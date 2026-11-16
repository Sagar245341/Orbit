# Orbit

<p align="center">
  <img src="docs/orbit-banner.svg" alt="Orbit community chat project banner" width="100%" />
</p>

[![CI](https://github.com/Sagar245341/Orbit/actions/workflows/ci.yml/badge.svg)](https://github.com/Sagar245341/Orbit/actions/workflows/ci.yml)

Orbit is a real-time community chat application. This milestone keeps the existing FastAPI authentication and WebSocket/Redis messaging, adds PostgreSQL as the production database, and introduces rooms, text channels, invitations, and public room discovery. The React frontend is being migrated incrementally to TypeScript; active entry points, contexts, API services, and the chat/channel flow are typed while the existing JSX components remain in use.

## Features

- JWT-based registration, sign-in, email verification, and OAuth support.
- Public and private rooms with descriptions, icons, categories, member limits, owners, and moderators.
- Text channels with topics and categories; owners/moderators can create, edit, and archive channels.
- Existing room messages are assigned to a `general` channel during the additive schema upgrade.
- Authenticated WebSocket chat backed by Redis Pub/Sub, with a legacy room WebSocket route retained.
- Shareable invitations with expiry, use limits, revocation, and authenticated acceptance.
- Public room discovery, room details, membership lists, and responsive dark-themed navigation.

Voice/video, direct messages, file uploads, rich notifications, and online presence are separate milestones and are not represented as working features in this delivery.

## Screenshots

The banner above is an original project illustration. Application screenshots can be added here after running the frontend against a configured local database; no sample room data is presented as live application content.

## Architecture

```text
React 18 + Vite + TypeScript (incremental conversion)
        | HTTP: Axios + bearer JWT       | WebSocket: bearer JWT
        v                                 v
FastAPI REST API                    FastAPI WebSocket
        |                                 |
        +---------- SQLAlchemy -----------+
                    PostgreSQL
        WebSocket events via Redis Pub/Sub
```

The browser development server proxies `/api` and `/ws` to FastAPI. In production, the backend can serve the Vite build and client-side routes. SQLAlchemy supports both the legacy SQLite database and PostgreSQL; new deployments use PostgreSQL. Existing SQLite data is copied only by the explicit migration command described below.

## Data model

- `users`: accounts, credentials, and profile identity.
- `rooms`: community metadata and owner; the historical `created_by` column remains the stored owner ID and is exposed as `owner_id`.
- `room_members`: unique room/user memberships and `owner`, `moderator`, or `member` roles.
- `channels`: room-scoped text channels, category, topic, order, and active/archive status.
- `room_invitations`: unique, unpredictable invitation codes, expiration, usage limit/count, creator, and active status.
- `messages`: existing chat history, now associated with a channel. `room_id` remains for compatibility and access checks.

On startup, SQLAlchemy creates missing tables and an idempotent additive migration updates older SQLite schemas. Existing room and message IDs are retained, room creators are backfilled as owners, member counts are recomputed, each room receives a `general` channel, and old messages are associated with it. No existing table is dropped or recreated.

### SQLite-to-PostgreSQL migration

The migration command makes a SQLite online backup, checks that the PostgreSQL target has no tables, applies only the app's additive legacy-schema upgrades, copies rows in foreign-key order, repairs PostgreSQL ID sequences, and verifies per-table row counts. It refuses to overwrite a backup or copy into a non-empty target. The exact pre-upgrade source is retained in the backup; the migration has not been run against the local database automatically.

1. Copy `.env.example` to `.env`, set a private `SECRET_KEY` and a strong URL-safe PostgreSQL password (letters, digits, hyphens, and underscores avoid URI escaping issues).
2. Start the PostgreSQL service:

   ```powershell
   docker compose up -d postgres
   ```

3. If you have an existing `chat.db`, migrate it from the repository root. Set the target URL to the host-accessible PostgreSQL address; the example below uses placeholders, not actual credentials:

   ```powershell
   $env:POSTGRES_MIGRATION_SOURCE_URL = "sqlite:///./chat.db"
   $env:DATABASE_URL = "postgresql+psycopg://orbit:URL_ENCODED_PASSWORD@localhost:5432/orbit"
   python -m scripts.migrate_sqlite_to_postgres --backup .\backups\chat-before-postgres.db
   ```

   Review the row-count report and retain the generated backup. Do not start the app against the target before migration; startup creates application tables, and migration correctly refuses a target that is no longer empty. For a fresh install with no SQLite data, skip this command.

4. Configure the normal `DATABASE_URL` in `.env` for local FastAPI use, or use Docker Compose, which connects the app container to the Compose PostgreSQL service.

## API

All room, channel, and invitation-management/acceptance routes require `Authorization: Bearer <access_token>`. Invitation preview is intentionally public. Authentication routes are listed in the FastAPI OpenAPI page at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/rooms` | Create a room, its owner membership, a `general` channel, and an initial invitation |
| `GET` | `/api/rooms` | List rooms the signed-in user belongs to |
| `GET` | `/api/rooms/discover?q=&category=&page=&page_size=` | Search paginated public rooms only |
| `GET` | `/api/rooms/{room_id}` | Get room details; private rooms require membership |
| `POST` | `/api/rooms/{room_id}/join` | Join a public room |
| `GET` | `/api/rooms/{room_id}/members` | List room members |
| `GET` | `/api/rooms/{room_id}/messages` | Read the legacy `general` channel history |
| `GET` | `/api/rooms/{room_id}/channels` | List active channels (members only) |
| `POST` | `/api/rooms/{room_id}/channels` | Create a channel (owner/moderator) |
| `PATCH` | `/api/channels/{channel_id}` | Edit channel name, topic, or category (owner/moderator) |
| `DELETE` | `/api/channels/{channel_id}` | Archive a channel while retaining its message history |
| `GET` | `/api/channels/{channel_id}/messages` | Read channel history (members only) |
| `POST` | `/api/rooms/{room_id}/invitations` | Create an invitation (owner/moderator) |
| `GET` | `/api/rooms/{room_id}/invitations` | List invitations (owner/moderator) |
| `GET` | `/api/invitations/{invite_code}` | Preview a valid invitation; no authentication required |
| `POST` | `/api/invitations/{invite_code}/accept` | Join via invitation (authentication required) |
| `DELETE` | `/api/invitations/{invite_id}` | Revoke an invitation (owner/moderator) |
| `WS` | `/ws/channels/{channel_id}?token=<JWT>` | Receive/send realtime channel messages |
| `WS` | `/ws/rooms/{room_id}?token=<JWT>` | Legacy WebSocket route mapped to the room's `general` channel |

Invitation creation accepts `expiration` values `never`, `1h`, `24h`, or `7d`, and `max_uses` values `null`, `1`, `5`, or `10`. Expired, revoked, exhausted, and invalid codes cannot be accepted. A full room returns HTTP `409`; unauthorized private-room access returns `403`.

## Local development

Requirements: Python 3.11+, Node.js 20.19+, npm, and Docker (for PostgreSQL and Redis).

Configure `.env` using `.env.example`, then start the services:

```powershell
docker compose up -d postgres redis
```

Install backend dependencies and start FastAPI:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal, install frontend dependencies and start Vite:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Open `http://localhost:5173`; the API is at `http://localhost:8000`, health check at `/health`, and API docs at `/docs`. Set `FRONTEND_BASE_URL` to the browser-visible frontend origin so invitation links use the right host. Registration email verification requires SMTP settings; existing verified accounts can sign in without SMTP.

### Docker

Set `SECRET_KEY` and PostgreSQL settings in the root `.env`. For a fresh database, start the complete app with:

```powershell
docker compose up --build
```

For an existing SQLite install, start only `postgres`, run and verify the migration above, then start the app:

```powershell
docker compose up --build
```

The app and built frontend are served at `http://localhost:8000`. PostgreSQL data is stored in the `orbit-postgres-data` named volume; Redis is used for cross-instance WebSocket message delivery.

## Tests and checks

From the repository root:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest
```

The backend tests use isolated temporary SQLite databases and do not require live PostgreSQL or Redis. They cover room creation, discovery/private-room exclusion, invitations and permissions, channel permissions/lifecycle, additive legacy-schema migration, and SQLite-to-PostgreSQL copy safety/data preservation.

From `frontend`:

```powershell
npm run typecheck
npm run build
```

## Manual feature checks

Example invitation URL:

```text
http://localhost:5173/invite/AbC123Xy
```

1. Sign in, create a public or private room, and use **Share invitation** from its details page.
2. Select expiry and usage options, create a link, then copy it or use the browser share sheet.
3. Open the link in a private browser window. Check room details and inviter display without exposing email addresses.
4. Sign in or register and verify email. Confirm the browser returns to the invitation and opens the joined room.
5. In chat, create a text channel as the owner/moderator, edit its topic, archive it, and confirm the channel disappears while other channel history remains.
6. Open two signed-in browsers in the same channel and exchange messages to verify WebSocket/Redis delivery.
7. Search Discover Rooms and confirm private rooms never appear. Confirm that a full room refuses new members.

## GitHub setup and push

The repository ignores `.env`, frontend environment files, database/backup files, virtual environments, `node_modules`, build output, and test caches. Commit `.env.example`, never real credentials, databases, or personal data. GitHub Actions runs backend tests and the frontend production build.

```powershell
git status --short
git check-ignore -v .env frontend/.env chat.db
git remote add origin https://github.com/<your-account>/<your-repository>.git
git add .
git status --short
git commit -m "Add channel-based chat and PostgreSQL migration"
git push -u origin main
```

Use Git Credential Manager, GitHub CLI, or SSH; never put a personal access token in the remote URL. Review `git status --short` before committing.

## Security notes

Use HTTPS/WSS and a strong private signing key in production. The existing frontend stores JWTs in `localStorage`, and WebSocket authentication uses a query-string token; production logging should redact query strings. Treat invitation URLs as bearer credentials: anyone holding an active link may join its room. Room previews expose only room information and inviter username, not email or other account data.
