# Scaling & Performance Guide

This project is tuned for free-tier friendly scaling. Use this as a runbook.

## Database
- Pooled connections: `DJANGO_DB_CONN_MAX_AGE=300`, `DJANGO_DB_CONN_HEALTH_CHECKS=True`, `DJANGO_DB_CONNECT_TIMEOUT=5`. Neon `*-pooler` endpoints already front the DB with pooling; keep using them.
- Optional guardrail: set `POSTGRES_STATEMENT_TIMEOUT_MS=8000` to prevent long-running queries during spikes.
- Indexes: `JobEntry` has candidate + `created_at`/`application_deadline` plus combined `(candidate, is_archived, status)` and `(candidate, is_archived, -updated_at)` for the jobs list/stats filters. Run migrations on deploy.
- For heavy reads, add read replicas if your provider supports them and point read-only workloads via `DATABASE_URL`.

## Caching (Redis)
- Default cache uses `django-redis` with Redis (DB 1). Configure `REDIS_URL` to your Upstash free-tier URL.
- Pool tuning: `REDIS_MAX_CONNECTIONS`, `REDIS_HEALTH_CHECK_INTERVAL`, `REDIS_SOCKET_TIMEOUT`, `CACHE_KEY_PREFIX` (for shared Redis).
- Job list/stats responses are cached per-user with versioned keys; invalidated on job/status changes.
- `GET /api/admin/system-metrics` now surfaces Redis pool usage (connected clients, pool max, memory) for quick health checks.

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
- Smoke: `k6 run --vus 10 --duration 30s scripts/k6-smoke-test.js -e BASE_URL=https://<host>/api`.
- Sustained load (50 concurrent): `k6 run scripts/k6-load-test.js -e BASE_URL=https://<host>/api -e AUTH_TOKEN=<jwt> -e VUS=50 -e HOLD=60s`. Thresholds enforce p95 < 500ms.
- Watch metrics during tests: `/api/admin/system-metrics` plus DB/Redis dashboards; Redis caching should hold hit latencies under 500ms.
- Profile slow queries with `django-debug-toolbar` in dev or Postgres `pg_stat_statements` in staging.
- Frontend check: while k6 is running, keep the React app open on jobs list/dashboard to confirm UI remains responsive and paginated responses stay under the latency threshold.

## Operational playbook
- Before deploy: run migrations, warm caches on hot endpoints, and ensure Redis and Postgres URLs are set.
- During incidents: check `/api/health`, then `/api/admin/system-metrics`. If DB connections are high, increase pool targets or recycle gunicorn workers.
- After incidents: export k6 results and DB slow query logs to identify new indexes or cache candidates.
