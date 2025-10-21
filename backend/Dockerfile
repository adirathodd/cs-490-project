# Use an official Python image as a parent image
FROM python:3.12-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    netcat-openbsd gcc postgresql-client build-essential \
 && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy project code
COPY backend/ /app/

# Set environment variables for Django
ENV PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=backend.settings \
    DATABASE_URL=postgres://postgres:postgres@db:5432/yourdb \
    REDIS_URL=redis://redis:6379/0

# Collect static files (optional for production)
RUN python manage.py collectstatic --noinput || true

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]