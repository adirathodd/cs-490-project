# Frontend Testing Guide: Resume Sharing & Feedback System

## Quick Start Testing

### Prerequisites

- Backend server running
- Frontend development server running
- At least one resume version created

---

## Test 1: Create and Copy Share Link ✅

**Steps:**

1. Navigate to `/resume/versions`
2. Find any resume version in the list
3. Click the 🔗 (link/share) icon button
4. Modal opens: "Share Resume"
5. Leave default settings (Public, Comments allowed)
6. Click "Create Share Link"
7. Green success box appears with link
8. Click "Copy Link" button
9. Button changes to "Link Copied!" with checkmark ✓
10. Click "Done" to close modal

**Expected Result:**

- Link is copied to clipboard
- Can paste in browser/text editor
- Format: `http://localhost:3000/shared-resume/{token}`

---

## Test 2: View Shared Resume (Public) ✅

**Steps:**

1. Copy share link from Test 1
2. Open in **incognito/private browser window**
3. Paste link and navigate
4. Beautiful purple gradient page appears
5. Form asks for "Your Name" and "Your Email"
6. Enter: Name: "Test Reviewer", Email: "reviewer@test.com"
7. Click "View Resume"
8. Resume content loads
9. Shows resume version details
10. Download button appears (if enabled)

**Expected Result:**

- Access granted after providing info
- Resume displays cleanly
- Professional design with gradient header

---

## Test 3: Password Protected Share ✅

**Steps:**

1. Create new share with:
   - Privacy: "Password protected"
   - Password: "TestPass123"
   - Comments: Enabled
2. Copy link
3. Open in incognito browser
4. See password form with lock icon
5. Enter wrong password: "WrongPass"
6. Error: "Invalid password"
7. Enter correct: "TestPass123"
8. Also provide name and email
9. Click "View Resume"
10. Resume loads successfully

**Expected Result:**

- Password required before access
- Wrong password rejected
- Correct password grants access

---

## Test 4: Email Restricted Share ✅

**Steps:**

1. Create new share with:
   - Privacy: "Specific email addresses"
   - Allowed Emails: "mentor@company.com"
2. Copy link
3. Open in incognito
4. Enter name and email: "other@test.com"
5. Click "View Resume"
6. Error: "Your email is not authorized"
7. Back button, enter: "mentor@company.com"
8. Click "View Resume"
9. Resume loads successfully

**Expected Result:**

- Non-allowed email rejected
- Allowed email granted access

---

## Test 5: View Feedback Panel ✅

**Steps:**

1. Return to logged-in account
2. Navigate to `/resume/versions`
3. Find version that has feedback (or create test feedback)
4. Click 📋 (clipboard/feedback) icon button
5. FeedbackPanel slides in from right
6. Shows list of feedback items
7. Each shows:
   - Reviewer name
   - Star rating (if provided)
   - Date
   - Status badge (Pending/Resolved)
8. Click filter tabs: All / Pending / Resolved
9. List updates based on filter

**Expected Result:**

- Panel displays all feedback
- Filters work correctly
- Clean, organized layout

---

## Test 6: View Feedback Details ✅

**Steps:**

1. In FeedbackPanel (from Test 5)
2. Click on any feedback item
3. Details section expands or loads
4. Shows:
   - Overall comment
   - Star rating visualization (⭐⭐⭐⭐⭐)
   - All comments in threaded format
   - Section references for comments
   - Highlighted text (if any)
   - Comment types (suggestion, issue, praise)
5. Nested replies indent properly

**Expected Result:**

- Full feedback details visible
- Comments organized by thread
- Professional comment cards

---

## Test 7: Resolve Feedback ✅

**Steps:**

1. In FeedbackPanel with details open
2. Find "Pending" feedback item
3. Click "Mark Resolved" button
4. Prompt appears: "Add resolution notes"
5. Enter: "Fixed grammar issues mentioned"
6. Click OK
7. Feedback status updates to "Resolved"
8. Resolved badge appears (green)
9. Resolution timestamp shows
10. Filter to "Resolved" - item appears there
11. Filter to "Pending" - item disappears

**Expected Result:**

- Feedback marked as resolved
- Status updates immediately
- Filters work correctly

---

## Test 8: Resolve Individual Comments ✅

**Steps:**

1. Open feedback details with multiple comments
2. Find a pending comment
3. Hover over comment
4. Click "Mark Resolved" link/button
5. Comment status updates
6. ✓ checkmark or badge appears
7. Comment stays visible but marked
8. Other comments remain pending

**Expected Result:**

- Individual comment resolution works
- Visual indicator appears
- Other comments unaffected

---

## Test 9: Delete Feedback ✅

**Steps:**

1. In FeedbackPanel
2. Select a feedback item (preferably test data)
3. Click "Delete" button
4. Confirmation dialog: "Are you sure?"
5. Click "Yes" or "Confirm"
6. Feedback item disappears from list
7. Panel refreshes
8. Deleted feedback no longer appears

**Expected Result:**

- Confirmation required
- Feedback deleted successfully
- List updates immediately

---

## Test 10: Privacy Settings Variations ✅

**Test each privacy level:**

### A. Public

- ✅ Only name/email required
- ✅ No additional restrictions

### B. Password Protected

- ✅ Password field appears
- ✅ Name/email also required
- ✅ Wrong password denied

### C. Email Verified

- ✅ Email checked against allowlist
- ✅ Allowed domains work (e.g., @company.com)
- ✅ Specific emails work

### D. Private

- ✅ Only owner can access
- ✅ Creates share for testing

---

## Test 11: Share Permissions ✅

**Test permission toggles:**

### Allow Comments: OFF

1. Create share with comments disabled
2. Open shared link
3. No feedback form appears
4. Message: "Comments not allowed"

### Allow Download: OFF

1. Create share with downloads disabled
2. Open shared link
3. No download button appears

### Require Reviewer Info: OFF

1. Create share with this unchecked
2. Open shared link
3. No name/email form (for public shares)
4. Direct access to resume

---

## Test 12: Expiration Enforcement ✅

**Steps:**

1. Create share with expiration set to past date
2. Copy link
3. Open in incognito
4. Error: "This share link has expired"
5. Status code: 410 Gone
6. Cannot access resume

**Expected Result:**

- Expired shares blocked
- Clear error message

---

## Test 13: Multiple Shares per Version ✅

**Steps:**

1. Select one resume version
2. Click share button
3. Create first share (Public)
4. Close modal
5. Click share button again
6. Create second share (Password protected)
7. Both shares work independently
8. Different privacy settings
9. Separate access logs

**Expected Result:**

- Multiple shares allowed per version
- Each has unique token
- Independent access control

---

## Test 14: Visual Feedback & UX ✅

**Check these UI elements:**

### ShareResumeModal

- ✅ Modal centers on screen
- ✅ Close button (×) works
- ✅ Privacy dropdown changes form fields dynamically
- ✅ Password field appears/disappears
- ✅ Email fields appear/disappears
- ✅ Checkboxes toggle properly
- ✅ Date picker works
- ✅ Character counter on message textarea
- ✅ "Creating..." shows loading spinner
- ✅ Success box is bright green
- ✅ Link is selectable and copyable
- ✅ Copy button shows feedback

### SharedResumeView

- ✅ Purple gradient background
- ✅ White card centered
- ✅ Lock icon for access form
- ✅ Input fields styled consistently
- ✅ Submit button has hover effect
- ✅ Loading spinner while accessing
- ✅ Error messages display in red
- ✅ Resume content readable
- ✅ Professional footer

### FeedbackPanel

- ✅ Slides in from right
- ✅ Close button (×) works
- ✅ Filter tabs highlight active
- ✅ Feedback cards have hover effect
- ✅ Star ratings render correctly
- ✅ Status badges color-coded
- ✅ Comments indent properly
- ✅ Action buttons styled consistently

---

## Test 15: Mobile Responsiveness ✅

**Test on mobile viewport (375px width):**

1. ShareResumeModal

   - ✅ Modal fits screen
   - ✅ Inputs stack vertically
   - ✅ Buttons full width
   - ✅ Text readable

2. SharedResumeView

   - ✅ Gradient scales
   - ✅ Form card fits
   - ✅ Resume content scrollable
   - ✅ Touch targets large enough

3. FeedbackPanel
   - ✅ Panel full width on mobile
   - ✅ Comments readable
   - ✅ Actions accessible

---

## Common Issues & Solutions

### Issue: Link doesn't copy

**Solution:** Check browser clipboard permissions. Try in different browser.

### Issue: "Network Error" when creating share

**Solution:**

- Check backend is running (`python manage.py runserver`)
- Verify API URL in frontend config
- Check browser console for CORS errors

### Issue: Shared link shows 404

**Solution:**

- Verify route added to App.js: `/shared-resume/:shareToken`
- Check token in URL matches database
- Ensure SharedResumeView component imported

### Issue: Password always fails

**Solution:**

- Check backend is hashing password correctly
- Verify POST data format
- Check Django settings for password hashers

### Issue: Feedback not appearing

**Solution:**

- Check version_id filter
- Verify feedback linked to correct version
- Check API response in Network tab

---

## API Testing (Optional)

Use Postman or curl to test API directly:

```bash
# Create share
curl -X POST http://localhost:8000/api/resume-shares/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_version_id": "UUID_HERE",
    "privacy_level": "public",
    "allow_comments": true
  }'

# View shared resume
curl -X POST http://localhost:8000/api/shared-resume/TOKEN_HERE/ \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer_name": "Test User",
    "reviewer_email": "test@example.com"
  }'

# List feedback
curl -X GET http://localhost:8000/api/feedback/?version_id=UUID_HERE \
  -H "Authorization: Bearer YOUR_TOKEN"

# Export feedback
curl -X POST http://localhost:8000/api/feedback/export/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version_id": "UUID_HERE"}'
```

---

## Checklist Summary

- [ ] Test 1: Create and copy share link
- [ ] Test 2: View shared resume (public)
- [ ] Test 3: Password protected share
- [ ] Test 4: Email restricted share
- [ ] Test 5: View feedback panel
- [ ] Test 6: View feedback details
- [ ] Test 7: Resolve feedback
- [ ] Test 8: Resolve individual comments
- [ ] Test 9: Delete feedback
- [ ] Test 10: Privacy settings variations
- [ ] Test 11: Share permissions
- [ ] Test 12: Expiration enforcement
- [ ] Test 13: Multiple shares per version
- [ ] Test 14: Visual feedback & UX
- [ ] Test 15: Mobile responsiveness

---

## Success Criteria

✅ All tests pass
✅ No console errors
✅ No network errors (except expected ones like wrong password)
✅ UI is responsive and professional
✅ User experience is smooth and intuitive
✅ Privacy controls work as expected
✅ Feedback system is functional

---

**Testing Complete!** 🎉

If all tests pass, the Resume Sharing and Feedback System is ready for production use.
