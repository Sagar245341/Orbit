import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware
from app.database.session import Base, engine
from app.database import models  # noqa: F401 - registers SQLAlchemy models
from app.api import auth, rooms
from app.core.config import OAUTH_COOKIE_SECURE, SECRET_KEY
from app.websocket.chat import router as websocket_router
from app.websocket.connection_manager import manager
from app.services.redis_service import connect_redis, close_redis, listen_for_messages

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_BUILD_DIR = FRONTEND_DIR / "dist"


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as error:
            if error.status_code != 404 or scope["path"].startswith(("/api", "/ws", "/static")):
                raise
            return await super().get_response("index.html", scope)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    await connect_redis()
    listener_task = asyncio.create_task(listen_for_messages(manager))
    app.state.redis_listener_task = listener_task
    try:
        yield
    finally:
        listener_task.cancel()
        with suppress(asyncio.CancelledError):
            await listener_task
        await close_redis()

app = FastAPI(
    title="WebSocket Chat App",
    description="Beginner-friendly real-time chat application using FastAPI, WebSockets and Redis.",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    SessionMiddleware,
    secret_key=SECRET_KEY,
    same_site="lax",
    https_only=OAUTH_COOKIE_SECURE,
)

app.include_router(auth.router, prefix="/api")
app.include_router(rooms.router, prefix="/api")
app.include_router(websocket_router)
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

@app.get("/", include_in_schema=False)
def home():
    built_index = FRONTEND_BUILD_DIR / "index.html"
    fallback_index = FRONTEND_DIR / "legacy.html"
    return FileResponse(built_index if built_index.is_file() else fallback_index)

@app.get("/health")
def health():
    return {"status": "ok"}

if FRONTEND_BUILD_DIR.is_dir():
    app.mount("/", SPAStaticFiles(directory=FRONTEND_BUILD_DIR, html=True), name="frontend")
