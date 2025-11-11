#!/usr/bin/env sh
# Hourly scheduler for send_interview_reminders.
# Sends email reminders for interviews happening in the next 24 hours.

set -eu

LOG_PREFIX="[interview-reminders]"

trap 'echo "$LOG_PREFIX Received SIGTERM, exiting"; exit 0' TERM INT

# If DJANGO_SETTINGS_MODULE not set, export default
export DJANGO_SETTINGS_MODULE=${DJANGO_SETTINGS_MODULE:-backend.settings}

# Run every hour
INTERVAL_SECONDS=${INTERVIEW_REMINDER_INTERVAL:-3600}

# Function to run reminders and timestamp
run_once() {
  echo "$LOG_PREFIX Running send_interview_reminders at $(date -u +'%Y-%m-%dT%H:%M:%SZ')";
  python manage.py send_interview_reminders || echo "$LOG_PREFIX Command failed";
}

# Run immediately on startup
run_once

# Then run every interval
while true; do
  echo "$LOG_PREFIX Next run in ${INTERVAL_SECONDS}s (≈ $((INTERVAL_SECONDS/60)) minutes)"
  sleep "$INTERVAL_SECONDS" || true
  run_once
done
