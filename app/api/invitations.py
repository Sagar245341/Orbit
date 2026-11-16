import secrets
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy import or_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.rooms import add_room_member, serialize_invitation
from app.database.models import Room, RoomInvitation, RoomMember, User, as_utc, utc_now
from app.database.session import get_db
from app.schemas.schemas import (
    InvitationCreate,
    InvitationPreviewResponse,
    InvitationResponse,
    RoomResponse,
)

router = APIRouter(tags=["Room invitations"])
EXPIRATION_DELAYS = {
    "never": None,
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
}


def active_invitation(db: Session, invite_code: str, check_uses: bool = True) -> RoomInvitation:
    invitation = db.query(RoomInvitation).filter_by(invite_code=invite_code).first()
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    expires_at = invitation.expires_at
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= utc_now():
            raise HTTPException(status_code=410, detail="This invitation has expired")
    if not invitation.is_active:
        raise HTTPException(status_code=410, detail="This invitation has been revoked")
    if check_uses and invitation.max_uses is not None and invitation.used_count >= invitation.max_uses:
        raise HTTPException(status_code=410, detail="This invitation has reached its use limit")
    return invitation


def require_invitation_manager(db: Session, room_id: int, user_id: int) -> Room:
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    membership = db.query(RoomMember).filter_by(
        room_id=room_id, user_id=user_id
    ).first()
    if membership is None or membership.role not in ("owner", "moderator"):
        raise HTTPException(status_code=403, detail="Only room owners and moderators can manage invitations")
    return room


@router.post(
    "/rooms/{room_id}/invitations",
    response_model=InvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invitation(
    room_id: int,
    data: InvitationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_invitation_manager(db, room_id, current_user.id)
    delay = EXPIRATION_DELAYS[data.expiration]
    invitation = RoomInvitation(
        room_id=room_id,
        invite_code=secrets.token_urlsafe(9),
        created_by=current_user.id,
        expires_at=utc_now() + delay if delay else None,
        max_uses=data.max_uses,
        used_count=0,
        is_active=True,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return serialize_invitation(db, invitation)


@router.get("/rooms/{room_id}/invitations", response_model=list[InvitationResponse])
def list_invitations(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_invitation_manager(db, room_id, current_user.id)
    invitations = (
        db.query(RoomInvitation)
        .filter_by(room_id=room_id)
        .order_by(RoomInvitation.created_at.desc(), RoomInvitation.id.desc())
        .all()
    )
    return [serialize_invitation(db, invitation) for invitation in invitations]


@router.get("/invitations/{invite_code}", response_model=InvitationPreviewResponse)
def preview_invitation(
    invite_code: str = Path(min_length=8, max_length=32, pattern=r"^[A-Za-z0-9_-]+$"),
    db: Session = Depends(get_db),
):
    invitation = active_invitation(db, invite_code)
    room = db.get(Room, invitation.room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Invited room is no longer available")
    inviter = db.get(User, invitation.created_by)
    room_response = RoomResponse.model_validate(room).model_copy(update={
        "owner_username": room.owner.username,
        "is_member": False,
    })
    return InvitationPreviewResponse(
        invite_code=invitation.invite_code,
        room=room_response,
        inviter_username=inviter.username if inviter else "A room member",
        expires_at=as_utc(invitation.expires_at),
        max_uses=invitation.max_uses,
        used_count=invitation.used_count,
    )


@router.post("/invitations/{invite_code}/accept")
def accept_invitation(
    invite_code: str = Path(min_length=8, max_length=32, pattern=r"^[A-Za-z0-9_-]+$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invitation = active_invitation(db, invite_code, check_uses=False)
    room = db.get(Room, invitation.room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Invited room is no longer available")

    membership = db.query(RoomMember).filter_by(
        room_id=room.id, user_id=current_user.id
    ).first()
    if membership is not None:
        return {"message": f"You are already in {room.name}", "room_id": room.id, "already_member": True}

    now = utc_now()
    conditions = [
        RoomInvitation.id == invitation.id,
        RoomInvitation.is_active.is_(True),
        or_(
            RoomInvitation.max_uses.is_(None),
            RoomInvitation.used_count < RoomInvitation.max_uses,
        ),
        or_(
            RoomInvitation.expires_at.is_(None),
            RoomInvitation.expires_at > now,
        ),
    ]
    try:
        usage = db.execute(
            update(RoomInvitation)
            .where(*conditions)
            .values(used_count=RoomInvitation.used_count + 1)
            .execution_options(synchronize_session=False)
        )
        if usage.rowcount != 1:
            db.rollback()
            raise HTTPException(status_code=410, detail="This invitation is no longer available")
        add_room_member(db, room, current_user.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        membership = db.query(RoomMember).filter_by(
            room_id=room.id, user_id=current_user.id
        ).first()
        if membership is not None:
            return {"message": f"You are already in {room.name}", "room_id": room.id, "already_member": True}
        raise
    except HTTPException:
        db.rollback()
        raise
    return {"message": f"You joined {room.name}", "room_id": room.id, "already_member": False}


@router.delete("/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invitation(
    invitation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invitation = db.get(RoomInvitation, invitation_id)
    if invitation is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    require_invitation_manager(db, invitation.room_id, current_user.id)
    invitation.is_active = False
    db.commit()
