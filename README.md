# Orbit — FastAPI WebSocket Chat

Orbit is a React chat frontend connected to the existing FastAPI, SQLite, JWT, and Redis Pub/Sub backend. The frontend uses Vite in development and can also be built into `frontend/dist` for FastAPI to serve.

## Requirements

- Node.js 20.19+ and npm
- Python 3.11+
- Redis (or Docker Desktop to run Redis)

## Configure and start the backend

From the project root, create the backend settings file only if you do not already have one:

```powershell
Set-Location D:\project\websocket-chat-app
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit the project-root `.env` and set your SMTP values before registering users. Make sure Redis is running at the address in `REDIS_URL` (by default, `localhost:6379`). If you use Docker and the `chat-redis` container already exists, run `docker start chat-redis`; otherwise, only if port 6379 is free, run:

```powershell
docker run --name chat-redis -p 6379:6379 -d redis:7-alpine
```

An installed Redis server can be used instead.

In a second PowerShell terminal, start FastAPI:

```powershell
Set-Location D:\project\websocket-chat-app
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API is available at `http://localhost:8000`, its health check is `http://localhost:8000/health`, and its interactive docs are at `http://localhost:8000/docs`. A healthy check returns `{"status":"ok"}`. Redis must be running for FastAPI startup and real-time message broadcasting.

## Configure email verification

Registration sends a one-time verification link through SMTP. Add your provider's settings to the project-root `.env` before registering users:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=Orbit <no-reply@example.com>
SMTP_USE_SSL=false
SMTP_STARTTLS=true
FRONTEND_BASE_URL=http://localhost:5173
```

For an SSL-only provider on port 465, set `SMTP_USE_SSL=true` and `SMTP_STARTTLS=false`. `FRONTEND_BASE_URL` must be the origin where the React app is reachable; for the Docker-built app use `http://localhost:8000`. Restart FastAPI after changing SMTP settings. Registration returns an explicit error if SMTP is not configured or delivery fails. Unverified accounts cannot sign in; the verification page can resend a link, which expires after 24 hours. Previously existing accounts continue to work.

## Configure and start the React frontend

In a third PowerShell terminal:

```powershell
Set-Location D:\project\websocket-chat-app\frontend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). In development, Vite proxies `/api` and `/ws` to `http://localhost:8000`; set `VITE_BACKEND_URL` in `frontend/.env` if the backend listens elsewhere.

The frontend's default API base is `/api`. For a separately hosted frontend, set `VITE_API_BASE_URL` to the backend API base ending in `/api`, and `VITE_WS_BASE_URL` to the backend WebSocket origin. Use HTTPS/WSS in production. Do not put secrets in Vite environment variables; they are public in the built client.

### If Vite shows `ECONNREFUSED`

This means the Vite proxy cannot reach FastAPI at `VITE_BACKEND_URL` (by default `http://localhost:8000`). It is not an npm-install error. Keep Vite running, start Redis and FastAPI in separate terminals as above, and check:

```powershell
Test-NetConnection localhost -Port 8000
Invoke-RestMethod http://localhost:8000/health
```

If FastAPI uses another port, set `VITE_BACKEND_URL` in `frontend/.env` to that address and restart Vite. Copying `frontend/.env.example` configures only the frontend; SMTP settings belong in the project-root `.env`. If registration returns HTTP 503, check the root SMTP settings and restart FastAPI.

## Production build

Build the React app from `frontend`:

```powershell
npm run build
```

The build is written to `frontend/dist`. Restart FastAPI after building; its root serves the React app and its client-side routes, while `/api` and `/ws` remain the backend endpoints. Docker builds the React app in a separate Node stage automatically:

```powershell
docker compose up --build
```

## Try it with two users

1. Configure SMTP and start Redis, FastAPI, and the Vite frontend (or use Docker Compose).
2. Open the Vite URL in two separate browser profiles or private windows.
3. Register a different username and email in each profile, open each verification email, then sign in.
4. In the first profile, create a room.
5. In the second profile, select that room from the room list; selecting a room joins it before history is loaded and the WebSocket connects.
6. Send messages from either profile and confirm they appear in both.

## Verification checks

From `frontend`, run the production build and dependency audit:

```powershell
npm run build
npm audit
```

For an end-to-end manual check, confirm `/health` returns `{"status":"ok"}`, register and verify two different email addresses, then sign in from separate browser profiles, join the same room, and send a message from each. The sender and the other participant should receive each message in real time.

## Backend API used by the frontend

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register with username, email, and password |
| POST | `/api/auth/login` | Sign in and receive a JWT |
| GET | `/api/auth/me` | Load the signed-in user |
| POST | `/api/auth/verify-email` | Verify an email using its one-time token |
| POST | `/api/auth/resend-verification` | Resend a pending verification email |
| GET | `/api/rooms` | List available rooms |
| POST | `/api/rooms` | Create a room |
| POST | `/api/rooms/{room_id}/join` | Join a room |
| GET | `/api/rooms/{room_id}/messages` | Load room history |
| WS | `/ws/rooms/{room_id}?token=JWT` | Exchange live messages |

## Security notes

For this learning project, the JWT is stored in `localStorage`, which is accessible to JavaScript running on the same origin and therefore exposed by an XSS vulnerability. Production apps should consider secure, HttpOnly cookie-based sessions or another carefully designed token flow, use HTTPS/WSS, apply a strong private `SECRET_KEY`, and prevent XSS. The backend's WebSocket JWT is passed in the query string, so production infrastructure should avoid recording query strings in logs or use short-lived WebSocket tickets.

## Push this project to GitHub

The root `.gitignore` excludes local environment files (`.env`, `env`, and `frontend/.env`), Python environments, SQLite databases, Docker data, `node_modules`, and the Vite build output. Commit `.env.example` files, but never commit real SMTP credentials, JWT secrets, or database files.

The local Git repository is initialized on `main` but is not connected to GitHub yet. Create an **empty** repository on GitHub, then from the project root connect it and push:

```powershell
Set-Location D:\project\websocket-chat-app
git status --short
git check-ignore -v .env frontend/.env chat.db
git remote add origin https://github.com/<your-account>/<your-repository>.git
git add .
git status --short
git commit -m "Build Orbit chat application"
git push -u origin main
```

Replace the URL with your repository's HTTPS or SSH URL. If `git remote add origin` reports that `origin` already exists, inspect it with `git remote -v` and update it only if it is incorrect. Authenticate with Git Credential Manager, GitHub CLI, or your SSH key; do not put a personal access token in the remote URL. Review `git status --short` before committing to ensure only intended source files are included.
