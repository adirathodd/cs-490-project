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
