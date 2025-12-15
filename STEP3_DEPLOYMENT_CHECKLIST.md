# Step 3: Deploy Backend to Render.com - Implementation Checklist

## ✅ Files Created/Verified

1. **`backend/render.yaml`** - Created ✓
2. **`backend/build.sh`** - Already exists and is executable ✓
3. **`backend/backend/settings.py`** - Already has production configs ✓
4. **Dependencies** - gunicorn and whitenoise already in requirements.txt ✓

---

## 🚀 Next Steps: Deploy to Render

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

### 2. Create Account and Deploy on Render

1. Go to [render.com](https://render.com)
2. Click **Sign Up** → Sign up with GitHub
3. Click **New** → **Web Service**
4. Click **Connect** next to your `cs-490-project` repository
5. Configure the service:
   - **Name**: `ats-backend`
   - **Region**: Ohio (or closest to you)
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `./build.sh`
   - **Start Command**: `gunicorn backend.wsgi:application --bind 0.0.0.0:$PORT --workers 2`
   - **Plan**: Free

### 3. Add Environment Variables

Click **Advanced** → **Add Environment Variable** and add these:

#### Required Variables:

| Key | Value | Notes |
|-----|-------|-------|
| `DJANGO_DEBUG` | `False` | Production mode |
| `DJANGO_SECRET_KEY` | (click **Generate**) | Auto-generated |
| `DJANGO_ALLOWED_HOSTS` | `ats-backend.onrender.com` | Will be your Render domain |
| `POSTGRES_HOST` | (from Neon - Step 1) | e.g., `ep-xxxxx.us-east-2.aws.neon.tech` |
| `POSTGRES_DB` | `neondb` | Default Neon database name |
| `POSTGRES_USER` | (from Neon) | Your Neon username |
| `POSTGRES_PASSWORD` | (from Neon) | Your Neon password |
| `REDIS_URL` | (from Upstash - Step 2) | e.g., `rediss://default:xxxxx@...` |
| `CELERY_BROKER_URL` | (same as REDIS_URL) | For background tasks |

#### Firebase Variables:

| Key | Value |
|-----|-------|
| `FIREBASE_PROJECT_ID` | `ats-candidate-system` |
| `FIREBASE_API_KEY` | `AIzaSyAATKgBgW_-rFOhtkQrZaG6OHW4uBlyvuI` |
| `FIREBASE_AUTH_DOMAIN` | `ats-candidate-system.firebaseapp.com` |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | (see below) |

#### Other API Keys:

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | `AIzaSyAHFRcSfM72gg7qeIjzHdHJGdBeRjwHk8o` |
| `EMAIL_HOST_USER` | `resumerocket123@gmail.com` |
| `EMAIL_HOST_PASSWORD` | `zazrdzisrupsnsco` |
| `DEFAULT_FROM_EMAIL` | `resumerocket123@gmail.com` |

#### CORS Settings (Add after frontend is deployed):

| Key | Value |
|-----|-------|
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
| `CSRF_TRUSTED_ORIGINS` | `https://your-app.vercel.app` |

### 4. Firebase Credentials Setup

For `GOOGLE_APPLICATION_CREDENTIALS_JSON`, you need the **entire contents** of your Firebase service account JSON file:

1. Open `backend/ats-candidate-system-firebase-adminsdk-fbsvc-b57e0fec95.json`
2. Copy the **entire file contents** (should start with `{` and end with `}`)
3. In Render, add environment variable:
   - **Key**: `GOOGLE_APPLICATION_CREDENTIALS_JSON`
   - **Value**: Paste the entire JSON (multi-line is OK)

### 5. Deploy

1. Click **Create Web Service**
2. Wait for deployment (first build takes 5-10 minutes)
3. Check logs for any errors
4. Once deployed, your backend will be at: `https://ats-backend.onrender.com`

---

## 🧪 Test Your Deployment

After deployment completes:

```bash
# Test health endpoint
curl https://ats-backend.onrender.com/api/health/

# Should return: {"status": "healthy"}
```

---

## ⚠️ Important Notes

### Prerequisites (Must Do First)
- **Step 1**: Set up Neon PostgreSQL database first
- **Step 2**: Set up Upstash Redis first
- You need these connection details before deploying to Render

### Cold Starts
- Free tier: Service spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- Solution: Use UptimeRobot (Step 7) to ping every 5 minutes

### Database Migrations
- Migrations run automatically on each deploy (in `build.sh`)
- Check logs if migrations fail

---

## 🐛 Troubleshooting

### Build Fails
- Check build logs in Render dashboard
- Verify `build.sh` is executable: `chmod +x backend/build.sh`
- Ensure all requirements are in `requirements.txt`

### Database Connection Error
- Verify Neon connection string format
- Ensure SSL mode: `?sslmode=require` in connection string
- Check that Neon database is active (auto-pauses after inactivity)

### Static Files Not Loading
- Whitenoise is configured to serve static files
- `collectstatic` runs during build
- Check `STATIC_ROOT` and `STATIC_URL` in settings.py

### Environment Variables Not Working
- Verify variable names exactly match (case-sensitive)
- No spaces around `=` in values
- Check logs for any errors reading env vars

---

## 📊 Monitor Your Deployment

Once deployed, monitor at:
- **Dashboard**: https://dashboard.render.com
- **Logs**: Dashboard → Your Service → Logs (real-time)
- **Metrics**: Dashboard → Your Service → Metrics

---

## ✅ Success Criteria

Your deployment is successful when:
- [ ] Build completes without errors
- [ ] Service shows as "Live" (green status)
- [ ] Health endpoint returns `{"status": "healthy"}`
- [ ] No errors in logs during startup
- [ ] Database migrations applied successfully

---

## 📝 Next Steps After Backend Deployment

Once backend is deployed and working:
1. Update `DJANGO_ALLOWED_HOSTS` with your actual Render URL
2. Proceed to **Step 4**: Deploy Frontend to Vercel
3. After frontend deployed, update CORS settings with Vercel URL
4. Set up monitoring (Step 7)

---

**Need Help?** Check the main [PRODUCTION_DEPLOYMENT.md](../PRODUCTION_DEPLOYMENT.md) for detailed instructions.
