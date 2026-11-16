import pytest
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import Session

from app.database.models import Message, Room, RoomMember, User
from app.database.session import Base
from scripts.migrate_sqlite_to_postgres import migrate_database


def test_migration_backs_up_and_preserves_existing_rows(tmp_path):
    source_path = tmp_path / "source.db"
    target_path = tmp_path / "target.db"
    backup_path = tmp_path / "backups" / "source.db.backup"
    source_engine = create_engine(f"sqlite:///{source_path}")
    Base.metadata.create_all(source_engine)
    with Session(source_engine) as db:
        owner = User(id=17, username="owner", email="owner@example.test", password_hash="hash")
        room = Room(id=23, name="Legacy room", created_by=17)
        db.add_all([owner, room])
        db.flush()
        db.add(RoomMember(id=31, room_id=23, user_id=17, role="owner"))
        db.add(Message(id=41, room_id=23, sender_id=17, content="Keep this history"))
        db.commit()
    source_engine.dispose()

    counts = migrate_database(
        f"sqlite:///{source_path}",
        f"sqlite:///{target_path}",
        backup_path,
    )

    assert backup_path.is_file()
    assert counts["users"] == 1
    assert counts["rooms"] == 1
    assert counts["room_members"] == 1
    assert counts["messages"] == 1
    backup_engine = create_engine(f"sqlite:///{backup_path}")
    target_engine = create_engine(f"sqlite:///{target_path}")
    assert inspect(backup_engine).has_table("messages")
    with Session(target_engine) as db:
        message = db.scalar(select(Message).where(Message.id == 41))
        assert message is not None
        assert message.content == "Keep this history"
        assert message.channel_id is not None
        assert db.get(RoomMember, 31).role == "owner"
    backup_engine.dispose()
    target_engine.dispose()


def test_migration_refuses_nonempty_target_without_overwriting_backup(tmp_path):
    source_path = tmp_path / "source.db"
    target_path = tmp_path / "target.db"
    backup_path = tmp_path / "backup.db"
    source_engine = create_engine(f"sqlite:///{source_path}")
    Base.metadata.create_all(source_engine)
    source_engine.dispose()
    target_engine = create_engine(f"sqlite:///{target_path}")
    with target_engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE unrelated (id INTEGER PRIMARY KEY)")
    target_engine.dispose()

    with pytest.raises(RuntimeError, match="target is not empty"):
        migrate_database(
            f"sqlite:///{source_path}",
            f"sqlite:///{target_path}",
            backup_path,
        )

    assert not backup_path.exists()


def test_migration_does_not_create_a_missing_sqlite_source(tmp_path):
    source_path = tmp_path / "missing.db"
    target_path = tmp_path / "target.db"
    backup_path = tmp_path / "backup.db"

    with pytest.raises(FileNotFoundError, match="source database does not exist"):
        migrate_database(
            f"sqlite:///{source_path}",
            f"sqlite:///{target_path}",
            backup_path,
        )

    assert not source_path.exists()
    assert not backup_path.exists()
