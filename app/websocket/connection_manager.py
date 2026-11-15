from collections import defaultdict
from fastapi import WebSocket
import asyncio

class ConnectionManager:
    def __init__(self):
        self.rooms: dict[int, set[WebSocket]] = defaultdict(set)
        self.lock = asyncio.Lock()

    async def connect(self, room_id: int, websocket: WebSocket):
        await websocket.accept()
        async with self.lock:
            self.rooms[room_id].add(websocket)

    async def disconnect(self, room_id: int, websocket: WebSocket):
        async with self.lock:
            self.rooms[room_id].discard(websocket)
            if not self.rooms[room_id]:
                self.rooms.pop(room_id, None)

    async def broadcast_local(self, room_id: int, message: dict):
        async with self.lock:
            sockets = list(self.rooms.get(room_id, set()))
        stale = []
        for socket in sockets:
            try:
                await socket.send_json(message)
            except Exception:
                stale.append(socket)
        for socket in stale:
            await self.disconnect(room_id, socket)

manager = ConnectionManager()
