# Scaling & Performance Guide

This project is tuned for free-tier friendly scaling. Use this as a runbook.

## Database
- Use pooled connections: `DJANGO_DB_CONN_MAX_AGE=120` and `DJANGO_DB_CONN_HEALTH_CHECKS=True`.
- Prefer managed Postgres with autoscaling storage (Neon/Supabase). Turn on connection pooling if offered.
- Indexes: `JobEntry` now has candidate + `created_at`/`application_deadline` indexes; run migrations on deploy.
- For heavy reads, add read replicas if your provider supports them and point read-only workloads via `DATABASE_URL`.

## Caching (Redis)
- Default cache uses Redis (DB 1). Configure `REDIS_URL` to your Upstash free-tier URL.
- Tune redis pool: `REDIS_MAX_CONNECTIONS`, `REDIS_HEALTH_CHECK_INTERVAL`, `REDIS_SOCKET_TIMEOUT`.
- Job list/stats responses are cached per-user with versioned keys; invalidated on job/status changes.

## Pagination & query shaping
- Job list API is paginated by default (`page_size` inherits DRF default, `page_size` param up to 100). Legacy clients can disable with `?paginate=false`.
- Stats endpoint caches aggregated results; CSV export bypasses cache.

## Monitoring
- Health: `GET /api/health`.
- Metrics: `GET /api/admin/system-metrics` (admin only) returns CPU%, memory, cache backend, and Postgres active connections when available.
- Add external uptime monitors against `/api/health` and alert on non-200s.

## Autoscaling (Render/Neon/Upstash free-tier tips)
- Render free tier: set min=1 instance; when upgrading, use autoscale based on response time/CPU. Keep worker and web as separate services.
- Neon: enable autosuspend to save credits; scale compute to larger size during load tests, then scale back.
- Upstash: free tier is rate-limited—monitor command count; if you approach limits, add simple in-app circuit breakers to fall back to in-memory caching for non-critical paths.

## Load testing
- Example k6 script: `node scripts/k6-smoke-test.js` (requires k6). Configure `BASE_URL` env var; includes auth token placeholder.
- Run short smoke: `k6 run --vus 10 --duration 30s scripts/k6-smoke-test.js`.
- Watch metrics during tests: `/api/admin/system-metrics` plus your DB/Redis dashboards.
- Profile slow queries with `django-debug-toolbar` in dev or Postgres `pg_stat_statements` in staging.

## Operational playbook
- Before deploy: run migrations, warm caches on hot endpoints, and ensure Redis and Postgres URLs are set.
- During incidents: check `/api/health`, then `/api/admin/system-metrics`. If DB connections are high, increase pool targets or recycle gunicorn workers.
- After incidents: export k6 results and DB slow query logs to identify new indexes or cache candidates.
