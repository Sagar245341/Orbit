from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.models import Channel, Message, Room, RoomMember, User
from app.database.session import get_db
from app.schemas.schemas import ChannelCreate, ChannelResponse, ChannelUpdate, MessageResponse

router = APIRouter(tags=["Channels"])


def require_room_membership(db: Session, room_id: int, user_id: int) -> RoomMember:
    if db.get(Room, room_id) is None:
        raise HTTPException(status_code=404, detail="Room not found")
    membership = db.query(RoomMember).filter_by(room_id=room_id, user_id=user_id).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Join this room before accessing its channels")
    return membership


def require_channel_access(db: Session, channel_id: int, user_id: int) -> tuple[Channel, RoomMember]:
    channel = db.get(Channel, channel_id)
    if channel is None or not channel.is_active:
        raise HTTPException(status_code=404, detail="Channel not found")
    membership = require_room_membership(db, channel.room_id, user_id)
    return channel, membership


def require_channel_manager(membership: RoomMember) -> None:
    if membership.role not in ("owner", "moderator"):
        raise HTTPException(status_code=403, detail="Only room owners and moderators can manage channels")


@router.get("/rooms/{room_id}/channels", response_model=list[ChannelResponse])
def list_channels(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_room_membership(db, room_id, current_user.id)
    return (
        db.query(Channel)
        .filter_by(room_id=room_id, is_active=True)
        .order_by(Channel.position, Channel.id)
        .all()
    )


@router.post(
    "/rooms/{room_id}/channels",
    response_model=ChannelResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_channel(
    room_id: int,
    data: ChannelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = require_room_membership(db, room_id, current_user.id)
    require_channel_manager(membership)
    position = (
        db.query(Channel.position)
        .filter_by(room_id=room_id, is_active=True)
        .order_by(Channel.position.desc())
        .first()
    )
    channel = Channel(
        room_id=room_id,
        name=data.name,
        topic=data.topic,
        category=data.category,
        position=(position[0] + 1) if position else 0,
    )
    db.add(channel)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A channel with this name already exists")
    db.refresh(channel)
    return channel


@router.patch("/channels/{channel_id}", response_model=ChannelResponse)
def update_channel(
    channel_id: int,
    data: ChannelUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    channel, membership = require_channel_access(db, channel_id, current_user.id)
    require_channel_manager(membership)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(channel, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="A channel with this name already exists")
    db.refresh(channel)
    return channel


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_channel(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    channel, membership = require_channel_access(db, channel_id, current_user.id)
    require_channel_manager(membership)
    active_count = db.query(Channel.id).filter_by(
        room_id=channel.room_id, is_active=True
    ).count()
    if active_count <= 1:
        raise HTTPException(status_code=409, detail="A room must keep at least one active channel")
    channel.is_active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/channels/{channel_id}/messages", response_model=list[MessageResponse])
def channel_messages(
    channel_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    channel, _ = require_channel_access(db, channel_id, current_user.id)
    limit = max(1, min(limit, 100))
    rows = (
        db.query(Message, User.username)
        .join(User, User.id == Message.sender_id)
        .filter(Message.channel_id == channel.id)
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
