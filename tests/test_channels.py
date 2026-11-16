from types import SimpleNamespace

from fastapi import Depends, FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api import channels
from app.api.deps import get_current_user
from app.database.models import Channel, Message, Room, RoomMember, User
from app.database.session import Base, get_db


def build_api(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'channels.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    test_sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    state = SimpleNamespace(user_id=1)

    def override_db():
        db = test_sessions()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(channels.router, prefix="/api")
    app.dependency_overrides[get_db] = override_db

    def current_user(request: Request, db=Depends(get_db)):
        return db.get(User, int(request.headers.get("x-test-user", state.user_id)))

    app.dependency_overrides[get_current_user] = current_user
    with test_sessions() as db:
        db.add_all([
            User(id=1, username="owner", email="owner@example.test", password_hash="unused"),
            User(id=2, username="member", email="member@example.test", password_hash="unused"),
            User(id=3, username="moderator", email="moderator@example.test", password_hash="unused"),
            User(id=4, username="guest", email="guest@example.test", password_hash="unused"),
        ])
        room = Room(id=1, name="Community", created_by=1)
        db.add(room)
        db.flush()
        db.add_all([
            RoomMember(room_id=1, user_id=1, role="owner"),
            RoomMember(room_id=1, user_id=2, role="member"),
            RoomMember(room_id=1, user_id=3, role="moderator"),
            Channel(room_id=1, name="general", position=0),
        ])
        db.commit()
    return TestClient(app), state, test_sessions, engine


def test_channel_roles_and_lifecycle(tmp_path):
    client, state, sessions, engine = build_api(tmp_path)

    assert client.get("/api/rooms/1/channels").json()[0]["name"] == "general"
    assert client.get("/api/rooms/1/channels", headers={"x-test-user": "4"}).status_code == 403
    assert client.post("/api/rooms/1/channels", json={"name": "announcements"}, headers={
        "x-test-user": "2",
    }).status_code == 403

    created = client.post("/api/rooms/1/channels", json={
        "name": "announcements",
        "topic": "Important updates",
        "category": "Community",
    })
    assert created.status_code == 201, created.text
    channel_id = created.json()["id"]
    with sessions() as db:
        db.add(Message(
            sender_id=1,
            room_id=1,
            channel_id=channel_id,
            content="Channel history",
        ))
        db.commit()
    assert client.get(f"/api/channels/{channel_id}/messages").json()[0]["content"] == "Channel history"
    assert client.get(f"/api/channels/{channel_id}/messages", headers={
        "x-test-user": "4",
    }).status_code == 403
    state.user_id = 3
    assert client.patch(f"/api/channels/{channel_id}", json={"name": "news"}).status_code == 200
    state.user_id = 1
    assert client.delete(f"/api/channels/{channel_id}").status_code == 204
    assert [channel["name"] for channel in client.get("/api/rooms/1/channels").json()] == ["general"]
    assert client.delete("/api/channels/1").status_code == 409

    with sessions() as db:
        archived = db.get(Channel, channel_id)
        assert archived is not None and not archived.is_active
    engine.dispose()
