#!/usr/bin/env bash
# Build script for Render.com deployment
set -o errexit

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Running database migrations..."
python manage.py migrate

# Create superuser from environment variables if provided
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "Creating/updating superuser..."
    python manage.py upsert_admin \
        --username "$DJANGO_SUPERUSER_USERNAME" \
        --password "$DJANGO_SUPERUSER_PASSWORD" \
        --email "${DJANGO_SUPERUSER_EMAIL:-admin@example.com}" \
        || echo "Superuser creation skipped or already exists"
fi

echo "Build completed successfully!"
