import argparse
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import DateTime, create_engine, inspect, select, text
from sqlalchemy.engine import make_url

from app.database import models  # noqa: F401 - register all tables
from app.database.session import Base, migrate_legacy_room_schema


def _sqlite_file(database_url: str) -> Path:
    url = make_url(database_url)
    if url.get_backend_name() != "sqlite" or not url.database or url.database == ":memory:":
        raise ValueError("The source must be a file-backed SQLite database URL.")
    return Path(url.database).resolve()


def _backup_sqlite(source_path: Path, backup_path: Path) -> None:
    if not source_path.is_file():
        raise FileNotFoundError(f"SQLite source database does not exist: {source_path}")
    if source_path == backup_path:
        raise ValueError("The backup path must differ from the source database.")
    if backup_path.exists():
        raise FileExistsError(f"Refusing to overwrite existing backup: {backup_path}")

    backup_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with sqlite3.connect(str(source_path)) as source, sqlite3.connect(str(backup_path)) as backup:
            source.backup(backup)
            result = backup.execute("PRAGMA integrity_check").fetchone()
            if not result or result[0] != "ok":
                raise RuntimeError(f"SQLite backup integrity check failed: {result}")
    except Exception:
        backup_path.unlink(missing_ok=True)
        raise


def migrate_database(
    source_url: str,
    target_url: str,
    backup_path: Path | str,
) -> dict[str, int]:
    source_path = _sqlite_file(source_url)
    backup_path = Path(backup_path).resolve()
    if source_path == backup_path:
        raise ValueError("The backup path must differ from the source database.")
    if not source_path.is_file():
        raise FileNotFoundError(f"SQLite source database does not exist: {source_path}")

    source_engine = create_engine(source_url)
    target_engine = create_engine(target_url, pool_pre_ping=True)
    try:
        source_inspector = inspect(source_engine)
        source_tables = set(source_inspector.get_table_names())
        known_tables = set(Base.metadata.tables)
        unexpected = source_tables - known_tables - {"sqlite_sequence"}
        if unexpected:
            raise ValueError(
                "The SQLite database contains tables not managed by this application: "
                + ", ".join(sorted(unexpected))
            )
        unexpected_columns = []
        for table_name in source_tables & known_tables:
            actual_columns = {
                column["name"] for column in source_inspector.get_columns(table_name)
            }
            model_columns = {column.name for column in Base.metadata.tables[table_name].columns}
            unexpected_columns.extend(
                f"{table_name}.{column}" for column in actual_columns - model_columns
            )
        if unexpected_columns:
            raise ValueError(
                "The SQLite database contains columns not managed by this application: "
                + ", ".join(sorted(unexpected_columns))
            )

        target_tables = inspect(target_engine).get_table_names()
        if target_tables:
            raise RuntimeError(
                "The PostgreSQL target is not empty. No data was copied; choose an empty database."
            )

        _backup_sqlite(source_path, backup_path)
        Base.metadata.create_all(bind=source_engine)
        migrate_legacy_room_schema(source_engine)

        counts: dict[str, int] = {}
        with source_engine.connect() as source, target_engine.begin() as target:
            Base.metadata.create_all(bind=target)
            for table in Base.metadata.sorted_tables:
                rows = source.execute(select(table)).mappings()
                copied = 0
                while True:
                    batch = []
                    for row in rows.fetchmany(500):
                        values = dict(row)
                        for column in table.columns:
                            value = values.get(column.name)
                            if (
                                isinstance(column.type, DateTime)
                                and column.type.timezone
                                and isinstance(value, datetime)
                                and value.tzinfo is None
                            ):
                                values[column.name] = value.replace(tzinfo=timezone.utc)
                        batch.append(values)
                    if not batch:
                        break
                    target.execute(table.insert(), batch)
                    copied += len(batch)
                target_count = target.execute(
                    select(text("COUNT(*)")).select_from(table)
                ).scalar_one()
                if target_count != copied:
                    raise RuntimeError(
                        f"Row-count verification failed for {table.name}: "
                        f"source={copied}, target={target_count}"
                    )
                counts[table.name] = copied

                if (
                    target.dialect.name == "postgresql"
                    and "id" in table.c
                    and table.c.id.primary_key
                ):
                    quote = target.dialect.identifier_preparer.quote
                    quoted_table = quote(table.name)
                    quoted_id = quote("id")
                    target.execute(
                        text(
                            "SELECT setval("
                            "pg_get_serial_sequence(:table_name, :column_name), "
                            f"GREATEST(COALESCE((SELECT MAX({quoted_id}) "
                            f"FROM {quoted_table}), 1), 1), "
                            f"EXISTS (SELECT 1 FROM {quoted_table}))"
                        ),
                        {"table_name": table.name, "column_name": "id"},
                    )
        return counts
    finally:
        source_engine.dispose()
        target_engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Back up SQLite and copy Orbit data into an empty PostgreSQL database."
    )
    parser.add_argument(
        "--source",
        default=os.getenv("POSTGRES_MIGRATION_SOURCE_URL"),
        help="SQLite URL (defaults to POSTGRES_MIGRATION_SOURCE_URL).",
    )
    parser.add_argument(
        "--target",
        default=os.getenv("DATABASE_URL"),
        help="PostgreSQL URL (defaults to DATABASE_URL).",
    )
    parser.add_argument(
        "--backup",
        type=Path,
        help="Backup filename (defaults to <source>.pre-postgres-backup).",
    )
    args = parser.parse_args()
    if not args.source or not args.target:
        parser.error("Provide --source/--target or set their corresponding environment variables.")
    if make_url(args.target).get_backend_name() != "postgresql":
        parser.error("The migration target must be PostgreSQL.")

    source_path = _sqlite_file(args.source)
    backup_path = args.backup or source_path.with_name(source_path.name + ".pre-postgres-backup")
    counts = migrate_database(args.source, args.target, backup_path)
    print(f"SQLite backup created at: {backup_path.resolve()}")
    print("PostgreSQL migration completed. Verified rows by table:")
    for table, count in counts.items():
        print(f"  {table}: {count}")


if __name__ == "__main__":
    main()
