from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from fastapi import Depends, FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.api import invitations, rooms
from app.api.deps import get_current_user
from app.database.models import Channel, Room, RoomInvitation, User
from app.database.session import Base, get_db, migrate_legacy_room_schema


@pytest.fixture
def api(tmp_path):
    database = tmp_path / "rooms-test.db"
    engine = create_engine(
        f"sqlite:///{database}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    test_sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    state = SimpleNamespace(user_id=1)

    def override_db():
        db = test_sessions()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(rooms.router, prefix="/api")
    app.include_router(invitations.router, prefix="/api")
    app.dependency_overrides[get_db] = override_db

    def current_user(request: Request, db=Depends(get_db)):
        user_id = int(request.headers.get("x-test-user", state.user_id))
        return db.get(User, user_id)

    app.dependency_overrides[get_current_user] = current_user
    with test_sessions() as db:
        db.add_all([
            User(id=1, username="owner", email="owner@example.test", password_hash="unused"),
            User(id=2, username="member", email="member@example.test", password_hash="unused"),
            User(id=3, username="guest", email="guest@example.test", password_hash="unused"),
        ])
        db.commit()
    client = TestClient(app)
    yield client, state, test_sessions
    engine.dispose()


def create_room(client, **fields):
    response = client.post("/api/rooms", json={"name": "Developers", **fields})
    assert response.status_code == 201, response.text
    return response.json()


def create_invitation(client, room_id, **options):
    response = client.post(f"/api/rooms/{room_id}/invitations", json=options)
    assert response.status_code == 201, response.text
    return response.json()


def test_room_creation_assigns_owner_and_creates_shareable_invitation(api):
    client, _, sessions = api
    room = create_room(client, description="A coding community", category="Technology")

    assert room["owner_id"] == 1
    assert room["created_by"] == 1
    assert room["member_count"] == 1
    assert room["room_type"] == "public"
    assert room["invite_code"]
    assert room["invite_url"].endswith(f"/invite/{room['invite_code']}")
    with sessions() as db:
        assert db.query(Channel).filter_by(room_id=room["id"], name="general").one()
    assert client.post("/api/rooms", json={
        "name": "Bad icon",
        "icon_url": "javascript:alert(1)",
    }).status_code == 422


def test_discovery_searches_public_rooms_and_never_lists_private_rooms(api):
    client, _, _ = api
    public = create_room(
        client,
        description="Talk about backend systems",
        category="Technology",
    )
    create_room(client, name="Secret Lounge", room_type="private", category="Technology")

    response = client.get("/api/rooms/discover", params={"q": "backend", "category": "technology"})
    assert response.status_code == 200
    result = response.json()
    assert result["total"] == 1
    assert [item["id"] for item in result["items"]] == [public["id"]]
    assert client.get("/api/rooms/discover", params={"q": "Secret Lounge"}).json()["total"] == 0


def test_public_join_is_idempotent_and_member_limit_is_enforced(api):
    client, state, _ = api
    room = create_room(client)
    state.user_id = 2
    joined = client.post(f"/api/rooms/{room['id']}/join")
    assert joined.status_code == 200
    assert joined.json()["already_member"] is False
    assert client.post(f"/api/rooms/{room['id']}/join").json()["already_member"] is True

    state.user_id = 1
    limited = create_room(client, name="One Person", max_members=1)
    state.user_id = 3
    full = client.post(f"/api/rooms/{limited['id']}/join")
    assert full.status_code == 409
    assert full.json()["detail"] == "This room is full"


def test_invitation_preview_is_validated_and_does_not_expose_email(api):
    client, _, _ = api
    room = create_room(client, description="A welcome space")

    preview = client.get(f"/api/invitations/{room['invite_code']}")
    assert preview.status_code == 200
    assert preview.json()["room"]["name"] == "Developers"
    assert preview.json()["inviter_username"] == "owner"
    assert "email" not in preview.text
    assert client.get("/api/invitations/not-a-real-code").status_code == 404


def test_expired_and_revoked_invitations_cannot_be_used(api):
    client, state, sessions = api
    room = create_room(client, room_type="private")
    expiring = create_invitation(client, room["id"], expiration="1h")
    with sessions() as db:
        invitation = db.get(RoomInvitation, expiring["id"])
        invitation.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    assert client.get(f"/api/invitations/{expiring['invite_code']}").status_code == 410
    state.user_id = 2
    assert client.post(f"/api/invitations/{expiring['invite_code']}/accept").status_code == 410

    state.user_id = 1
    revoked = create_invitation(client, room["id"])
    assert client.delete(f"/api/invitations/{revoked['id']}").status_code == 204
    assert client.get(f"/api/invitations/{revoked['invite_code']}").status_code == 410
    state.user_id = 3
    assert client.post(f"/api/invitations/{revoked['invite_code']}/accept").status_code == 410


def test_invitation_use_limit_and_duplicate_membership(api):
    client, state, _ = api
    room = create_room(client, room_type="private")
    invitation = create_invitation(client, room["id"], max_uses=1)

    state.user_id = 2
    accepted = client.post(f"/api/invitations/{invitation['invite_code']}/accept")
    assert accepted.status_code == 200
    assert accepted.json()["already_member"] is False
    duplicate = client.post(f"/api/invitations/{invitation['invite_code']}/accept")
    assert duplicate.status_code == 200
    assert duplicate.json()["already_member"] is True

    state.user_id = 3
    limited = client.post(f"/api/invitations/{invitation['invite_code']}/accept")
    assert limited.status_code == 410
    assert client.get(f"/api/rooms/{room['id']}").status_code == 403


def test_simultaneous_accepts_cannot_exceed_invitation_use_limit(api):
    from concurrent.futures import ThreadPoolExecutor

    client, _, sessions = api
    room = create_room(client, room_type="private")
    invitation = create_invitation(client, room["id"], max_uses=1)

    def accept(user_id):
        return client.post(
            f"/api/invitations/{invitation['invite_code']}/accept",
            headers={"x-test-user": str(user_id)},
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(accept, (2, 3)))

    assert sorted(response.status_code for response in responses) == [200, 410]
    with sessions() as db:
        stored_invitation = db.get(RoomInvitation, invitation["id"])
        stored_room = db.get(Room, room["id"])
        assert stored_invitation.used_count == 1
        assert stored_room.member_count == 2


def test_private_room_requires_invitation_and_invitation_join_works(api):
    client, state, _ = api
    room = create_room(client, room_type="private")
    assert client.post(f"/api/rooms/{room['id']}/join").status_code == 403
    invitation = create_invitation(client, room["id"])
    state.user_id = 2
    assert client.post(f"/api/invitations/{invitation['invite_code']}/accept").status_code == 200
    assert client.get(f"/api/rooms/{room['id']}").status_code == 200


def test_non_moderator_cannot_create_or_revoke_invitations(api):
    client, state, _ = api
    room = create_room(client)
    invitation_id = create_invitation(client, room["id"])["id"]
    state.user_id = 2
    assert client.post(f"/api/rooms/{room['id']}/join").status_code == 200
    assert client.post(f"/api/rooms/{room['id']}/invitations", json={}).status_code == 403
    assert client.delete(f"/api/invitations/{invitation_id}").status_code == 403
    assert client.get(f"/api/rooms/{room['id']}/invitations").status_code == 403


def test_additive_migration_preserves_legacy_room_and_membership_data(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'legacy.db'}",
        connect_args={"check_same_thread": False},
    )
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(40) NOT NULL, "
            "email VARCHAR(255) NOT NULL, password_hash VARCHAR(255) NOT NULL, created_at DATETIME)"
        ))
        connection.execute(text(
            "CREATE TABLE rooms (id INTEGER PRIMARY KEY, name VARCHAR(80) NOT NULL, "
            "created_by INTEGER NOT NULL, created_at DATETIME NOT NULL)"
        ))
        connection.execute(text(
            "CREATE TABLE room_members (id INTEGER PRIMARY KEY, room_id INTEGER NOT NULL, "
            "user_id INTEGER NOT NULL, joined_at DATETIME NOT NULL, "
            "CONSTRAINT uq_room_member UNIQUE(room_id, user_id))"
        ))
        connection.execute(text(
            "CREATE TABLE messages (id INTEGER PRIMARY KEY, sender_id INTEGER NOT NULL, "
            "room_id INTEGER NOT NULL, content TEXT NOT NULL, created_at DATETIME NOT NULL)"
        ))
        connection.execute(text(
            "INSERT INTO users VALUES (1, 'legacy', 'legacy@example.test', 'unused', CURRENT_TIMESTAMP)"
        ))
        connection.execute(text(
            "INSERT INTO rooms VALUES (7, 'Old room', 1, CURRENT_TIMESTAMP)"
        ))
        connection.execute(text(
            "INSERT INTO messages VALUES (11, 1, 7, 'Preserved history', CURRENT_TIMESTAMP)"
        ))
    Base.metadata.create_all(bind=engine)
    migrate_legacy_room_schema(engine)
    with engine.connect() as connection:
        room = connection.execute(text(
            "SELECT id, room_type, member_count, description FROM rooms WHERE id = 7"
        )).one()
        membership = connection.execute(text(
            "SELECT user_id, role FROM room_members WHERE room_id = 7"
        )).one()
        channel = connection.execute(text(
            "SELECT id, name FROM channels WHERE room_id = 7"
        )).one()
        message = connection.execute(text(
            "SELECT channel_id, content FROM messages WHERE id = 11"
        )).one()
    assert tuple(room) == (7, "public", 1, "")
    assert tuple(membership) == (1, "owner")
    assert tuple(channel)[1] == "general"
    assert tuple(message) == (channel.id, "Preserved history")
    engine.dispose()
