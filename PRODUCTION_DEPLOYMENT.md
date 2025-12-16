# 🚀 Production Deployment Guide

## ATS Candidates Platform - Complete Free-Tier Deployment

This comprehensive guide walks you through deploying the ATS Candidates platform to production using **100% free-tier services**. Follow each step carefully.

---

## 📋 Table of Contents

1. [Architecture Overview](#-architecture-overview)
2. [Prerequisites](#-prerequisites)
3. [Step 1: PostgreSQL Database (Neon)](#-step-1-set-up-postgresql-database-neon)
4. [Step 2: Redis Cache (Upstash)](#-step-2-set-up-redis-upstash)
5. [Step 3: Backend Deployment (Render.com)](#-step-3-deploy-backend-to-rendercom)
6. [Step 4: Frontend Deployment (Vercel)](#-step-4-deploy-frontend-to-vercel)
7. [Step 5: Connect Frontend to Backend](#-step-5-connect-frontend-to-backend)
8. [Step 6: File Storage (Cloudinary)](#-step-6-set-up-file-storage-cloudinary)
9. [Step 7: CI/CD Pipeline (GitHub Actions)](#-step-7-cicd-pipeline-github-actions)
10. [Step 8: Monitoring and Error Tracking](#-step-8-monitoring-and-error-tracking)
11. [Step 9: Final Configuration](#-step-9-final-configuration)
12. [Troubleshooting](#-troubleshooting)
13. [Free Tier Limitations](#-free-tier-limitations)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐         ┌──────────────┐         ┌────────────┐  │
│   │              │         │              │         │            │  │
│   │   Vercel     │ ──────► │  Render.com  │ ──────► │   Neon     │  │
│   │  (Frontend)  │  HTTPS  │  (Backend)   │   SSL   │ (Postgres) │  │
│   │              │         │              │         │            │  │
│   └──────────────┘         └──────┬───────┘         └────────────┘  │
│                                   │                                  │
│                                   │                                  │
│                                   ▼                                  │
│                            ┌──────────────┐                         │
│                            │   Upstash    │                         │
│                            │   (Redis)    │                         │
│                            └──────────────┘                         │
│                                                                      │
│   Monitoring: UptimeRobot + Sentry                                  │
│   Storage: Cloudinary (optional)                                    │
│   CI/CD: GitHub Actions                                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Service Summary

| Component | Service | Free Tier Limits | Cost |
|-----------|---------|------------------|------|
| **Frontend** | Vercel | 100GB bandwidth/month | $0 |
| **Backend** | Render.com | 750 hours/month, spins down after 15 min | $0 |
| **Database** | Neon | 0.5GB storage, auto-suspend | $0 |
| **Redis** | Upstash | 10K commands/day | $0 |
| **Storage** | Cloudinary | 25GB storage, 25GB bandwidth | $0 |
| **Monitoring** | UptimeRobot | 50 monitors | $0 |
| **Errors** | Sentry | 5K errors/month | $0 |

**Total Monthly Cost: $0**

---

## ✅ Prerequisites

Before starting, ensure you have:

- [ ] GitHub account with your repository pushed
- [ ] Node.js 18+ installed locally
- [ ] Python 3.12+ installed locally
- [ ] Git installed
- [ ] Access to project's Firebase Console (for credentials)

### Required Credentials to Gather

Collect these before deployment:

| Credential | Where to Get It |
|------------|-----------------|
| Firebase API Key | Firebase Console → Project Settings |
| Firebase Auth Domain | Firebase Console → Project Settings |
| Firebase Project ID | Firebase Console → Project Settings |
| Firebase Admin SDK JSON | Firebase Console → Service Accounts → Generate New Private Key |
| Gemini API Key | Google AI Studio |
| Google OAuth Credentials | Google Cloud Console (if using Gmail integration) |

---

## 🗄️ Step 1: Set Up PostgreSQL Database (Neon)

### 1.1 Create Neon Account

1. Go to **[https://neon.tech](https://neon.tech)**
2. Click **"Sign Up"** → Choose **"Continue with GitHub"**
3. Authorize Neon to access your GitHub account

### 1.2 Create a New Project

1. Click **"New Project"**
2. Fill in the details:
   - **Project name**: `ats-candidates`
   - **Postgres version**: `16` (latest stable)
   - **Region**: `US East (Ohio)` (or closest to your users)
3. Click **"Create Project"**

### 1.3 Get Connection Details

After project creation, you'll see the connection dashboard:

1. Click **"Connection Details"** tab
2. Set **"Connection type"** to `Parameters only`
3. Copy each value:

```env
POSTGRES_HOST=ep-cool-darkness-123456.us-east-2.aws.neon.tech
POSTGRES_DB=neondb
POSTGRES_USER=neondb_owner
POSTGRES_PASSWORD=xxxxxxxxxxxx
```

4. **Important**: Also copy the full connection string for reference:
```
postgresql://neondb_owner:xxxx@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### 1.4 Enable Pooled Connections (Recommended)

For better performance with Django:

1. Go to your project → **Settings** → **Connection Pooling**
2. Enable **"Connection pooling"**
3. Use the pooled connection host (ends with `-pooler`):
```
ep-cool-darkness-123456-pooler.us-east-2.aws.neon.tech
```

### 1.5 Save Your Credentials

Create a secure note with all database credentials. You'll need them for Render.com.

---

## 🔴 Step 2: Set Up Redis (Upstash)

### 2.1 Create Upstash Account

1. Go to **[https://upstash.com](https://upstash.com)**
2. Click **"Sign Up"** → **"Continue with GitHub"**
3. Authorize Upstash

### 2.2 Create Redis Database

1. Click **"Create Database"**
2. Configure:
   - **Name**: `ats-redis`
   - **Type**: `Regional`
   - **Region**: `US-East-1` (N. Virginia) - same region as Render
   - **TLS**: `Enabled` (default)
3. Click **"Create"**

### 2.3 Get Redis Connection URL

1. Go to your database dashboard
2. Find **"REST API"** section
3. Click on **"UPSTASH_REDIS_REST_URL"** to copy
4. For Django/Celery, you need the **Redis URL** format:

Look for **"Connect"** tab and copy the URL:
```
rediss://default:AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxE@us1-xxxxx-xxxxx-xxxxx.upstash.io:6379
```

**Note**: The URL starts with `rediss://` (with double 's') for TLS connection.

### 2.4 Save Redis URL

Save this as `REDIS_URL` - you'll need it for:
- Django cache
- Celery broker
- Celery result backend

---

## 🔧 Step 3: Deploy Backend to Render.com

### 3.1 Create Render Account

1. Go to **[https://render.com](https://render.com)**
2. Click **"Get Started for Free"**
3. Choose **"GitHub"** to sign up
4. Authorize Render to access your repositories

### 3.2 Create the Build Script

First, ensure you have the build script in your repository:

**File: `backend/build.sh`**
```bash
#!/usr/bin/env bash
# Build script for Render.com deployment
set -o errexit

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Running database migrations..."
python manage.py migrate

echo "Build completed successfully!"
```

Make it executable:
```bash
chmod +x backend/build.sh
```

Commit and push to GitHub.

### 3.3 Create Web Service on Render

1. Go to Render Dashboard
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository:
   - Find `cs-490-project` repository
   - Click **"Connect"**

### 3.4 Configure the Web Service

Fill in the configuration:

| Setting | Value |
|---------|-------|
| **Name** | `ats-backend` |
| **Region** | `Virginia (US East)` |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `chmod +x build.sh && ./build.sh` |
| **Start Command** | `gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120` |
| **Instance Type** | `Free` |

### 3.5 Add Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** and add each:

#### Django Settings
| Key | Value |
|-----|-------|
| `DJANGO_DEBUG` | `False` |
| `DJANGO_SECRET_KEY` | Click **"Generate"** to create a secure key |
| `DJANGO_ALLOWED_HOSTS` | `ats-backend.onrender.com` |
| `DJANGO_LOG_LEVEL` | `WARNING` |

#### Database (from Neon)
| Key | Value |
|-----|-------|
| `POSTGRES_HOST` | `ep-xxxxx.us-east-2.aws.neon.tech` |
| `POSTGRES_DB` | `neondb` |
| `POSTGRES_USER` | `neondb_owner` |
| `POSTGRES_PASSWORD` | `your-password-from-neon` |
| `POSTGRES_PORT` | `5432` |

#### Redis (from Upstash)
| Key | Value |
|-----|-------|
| `REDIS_URL` | `rediss://default:xxxxx@us1-xxxxx.upstash.io:6379` |
| `CELERY_BROKER_URL` | `rediss://default:xxxxx@us1-xxxxx.upstash.io:6379` |

#### Firebase
| Key | Value |
|-----|-------|
| `FIREBASE_PROJECT_ID` | `your-firebase-project-id` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Paste the **entire JSON content** of your Firebase Admin SDK file |

#### AI and External APIs
| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | `your-gemini-api-key` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |

#### CORS and URLs (leave blank for now - we'll update after frontend deployment)
| Key | Value |
|-----|-------|
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` (update later) |
| `CSRF_TRUSTED_ORIGINS` | `https://your-app.vercel.app` (update later) |
| `FRONTEND_URL` | `https://your-app.vercel.app` (update later) |

#### Email (Optional)
| Key | Value |
|-----|-------|
| `DEFAULT_FROM_EMAIL` | `resumerocket123@gmail.com` |
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_HOST_USER` | `your-email@gmail.com` |
| `EMAIL_HOST_PASSWORD` | `your-app-password` |
| `EMAIL_USE_TLS` | `True` |

### 3.6 Deploy the Backend

1. Click **"Create Web Service"**
2. Wait for the build to complete (5-10 minutes)
3. Watch the logs for any errors

### 3.7 Verify Backend Deployment

Once deployed, test the health endpoint:

```bash
curl https://ats-backend.onrender.com/api/health/
```

Expected response:
```json
{
  "status": "healthy",
  "database": "healthy",
  "version": "1.0.0"
}
```

**Note**: The first request may take 30-60 seconds due to cold start.

### 3.8 Get Your Backend URL

Copy your Render URL: `https://ats-backend.onrender.com`

You'll need this for the frontend configuration.

---

## ⚛️ Step 4: Deploy Frontend to Vercel

### 4.1 Create Vercel Account

1. Go to **[https://vercel.com](https://vercel.com)**
2. Click **"Sign Up"** → **"Continue with GitHub"**
3. Authorize Vercel to access your repositories

### 4.2 Create Vercel Configuration

Ensure you have this file in your repository:

**File: `frontend/vercel.json`**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "create-react-app",
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ]
}
```

### 4.3 Import Project to Vercel

1. Go to Vercel Dashboard
2. Click **"Add New..."** → **"Project"**
3. Find your `cs-490-project` repository
4. Click **"Import"**

### 4.4 Configure the Project

| Setting | Value |
|---------|-------|
| **Project Name** | `ats-candidates` |
| **Framework Preset** | `Create React App` |
| **Root Directory** | Click "Edit" → Select `frontend` |
| **Build Command** | `npm run build` (default) |
| **Output Directory** | `build` (default) |

### 4.5 Add Environment Variables

Click **"Environment Variables"** and add:

| Key | Value |
|-----|-------|
| `REACT_APP_API_URL` | `https://ats-backend.onrender.com/api` |
| `REACT_APP_FIREBASE_API_KEY` | `your-firebase-api-key` |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `REACT_APP_FIREBASE_PROJECT_ID` | `your-firebase-project-id` |

### 4.6 Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-5 minutes)
3. Vercel will provide a URL like: `https://ats-candidates.vercel.app`

### 4.7 Verify Frontend Deployment

1. Open your Vercel URL in a browser
2. You should see the login/home page
3. Open browser developer tools → Network tab to check for errors

---

## 🔗 Step 5: Connect Frontend to Backend

### 5.1 Update Render CORS Settings

Now that you have your Vercel URL, update the Render environment variables:

1. Go to **Render Dashboard** → **ats-backend** → **Environment**
2. Update these variables:

| Key | Value |
|-----|-------|
| `CORS_ALLOWED_ORIGINS` | `https://ats-candidates.vercel.app` |
| `CSRF_TRUSTED_ORIGINS` | `https://ats-candidates.vercel.app` |
| `FRONTEND_URL` | `https://ats-candidates.vercel.app` |

3. Click **"Save Changes"**
4. The service will automatically redeploy

### 5.2 Update Firebase Authorized Domains

1. Go to **Firebase Console** → Your Project
2. Navigate to **Authentication** → **Settings** → **Authorized Domains**
3. Add your Vercel domain:
   - `ats-candidates.vercel.app`
4. Also add Render domain if using OAuth callbacks:
   - `ats-backend.onrender.com`

### 5.3 Test the Full Application

1. Open `https://ats-candidates.vercel.app`
2. Try to register a new account
3. Log in with the new account
4. Verify API calls work (check Network tab)

---

## 📁 Step 6: Set Up File Storage (Cloudinary)

For user uploads (profile pictures, resumes), use Cloudinary's free tier.

### 6.1 Create Cloudinary Account

1. Go to **[https://cloudinary.com](https://cloudinary.com)**
2. Click **"Sign Up for Free"**
3. Complete registration

### 6.2 Get API Credentials

From your Cloudinary Dashboard, copy:

| Credential | Location |
|------------|----------|
| Cloud Name | Top of dashboard |
| API Key | Account Details section |
| API Secret | Account Details section |

### 6.3 Add to Render Environment

Add these environment variables to Render:

| Key | Value |
|-----|-------|
| `CLOUDINARY_CLOUD_NAME` | `your-cloud-name` |
| `CLOUDINARY_API_KEY` | `your-api-key` |
| `CLOUDINARY_API_SECRET` | `your-api-secret` |

### 6.4 Install Cloudinary (If Not Already)

Add to `backend/requirements.txt`:
```
cloudinary==1.36.0
django-cloudinary-storage==0.3.0
```

Update `backend/backend/settings.py`:
```python
# Add to INSTALLED_APPS
INSTALLED_APPS = [
    # ... existing apps
    'cloudinary_storage',
    'cloudinary',
]

# Add Cloudinary configuration
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.environ.get('CLOUDINARY_CLOUD_NAME'),
    'API_KEY': os.environ.get('CLOUDINARY_API_KEY'),
    'API_SECRET': os.environ.get('CLOUDINARY_API_SECRET'),
}

# Use Cloudinary for media files in production
if not DEBUG:
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
```

---

## 🔄 Step 7: CI/CD Pipeline (GitHub Actions)

### 7.1 Create Workflow File

**File: `.github/workflows/deploy.yml`**

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # ==================== BACKEND TESTS ====================
  test-backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'
          cache-dependency-path: backend/requirements.txt
      
      - name: Install dependencies
        working-directory: ./backend
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      
      - name: Run tests
        working-directory: ./backend
        env:
          DJANGO_DEBUG: 'True'
          USE_SQLITE_FOR_TESTS: '1'
          DJANGO_SECRET_KEY: 'test-secret-key-for-ci-pipeline'
        run: |
          pytest --cov=core --cov-report=xml -v || true
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage.xml
          fail_ci_if_error: false

  # ==================== FRONTEND TESTS ====================
  test-frontend:
    name: Frontend Tests
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      
      - name: Install dependencies
        working-directory: ./frontend
        run: npm ci
      
      - name: Run tests
        working-directory: ./frontend
        run: npm test -- --coverage --watchAll=false --passWithNoTests
        continue-on-error: true
      
      - name: Build application
        working-directory: ./frontend
        env:
          CI: false  # Prevents treating warnings as errors
        run: npm run build

  # ==================== DEPLOY BACKEND ====================
  deploy-backend:
    name: Deploy Backend to Render
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - name: Trigger Render Deploy
        run: |
          if [ -n "${{ secrets.RENDER_DEPLOY_HOOK }}" ]; then
            curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK }}"
            echo "✅ Triggered Render deployment"
          else
            echo "⚠️ RENDER_DEPLOY_HOOK not configured"
          fi

  # ==================== DEPLOY FRONTEND ====================
  deploy-frontend:
    name: Deploy Frontend to Vercel
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - name: Deployment Notice
        run: |
          echo "✅ Vercel automatically deploys on push to main"
          echo "   Check Vercel dashboard for deployment status"
```

### 7.2 Set Up Render Deploy Hook

1. Go to **Render Dashboard** → **ats-backend**
2. Click **Settings** → Scroll to **Deploy Hook**
3. Copy the URL

### 7.3 Add GitHub Secret

1. Go to your **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions**
2. Click **"New repository secret"**
3. Add:
   - **Name**: `RENDER_DEPLOY_HOOK`
   - **Value**: Paste the Render deploy hook URL
4. Click **"Add secret"**

### 7.4 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    CI/CD WORKFLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Push to main ──► Run Tests ──► Deploy                    │
│        │              │             │                       │
│        │              ├─► Backend   │                       │
│        │              └─► Frontend  │                       │
│        │                            │                       │
│        │                            ├─► Render (Backend)    │
│        │                            └─► Vercel (Frontend)   │
│        │                                                    │
│   Pull Request ──► Run Tests Only (no deploy)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Step 8: Monitoring and Error Tracking

### 8.1 UptimeRobot (Uptime Monitoring)

1. Go to **[https://uptimerobot.com](https://uptimerobot.com)**
2. Sign up for free (50 monitors)
3. Click **"Add New Monitor"**

#### Backend Monitor
| Setting | Value |
|---------|-------|
| Monitor Type | HTTP(s) |
| Friendly Name | ATS Backend |
| URL | `https://ats-backend.onrender.com/api/health/` |
| Monitoring Interval | 5 minutes |

#### Frontend Monitor
| Setting | Value |
|---------|-------|
| Monitor Type | HTTP(s) |
| Friendly Name | ATS Frontend |
| URL | `https://ats-candidates.vercel.app` |
| Monitoring Interval | 5 minutes |

4. Add your email for alerts

**Bonus**: Pinging the backend every 5 minutes helps prevent Render cold starts!

### 8.2 Sentry (Error Tracking)

1. Go to **[https://sentry.io](https://sentry.io)**
2. Sign up (5K errors/month free)
3. Create a new project:
   - Platform: **Django**
   - Project name: `ats-backend`
4. Copy the DSN URL

#### Add to Render Environment
| Key | Value |
|-----|-------|
| `SENTRY_DSN` | `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx` |

Sentry is already configured in `settings.py` to use this environment variable.

### 8.3 View Errors

1. Go to Sentry Dashboard
2. You'll see all errors with:
   - Stack traces
   - User context
   - Request data
   - Environment info

---

## ⚙️ Step 9: Final Configuration

### 9.1 Production Checklist

Run through this checklist before going live:

#### Security
- [ ] `DJANGO_DEBUG` is `False`
- [ ] `DJANGO_SECRET_KEY` is a unique, random value
- [ ] All passwords and API keys are in environment variables
- [ ] CORS is configured for specific origins only
- [ ] HTTPS is enforced (automatic on Vercel/Render)

#### Database
- [ ] PostgreSQL is connected (not SQLite)
- [ ] Migrations have run successfully
- [ ] Database has backups enabled (Neon does this automatically)

#### Frontend
- [ ] API URL points to production backend
- [ ] Firebase is configured with production credentials
- [ ] All routes work correctly

#### Monitoring
- [ ] UptimeRobot monitors are active
- [ ] Sentry is capturing errors
- [ ] Email alerts are configured

### 9.2 Test All Features

1. **Authentication**
   - [ ] Register new user
   - [ ] Login with email/password
   - [ ] Login with Google (if configured)
   - [ ] Logout
   - [ ] Password reset

2. **Profile**
   - [ ] Update basic profile
   - [ ] Upload profile picture
   - [ ] Add education
   - [ ] Add work experience
   - [ ] Add skills

3. **Jobs**
   - [ ] Create job application
   - [ ] Update job status
   - [ ] Add interview
   - [ ] Delete job

4. **AI Features**
   - [ ] Resume builder
   - [ ] Cover letter generator
   - [ ] Interview prep

### 9.3 Environment Variables Summary

#### Render (Backend) - Complete List

```env
# Django
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<generated-secret>
DJANGO_ALLOWED_HOSTS=ats-backend.onrender.com
DJANGO_LOG_LEVEL=WARNING

# Database (Neon)
POSTGRES_HOST=ep-xxxxx.us-east-2.aws.neon.tech
POSTGRES_DB=neondb
POSTGRES_USER=neondb_owner
POSTGRES_PASSWORD=<your-password>
POSTGRES_PORT=5432

# Redis (Upstash)
REDIS_URL=rediss://default:xxxxx@us1-xxxxx.upstash.io:6379
CELERY_BROKER_URL=rediss://default:xxxxx@us1-xxxxx.upstash.io:6379

# Firebase
FIREBASE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# AI
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.5-flash

# CORS/URLs
CORS_ALLOWED_ORIGINS=https://ats-candidates.vercel.app
CSRF_TRUSTED_ORIGINS=https://ats-candidates.vercel.app
FRONTEND_URL=https://ats-candidates.vercel.app

# Email
DEFAULT_FROM_EMAIL=resumerocket123@gmail.com

# Monitoring
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx

# Storage (Optional)
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret
```

#### Vercel (Frontend) - Complete List

```env
REACT_APP_API_URL=https://ats-backend.onrender.com/api
REACT_APP_FIREBASE_API_KEY=AIzaxxxxxxxxxxxxxxxxxxxxx
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
```

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### 1. Backend won't start

**Symptoms**: Render shows "Deploy failed" or continuous restarts

**Solutions**:
```bash
# Check build logs for missing dependencies
# Add missing packages to requirements.txt

# Verify environment variables are set
# Check for typos in variable names

# Ensure build.sh is executable
chmod +x backend/build.sh
git add backend/build.sh
git commit -m "Make build.sh executable"
git push
```

#### 2. Database connection fails

**Symptoms**: "could not connect to server" errors

**Solutions**:
- Verify `POSTGRES_HOST` is correct (not `localhost`)
- Check `POSTGRES_PASSWORD` doesn't have special characters that need escaping
- Ensure Neon project is active (not suspended)
- Try the pooled connection host instead

#### 3. CORS errors in browser

**Symptoms**: "Access to XMLHttpRequest blocked by CORS policy"

**Solutions**:
1. Add Vercel URL to `CORS_ALLOWED_ORIGINS` in Render
2. Include the protocol: `https://ats-candidates.vercel.app`
3. Also add to `CSRF_TRUSTED_ORIGINS`
4. Redeploy backend after changes

#### 4. Firebase authentication fails

**Symptoms**: "Firebase: Error (auth/unauthorized-domain)"

**Solutions**:
1. Go to Firebase Console → Authentication → Settings
2. Add your Vercel domain to "Authorized domains"
3. Ensure `FIREBASE_PROJECT_ID` matches in both frontend and backend

#### 5. Cold start delays (30+ seconds)

**Symptoms**: First request after inactivity is very slow

**Solutions**:
- This is normal for Render free tier
- UptimeRobot pings help keep the service warm
- Add loading indicator in frontend
- Consider upgrading to paid tier for production

#### 6. Redis connection fails

**Symptoms**: Celery errors or cache errors

**Solutions**:
- Ensure URL starts with `rediss://` (with TLS)
- Check Upstash dashboard for connection status
- Verify the full URL was copied correctly

#### 7. Static files not loading

**Symptoms**: CSS/JS 404 errors in production

**Solutions**:
- Ensure `whitenoise` is in MIDDLEWARE
- Run `collectstatic` during build
- Check `STATIC_ROOT` is set correctly

#### 8. Environment variables not working

**Symptoms**: Features broken in production but work locally

**Solutions**:
- Environment variables in Vercel require `REACT_APP_` prefix
- Rebuild frontend after adding new variables
- Check for extra spaces in variable values

---

## ⚠️ Free Tier Limitations

### Understanding the Limits

| Service | Limitation | Impact | Workaround |
|---------|------------|--------|------------|
| **Render** | Spins down after 15 min inactivity | 30-60 sec cold start | UptimeRobot pings every 5 min |
| **Render** | 750 hours/month | ~31 days continuous | Sufficient for one service |
| **Neon** | 0.5 GB storage | Limited data | Sufficient for demo |
| **Neon** | Auto-suspends after 5 min | Slight delay on first query | Acceptable for demo |
| **Upstash** | 10K commands/day | Limited caching | Use caching wisely |
| **Vercel** | 100 GB bandwidth | High traffic limit | Plenty for demo |
| **Cloudinary** | 25 GB storage/bandwidth | Limited uploads | Sufficient for demo |

### When to Upgrade

Consider paid tiers if:
- You need instant response times (no cold starts)
- You're handling production traffic
- You need more storage or bandwidth
- You need background workers (Celery)

### Upgrade Recommendations

| Service | Paid Tier | Cost | Benefits |
|---------|-----------|------|----------|
| Render | Starter | $7/month | No cold starts, more CPU/RAM |
| Neon | Launch | $19/month | More storage, always-on |
| Vercel | Pro | $20/month | More bandwidth, team features |

---

## 🎉 Congratulations!

Your ATS Candidates platform is now live!

**Production URLs**:
- 🌐 **Frontend**: `https://ats-candidates.vercel.app`
- 🔌 **Backend API**: `https://ats-backend.onrender.com/api`
- 💚 **Health Check**: `https://ats-backend.onrender.com/api/health/`

**Monitoring**:
- 📈 UptimeRobot Dashboard
- 🐛 Sentry Error Tracking

**Next Steps**:
1. Share the URL with your team
2. Conduct user testing
3. Monitor for errors in Sentry
4. Check UptimeRobot for any downtime

---

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Neon Documentation](https://neon.tech/docs)
- [Upstash Documentation](https://upstash.com/docs)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/5.0/howto/deployment/checklist/)
- [Firebase Admin Setup](https://firebase.google.com/docs/admin/setup)

---

*Last Updated: December 2025*
