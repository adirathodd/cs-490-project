# Production Deployment Guide - Free Tier

This guide walks you through deploying the ATS Candidates platform to production using **100% free-tier services**.

---

## 📋 Architecture Overview

| Component | Free-Tier Service | Notes |
|-----------|-------------------|-------|
| **Frontend (React)** | Vercel | Free for hobby projects |
| **Backend (Django)** | Render.com | 750 hours/month free |
| **Database (PostgreSQL)** | Neon or Supabase | Free tier available |
| **Redis (Cache/Celery)** | Upstash | Free tier with 10K commands/day |
| **File Storage** | Cloudinary or Firebase Storage | Free tier available |
| **Domain** | Provided by Vercel/Render | Custom domain optional |

---

## 🗄️ Step 1: Set Up PostgreSQL Database (Neon - Free Tier)

### 1.1 Create Neon Account
1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub (recommended)
3. Create a new project named `ats-candidates`

### 1.2 Get Connection String
After creating the project:
1. Click on your project → **Connection Details**
2. Copy the connection string (looks like):
   ```
   postgresql://username:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Save these values separately:
   - `POSTGRES_HOST`: `ep-xxxxx.us-east-2.aws.neon.tech`
   - `POSTGRES_DB`: `neondb`
   - `POSTGRES_USER`: (your username)
   - `POSTGRES_PASSWORD`: (your password)

### 1.3 Alternative: Supabase (Free Tier)
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to **Settings** → **Database** → **Connection string**

---

## 🔴 Step 2: Set Up Redis (Upstash - Free Tier)

### 2.1 Create Upstash Account
1. Go to [upstash.com](https://upstash.com)
2. Sign up with GitHub
3. Click **Create Database**
4. Select **Redis**
5. Choose region closest to your backend (e.g., US-East-1)
6. Name it `ats-redis`

### 2.2 Get Redis URL
1. Go to your database → **Details**
2. Copy the **Redis URL** (looks like):
   ```
   rediss://default:xxxxx@global-xxxxx.upstash.io:6379
   ```
3. Save as `REDIS_URL`

---

## 🔧 Step 3: Deploy Backend to Render.com

### 3.1 Prepare Backend for Production

Create a new file `backend/render.yaml`:

```yaml
services:
  - type: web
    name: ats-backend
    env: python
    region: ohio
    plan: free
    buildCommand: |
      pip install -r requirements.txt
      python manage.py collectstatic --noinput
      python manage.py migrate
    startCommand: gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --workers 2
    envVars:
      - key: DJANGO_DEBUG
        value: "False"
      - key: DJANGO_SECRET_KEY
        generateValue: true
      - key: DJANGO_ALLOWED_HOSTS
        sync: false
      - key: POSTGRES_HOST
        sync: false
      - key: POSTGRES_DB
        sync: false
      - key: POSTGRES_USER
        sync: false
      - key: POSTGRES_PASSWORD
        sync: false
      - key: REDIS_URL
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: FIREBASE_PROJECT_ID
        sync: false
```

### 3.2 Create `backend/build.sh` (Render build script):

```bash
#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

python manage.py collectstatic --noinput
python manage.py migrate
```

### 3.3 Deploy to Render

1. Go to [render.com](https://render.com) and sign up with GitHub
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `ats-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `chmod +x build.sh && ./build.sh`
   - **Start Command**: `gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --workers 2`
5. Add Environment Variables (from previous steps):

| Key | Value |
|-----|-------|
| `DJANGO_DEBUG` | `False` |
| `DJANGO_SECRET_KEY` | (click Generate) |
| `DJANGO_ALLOWED_HOSTS` | `ats-backend.onrender.com` |
| `POSTGRES_HOST` | (from Neon) |
| `POSTGRES_DB` | `neondb` |
| `POSTGRES_USER` | (from Neon) |
| `POSTGRES_PASSWORD` | (from Neon) |
| `REDIS_URL` | (from Upstash) |
| `CELERY_BROKER_URL` | (same as REDIS_URL) |
| `GEMINI_API_KEY` | (your API key) |
| `FIREBASE_PROJECT_ID` | (your project ID) |
| `FIREBASE_CREDENTIALS` | (see Step 3.4) |
| `FRONTEND_URL` | `https://ats-candidates.vercel.app` |
| `DEFAULT_FROM_EMAIL` | `resumerocket123@gmail.com` |

6. Click **Create Web Service**

### 3.4 Firebase Credentials on Render

For Firebase Admin SDK credentials:
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key (JSON file)
3. In Render, you have two options:

**Option A - Environment Variable (Recommended):**
- Create env var `GOOGLE_APPLICATION_CREDENTIALS_JSON` with the entire JSON content
- Update `settings.py` to read from this variable (see modifications below)

**Option B - Render Disk (Persistent Storage):**
- Upload the JSON file to a Render Disk (not available on free tier)

### 3.5 Update settings.py for Production

Add these modifications to your `backend/backend/settings.py`:

```python
# Add near the top after imports
import json
import tempfile

# Add after SECRET_KEY line
# Production Firebase credentials from environment variable
firebase_creds_json = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS_JSON', '')
if firebase_creds_json and not os.environ.get('FIREBASE_CREDENTIALS'):
    # Write JSON to temporary file for firebase-admin
    try:
        creds_data = json.loads(firebase_creds_json)
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(creds_data, f)
            os.environ['FIREBASE_CREDENTIALS'] = f.name
            os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = f.name
    except json.JSONDecodeError:
        pass

# Update ALLOWED_HOSTS to include Render domain
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost 127.0.0.1').split()

# Update CORS settings for production
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split()
CSRF_TRUSTED_ORIGINS = os.environ.get('CSRF_TRUSTED_ORIGINS', 'http://localhost:3000').split()

# Production security settings
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
```

---

## ⚛️ Step 4: Deploy Frontend to Vercel

### 4.1 Prepare Frontend for Vercel

Create `frontend/vercel.json`:

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

### 4.2 Update API URL Configuration

Create/update `frontend/.env.production`:

```env
REACT_APP_API_URL=https://ats-backend.onrender.com/api
REACT_APP_FIREBASE_API_KEY=your-firebase-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
```

### 4.3 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
5. Add Environment Variables:

| Key | Value |
|-----|-------|
| `REACT_APP_API_URL` | `https://ats-backend.onrender.com/api` |
| `REACT_APP_FIREBASE_API_KEY` | (your key) |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | (your domain) |
| `REACT_APP_FIREBASE_PROJECT_ID` | (your project ID) |

6. Click **Deploy**

### 4.4 Get Your Vercel URL

After deployment, you'll get a URL like:
- `https://ats-candidates.vercel.app`

Update your Render backend environment variables:
- `CORS_ALLOWED_ORIGINS`: `https://ats-candidates.vercel.app`
- `CSRF_TRUSTED_ORIGINS`: `https://ats-candidates.vercel.app`
- `FRONTEND_URL`: `https://ats-candidates.vercel.app`

---

## 📁 Step 5: Set Up File Storage (Cloudinary - Free Tier)

For user uploads (profile pictures, resumes), use Cloudinary:

### 5.1 Create Cloudinary Account
1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up (free tier: 25GB storage, 25GB bandwidth/month)
3. Get your credentials from Dashboard:
   - Cloud name
   - API Key
   - API Secret

### 5.2 Install Cloudinary (Optional)

If you want to use Cloudinary for file storage:

```bash
pip install cloudinary django-cloudinary-storage
```

Add to `requirements.txt`:
```
cloudinary==1.36.0
django-cloudinary-storage==0.3.0
```

Update `settings.py`:
```python
# Cloudinary configuration
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.environ.get('CLOUDINARY_CLOUD_NAME'),
    'API_KEY': os.environ.get('CLOUDINARY_API_KEY'),
    'API_SECRET': os.environ.get('CLOUDINARY_API_SECRET'),
}

if not DEBUG:
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
```

---

## 🔄 Step 6: Set Up CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        working-directory: ./backend
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-django pytest-cov
      
      - name: Run tests
        working-directory: ./backend
        env:
          DJANGO_DEBUG: 'True'
          USE_SQLITE_FOR_TESTS: '1'
          DJANGO_SECRET_KEY: 'test-secret-key'
        run: |
          pytest --cov=core --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./backend/coverage.xml

  test-frontend:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node.js
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
        run: npm test -- --coverage --watchAll=false
      
      - name: Build
        working-directory: ./frontend
        run: npm run build

  deploy-backend:
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - name: Deploy to Render
        env:
          RENDER_DEPLOY_HOOK: ${{ secrets.RENDER_DEPLOY_HOOK }}
        run: |
          curl -X POST "$RENDER_DEPLOY_HOOK"

  deploy-frontend:
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - name: Trigger Vercel Deployment
        run: echo "Vercel auto-deploys on push to main via GitHub integration"
```

### 6.1 Set Up Render Deploy Hook

1. Go to Render Dashboard → Your Service → Settings
2. Scroll to **Deploy Hook**
3. Copy the URL
4. Go to GitHub → Repository → Settings → Secrets → Actions
5. Add secret `RENDER_DEPLOY_HOOK` with the URL

---

## 📊 Step 7: Set Up Monitoring (Free Tier)

### 7.1 UptimeRobot (Uptime Monitoring)
1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up (free: 50 monitors)
3. Add monitors:
   - **Backend**: `https://ats-backend.onrender.com/api/health/`
   - **Frontend**: `https://ats-candidates.vercel.app`
4. Set alert contacts (email)

### 7.2 Sentry (Error Tracking)
1. Go to [sentry.io](https://sentry.io)
2. Sign up (free: 5K errors/month)
3. Create Django project
4. Get DSN

Install Sentry:
```bash
pip install sentry-sdk
```

Add to `requirements.txt`:
```
sentry-sdk==1.38.0
```

Add to `settings.py`:
```python
import sentry_sdk

if not DEBUG:
    sentry_sdk.init(
        dsn=os.environ.get('SENTRY_DSN', ''),
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )
```

Add `SENTRY_DSN` to Render environment variables.

---

## 🚀 Step 8: Final Deployment Checklist

### Environment Variables Summary

**Render (Backend):**
```env
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<generated>
DJANGO_ALLOWED_HOSTS=ats-backend.onrender.com
POSTGRES_HOST=<from-neon>
POSTGRES_DB=neondb
POSTGRES_USER=<from-neon>
POSTGRES_PASSWORD=<from-neon>
REDIS_URL=<from-upstash>
CELERY_BROKER_URL=<from-upstash>
GEMINI_API_KEY=<your-key>
FIREBASE_PROJECT_ID=<your-project>
GOOGLE_APPLICATION_CREDENTIALS_JSON=<json-content>
FRONTEND_URL=https://ats-candidates.vercel.app
CORS_ALLOWED_ORIGINS=https://ats-candidates.vercel.app
CSRF_TRUSTED_ORIGINS=https://ats-candidates.vercel.app
DEFAULT_FROM_EMAIL=resumerocket123@gmail.com
SENTRY_DSN=<from-sentry>
```

**Vercel (Frontend):**
```env
REACT_APP_API_URL=https://ats-backend.onrender.com/api
REACT_APP_FIREBASE_API_KEY=<your-key>
REACT_APP_FIREBASE_AUTH_DOMAIN=<your-domain>
REACT_APP_FIREBASE_PROJECT_ID=<your-project>
```

### Deployment Steps (In Order)

1. ✅ Create Neon PostgreSQL database
2. ✅ Create Upstash Redis database
3. ✅ Deploy backend to Render
4. ✅ Run database migrations (automatic on Render)
5. ✅ Deploy frontend to Vercel
6. ✅ Update CORS settings with Vercel URL
7. ✅ Set up UptimeRobot monitoring
8. ✅ Set up Sentry error tracking
9. ✅ Test all features in production

---

## ⚠️ Free Tier Limitations

| Service | Limitation | Workaround |
|---------|------------|------------|
| **Render** | Spins down after 15 min inactivity | First request takes ~30s to cold start |
| **Neon** | 0.5GB storage, auto-suspend | Sufficient for demo/testing |
| **Upstash** | 10K commands/day | Use caching wisely |
| **Vercel** | 100GB bandwidth/month | More than enough for demo |

### Handling Render Cold Starts

Add a health check endpoint to keep the service warm (optional):

```python
# backend/core/views.py
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return JsonResponse({'status': 'healthy'})
```

```python
# backend/core/urls.py
path('health/', views.health_check, name='health-check'),
```

Use UptimeRobot to ping `/api/health/` every 5 minutes to prevent cold starts.

---

## 🔒 Security Checklist

- [x] `DEBUG=False` in production
- [x] Secret key generated and stored securely
- [x] HTTPS enforced (automatic on Vercel/Render)
- [x] CORS configured for specific origins
- [x] CSRF protection enabled
- [x] Security headers enabled (HSTS, etc.)
- [x] Database credentials in environment variables
- [x] Firebase credentials secured

---

## 📝 Post-Deployment Verification

1. **Test user registration** - Create new account
2. **Test login/logout** - Firebase authentication works
3. **Test job tracking** - Create, update, delete jobs
4. **Test AI features** - Resume builder, cover letter generator
5. **Test file uploads** - Profile pictures
6. **Check error tracking** - Trigger an error, verify it appears in Sentry
7. **Check uptime monitoring** - Verify alerts are configured

---

## 🆘 Troubleshooting

### Backend won't start on Render
- Check build logs for errors
- Verify all environment variables are set
- Check `requirements.txt` has all dependencies

### Database connection errors
- Verify Neon connection string is correct
- Check SSL mode (`?sslmode=require`)
- Ensure `POSTGRES_*` variables match Neon credentials

### CORS errors in browser
- Add Vercel URL to `CORS_ALLOWED_ORIGINS`
- Add Vercel URL to `CSRF_TRUSTED_ORIGINS`
- Redeploy backend after updating

### Firebase authentication fails
- Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON` contains valid JSON
- Check Firebase project ID matches
- Ensure Firebase Auth is enabled in console

---

## 📚 Useful Commands

```bash
# Check Render logs
# Go to Render Dashboard → Your Service → Logs

# Run migrations manually (via Render Shell)
python manage.py migrate

# Create superuser (via Render Shell)
python manage.py createsuperuser

# Check database connection
python manage.py dbshell
```

---

**Congratulations!** 🎉 Your ATS Candidates platform is now live at:
- **Frontend**: `https://ats-candidates.vercel.app`
- **Backend API**: `https://ats-backend.onrender.com/api`
