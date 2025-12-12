# Environment Variables Configuration

This document explains how environment variables are managed in this project using Docker Compose.

## Overview

This project uses `.env` files to manage sensitive configuration data like Firebase credentials, API keys, and secrets. **These files are NOT committed to git** to keep credentials secure.

## File Structure

```
cs-490-project/
├── backend/
│   ├── .env                    # ❌ Not in git - contains real credentials
│   └── .env.example            # ✅ In git - template for team
├── frontend/
│   ├── .env                    # ❌ Not in git - contains real credentials
│   └── .env.example            # ✅ In git - template for team
└── docker-compose.yaml         # ✅ References .env files via env_file
```

## How It Works

### Backend Environment Variables

The `docker-compose.yaml` uses `env_file` to load `backend/.env`:

```yaml
backend:
  env_file:
    - ./backend/.env
  environment:
    DJANGO_SETTINGS_MODULE: backend.settings
    DATABASE_URL: postgres://postgres:postgres@db:5432/yourdb
    REDIS_URL: redis://redis:6379/0
```

**What happens:**
1. Docker Compose reads `backend/.env`
2. All variables from `.env` are loaded into the backend container
3. Additional variables can be set in the `environment` section
4. Environment section takes precedence over `env_file`

### Frontend Environment Variables

The frontend uses build arguments to inject environment variables at build time:

```yaml
frontend:
  build:
    args:
      - REACT_APP_FIREBASE_API_KEY=${REACT_APP_FIREBASE_API_KEY}
      - REACT_APP_FIREBASE_AUTH_DOMAIN=${REACT_APP_FIREBASE_AUTH_DOMAIN}
      - REACT_APP_FIREBASE_PROJECT_ID=${REACT_APP_FIREBASE_PROJECT_ID}
      - REACT_APP_API_URL=${REACT_APP_API_URL}
  env_file:
    - ./frontend/.env
```

**What happens:**
1. Docker Compose reads `frontend/.env`
2. Build arguments are passed to the Dockerfile during build
3. React embeds these values at build time (not runtime)
4. Environment variables must start with `REACT_APP_` to be accessible

## Setup for New Team Members

### 1. Copy Example Files

```bash
# Backend
cd backend
cp .env.example .env

# Frontend
cd ../frontend
cp .env.example .env
```

### 2. Get Credentials from Team Lead

You need:
- Firebase Service Account JSON file
- Firebase API Key
- Firebase Project ID
- Django Secret Key

### 3. Edit .env Files

**backend/.env:**
```env
FIREBASE_CREDENTIALS=ats-candidate-system-firebase-adminsdk-fbsvc-64985faa4c.json
FIREBASE_PROJECT_ID=ats-candidate-system
FIREBASE_API_KEY=your-actual-api-key
SECRET_KEY=your-django-secret-key

# Google OAuth used by /api/contacts/import
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# UC-114: GitHub OAuth
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:8000/api/github/callback/
# Optional: where to redirect after successful connect
FRONTEND_BASE_URL=http://localhost:3000
```

> 💡 Create a Google Cloud OAuth 2.0 **Web application** client for development, then add
> `http://localhost:8000/api/contacts/import/callback` to the list of authorized redirect URIs.
> Copy the generated Client ID and Client secret into the variables above and restart the backend container.

**frontend/.env:**
```env
REACT_APP_FIREBASE_API_KEY=your-actual-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=ats-candidate-system.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ats-candidate-system
REACT_APP_API_URL=http://localhost:8000/api
```

### 4. Place Firebase JSON File

```bash
# Put the Firebase JSON file in backend/ directory
cp path/to/ats-candidate-system-firebase-adminsdk-fbsvc-64985faa4c.json backend/
```

### 5. Build and Run

```bash
docker compose up -d --build
```

## Environment Variable Precedence

Docker Compose loads environment variables in this order (later overrides earlier):

1. Environment variables from the shell
2. `.env` file in the project root (if exists)
3. `env_file` in docker-compose.yaml
4. `environment` in docker-compose.yaml
5. Variables defined in the Dockerfile

## Common Issues

### Issue: Changes to .env not taking effect

**Solution:**
```bash
# Rebuild containers to pick up changes
docker compose down
docker compose up -d --build
```

### Issue: React app not seeing environment variables

**Solution:**
- Ensure variables start with `REACT_APP_`
- Rebuild frontend (React embeds vars at build time):
  ```bash
  docker compose up -d --build frontend
  ```

### Issue: "FIREBASE_CREDENTIALS file not found"

**Solution:**
1. Check the filename in `backend/.env` matches the actual file
2. Ensure the Firebase JSON file is in `backend/` directory
3. Use just the filename, not a path: `FIREBASE_CREDENTIALS=filename.json`

### Verify Environment Variables Loaded

```bash
# Check backend environment variables
docker compose exec backend env | grep FIREBASE

# Check all backend environment variables
docker compose exec backend env

# View what Docker Compose will use (without running)
docker compose config
```

## Security Best Practices

### ❌ NEVER Do This
- Commit `.env` files to git
- Hardcode credentials in `docker-compose.yaml`
- Share `.env` files via public channels
- Include credentials in screenshots or documentation

### ✅ ALWAYS Do This
- Use `.env.example` as a template
- Keep real credentials in `.env` (gitignored)
- Share credentials securely (encrypted messaging, password manager)
- Rotate credentials if exposed
- Use different credentials for dev/staging/production

## Adding New Environment Variables

### For Backend

1. Add to `backend/.env`:
   ```env
   NEW_VARIABLE=value
   ```

2. Add to `backend/.env.example`:
   ```env
   NEW_VARIABLE=example-value-here
   ```

3. Restart backend:
   ```bash
   docker compose restart backend
   ```

### For Frontend

1. Add to `frontend/.env` (must start with `REACT_APP_`):
   ```env
   REACT_APP_NEW_VARIABLE=value
   ```

2. Add to `frontend/.env.example`:
   ```env
   REACT_APP_NEW_VARIABLE=example-value-here
   ```

3. Add to `docker-compose.yaml` build args:
   ```yaml
   frontend:
     build:
       args:
         - REACT_APP_NEW_VARIABLE=${REACT_APP_NEW_VARIABLE}
   ```

4. Rebuild frontend:
   ```bash
   docker compose up -d --build frontend
   ```

## Troubleshooting Commands

```bash
# Check what environment variables Docker Compose will use
docker compose config

# View environment variables inside running container
docker compose exec backend env
docker compose exec frontend env

# Check specific variable
docker compose exec backend bash -c 'echo $FIREBASE_CREDENTIALS'

# View logs to see environment-related errors
docker compose logs backend
docker compose logs frontend

# Restart specific service
docker compose restart backend
docker compose restart frontend

# Rebuild everything
docker compose down
docker compose up -d --build
```

## Reference

- [Docker Compose Environment Variables Docs](https://docs.docker.com/compose/environment-variables/)
- [React Environment Variables Docs](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [Django Settings Best Practices](https://docs.djangoproject.com/en/stable/topics/settings/)
