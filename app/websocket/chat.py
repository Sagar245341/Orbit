from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.database.session import SessionLocal
from app.database.models import Channel, User, Room, RoomMember, Message
from app.core.security import get_user_id_from_token
from app.services.redis_service import publish_channel_message
from app.websocket.connection_manager import manager

router = APIRouter()

@router.websocket("/ws/rooms/{room_id}")
async def room_chat(websocket: WebSocket, room_id: int):
    await _chat(websocket, room_id=room_id)


@router.websocket("/ws/channels/{channel_id}")
async def channel_chat(websocket: WebSocket, channel_id: int):
    await _chat(websocket, channel_id=channel_id)


async def _chat(websocket: WebSocket, room_id: int | None = None, channel_id: int | None = None):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Authentication token required")
        return

    try:
        user_id = get_user_id_from_token(token)
    except Exception:
        await websocket.close(code=1008, reason="Invalid or expired token")
        return

    db: Session = SessionLocal()
    try:
        user = db.get(User, user_id)
        if channel_id is not None:
            channel = db.get(Channel, channel_id)
        else:
            channel = db.query(Channel).filter_by(
                room_id=room_id, name="general", is_active=True
            ).first()
        room = db.get(Room, channel.room_id) if channel else None
        membership = (
            db.query(RoomMember).filter_by(room_id=room.id, user_id=user_id).first()
            if room else None
        )
        if user is None or room is None or channel is None or not channel.is_active or membership is None:
            await websocket.close(code=1008, reason="User or room access not found")
            return

        await manager.connect(channel.id, websocket)
        try:
            while True:
                data = await websocket.receive_json()
                db.refresh(channel)
                if not channel.is_active:
                    await websocket.close(code=1008, reason="This channel has been archived")
                    break
                content = data.get("content", "")
                if not isinstance(content, str):
                    await websocket.send_json({"type": "error", "detail": "Message content must be text"})
                    continue
                content = content.strip()
                if not content:
                    await websocket.send_json({"type": "error", "detail": "Message cannot be empty"})
                    continue
                if len(content) > 2000:
                    await websocket.send_json({"type": "error", "detail": "Message must be 2000 characters or fewer"})
                    continue

                message = Message(
                    sender_id=user_id,
                    room_id=room.id,
                    channel_id=channel.id,
                    content=content,
                )
                db.add(message)
                db.commit()
                db.refresh(message)

                payload = {
                    "type": "message",
                    "id": message.id,
                    "sender_id": user_id,
                    "sender_username": user.username,
                    "room_id": room.id,
                    "channel_id": channel.id,
                    "content": content,
                    "created_at": message.created_at.isoformat(),
                }
                # Redis Pub/Sub fans the message out to every FastAPI instance.
                await publish_channel_message(channel.id, payload)
        except WebSocketDisconnect:
            pass
        finally:
            await manager.disconnect(channel.id, websocket)
    finally:
        db.close()
