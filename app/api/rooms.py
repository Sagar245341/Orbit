from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models import User, Room, RoomMember, Message
from app.schemas.schemas import RoomCreate, RoomResponse, MessageResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/rooms", tags=["Chat rooms"])

def require_membership(db: Session, room_id: int, user_id: int):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    membership = db.query(RoomMember).filter_by(room_id=room_id, user_id=user_id).first()
    if membership is None:
        raise HTTPException(status_code=403, detail="Join this room before accessing it")
    return room

@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    data: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = Room(name=data.name.strip(), created_by=current_user.id)
    db.add(room)
    db.flush()
    db.add(RoomMember(room_id=room.id, user_id=current_user.id))
    db.commit()
    db.refresh(room)
    return room

@router.get("", response_model=list[RoomResponse])
def list_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # All rooms are discoverable; membership is still required to read or chat.
    return db.query(Room).order_by(Room.id.desc()).all()

@router.post("/{room_id}/join")
def join_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = db.get(Room, room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    membership = db.query(RoomMember).filter_by(room_id=room_id, user_id=current_user.id).first()
    if membership is None:
        db.add(RoomMember(room_id=room_id, user_id=current_user.id))
        db.commit()
    return {"message": f"You joined {room.name}", "room_id": room_id}

@router.get("/{room_id}/messages", response_model=list[MessageResponse])
def get_messages(
    room_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_membership(db, room_id, current_user.id)
    limit = max(1, min(limit, 100))
    rows = (
        db.query(Message, User.username)
        .join(User, User.id == Message.sender_id)
        .filter(Message.room_id == room_id)
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
            content=message.content,
            created_at=message.created_at,
            sender_username=username,
        )
        for message, username in rows
    ]
