import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import FRONTEND_BASE_URL
from app.database.models import Channel, Message, Room, RoomInvitation, RoomMember, User, as_utc
from app.database.session import get_db
from app.schemas.schemas import (
    InvitationResponse,
    MessageResponse,
    RoomCreate,
    RoomCreatedResponse,
    RoomMemberResponse,
    RoomPageResponse,
    RoomResponse,
)

router = APIRouter(prefix="/rooms", tags=["Chat rooms"])


def require_membership(db: Session, room_id: int, user_id: int):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    membership = db.query(RoomMember).filter_by(room_id=room_id, user_id=user_id).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Join this room before accessing it")
    return room, membership


def serialize_room(db: Session, room: Room, user_id: int) -> RoomResponse:
    result = RoomResponse.model_validate(room)
    membership = db.query(RoomMember).filter_by(
        room_id=room.id, user_id=user_id
    ).first()
    return result.model_copy(update={
        "owner_username": room.owner.username,
        "is_member": membership is not None,
        "current_user_role": membership.role if membership else None,
    })


def serialize_invitation(db: Session, invitation: RoomInvitation) -> InvitationResponse:
    creator = db.get(User, invitation.created_by)
    return InvitationResponse(
        id=invitation.id,
        room_id=invitation.room_id,
        invite_code=invitation.invite_code,
        invite_url=f"{FRONTEND_BASE_URL}/invite/{invitation.invite_code}",
        created_by=invitation.created_by,
        inviter_username=creator.username if creator else "A room member",
        expires_at=as_utc(invitation.expires_at),
        max_uses=invitation.max_uses,
        used_count=invitation.used_count,
        is_active=invitation.is_active,
        created_at=as_utc(invitation.created_at),
    )


def add_room_member(db: Session, room: Room, user_id: int, role: str = "member") -> None:
    """Reserve a member slot and add membership in the same transaction."""
    reservation = db.execute(
        update(Room)
        .where(
            Room.id == room.id,
            or_(Room.max_members.is_(None), Room.member_count < Room.max_members),
        )
        .values(member_count=Room.member_count + 1)
        .execution_options(synchronize_session=False)
    )
    if reservation.rowcount != 1:
        raise HTTPException(status_code=409, detail="This room is full")
    db.add(RoomMember(room_id=room.id, user_id=user_id, role=role))


@router.post("", response_model=RoomCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    data: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = Room(
        name=data.name,
        description=data.description.strip(),
        icon_url=data.icon_url,
        room_type=data.room_type,
        category=data.category,
        max_members=data.max_members,
        created_by=current_user.id,
        member_count=1,
    )
    db.add(room)
    db.flush()
    db.add(RoomMember(room_id=room.id, user_id=current_user.id, role="owner"))
    db.add(Channel(room_id=room.id, name="general", position=0))
    invitation = RoomInvitation(
        room_id=room.id,
        invite_code=secrets.token_urlsafe(9),
        created_by=current_user.id,
        expires_at=None,
        max_uses=None,
        used_count=0,
        is_active=True,
    )
    db.add(invitation)
    db.commit()
    db.refresh(room)
    db.refresh(invitation)
    payload = serialize_room(db, room, current_user.id).model_dump()
    payload.update({
        "invite_code": invitation.invite_code,
        "invite_url": f"{FRONTEND_BASE_URL}/invite/{invitation.invite_code}",
    })
    return payload


@router.get("", response_model=list[RoomResponse])
def list_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rooms = (
        db.query(Room)
        .join(RoomMember, RoomMember.room_id == Room.id)
        .filter(RoomMember.user_id == current_user.id)
        .order_by(Room.id.desc())
        .all()
    )
    return [serialize_room(db, room, current_user.id) for room in rooms]


@router.get("/discover", response_model=RoomPageResponse)
def discover_rooms(
    q: str = Query(default="", max_length=100),
    category: str | None = Query(default=None, max_length=60),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Room).filter(Room.room_type == "public")
    search = q.strip()
    if search:
        pattern = f"%{search}%"
        query = query.filter(or_(Room.name.ilike(pattern), Room.description.ilike(pattern)))
    if category and category.strip():
        query = query.filter(Room.category.ilike(category.strip()))
    total = query.count()
    rooms = (
        query.order_by(Room.member_count.desc(), Room.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return RoomPageResponse(
        items=[serialize_room(db, room, current_user.id) for room in rooms],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    is_member = db.query(RoomMember.id).filter_by(
        room_id=room_id, user_id=current_user.id
    ).first() is not None
    if room.room_type == "private" and not is_member:
        raise HTTPException(status_code=403, detail="Private room details are only available to members")
    return serialize_room(db, room, current_user.id)


@router.post("/{room_id}/join")
def join_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.room_type != "public":
        raise HTTPException(status_code=403, detail="Private rooms require an invitation")
    membership = db.query(RoomMember).filter_by(
        room_id=room_id, user_id=current_user.id
    ).first()
    if membership is not None:
        return {"message": f"You are already in {room.name}", "room_id": room_id, "already_member": True}
    try:
        add_room_member(db, room, current_user.id)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        membership = db.query(RoomMember).filter_by(
            room_id=room_id, user_id=current_user.id
        ).first()
        if membership is not None:
            return {"message": f"You are already in {room.name}", "room_id": room_id, "already_member": True}
        raise
    return {"message": f"You joined {room.name}", "room_id": room_id, "already_member": False}


@router.get("/{room_id}/members", response_model=list[RoomMemberResponse])
def get_room_members(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, room_id, current_user.id)
    rows = (
        db.query(RoomMember, User.username)
        .join(User, User.id == RoomMember.user_id)
        .filter(RoomMember.room_id == room_id)
        .order_by(RoomMember.joined_at, RoomMember.id)
        .all()
    )
    return [
        RoomMemberResponse(
            id=member.user_id,
            username=username,
            role=member.role,
            joined_at=member.joined_at,
        )
        for member, username in rows
    ]


@router.get("/{room_id}/messages", response_model=list[MessageResponse])
def get_messages(
    room_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, room_id, current_user.id)
    limit = max(1, min(limit, 100))
    general_channel = db.query(Channel).filter_by(
        room_id=room_id, name="general", is_active=True
    ).first()
    if general_channel is None:
        return []
    rows = (
        db.query(Message, User.username)
        .join(User, User.id == Message.sender_id)
        .filter(Message.room_id == room_id, Message.channel_id == general_channel.id)
        .order_by(Message.id.desc())
        .limit(limit)
        .all()
    )
    rows.reverse()
    return [
        MessageResponse(
            id=message.id,
            sender_id=message.sender_id,
            room_id=message.room_id,
            channel_id=message.channel_id,
            content=message.content,
            created_at=message.created_at,
            sender_username=username,
        )
        for message, username in rows
    ]
