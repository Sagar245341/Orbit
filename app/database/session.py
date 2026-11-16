from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def migrate_legacy_room_schema(target_engine=engine):
    inspector = inspect(target_engine)
    if "rooms" not in inspector.get_table_names():
        return

    if "channels" not in inspector.get_table_names():
        from app.database.models import Channel
        Channel.__table__.create(target_engine, checkfirst=True)

    inspector = inspect(target_engine)
    room_columns = {column["name"] for column in inspector.get_columns("rooms")}
    member_columns = {column["name"] for column in inspector.get_columns("room_members")}
    timestamp_type = (
        "TIMESTAMP WITH TIME ZONE"
        if target_engine.dialect.name == "postgresql"
        else "DATETIME"
    )
    room_additions = {
        "description": "TEXT NOT NULL DEFAULT ''",
        "icon_url": "VARCHAR(500)",
        "room_type": "VARCHAR(10) NOT NULL DEFAULT 'public'",
        "category": "VARCHAR(60)",
        "max_members": "INTEGER",
        "member_count": "INTEGER NOT NULL DEFAULT 0",
        "updated_at": timestamp_type,
    }

    with target_engine.begin() as connection:
        for column, definition in room_additions.items():
            if column not in room_columns:
                connection.execute(text(f"ALTER TABLE rooms ADD COLUMN {column} {definition}"))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_rooms_room_type ON rooms (room_type)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_rooms_category ON rooms (category)"
        ))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_rooms_created_by ON rooms (created_by)"
        ))
        if "role" not in member_columns:
            connection.execute(text(
                "ALTER TABLE room_members ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'member'"
            ))
        if "messages" in inspector.get_table_names():
            message_columns = {
                column["name"] for column in inspector.get_columns("messages")
            }
            if "channel_id" not in message_columns:
                connection.execute(text(
                    "ALTER TABLE messages ADD COLUMN channel_id INTEGER "
                    "REFERENCES channels(id) ON DELETE SET NULL"
                ))
            connection.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_messages_channel_id ON messages (channel_id)"
            ))
        connection.execute(text(
            "INSERT INTO channels "
            "(room_id, name, topic, category, position, is_active, created_at, updated_at) "
            "SELECT rooms.id, 'general', '', NULL, 0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
            "FROM rooms WHERE NOT EXISTS ("
            "SELECT 1 FROM channels WHERE channels.room_id = rooms.id "
            "AND channels.name = 'general') "
            "ON CONFLICT (room_id, name) DO NOTHING"
        ))
        if "messages" in inspector.get_table_names():
            connection.execute(text(
                "UPDATE messages SET channel_id = ("
                "SELECT channels.id FROM channels "
                "WHERE channels.room_id = messages.room_id AND channels.name = 'general' "
                "AND channels.is_active = TRUE LIMIT 1) "
                "WHERE channel_id IS NULL"
            ))
        connection.execute(text(
            "UPDATE rooms SET member_count = "
            "(SELECT COUNT(*) FROM room_members WHERE room_members.room_id = rooms.id)"
        ))
        connection.execute(text(
            "UPDATE rooms SET updated_at = created_at WHERE updated_at IS NULL"
        ))
        connection.execute(text(
            "UPDATE room_members SET role = 'owner' "
            "WHERE EXISTS (SELECT 1 FROM rooms "
            "WHERE rooms.id = room_members.room_id AND rooms.created_by = room_members.user_id)"
        ))
        connection.execute(text(
            "INSERT INTO room_members (room_id, user_id, role, joined_at) "
            "SELECT rooms.id, rooms.created_by, 'owner', CURRENT_TIMESTAMP FROM rooms "
            "WHERE NOT EXISTS (SELECT 1 FROM room_members "
            "WHERE room_members.room_id = rooms.id AND room_members.user_id = rooms.created_by)"
        ))
        connection.execute(text(
            "UPDATE rooms SET member_count = "
            "(SELECT COUNT(*) FROM room_members WHERE room_members.room_id = rooms.id)"
        ))
