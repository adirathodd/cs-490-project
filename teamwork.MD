

# Team Development Workflow

To help your team collaborate efficiently on this Dockerized **Django + React + PostgreSQL + Redis** project, follow the workflow below. These guidelines explain how to set up the environment, modify code, and manage the stack across multiple developers.

## 1) Prerequisites
- **Git** installed and access to the repository.
- **Docker Desktop** (macOS/Windows) or Docker Engine + Compose (Linux).
- Optional (for frontend hot reload): **Node.js 20+** and **npm** or **yarn**.

Verify installs:
```bash
docker --version
docker compose version
node -v   # optional for local React dev
npm -v    # optional for local React dev
```

## 2) Start the Development Environment (Docker)
From the repository root (where `docker-compose.yml` lives):
```bash
docker compose up -d
```
Check status:
```bash
docker compose ps
```
Services started:
- **backend** → Django dev server on `http://localhost:8000`
- **frontend** → Nginx serving the built React app on `http://localhost:3000`
- **db** → PostgreSQL on `localhost:5432`
- **redis** → Redis on `localhost:6379`

> Tip: Remove the `version:` key in `docker-compose.yml` if you see a Compose warning about it being obsolete.

## 3) Backend Development (Django)
- Source is mounted: `./backend` → `/app` in the container.
- Django **auto‑reloads** on file changes when running `runserver`.

Common commands (run inside the container):
```bash
# Apply database migrations
docker compose exec backend python manage.py migrate

# Create a superuser for /admin
docker compose exec backend python manage.py createsuperuser

# Open a Django shell
docker compose exec backend python manage.py shell

# Bash into the container
docker compose exec backend bash
```

## 4) Database & Cache
- **PostgreSQL** is available inside Docker as host `db:5432` and on your host as `localhost:5432`.
- **Redis** is available inside Docker as host `redis:6379` and on your host as `localhost:6379`.
- Database data persists in the `postgres_data` volume.

To reset DB data intentionally:
```bash
docker compose down -v   # WARNING: deletes the DB volume
```

## 5) Frontend Development (React) with Hot Reload
The current Docker setup serves a **built** React bundle via Nginx—great for staging/production, not ideal for day‑to‑day edits. For hot reload during development, run the React dev server **locally**:

```bash
cd frontend
npm install      # first time only
npm start        # runs on http://localhost:3000 with hot reload
```

Add a dev proxy in `frontend/package.json` so API calls go to Django:
```json
{
  "proxy": "http://localhost:8000"
}
```

Now your React app can call relative API paths like `/api/...` without CORS configuration.

> Alternative: You can add a separate Compose service that runs `npm start` and mounts `frontend/` for containerized hot reload, but running React locally is typically simpler.

## 6) Collaboration & Git Flow
- **Branching**: create feature branches; open Pull Requests (PRs); require reviews before merging to `main`.
- **Secrets & config**: use environment variables / `.env` files. Do **not** commit real secrets.
- **Code quality**: adopt formatters/linters (e.g., `black`/`flake8` for Python; ESLint/Prettier for JS/TS).
- **Docs**: keep `README.md` and this `teamwork.MD` updated for onboarding.

## 7) Migrations, Tests & Admin
- Run migrations after model changes:
```bash
docker compose exec backend python manage.py migrate
```
- Create an admin user and log in at `http://localhost:8000/admin`:
```bash
docker compose exec backend python manage.py createsuperuser
```
- Example test commands:
```bash
# Django tests
docker compose exec backend python manage.py test
# or, if using pytest
docker compose exec backend pytest -q
```

## 8) Useful Docker Commands
```bash
# Start services (foreground)
docker compose up
# Start services (background)
docker compose up -d
# Show running services
docker compose ps
# Tail logs (all or one service)
docker compose logs -f
docker compose logs -f backend
# Exec into a service
docker compose exec backend bash
# Stop and remove containers
docker compose down
# Stop/remove + delete named volumes (DB reset!)
docker compose down -v
# Rebuild after Dockerfile/requirements change
docker compose up --build
```

## 9) Troubleshooting
- **Can’t connect to DB when running manage.py locally**: Inside Docker, DB host is `db`; on your host it’s `localhost`. Prefer running management commands with `docker compose exec backend ...`.
- **Backend not starting**: Check container logs: `docker compose logs -f backend`. Verify `DJANGO_SETTINGS_MODULE` and dependencies.
- **Frontend shows old bundle**: If using Nginx container, it serves the last built bundle. For live edits, run `npm start` locally.
- **Port conflicts**: Ensure ports 8000/3000/5432/6379 aren’t used by other processes.

## 10) Onboarding Checklist (New Devs)
1. Install Docker; verify `docker compose`.
2. Clone repository.
3. `docker compose up -d`
4. Apply migrations: `docker compose exec backend python manage.py migrate`
5. Create admin: `docker compose exec backend python manage.py createsuperuser`
6. (Optional) Run React locally: `npm start` in `frontend/`
7. Open: `http://localhost:8000` (API/admin) and `http://localhost:3000` (UI)

---
This workflow keeps everyone on the same stack while enabling fast local iteration: Django auto‑reload for backend, React dev server hot reload for frontend, and consistent infra via Docker Compose.
