# UC-052 Resume Version Management - Change Tracking Implementation

## What Was Added

### 1. Automatic Change Tracking

**Problem**: User wanted to track all changes made to resume versions automatically.

**Solution**: Implemented `ResumeVersionChange` model that automatically records every edit made to a resume version.

### Backend Changes

#### New Model: `ResumeVersionChange`

**File**: `backend/core/models.py`

**Features**:

- UUID primary key for unique identification
- Links to parent `ResumeVersion` via foreign key
- Tracks change type: `create`, `edit`, `merge`, `duplicate`
- Stores field-level diffs in JSON format
- Automatic timestamp on creation
- Indexed for fast querying

**Fields**:

```python
id: UUID (primary key)
version: ForeignKey to ResumeVersion
change_type: CharField (create/edit/merge/duplicate)
changes: JSONField (field-level diffs)
created_at: DateTimeField (auto-generated)
```

#### Enhanced `ResumeVersion.save()` Method

**File**: `backend/core/models.py`

**Auto-tracking Logic**:

1. Detects if this is an update (not a new creation)
2. Fetches the old version from database
3. Compares fields:
   - `version_name`
   - `description`
   - `content` (full JSON comparison)
   - `latex_content` (tracks length change)
4. Creates a `ResumeVersionChange` record with:
   - Field name
   - Old value
   - New value
5. Only creates record if changes exist

**Example Change Record**:

```json
{
  "version_name": {
    "old": "Software Engineer Resume v1",
    "new": "Senior Software Engineer Resume v1"
  },
  "content": {
    "old": {...previous content...},
    "new": {...updated content...}
  },
  "latex_content": {
    "old": 2450,  // character count
    "new": 2678
  }
}
```

#### New Serializer: `ResumeVersionChangeSerializer`

**File**: `backend/core/serializers.py`

Serializes change records for API responses:

```python
fields: ['id', 'change_type', 'changes', 'created_at']
```

#### Updated History View

**File**: `backend/core/views.py` - `resume_version_history()`

**Enhanced with**:

- Fetches all `ResumeVersionChange` records for the version
- Includes changes in API response
- Handles invalid UUID errors gracefully (was causing "invalid token" error)

**Response Structure**:

```json
{
  "version": {...version details...},
  "parents": [...parent versions...],
  "children": [...derived versions...],
  "changes": [
    {
      "id": "uuid",
      "change_type": "edit",
      "changes": {
        "version_name": {"old": "...", "new": "..."}
      },
      "created_at": "2025-11-11T..."
    }
  ]
}
```

### Frontend Changes

#### Enhanced History Modal

**File**: `frontend/src/components/resume/ResumeVersionControl.js`

**New Features**:

1. **Change Timeline Section**:

   - Shows all edits in chronological order
   - Color-coded by change type
   - Displays timestamp for each change

2. **Field-Level Diff Display**:

   - Before/After comparison for each field
   - Red background for old values
   - Green background for new values
   - Formatted JSON for complex objects

3. **Visual Hierarchy**:
   - Change type badges (Create/Edit/Merge/Duplicate)
   - Organized by field name
   - Clear labeling of "Before" and "After"

**Modal Sections**:

1. **Change History** (NEW)

   - Timeline of all edits
   - Field-by-field diffs
   - Change type indicators

2. **Parent Versions**

   - Shows version lineage
   - Click to view parent details

3. **Derived Versions**
   - Shows child versions
   - Tracks version branching

#### Enhanced Styling

**File**: `frontend/src/components/resume/ResumeVersionControl.css`

**New Styles**:

```css
.changes-timeline - Timeline container
.change-item - Individual change record
.change-header - Type badge and timestamp
.change-type.{create|edit|merge|duplicate} - Color-coded badges
.change-details - Field-level changes
.field-change - Individual field diff
.change-diff - Before/After comparison
.old-value - Red-highlighted old values
.new-value - Green-highlighted new values
```

**Color Coding**:

- **Create**: Green (new version created)
- **Edit**: Blue (content modified)
- **Merge**: Yellow (merged from other version)
- **Duplicate**: Purple (copied from existing)

### Database Migration

**File**: `backend/core/migrations/0014_add_resume_version_changes.py`

**Actions**:

1. Creates `core_resumeversionchange` table
2. Adds foreign key to `core_resumeversion`
3. Creates index on `(version_id, -created_at)` for fast queries
4. Updates indexes on `core_resumeversion` table

**Migration Status**: ✅ Applied successfully

## How It Works

### Workflow

1. **User Creates Version**:

   - Saves resume from AI Generator
   - `ResumeVersion` created with initial content
   - No change record (it's a creation)

2. **User Edits Version**:

   - Updates version name, description, or content
   - `ResumeVersion.save()` detects it's an update
   - Compares old vs new values
   - Creates `ResumeVersionChange` record automatically
   - Stores field-level diffs

3. **User Views History**:
   - Clicks "View History" on any version
   - Backend returns:
     - Parent/child versions (lineage)
     - All change records (edits)
   - Frontend displays:
     - Timeline of changes
     - Field-by-field comparison
     - Color-coded diffs

### Example Timeline

```
Version: "Senior SWE - Google"

📝 Edited - Nov 11, 2025 3:45 PM
   version_name:
   Before: "Software Engineer - Google"
   After: "Senior Software Engineer - Google"

   description:
   Before: "Tailored for backend role"
   After: "Tailored for senior backend role with team lead experience"

📝 Edited - Nov 11, 2025 2:30 PM
   content:
   Before: {...5 years experience...}
   After: {...8 years experience...}

   latex_content:
   Before: 2450 characters
   After: 2678 characters

Created from: "Software Engineer Template"
```

## Fixes Applied

### Issue 1: "Invalid Token" Error

**Problem**: Clicking "View History" showed "invalid token" error

**Root Cause**: Backend wasn't handling invalid UUID formats properly

**Fix**:

- Added `ValueError` exception handling in `resume_version_history()` view
- Now returns proper 404 error with message: "Resume version not found"

**Code Change**:

```python
except (ResumeVersion.DoesNotExist, ValueError):
    return Response({'error': 'Resume version not found'},
                   status=status.HTTP_404_NOT_FOUND)
```

### Issue 2: No Change Tracking

**Problem**: Edits to versions weren't being tracked

**Root Cause**: No mechanism to record changes

**Fix**:

- Created `ResumeVersionChange` model
- Enhanced `ResumeVersion.save()` to auto-track changes
- Updated API to return change history
- Enhanced UI to display changes

## Testing Checklist

### Backend Testing

1. **Create a Version**:

   ```bash
   # POST /api/resume-versions/
   # Should create version without change record
   ```

2. **Edit the Version**:

   ```bash
   # PUT /api/resume-versions/{id}/
   # Should auto-create change record
   ```

3. **View History**:

   ```bash
   # GET /api/resume-versions/{id}/history/
   # Should return version + changes array
   ```

4. **Verify Database**:
   ```bash
   docker-compose exec db psql -U postgres -d yourdb
   SELECT * FROM core_resumeversionchange;
   ```

### Frontend Testing

1. **Save a Resume Version**:

   - Generate resume in AI Generator
   - Click "Save as Version"
   - Enter name and save
   - Verify success

2. **Edit the Version**:

   - Go to Resume → Version Control
   - Click on a version
   - Edit name, description, or content
   - Save changes

3. **View Change History**:

   - Click "View History" button
   - Should see:
     - Change timeline section
     - Each edit with timestamp
     - Field-by-field diffs
     - Color-coded before/after

4. **Verify Change Details**:
   - Old values in red background
   - New values in green background
   - Change type badges (Edit/Create/Merge)
   - Proper timestamps

## Database Schema

### Table: `core_resumeversionchange`

```sql
Column      | Type                     | Description
------------|--------------------------|---------------------------
id          | uuid                     | Primary key
version_id  | uuid                     | FK to core_resumeversion
change_type | varchar(50)              | create/edit/merge/duplicate
changes     | jsonb                    | Field-level diffs
created_at  | timestamp with time zone | Auto-generated timestamp

Indexes:
- PRIMARY KEY on id
- INDEX on (version_id, -created_at) for fast queries
- FOREIGN KEY to core_resumeversion(id) CASCADE
```

## API Changes

### Updated Endpoint: `GET /api/resume-versions/{id}/history/`

**Before**:

```json
{
  "version": {...},
  "parents": [...],
  "children": [...]
}
```

**After**:

```json
{
  "version": {...},
  "parents": [...],
  "children": [...],
  "changes": [
    {
      "id": "uuid",
      "change_type": "edit",
      "changes": {
        "version_name": {"old": "...", "new": "..."},
        "description": {"old": "...", "new": "..."}
      },
      "created_at": "2025-11-11T15:45:00Z"
    }
  ]
}
```

## Files Modified

### Backend

- ✅ `backend/core/models.py` - Added `ResumeVersionChange` model and enhanced `save()`
- ✅ `backend/core/serializers.py` - Added `ResumeVersionChangeSerializer`
- ✅ `backend/core/views.py` - Enhanced `resume_version_history()` view
- ✅ `backend/core/migrations/0014_add_resume_version_changes.py` - New migration

### Frontend

- ✅ `frontend/src/components/resume/ResumeVersionControl.js` - Enhanced history modal
- ✅ `frontend/src/components/resume/ResumeVersionControl.css` - Added change timeline styles

## Next Steps for Users

1. **Save Resume Versions**:

   - Generate resumes in AI Generator
   - Click "Save as Version" to create snapshots

2. **Edit Freely**:

   - Make changes to versions
   - Every edit is automatically tracked
   - No manual "track changes" needed

3. **Review History**:

   - Click "View History" on any version
   - See complete edit timeline
   - Compare before/after for each field

4. **Audit Trail**:
   - Full transparency of all changes
   - Timestamps for every edit
   - Field-level granularity

## Status: ✅ COMPLETE

All change tracking features are now fully implemented:

- ✅ Automatic change detection
- ✅ Field-level diff tracking
- ✅ Change history API
- ✅ Visual timeline in UI
- ✅ Color-coded before/after comparison
- ✅ Fixed "invalid token" error
- ✅ Database migration applied
- ✅ Backend restarted with new code

**The feature is ready for testing!**
