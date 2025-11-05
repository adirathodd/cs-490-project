#!/bin/bash
# UC-035: Test Suite Runner
# Run comprehensive backend tests with coverage reporting

set -e

echo "================================"
echo "UC-035: Backend Test Suite"
echo "================================"

# Navigate to backend directory
cd "$(dirname "$0")"

echo ""
echo "Step 1: Installing test dependencies..."
pip install -q factory-boy==3.3.0 coverage==7.4.0 Faker==35.2.0

echo ""
echo "Step 2: Running test suite with coverage..."
coverage run --source='core' manage.py test core.tests --verbosity=2

echo ""
echo "Step 3: Generating coverage report..."
coverage report

echo ""
echo "Step 4: Generating HTML coverage report..."
coverage html

echo ""
echo "================================"
echo "✓ Test Results Summary"
echo "================================"
coverage report --skip-covered

echo ""
echo "HTML coverage report available at: htmlcov/index.html"
echo ""
echo "To view detailed coverage:"
echo "  open htmlcov/index.html"
echo ""
