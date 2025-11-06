#!/usr/bin/env sh
# Daily scheduler for send_deadline_reminders at a specific local time.
# Defaults to 09:00 America/New_York (handles DST via tz database).

set -eu

LOG_PREFIX="[deadline-reminders]"

trap 'echo "$LOG_PREFIX Received SIGTERM, exiting"; exit 0' TERM INT

# If DJANGO_SETTINGS_MODULE not set, export default
export DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-backend.settings}

# Scheduling configuration
REMINDERS_TZ=${REMINDERS_TZ:-America/New_York}
REMINDERS_HOUR=${REMINDERS_HOUR:-9}
REMINDERS_MINUTE=${REMINDERS_MINUTE:-0}

# Function to run reminders and timestamp
run_once() {
  echo "$LOG_PREFIX Running send_deadline_reminders at $(date -u +'%Y-%m-%dT%H:%M:%SZ') (target: ${REMINDERS_HOUR}:${REMINDERS_MINUTE} ${REMINDERS_TZ})";
  python manage.py send_deadline_reminders || echo "$LOG_PREFIX Command failed";
}

# Compute seconds until next target time in the configured timezone
seconds_until_next_target() {
  python - <<PY
from datetime import datetime, timedelta
try:
    from zoneinfo import ZoneInfo
except Exception:
    # Python <3.9 fallback not expected here, but just in case
    import sys
    print(3600)
    sys.exit(0)

tz_name = "${REMINDERS_TZ}"
hour = int("${REMINDERS_HOUR}")
minute = int("${REMINDERS_MINUTE}")

tz = ZoneInfo(tz_name)
now = datetime.now(tz)
target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
if now >= target:
    target += timedelta(days=1)
delta = target - now
print(max(1, int(delta.total_seconds())))
PY
}

while true; do
  # Sleep until the next target time
  SLEEP_SECS=$(seconds_until_next_target)
  echo "$LOG_PREFIX Next run in ${SLEEP_SECS}s (≈ $((SLEEP_SECS/3600))h $(((SLEEP_SECS%3600)/60))m)"
  sleep "$SLEEP_SECS" || true
  run_once
done
