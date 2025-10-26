# ATS Candidate System - Team Onboarding Guide

Welcome to the ATS Candidate System project! This guide will help you get the project running on your local machine.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Firebase Configuration](#firebase-configuration)
- [Running the Application](#running-the-application)
- [Accessing the Application](#accessing-the-application)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

## Prerequisites

Before you begin, ensure you have the following installed on your machine:

### Required Software

#### 1. Git
- **Download:** [https://git-scm.com/downloads](https://git-scm.com/downloads)
- **Verify installation:**
  ```bash
  git --version
  # Should show: git version 2.x.x or higher
  ```

#### 2. Docker Desktop (REQUIRED)
- **Download:** [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
- **Important:** Make sure Docker Desktop is running before proceeding
- **Includes:** Docker Engine, Docker Compose, PostgreSQL container, Redis container
- **Verify installation:**
  ```bash
  docker --version
  # Should show: Docker version 20.x.x or higher
  
  docker compose version
  # Should show: Docker Compose version 2.x.x or higher
  ```
- **Note:** You do NOT need to install PostgreSQL or Redis separately - they run in Docker containers

#### 3. Python 3.12+ (Optional - for local development without Docker)
- **Download:** [https://www.python.org/downloads/](https://www.python.org/downloads/)
- **Note:** Only needed if you want to run backend locally without Docker
- **Verify installation:**
  ```bash
  python3 --version
  # Should show: Python 3.12.x or higher
  ```
- **For Docker-only setup (recommended), you can skip installing Python**

#### 4. Node.js 16+ (Optional - for local frontend development)
- **Download:** [https://nodejs.org/](https://nodejs.org/)
- **Note:** Only needed if you want to run frontend with hot-reload during development
- **Verify installation:**
  ```bash
  node --version
  # Should show: v16.x.x or higher
  
  npm --version
  # Should show: 8.x.x or higher
  ```
- **For Docker-only setup, you can skip installing Node.js**

### What You MUST Install
✅ **Git** - Required for cloning the repository  
✅ **Docker Desktop** - Required for running the entire stack (includes PostgreSQL, Redis)

### What's Optional
⚪ **Python** - Only for local backend development without Docker  
⚪ **Node.js** - Only for frontend development with hot-reload  
⚪ **PostgreSQL** - ❌ Do NOT install separately (runs in Docker)  
⚪ **Redis** - ❌ Do NOT install separately (runs in Docker)

### Complete Verification
Run these commands to verify your setup:
```bash
git --version
docker --version
docker compose version

# Optional checks (if installed):
python3 --version
node --version
npm --version
```

**If all commands work, you're ready to proceed! 🎉**

## Initial Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/nishantmnair/cs-490-project.git

# Navigate to the project directory
cd cs-490-project
```

### 2. Project Structure Overview

```
cs-490-project/
├── backend/              # Django REST API
│   ├── core/            # Main application
│   ├── backend/         # Django settings
│   ├── Dockerfile       # Backend container config
│   └── .env             # Backend environment variables
├── frontend/            # React application
│   ├── src/             # React source files
│   ├── public/          # Static files
│   ├── Dockerfile       # Frontend container config
│   ├── nginx.conf       # Nginx configuration
│   └── .env             # Frontend environment variables
├── docker-compose.yaml  # Docker orchestration (note: .yaml not .yml)
└── ONBOARDING.md        # This file
```

## Firebase Configuration

### 1. Get Firebase Credentials from Team Lead

**You need two things from your team lead:**

1. **Firebase Service Account JSON file** (`ats-candidate-system-firebase-adminsdk-fbsvc-64985faa4c.json`)
2. **Firebase API Key** (for frontend configuration)

### 2. Set Up Firebase Credentials

Once you receive the Firebase JSON file:

```bash
# Navigate to backend directory
cd backend

# Place the JSON file here
# The file should be at: backend/ats-candidate-system-firebase-adminsdk-fbsvc-64985faa4c.json
```

**⚠️ IMPORTANT: Never commit the Firebase JSON file to git!** It's already in `.gitignore`.

### 3. Configure Backend Environment

Create or verify the backend `.env` file:

```bash
# Navigate to backend directory
cd backend

# Copy the example file (if .env doesn't exist)
cp .env.example .env

# Edit .env with your actual credentials
```

The `backend/.env` file should contain:
```env
# Firebase credentials
FIREBASE_CREDENTIALS=<Filepath to your credentials JSON file>
FIREBASE_PROJECT_ID=ats-candidate-system
FIREBASE_API_KEY="<API_KEY from Firebase>"
FIREBASE_AUTH_DOMAIN="ats-candidate-system.firebaseapp.com"
FIREBASE_STORAGE_BUCKET="storage-bucket"
FIREBASE_DATABASE_URL="none"

# Django secret key (generate a new one for production!)
SECRET_KEY='your-secret-key-here'

# Email credentials (optional for now)
EMAIL_HOST='smtp.gmail.com'
EMAIL_PORT=587
EMAIL_HOST_USER='your-email@example.com'
EMAIL_HOST_PASSWORD='your-email-password'
```

**Important Notes:**
- 🔥 **FIREBASE_CREDENTIALS** should be just the filename (not a full path)
- 🔥 The Firebase JSON file should be in the same directory as `.env`
- 🔥 **Never commit the `.env` file** - it's in `.gitignore`
- 🔥 Docker Compose will automatically load this file via `env_file: ./backend/.env`

**Note:** Database and Redis configuration is in `docker-compose.yaml`, not in `.env`

### 4. Configure Frontend Environment

Create or verify the frontend `.env` file:

```bash
# Navigate to frontend directory
cd ../frontend

# Copy the example file (if .env doesn't exist)
cp .env.example .env

# Edit .env with your actual credentials
```

The `frontend/.env` file should contain:
```env
REACT_APP_FIREBASE_API_KEY=<API_KEY from Firebase>
REACT_APP_FIREBASE_AUTH_DOMAIN=ats-candidate-system.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=ats-candidate-system
REACT_APP_API_URL=http://localhost:8000/api
```

**Important Notes:**
- 🔥 Environment variables must start with `REACT_APP_` to be accessible in React
- 🔥 Changes to `.env` require rebuilding the frontend container
- 🔥 **Never commit the `.env` file** with real credentials

**Note:** Get the actual `FIREBASE_API_KEY` from your team lead or Firebase Console

## Running the Application

### Understanding the Docker Setup

This project uses **Docker Compose** to run all services in containers:

| Service | Container Name | Purpose | Port | Image |
|---------|---------------|---------|------|-------|
| Backend | `ats_backend` | Django REST API | 8000 | Python 3.12-slim |
| Frontend | `ats_frontend` | React + Nginx | 3000 (maps to 80) | Node 20 + Nginx Alpine |
| Database | `ats_db` | PostgreSQL | 5432 | postgres:15-alpine |
| Cache | `ats_redis` | Redis | 6379 | redis:7-alpine |

**Key Points:**
- ✅ PostgreSQL runs in Docker (no separate installation needed)
- ✅ Redis runs in Docker (no separate installation needed)
- ✅ Python 3.12 runs in Docker (no separate installation needed)
- ✅ Node.js runs in Docker for building (no separate installation needed)
- ✅ Database data persists in Docker volume `postgres_data`

### 1. Build and Start All Services

From the project root directory:

```bash
# Build and start all containers (backend, frontend, database, redis)
docker compose up -d --build
```

This command will:
- Build the Docker images for backend and frontend
- Start PostgreSQL database
- Start Redis cache
- Start Django backend on port 8000
- Start React frontend on port 3000

### 2. Verify Containers are Running

```bash
# Check running containers
docker compose ps

# You should see 4 services running:
# - ats_backend (Django)
# - ats_frontend (React/Nginx)
# - ats_db (PostgreSQL)
# - ats_redis (Redis)
```

### 3. Run Database Migrations

**First time setup only:**

```bash
# Run Django migrations to set up the database
docker compose exec backend python manage.py migrate

# Create a Django superuser (optional, for admin panel)
docker compose exec backend python manage.py createsuperuser
```

Follow the prompts to create your admin account.

### 4. View Logs (Optional)

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f frontend
```

Press `Ctrl+C` to stop viewing logs.

## Email setup (UC-009: account deletion confirmations)

By default in development, the backend uses the console email backend so you can see emails in logs. To enable real delivery (e.g., Gmail SMTP), add the SMTP variables to `backend/.env`.

Quick options
- Default (recommended for local dev): do nothing; emails print to backend logs. The deletion request endpoint also returns a `confirm_url` in development for quick testing.
- Real SMTP (e.g., Gmail App Password):
  1. Ensure these are set in `backend/.env` (see `backend/.env.example`):
     - `DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`
     - `EMAIL_HOST=smtp.gmail.com`
     - `EMAIL_PORT=587`
     - `EMAIL_USE_TLS=True`
     - `EMAIL_HOST_USER=your@gmail.com`
     - `EMAIL_HOST_PASSWORD=your-16-char-app-password`
     - `DEFAULT_FROM_EMAIL=Your App <your@gmail.com>`
  2. Restart the backend: `docker compose restart backend` (or rebuild if first time)

Gmail App Password steps
1. Enable 2‑Step Verification in your Google account
2. Create an App Password (Google Account → Security → App passwords)
3. Choose Mail → Other (name it), copy the 16‑character password

Verify end-to-end
1. In the app, go to Profile → Delete Account and submit
2. You should see “Confirmation email sent. Please check your email to confirm deletion.”
3. Check your email (Spam/Promotions too), click the link, and confirm

More details and troubleshooting
- See README: Operational guide → Account Deletion Email Flow (UC‑009):
  - ./README.md#operational-guide-account-deletion-email-flow-uc-009

## Accessing the Application

Once all services are running:

### Frontend (React Application)
- **URL:** http://localhost:3000
- **Default Page:** Login page
- **Routes:**
  - `/register` - User registration
  - `/login` - User login
  - `/dashboard` - Main dashboard (requires authentication)

### Backend (Django API)
- **URL:** http://localhost:8000
- **Admin Panel:** http://localhost:8000/admin
- **API Docs:** http://localhost:8000/api/
- **Health Check:** http://localhost:8000/api/health/

### Database
- **Host:** localhost
- **Port:** 5432
- **Database:** yourdb
- **Username:** postgres
- **Password:** postgres

**Note:** These credentials are defined in `docker-compose.yaml`

## Development Workflow

### Making Changes

#### Backend Changes (Python/Django)
```bash
# The backend auto-reloads on code changes
# Just edit files in backend/ directory

# If you add new dependencies:
# 1. Add to backend/backend/requirements.txt
# 2. Rebuild: docker compose up -d --build backend
```

#### Frontend Changes (React)
```bash
# For live development with hot-reload:
cd frontend
npm install  # First time only
npm start    # Starts dev server on port 3000

# Or use Docker (requires rebuild for changes):
docker compose up -d --build frontend
```

### Common Commands

```bash
# Stop all services
docker compose down

# Stop and remove volumes (clears database)
docker compose down -v

# Restart a specific service
docker compose restart backend
docker compose restart frontend

# View container logs
docker compose logs -f backend

# Execute commands in container
docker compose exec backend python manage.py shell
docker compose exec backend python manage.py migrate

# Rebuild everything from scratch
docker compose down -v
docker compose up -d --build
```

### Running Tests

```bash
# Backend tests
docker compose exec backend python manage.py test

# Frontend tests
cd frontend
npm test
```

## Troubleshooting

### Issue: Containers won't start

**Solution:**
```bash
# Check Docker is running
docker --version

# Check for port conflicts
lsof -i :3000  # Frontend port
lsof -i :8000  # Backend port
lsof -i :5432  # Database port

# Stop conflicting services and try again
docker compose down
docker compose up -d --build
```

### Issue: "Firebase not configured" error

**Solution:**
1. Verify `ats-candidate-system-firebase-adminsdk-fbsvc-64985faa4c.json` exists in `backend/` directory
2. Check `backend/.env` exists and has correct `FIREBASE_CREDENTIALS` filename (without path)
3. Verify `backend/.env` is being loaded by checking:
   ```bash
   docker compose config | grep FIREBASE
   ```
4. Restart backend: `docker compose restart backend`
5. Check logs: `docker compose logs backend`
6. If still failing, rebuild: `docker compose up -d --build backend`

### Issue: Environment variables not loading

**Solution:**
1. Verify `.env` files exist in both `backend/` and `frontend/` directories
2. Check `.env` file format (no spaces around `=`, proper quotes)
3. Rebuild containers to pick up changes:
   ```bash
   docker compose down
   docker compose up -d --build
   ```
4. Verify environment variables inside container:
   ```bash
   docker compose exec backend env | grep FIREBASE
   ```

### Issue: Database connection errors

**Solution:**
```bash
# Stop all services
docker compose down

# Start database first
docker compose up -d db

# Wait 10 seconds, then start backend
docker compose up -d backend

# Run migrations
docker compose exec backend python manage.py migrate
```

### Issue: 404 errors when refreshing pages in React

**Solution:**
This is already fixed with the nginx configuration, but if you see this:
```bash
# Rebuild frontend
docker compose up -d --build frontend
```

### Issue: CORS errors in browser console

**Solution:**
1. Verify backend is running: `docker compose ps`
2. Check browser console for exact error
3. The backend CORS settings in `backend/backend/settings.py` should allow `http://localhost:3000`
4. Restart backend: `docker compose restart backend`
5. Clear browser cache and cookies
6. Try in incognito/private browsing mode

### Issue: "An account with this email already exists"

**Solution:**
This means the email is already registered. Either:
1. Use a different email
2. Use the login page instead
3. Ask team lead to delete the user from Firebase Console

### Issue: Can't access admin panel

**Solution:**
```bash
# Create superuser
docker compose exec backend python manage.py createsuperuser

# Access at http://localhost:8000/admin
```

### Issue: npm install fails

**Solution:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Project Structure

### Backend (`/backend`)

```
backend/
├── core/                       # Main Django app
│   ├── models.py              # Database models (30+ models)
│   ├── views.py               # API endpoints
│   ├── serializers.py         # Data serializers
│   ├── authentication.py      # Firebase authentication
│   ├── firebase_utils.py      # Firebase helper functions
│   └── urls.py                # URL routing
├── backend/
│   ├── settings.py            # Django settings
│   ├── urls.py                # Root URL config
│   └── requirements.txt       # Python dependencies
├── Dockerfile                 # Backend container config
└── .env                       # Environment variables
```

### Frontend (`/frontend`)

```
frontend/
├── src/
│   ├── components/           # React components
│   │   ├── Register.js      # Registration page
│   │   ├── Login.js         # Login page
│   │   ├── Dashboard.js     # Dashboard page
│   │   ├── PrivateRoute.js  # Route protection
│   │   ├── Auth.css         # Auth styling
│   │   └── Dashboard.css    # Dashboard styling
│   ├── context/
│   │   └── AuthContext.js   # Global auth state
│   ├── services/
│   │   ├── firebase.js      # Firebase SDK
│   │   └── api.js           # API client
│   ├── config/
│   │   └── firebase.js      # Firebase config
│   ├── App.js               # Main app component
│   └── index.js             # Entry point
├── public/                  # Static files
├── Dockerfile              # Frontend container config
├── nginx.conf              # Nginx configuration
└── package.json            # Node dependencies
```

## Key Features Implemented

### Authentication (UC-001, UC-002)
- ✅ Email/password registration with validation
- ✅ Email/password login
- ✅ Firebase authentication integration
- ✅ Protected routes
- ✅ Token-based API authentication

### Database Models
- ✅ 30+ models covering:
  - User profiles and work history
  - Job opportunities and applications
  - Documents and resumes
  - Professional network
  - Analytics and metrics
  - AI-generated content
  - Notifications

## Need Help?

### Documentation
- **Backend API:** `backend/API_DOCUMENTATION.md`
- **Firebase Setup:** `backend/FIREBASE_SETUP.md`
- **Frontend Guide:** `frontend/FRONTEND_SETUP.md`

### Common Questions

**Q: How do I add a new Python package?**
```bash
# Add to backend/backend/requirements.txt
# Then rebuild:
docker compose up -d --build backend
```

**Q: How do I add a new npm package?**
```bash
cd frontend
npm install package-name
# Update package.json in git
```

**Q: How do I reset the database?**
```bash
docker compose down -v
docker compose up -d
docker compose exec backend python manage.py migrate
```

**Q: How do I view the database?**
```bash
# Connect to PostgreSQL
docker compose exec db psql -U postgres -d yourdb

# Or use a GUI tool like pgAdmin or DBeaver with:
# Host: localhost
# Port: 5432
# Database: yourdb
# User: postgres
# Password: postgres
```

**Q: The frontend won't connect to the backend**
- Check both containers are running: `docker compose ps`
- Check backend logs: `docker compose logs backend`
- Verify API URL in `frontend/.env` is `http://localhost:8000/api`
- Clear browser cache and try again

## Git Workflow

```bash
# Always pull latest changes before starting work
git pull origin main

# Create a feature branch
git checkout -b feature/your-feature-name

# Make your changes and commit
git add .
git commit -m "Description of changes"

# Push to remote
git push origin feature/your-feature-name

# Create a Pull Request on GitHub
```

### Files to NEVER Commit
- `backend/ats-candidate-system-firebase-adminsdk-fbsvc-64985faa4c.json` ❌ (Firebase credentials)
- `backend/.env` ❌ (contains sensitive data - use .env.example instead)
- `frontend/.env` ❌ (contains sensitive data - use .env.example instead)
- `.venv/` ❌ (Python virtual environment)
- `node_modules/` ❌ (npm packages)
- `__pycache__/` ❌ (Python cache)
- `*.pyc` ❌ (Python compiled files)
- `.DS_Store` ❌ (macOS system files)

### Files to COMMIT
- `backend/.env.example` ✅ (template for team members)
- `frontend/.env.example` ✅ (template for team members)
- `docker-compose.yaml` ✅ (orchestration config)
- All source code ✅

## Team Collaboration

### Before Starting Work
1. Pull latest changes: `git pull origin main`
2. Make sure containers are running: `docker compose up -d`
3. Check for any new migrations: `docker compose exec backend python manage.py migrate`

### After Making Changes
1. Test your changes locally
2. Commit with clear messages
3. Push to your branch
4. Create a Pull Request
5. Wait for code review

## Quick Reference

```bash
# Start everything
docker compose up -d --build

# Stop everything
docker compose down

# View logs
docker compose logs -f

# Restart a service
docker compose restart backend

# Run migrations
docker compose exec backend python manage.py migrate

# Access Django shell
docker compose exec backend python manage.py shell

# Create superuser
docker compose exec backend python manage.py createsuperuser

# Frontend dev mode (with hot reload)
cd frontend && npm start
```

## Success Checklist

After following this guide, you should be able to:

- [ ] Access the frontend at http://localhost:3000
- [ ] See the login page
- [ ] Register a new account
- [ ] Log in successfully
- [ ] Access the dashboard
- [ ] View the Django admin panel at http://localhost:8000/admin
- [ ] See all 4 containers running with `docker compose ps`

## Getting Started Now!

**Quick Start (5 minutes):**

1. **Get Firebase credentials from team lead** 
   - Firebase JSON file: `ats-candidate-system-firebase-adminsdk-fbsvc-64985faa4c.json`
   - Firebase API Key and other credentials for `.env` files

2. **Set up environment files:**
```bash
cd backend
cp .env.example .env
# Edit backend/.env with actual credentials

cd ../frontend
cp .env.example .env
# Edit frontend/.env with actual credentials
```

3. **Place Firebase JSON file in backend/ directory**

4. **Build and run:**
```bash
cd ..
docker compose up -d --build
docker compose exec backend python manage.py migrate
```

5. **Open http://localhost:3000 and register!**

Welcome to the team! 🚀

If you encounter any issues, check the [Troubleshooting](#troubleshooting) section or ask in the team chat.
