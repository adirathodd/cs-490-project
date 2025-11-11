# ATS Backend - Django Application

This is the backend for the ATS (Applicant Tracking System) for Candidates project, built with Django and PostgreSQL.

## 🗄️ Database Schema

The application includes a comprehensive database design covering:

### Core Models
- **User & Profile Management**: CandidateProfile, WorkExperience, Education, Certification, Achievement
- **Skills**: Skill, CandidateSkill (with proficiency levels)
- **Companies**: Company, CompanyResearch, JobOpportunity, JobRequirement, SalaryData
- **Applications**: Application, ApplicationStage, Interview
- **Documents**: Document (resumes, cover letters, portfolios with versioning)

### Collaboration & Networking
- **Contacts**: Professional connections and relationships
- **Referrals**: Track warm introductions and referral status
- **Team Members**: Multi-user collaboration (coaches, mentors, partners)
- **Shared Notes**: Collaborative feedback on applications

### Interview Preparation
- **Interview Questions**: Question bank by type and difficulty
- **Interview Prep Sessions**: Track practice sessions
- **Mock Interviews**: Video practice with AI/mentor feedback

### Analytics & Intelligence
- **User Activity**: Track all user actions for insights
- **Performance Metrics**: Application success rates, conversion rates
- **Success Patterns**: AI-identified patterns in successful applications
- **Market Intelligence**: Salary benchmarks and market trends

### AI & Automation
- **AI Generation Log**: Track AI-generated content (resumes, cover letters, etc.)
- **Automation Rules**: User-defined workflow automations

### Notifications
- **Reminders**: Follow-ups, deadlines, interview prep
- **Notifications**: System notifications and alerts

## 🚀 Getting Started

### Prerequisites
- Docker and Docker Compose
- Python 3.12+ (for local development)

### Using Docker (Recommended)

1. **Start all services:**
   ```bash
   docker compose up -d
   ```

2. **Run migrations:**
   ```bash
   docker compose exec backend python manage.py migrate
   ```

3. **Create a superuser:**
   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

4. **Access the application:**
   - Backend API: http://localhost:8000
   - Admin Panel: http://localhost:8000/admin
   - Frontend: http://localhost:3000

### Local Development (Without Docker)

1. **Create a virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Install the Tectonic LaTeX engine** (required for AI resume PDFs):
   ```bash
   brew install tectonic  # macOS
   # or download from https://tectonic-typesetting.github.io/ and ensure the binary is on PATH
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

5. **Create a superuser:**
   ```bash
   python manage.py createsuperuser
   ```

6. **Run the development server:**
   ```bash
   python manage.py runserver
   ```

## 📊 Database Management

### Create Migrations
After modifying models:
```bash
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py migrate
```

### Reset Database
To start fresh (⚠️ deletes all data):
```bash
docker compose down -v
docker compose up -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

### Backup Database
```bash
docker compose exec db pg_dump -U postgres yourdb > backup.sql
```

### Restore Database
```bash
docker compose exec -T db psql -U postgres yourdb < backup.sql
```

## 🔧 Useful Commands

### Django Management
```bash
# Make migrations
docker compose exec backend python manage.py makemigrations

# Apply migrations
docker compose exec backend python manage.py migrate

# Create superuser
docker compose exec backend python manage.py createsuperuser

# Start Django shell
docker compose exec backend python manage.py shell

# Collect static files
docker compose exec backend python manage.py collectstatic

# Run tests
docker compose exec backend python manage.py test
```

### Scheduled Deadline Reminder Emails

This project includes a lightweight daily scheduler service (`reminders`) that sends email notifications for job application deadlines (3-days-before and day-of) using the management command `send_deadline_reminders`.

Service definition lives in `docker-compose.yaml` under `reminders` and uses the same backend image. It runs the script:

```
backend/scripts/run_deadline_reminder_loop.sh
```

Behavior:
- Sleeps until the next 9:00 AM America/New_York occurrence (DST aware) then runs.
- After each run computes sleep until the next day’s 9:00 AM.
- Timezone and hour/minute are configurable via environment variables.

#### Enable / Start
If you've already updated your compose file:
```bash
docker compose up -d reminders
```

#### Adjust Target Time
Edit the `reminders` service environment section in `docker-compose.yaml`:
```yaml
      environment:
         REMINDERS_TZ: America/New_York   # Any valid IANA tz
         REMINDERS_HOUR: 9                # 0-23
         REMINDERS_MINUTE: 0              # 0-59
```
Then rebuild/restart:
```bash
docker compose up -d --build reminders
```

#### Manual Run / Test
```bash
docker compose exec backend python manage.py send_deadline_reminders
```

#### Logs
```bash
docker compose logs -f reminders
```

#### Disable
```bash
docker compose stop reminders
```

For more advanced scheduling (retry logic, precise cron expressions, distributed tasks), consider introducing Celery Beat or a dedicated cron container later.

### Scheduled Interview Reminder Emails

This project includes an hourly scheduler service for sending interview reminder emails. The system sends reminders in two ways:

1. **Automatic reminders for interviews 24 hours away**: The management command `send_interview_reminders` runs every hour to check for upcoming interviews.
2. **Immediate reminders for last-minute interviews**: When an interview is scheduled with less than 24 hours notice, an email is sent immediately via Django signals.

Service definition can be added to `docker-compose.yaml`:

```yaml
interview-reminders:
  build: ./backend
  command: sh scripts/run_interview_reminder_loop.sh
  volumes:
    - ./backend:/app
  depends_on:
    - db
  environment:
    - INTERVIEW_REMINDER_INTERVAL=3600  # Run every hour (in seconds)
```

Behavior:
- Runs immediately on startup, then every hour (configurable)
- Checks for interviews scheduled 24-26 hours in the future
- Sends formatted HTML emails with interview details, preparation notes, and meeting links
- Immediate emails sent automatically when scheduling interviews with <24h notice

#### Manual Run / Test
```bash
# Test the command
docker compose exec backend python manage.py send_interview_reminders

# Create a test interview to trigger immediate email (if scheduled <24h from now)
docker compose exec backend python manage.py shell -c "
from core.models import InterviewSchedule, JobEntry, CandidateProfile
from django.utils import timezone
from datetime import timedelta

# Get first job and candidate
job = JobEntry.objects.first()
candidate = CandidateProfile.objects.first()

if job and candidate:
    # Create interview 12 hours from now
    interview = InterviewSchedule.objects.create(
        job=job,
        candidate=candidate,
        interview_type='video',
        scheduled_at=timezone.now() + timedelta(hours=12),
        duration_minutes=60,
        meeting_link='https://zoom.us/test',
        interviewer_name='Test Interviewer',
        preparation_notes='This is a test interview',
    )
    print(f'Created interview: {interview}')
    print('An immediate reminder email should have been sent!')
else:
    print('No job or candidate found')
"
```

#### Adjust Run Interval
Edit the environment variable in `docker-compose.yaml`:
```yaml
environment:
  INTERVIEW_REMINDER_INTERVAL: 3600  # Seconds (3600 = 1 hour, 1800 = 30 min)
```

#### Logs
```bash
docker compose logs -f interview-reminders
```

### Company Data Management

Populate and manage company information for the job tracking system:

```bash
# Populate database with curated top tech companies (Google, Microsoft, Amazon, etc.)
docker compose exec backend python manage.py populate_companies

# Fetch real company data from free APIs (Clearbit + GitHub)
docker compose exec backend python manage.py fetch_company_data --limit 50

# View all companies in database
docker compose exec backend python manage.py shell -c "from core.models import Company, CompanyResearch; print(f'Total Companies: {Company.objects.count()}'); [print(f'  - {c.name} ({c.domain})') for c in Company.objects.all()]"

# View detailed company information
docker compose exec backend python manage.py shell -c "
from core.models import Company
companies = Company.objects.all()
for c in companies[:5]:  # Show first 5
    print(f'\n{c.name}:')
    print(f'  Industry: {c.industry}')
    print(f'  Location: {c.hq_location}')
    if hasattr(c, 'research'):
        r = c.research
        print(f'  Employees: {r.employee_count:,}' if r.employee_count else '  Employees: N/A')
        print(f'  Rating: {r.glassdoor_rating}/5.0' if r.glassdoor_rating else '  Rating: N/A')
        print(f'  Description: {r.description[:100]}...')
"

# Check specific company by name
docker compose exec backend python manage.py shell -c "from core.models import Company; c = Company.objects.filter(name__icontains='Google').first(); print(f'{c.name}: {c.domain}') if c else print('Not found')"

# Count companies by industry
docker compose exec backend python manage.py shell -c "from core.models import Company; from django.db.models import Count; for item in Company.objects.values('industry').annotate(count=Count('id')).order_by('-count'): print(f'{item[\"industry\"]}: {item[\"count\"]}')"
```

### Inspect Important Tables
Quickly list counts and sample rows from key tables:

```bash
# Curated important tables (default, 10 rows each)
docker compose exec backend python manage.py show_important_tables

# Show more rows
docker compose exec backend python manage.py show_important_tables --limit 25

# Order rows (e.g., newest first by created_at when available)
docker compose exec backend python manage.py show_important_tables --order -created_at

# Include all models defined in core.models
docker compose exec backend python manage.py show_important_tables --all

# Only specific models by name
docker compose exec backend python manage.py show_important_tables --models UserAccount CandidateProfile Education
```

### Database Operations
```bash
# Access PostgreSQL shell
docker compose exec db psql -U postgres yourdb

# Show all tables
docker compose exec db psql -U postgres yourdb -c "\dt"

# View database size
docker compose exec db psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('yourdb'));"
```

### Container Management
```bash
# View logs
docker compose logs backend
docker compose logs -f backend  # Follow logs

# Restart services
docker compose restart backend

# Stop all services
docker compose down

# Stop and remove volumes (⚠️ deletes data)
docker compose down -v
```

## 🔐 Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Generate a service account key (JSON file)
3. Place it in the backend directory or set the path in `.env`:
   ```
   FIREBASE_CREDENTIALS=/path/to/firebase-service-account.json
   ```

## ✉️ Email Settings

- Outgoing emails use SMTP settings from `backend/.env`.
- To change the sender address, set `DEFAULT_FROM_EMAIL` in `backend/.env`.
- Current default sender: `resumerocket123@gmail.com` (can be overridden via env).
- If using Gmail SMTP, it's recommended that `EMAIL_HOST_USER` matches `DEFAULT_FROM_EMAIL` and that you use an App Password.

### Gmail SMTP (App Password) Checklist

If you're using Gmail to send emails from the backend, follow these steps:

1. Enable 2-Step Verification (2FA) on the Gmail account.
2. Create an App Password in Google Account Security:
   - Select App: "Mail"
   - Select Device: "Other (Custom name)" (any name is fine)
   - Copy the generated 16-character password (no spaces).
3. Configure `backend/.env`:
   ```env
   DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USE_TLS=true
   EMAIL_USE_SSL=false
   EMAIL_HOST_USER=resumerocket123@gmail.com
   EMAIL_HOST_PASSWORD=<16-char-app-password-without-spaces>
   DEFAULT_FROM_EMAIL=resumerocket123@gmail.com
   ```
4. Reload the backend to apply changes:
   - Restart: `docker compose restart backend`
   - If you edited `backend/.env` and it is mounted into the container, restart is enough. If the env is baked into the image, rebuild: `docker compose up -d --build backend`.
5. Test send:
   - Trigger a real flow (e.g., account deletion request), or
   - Use a quick Django shell snippet to send a test email.

Troubleshooting:
- SMTPAuthenticationError 535 (Bad Credentials): Regenerate the App Password and ensure it's pasted as a single 16-character string without spaces.
- No email received: Check Spam/Promotions and ensure `DEFAULT_FROM_EMAIL` matches `EMAIL_HOST_USER`.

## 📁 Project Structure

```
backend/
├── backend/                  # Django project settings
│   ├── __init__.py
│   ├── settings.py          # Main settings
│   ├── urls.py              # URL routing
│   ├── wsgi.py              # WSGI config
│   ├── asgi.py              # ASGI config
│   └── requirements.txt     # Python dependencies
├── core/                     # Main application
│   ├── models.py            # Database models (30+ models)
│   ├── admin.py             # Django admin configuration
│   ├── apps.py              # App configuration
│   └── __init__.py
├── manage.py                # Django management script
├── Dockerfile               # Docker configuration
└── .env.example             # Environment variables template
```

## 🧪 Testing

Run the test suite:
```bash
docker compose exec backend python manage.py test
```

Run with coverage:
```bash
docker compose exec backend python manage.py test --coverage
```

## 📝 API Documentation

Once the server is running, you can:
- Access the Django admin at `/admin`
- View the browsable API (if DRF is configured) at `/api/`

## 🛠️ Technology Stack

- **Framework**: Django 5.2.7
- **Database**: PostgreSQL 15
- **Cache/Queue**: Redis 7
- **Python**: 3.12
- **Key Libraries**:
  - Django REST Framework (API)
  - Firebase Admin (Authentication & Firestore)
  - Celery (Background tasks)
  - Pillow (Image processing)

## 🔍 Troubleshooting

### Port Already in Use
If port 8000 is already in use:
```bash
docker compose down
# Or change the port in docker-compose.yaml
```

### Database Connection Issues
```bash
# Check if database is running
docker compose ps

# Restart database
docker compose restart db

# Check database logs
docker compose logs db
```

### Migration Issues
```bash
# Show migration status
docker compose exec backend python manage.py showmigrations

# Fake a migration (if needed)
docker compose exec backend python manage.py migrate --fake core
```

## 📚 Additional Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes
3. Run tests
4. Submit a pull request

## 📄 License

This project is part of the CS490 Capstone Project.
