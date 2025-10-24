#!/bin/bash

# UC-022 Docker Setup Script
# This script rebuilds Docker containers with the new dependencies (Pillow, psycopg2-binary)

echo "🔧 UC-022: Rebuilding Docker containers with new dependencies..."
echo ""

# Navigate to project root
cd "$(dirname "$0")"

echo "Step 1: Stopping existing containers..."
docker-compose down

echo ""
echo "Step 2: Removing old images to ensure clean build..."
docker-compose rm -f

echo ""
echo "Step 3: Building containers with new dependencies (this may take a few minutes)..."
docker-compose build --no-cache

echo ""
echo "Step 4: Starting containers..."
docker-compose up -d

echo ""
echo "⏳ Waiting for database to be ready..."
sleep 10

echo ""
echo "Step 5: Running migrations..."
docker-compose exec backend python manage.py migrate

echo ""
echo "Step 6: Creating media directory..."
docker-compose exec backend mkdir -p /app/media/profile_pictures
docker-compose exec backend chmod -R 755 /app/media

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Install frontend dependencies:"
echo "   cd frontend && npm install"
echo ""
echo "2. View logs:"
echo "   docker-compose logs -f"
echo ""
echo "3. Access the application:"
echo "   - Backend: http://localhost:8000"
echo "   - Frontend: http://localhost:3000"
echo ""
