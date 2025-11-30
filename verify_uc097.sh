#!/bin/bash

# UC-097 User Flow Testing Script
# This script helps verify that all components are working correctly

echo "🔍 UC-097: Application Success Rate Analysis - Quick Verification"
echo "================================================================"
echo ""

# Check if services are running
echo "1️⃣  Checking Docker Services..."
if docker compose ps | grep -q "Up"; then
    echo "   ✅ Docker services are running"
else
    echo "   ❌ Docker services are not running"
    echo "   Run: docker compose up -d"
    exit 1
fi
echo ""

# Check backend health
echo "2️⃣  Checking Backend API..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/auth/verify-token)
if [ "$BACKEND_STATUS" = "401" ] || [ "$BACKEND_STATUS" = "200" ]; then
    echo "   ✅ Backend API is responding (status: $BACKEND_STATUS)"
else
    echo "   ⚠️  Backend API status: $BACKEND_STATUS"
fi
echo ""

# Check frontend
echo "3️⃣  Checking Frontend..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "   ✅ Frontend is accessible"
else
    echo "   ❌ Frontend is not accessible (status: $FRONTEND_STATUS)"
fi
echo ""

# Check test data
echo "4️⃣  Verifying Test Data..."
JOB_COUNT=$(docker compose exec -T backend python manage.py shell -c "from core.models import JobEntry; print(JobEntry.objects.count())" 2>/dev/null | grep -o '[0-9]\+' | tail -1)
if [ -n "$JOB_COUNT" ] && [ "$JOB_COUNT" -gt "0" ]; then
    echo "   ✅ Found $JOB_COUNT job applications in database"
else
    echo "   ⚠️  No test data found. Run: cd backend && python create_uc097_test_data.py"
fi
echo ""

# Check UC-097 specific fields
echo "5️⃣  Checking UC-097 Fields..."
HAS_UC097_DATA=$(docker compose exec -T backend python manage.py shell -c "
from core.models import JobEntry
count = JobEntry.objects.exclude(application_source='').count()
print(count)
" 2>/dev/null | grep -o '[0-9]\+' | tail -1)

if [ -n "$HAS_UC097_DATA" ] && [ "$HAS_UC097_DATA" -gt "0" ]; then
    echo "   ✅ Found $HAS_UC097_DATA applications with UC-097 tracking data"
else
    echo "   ⚠️  UC-097 fields are empty. Run: cd backend && python create_uc097_test_data.py"
fi
echo ""

echo "================================================================"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Open browser: http://localhost:3000"
echo "2. Login with test account: test@example.com"
echo "3. Navigate to: Analytics → Success Analysis tab"
echo "4. Follow the testing guide in: UC-097-USER-TESTING-GUIDE.md"
echo ""
echo "🎯 Key URLs:"
echo "   Frontend:  http://localhost:3000/analytics"
echo "   Backend:   http://localhost:8000/api/jobs/success-analysis"
echo "   Docs:      UC-097-USER-TESTING-GUIDE.md"
echo ""
echo "================================================================"
