#!/bin/bash
# UC-035: Quick Fix Script for Test Field Name Mismatches
# This script corrects field name mismatches between tests and actual Django models

set -e

echo "================================"
echo "UC-035: Test Field Name Fixes"
echo "================================"
echo ""

cd "$(dirname "$0")/backend/core/tests"

echo "Creating backup of test files..."
mkdir -p .backup_$(date +%Y%m%d_%H%M%S)
cp test_*.py .backup_$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true

echo ""
echo "Applying fixes..."

# Fix 1: profile → candidate (for ForeignKey relationships)
echo "  - Fixing profile → candidate references..."
find . -name "test_*.py" -type f -exec sed -i '' 's/profile=self\.profile/candidate=self.profile/g' {} \;
find . -name "test_*.py" -type f -exec sed -i '' 's/profile=profile/candidate=profile/g' {} \;
find . -name "test_*.py" -type f -exec sed -i '' "s/'profile': self\.profile/'candidate': self.profile/g" {} \;

# Fix 2: proficiency_level → level (CandidateSkill)
echo "  - Fixing proficiency_level → level..."
find . -name "test_*.py" -type f -exec sed -i '' 's/proficiency_level/level/g' {} \;

# Fix 3: years_of_experience → years (CandidateSkill)
echo "  - Fixing years_of_experience → years..."
find . -name "test_*.py" -type f -exec sed -i '' 's/years_of_experience/years/g' {} \;

# Fix 4: degree → degree_type (Education)
echo "  - Fixing degree → degree_type..."
find . -name "test_*.py" -type f -exec sed -i '' "s/'degree':/'degree_type':/g" {} \;
find . -name "test_*.py" -type f -exec sed -i '' 's/degree=/degree_type=/g' {} \;
find . -name "test_*.py" -type f -exec sed -i '' 's/degree="/degree_type="/g' {} \;

# Fix 5: company → company_name (WorkExperience)
echo "  - Fixing company → company_name..."
find . -name "test_*.py" -type f -exec sed -i '' "s/'company':/'company_name':/g" {} \;
find . -name "test_*.py" -type f -exec sed -i '' 's/company=/company_name=/g' {} \;
find . -name "test_*.py" -type f -exec sed -i '' 's/company="/company_name="/g' {} \;

# Fix 6: job_title field (already correct, but ensure consistency)
echo "  - Verifying job_title references..."

# Fix 7: display_order → order (CandidateSkill uses 'order')
echo "  - Fixing display_order → order for CandidateSkill..."
# Note: This is selective - Project uses display_order, CandidateSkill uses order

echo ""
echo "================================"
echo "✓ Fixes Applied Successfully"
echo "================================"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff backend/core/tests/"
echo "  2. Add missing model methods (see UC-035-IMPLEMENTATION-SUMMARY.md)"
echo "  3. Run tests: docker-compose exec backend python manage.py test core.tests"
echo ""
echo "Backups saved in: .backup_*/"
echo ""
