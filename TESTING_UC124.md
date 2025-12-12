# Testing UC-124: Job Application Timing Optimizer

## How to Access the Feature

The Application Timing Optimizer has been integrated into the frontend at:
- **URL**: `/jobs/timing-optimizer`
- **Navigation**: Jobs page → Click "Timing →" button in the header

## Starting the Application

### 1. Start Backend Server
```bash
cd /Users/nishantnair/Downloads/cs-490-project/backend
python3 manage.py runserver
```
Backend will run on http://localhost:8000

### 2. Start Frontend Server (in a new terminal)
```bash
cd /Users/nishantnair/Downloads/cs-490-project/frontend
npm start
```
Frontend will run on http://localhost:3000

## Testing the Feature

### Step 1: Login and Navigate
1. Open http://localhost:3000
2. Login with your credentials
3. Navigate to **Jobs** page from the navigation menu
4. Look for the **"Timing →"** button in the header (yellow/amber colored)
5. Click it to open the Timing Optimizer

### Step 2: Test Schedule Tab
**Schedule future application submissions:**

1. You should see a form to "Schedule New Submission"
2. Fill in the form:
   - Select a **Job Entry** from dropdown
   - Choose a **Scheduled Date & Time** (future date)
   - Select your **Time Zone**
   - Choose **Submission Method** (email/website)
   - Set **Priority** (low/medium/high)
   - Add optional **Notes**
3. Click **"Schedule Submission"**
4. Your scheduled submission should appear in the list below
5. Try these actions on a scheduled item:
   - **Reschedule**: Change the date/time
   - **Execute Now**: Submit immediately
   - **Cancel**: Mark as cancelled
   - **Delete**: Remove completely

### Step 3: Test Reminders Tab
**Set reminders for application deadlines:**

1. Click the **"Reminders"** tab
2. Click **"Add Reminder"** button
3. Fill in the form:
   - Select **Job Entry**
   - Choose **Reminder Type** (application deadline, follow-up, etc.)
   - Enter **Subject** and **Message Template**
   - Set **Scheduled Date & Time**
   - Optional: Enable **Recurring** and set interval in days
4. Click **"Create Reminder"**
5. Your reminder appears in the list
6. Try **"Dismiss"** button to mark a reminder as complete
7. For recurring reminders, it should create the next occurrence automatically

### Step 4: Test Analytics Tab
**View timing best practices and response rate patterns:**

1. Click the **"Analytics"** tab
2. You should see:
   - **Best Practices** section with timing recommendations:
     - Optimal days to apply (Tuesday-Thursday)
     - Best times (morning: 6-10 AM)
     - Days to avoid (weekends)
   - **Your Response Rate by Day** - bar chart showing which days get best responses
   - **Your Response Rate by Hour** - bar chart showing optimal hours
   - **Recommendations** based on your data
3. Click **"Refresh Analytics"** to recalculate from latest data

### Step 5: Test Calendar Tab
**View calendar of scheduled and completed applications:**

1. Click the **"Calendar"** tab
2. Select date range:
   - **Start Date** and **End Date**
3. Click **"Load Calendar"**
4. You should see:
   - **Scheduled Submissions** (blue)
   - **Completed Applications** (green)
   - Each entry shows job title, company, and date

## Expected Behavior

### Scheduled Submissions
- ✅ Can only schedule future dates (past dates show error)
- ✅ Status filters work: pending, completed, cancelled, failed
- ✅ Execute button submits immediately
- ✅ Reschedule updates the datetime
- ✅ Cancel changes status to cancelled
- ✅ Delete removes from database

### Reminders
- ✅ Can create one-time or recurring reminders
- ✅ Recurring reminders create next occurrence when dismissed
- ✅ Status filters work: pending, sent, dismissed
- ✅ Dismiss marks as complete and sets sent_at timestamp
- ✅ Email notifications sent via Celery (check backend console)

### Analytics
- ✅ Best practices always show consistent recommendations
- ✅ Response rate charts populate when you have application data
- ✅ Empty state shows "No data available" message
- ✅ Recommendations appear when patterns detected

### Calendar
- ✅ Shows both scheduled (future) and completed (past) applications
- ✅ Date range filtering works
- ✅ Each event displays job details

## Backend Celery Tasks (Automated)

These run in the background when Celery is running:

1. **Process Due Submissions**: Every 5 minutes, checks for submissions due and executes them
2. **Send Reminders**: Every 5 minutes, sends emails for due reminders
3. **Check Upcoming Deadlines**: Daily, creates reminders for deadlines in 3 days

To enable these, start Celery:
```bash
cd /Users/nishantnair/Downloads/cs-490-project/backend
celery -A backend worker -l info
```

## API Endpoints Available

All endpoints are prefixed with `/api/`:

- `GET/POST /scheduled-submissions/` - List/create scheduled submissions
- `GET /scheduled-submissions/{id}/` - Get details
- `PUT /scheduled-submissions/{id}/` - Update/reschedule
- `DELETE /scheduled-submissions/{id}/` - Delete
- `POST /scheduled-submissions/{id}/execute/` - Execute immediately
- `GET/POST /reminders/` - List/create reminders
- `PUT /reminders/{id}/dismiss/` - Dismiss reminder
- `GET /application-timing/best-practices/` - Get timing recommendations
- `GET /application-timing/analytics/` - Get response rate data
- `GET /application-timing/calendar/` - Get calendar view data

## Troubleshooting

### Feature not visible?
- Clear browser cache (Cmd+Shift+R on Mac)
- Check browser console for errors (F12 → Console tab)

### Scheduled submissions not executing?
- Start Celery worker (see above)
- Check backend terminal for Celery task output

### No analytics data?
- You need job applications with response data
- Add some jobs with status: applied, phone_screen, interview, offer
- Add different submitted_at times/dates for variety

### Reminders not sending?
- Email requires SMTP configuration in backend/.env
- Check EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD
- Celery must be running

## Test Data Creation

To quickly test with data, you can:

1. **Create some jobs** on the Jobs page
2. **Schedule submissions** for different times/days
3. **Add reminders** with various types
4. **Update job statuses** to applied/interview to generate response data
5. **Check analytics** to see patterns

## Success Indicators

✅ You should be able to:
- Schedule future submissions without errors
- See scheduled items in the list
- Filter by status (pending/completed/cancelled)
- Execute, reschedule, or cancel submissions
- Create reminders (one-time and recurring)
- Dismiss reminders
- View timing best practices
- See response rate charts (with data)
- View calendar with scheduled/completed items
- Navigate between all 4 tabs smoothly

## Questions or Issues?

If you encounter any issues:
1. Check browser console (F12) for JavaScript errors
2. Check backend terminal for Python errors
3. Verify both servers are running
4. Ensure you're logged in with a valid account
