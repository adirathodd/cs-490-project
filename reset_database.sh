#!/bin/bash
# Database Reset Script for ResumeRocket
# This script completely resets the database and applies all migrations

set -e  # Exit on error

echo "=========================================="
echo "ResumeRocket Database Reset Script"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will DELETE ALL DATA in your database!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Reset cancelled."
    exit 0
fi

echo ""
echo "🔄 Step 1: Stopping all containers..."
docker compose down

echo ""
echo "🗑️  Step 2: Removing database volume..."
docker volume rm cs-490-project_postgres_data || echo "Volume not found, continuing..."

echo ""
echo "🚀 Step 3: Starting containers..."
docker compose up -d

echo ""
echo "⏳ Step 4: Waiting for database to be ready..."
sleep 15

# Check if database is ready
echo "🔍 Checking database connection..."
docker compose exec db pg_isready -U postgres || {
    echo "❌ Database not ready. Waiting longer..."
    sleep 10
    docker compose exec db pg_isready -U postgres || {
        echo "❌ Database failed to start. Please check logs: docker compose logs db"
        exit 1
    }
}

echo ""
echo "✅ Database is ready!"
echo ""
echo "📝 Step 5: Running migrations..."
docker compose exec backend python manage.py migrate

echo ""
echo "✅ Database reset complete!"
echo ""
echo "=========================================="
echo "📊 Database Status:"
echo "=========================================="
docker compose exec backend python check_profiles.py

echo ""
echo "=========================================="
echo "Next Steps:"
echo "=========================================="
echo "1. Register a new user at: http://localhost:3000/register"
echo "2. Complete your profile at: http://localhost:3000/profile"
echo "3. Check profiles anytime with: docker compose exec backend python check_profiles.py"
echo ""
echo "✨ Done!"
