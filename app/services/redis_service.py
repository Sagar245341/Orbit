import asyncio
import json
from redis.asyncio import Redis
from app.core.config import REDIS_URL

redis_client: Redis | None = None

async def connect_redis():
    global redis_client
    redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
    await redis_client.ping()
    return redis_client

async def close_redis():
    global redis_client
    if redis_client is not None:
        await redis_client.aclose()
        redis_client = None

async def publish_room_message(room_id: int, message: dict):
    if redis_client is None:
        raise RuntimeError("Redis is not connected")
    await redis_client.publish(f"chat:room:{room_id}", json.dumps(message, default=str))

async def listen_for_messages(manager):
    """Subscribe to every room channel and deliver messages to this server's local sockets."""
    if redis_client is None:
        raise RuntimeError("Redis is not connected")
    pubsub = redis_client.pubsub()
    await pubsub.psubscribe("chat:room:*")
    try:
        async for event in pubsub.listen():
            if event["type"] != "pmessage":
                continue
            try:
                channel = event["channel"]
                room_id = int(channel.rsplit(":", 1)[1])
                payload = json.loads(event["data"])
                await manager.broadcast_local(room_id, payload)
            except (ValueError, TypeError, json.JSONDecodeError):
                # Ignore malformed broker messages rather than killing the listener.
                continue
    finally:
        await pubsub.aclose()
