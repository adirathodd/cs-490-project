# CI/CD Deployment Pipeline Documentation

This document describes the automated deployment pipeline implemented for the ATS Candidate System.

## Overview

The project uses GitHub Actions for CI/CD with the following workflows:

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `ci.yml` | All pushes & PRs | Runs tests, linting, and security scans |
| `deploy.yml` | Push to `main` | Deploys to production environment |
| `deploy-staging.yml` | Push to `develop` | Deploys to staging environment |
| `rollback.yml` | Manual trigger | Rolls back a deployment |

## Workflow Details

### CI Pipeline (`ci.yml`)

Triggered on every push and pull request to any branch.

**Jobs:**
1. **Backend Tests** - Runs Django/pytest tests with coverage
2. **Frontend Tests** - Runs Jest tests with coverage
3. **Frontend Build** - Verifies the React app builds successfully
4. **Lint** - Runs code quality checks (flake8, black, eslint)
5. **Security** - Runs security scans (bandit, npm audit)
6. **CI Summary** - Aggregates results and fails if critical tests fail

### Production Deployment (`deploy.yml`)

Triggered on push to `main` branch.

**Features:**
- Runs full test suite before deployment
- Deploys backend to Render
- Deploys frontend to Vercel
- Performs health checks after deployment
- Sends notifications to Slack/Discord
- Records deployment metrics
- Automatic rollback on failure

### Staging Deployment (`deploy-staging.yml`)

Triggered on push to `develop` branch.

**Features:**
- Similar to production but deploys to staging environment
- Allows skipping tests for emergency fixes (not recommended)

### Rollback (`rollback.yml`)

Manually triggered workflow for rolling back deployments.

**Features:**
- Select environment (staging/production)
- Optionally specify target commit SHA
- Choose to rollback backend, frontend, or both
- Requires reason for rollback
- Sends notifications

## Required Secrets

Configure these secrets in your GitHub repository settings:

### Required for All Deployments
| Secret | Description |
|--------|-------------|
| `RENDER_DEPLOY_HOOK` | Render deploy hook URL for production backend |
| `RENDER_STAGING_DEPLOY_HOOK` | Render deploy hook URL for staging backend |

### Optional for Enhanced Features
| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel API token for frontend deployment |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `PRODUCTION_API_URL` | Production API URL for health checks |
| `STAGING_API_URL` | Staging API URL for health checks |
| `PRODUCTION_FRONTEND_URL` | Production frontend URL |
| `STAGING_FRONTEND_URL` | Staging frontend URL |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for notifications |
| `DISCORD_WEBHOOK_URL` | Discord webhook for notifications |
| `DEPLOYMENT_API_KEY` | API key for deployment metrics recording |
| `REACT_APP_FIREBASE_API_KEY` | Firebase config for production builds |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `REACT_APP_FIREBASE_PROJECT_ID` | Firebase project ID |

## GitHub Environments

Create these environments in your repository settings:

### `production`
- Add protection rules (require reviewers, etc.)
- Configure secrets specific to production

### `staging`
- Less restrictive rules for faster iteration
- Configure secrets specific to staging

## Deployment Tracking API

The system includes a backend API for tracking deployment history:

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deployments/` | List all deployments |
| POST | `/api/deployments/` | Create deployment record |
| GET | `/api/deployments/{id}/` | Get deployment details |
| GET | `/api/deployments/stats/` | Get deployment statistics |
| GET | `/api/deployments/metrics/` | Get dashboard metrics |
| GET | `/api/deployments/recent/` | Get recent deployments |
| GET | `/api/deployments/summary/` | Quick summary for widgets |
| POST | `/api/deployments/{id}/rollback/` | Trigger rollback |

### Frontend Dashboard

Access the deployment dashboard at `/admin/deployments` in the application.

Features:
- Real-time deployment status
- Environment-specific statistics
- Deployment history with filtering
- Success rate and duration metrics
- Trend visualization
- One-click rollback capability

## Notification Setup

### Slack

1. Create an incoming webhook in your Slack workspace
2. Add the webhook URL as `SLACK_WEBHOOK_URL` secret

Notifications include:
- Deployment status (success/failure)
- Environment and branch info
- Commit details
- Links to workflow and commit

### Discord

1. Create a webhook in your Discord server channel
2. Add the webhook URL as `DISCORD_WEBHOOK_URL` secret

## Rollback Procedures

### Automatic Rollback

Automatic rollback is triggered when:
- Health checks fail after deployment
- Critical errors occur during deployment

### Manual Rollback

1. Go to Actions tab in GitHub
2. Select "Rollback Deployment" workflow
3. Click "Run workflow"
4. Fill in:
   - Environment (staging/production)
   - Target SHA (optional - defaults to previous deployment)
   - Reason for rollback
   - Components to rollback (backend/frontend)
5. Click "Run workflow"

## Environment Variables

Add these to your backend `.env` file:

```bash
# Deployment tracking
DEPLOYMENT_API_KEY=your-secure-api-key
ENVIRONMENT=development  # or staging/production
```

## Monitoring Deployments

### Via GitHub

- Check Actions tab for workflow runs
- View deployment history in Environments
- Monitor job summaries for detailed metrics

### Via Application

- Navigate to `/admin/deployments`
- View real-time metrics and history
- Filter by environment, status, and date

### Via API

```bash
# Get deployment stats
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api.com/api/deployments/stats/?days=30

# Get recent deployments
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api.com/api/deployments/recent/?limit=5
```

## Troubleshooting

### Deployment Failed

1. Check workflow logs in GitHub Actions
2. Review health check results
3. Check application logs in Render/Vercel
4. Verify environment variables are set correctly

### Health Check Failing

1. Ensure `/api/health/` endpoint is accessible
2. Check if the application started successfully
3. Verify database connections

### Notifications Not Sending

1. Verify webhook URLs are correct
2. Check webhook configuration in Slack/Discord
3. Review workflow logs for errors

## Best Practices

1. **Always test locally** before pushing to main
2. **Use feature branches** and merge via PRs
3. **Write meaningful commit messages** for tracking
4. **Monitor deployments** after each push
5. **Keep secrets secure** and rotate regularly
6. **Review automated test results** before deploying
