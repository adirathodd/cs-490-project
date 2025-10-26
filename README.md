# ATS for Candidates
*CS 490 Capstone Project - Fall 2025*

## Executive Summary

This project creates an Applicant Tracking System designed specifically for job candidates, flipping the traditional employer-centric ATS model to empower job seekers with the same tools that employers use to manage their hiring process. The platform leverages AI-powered automation to streamline the job search experience, enabling candidates to take control of their career journey with intelligent application management, personalized content generation, and data-driven insights.

## Business Concept

As a capstone project presented in a business startup format, this ATS for candidates addresses the gap in the job search market where candidates lack the organizational tools and intelligence that employers take for granted. The platform democratizes access to professional-grade career management technology, creating a new category of candidate-centric career software.

### Market Opportunity
- **$4.5B** global job board market size (2024)
- **73%** of job seekers use multiple platforms simultaneously
- **Average job search duration**: 3-6 months for professionals
- **Pain points**: Disorganized applications, generic resumes, poor follow-up tracking

### Value Proposition
Transform chaotic job searching into a strategic, organized, and data-driven process that increases interview rates and accelerates career advancement.

## Core Features & Capabilities

### 🎯 **Candidate Profile Management**
- **LinkedIn-style Professional Profiles**: Comprehensive career history, skills, achievements
- **Multi-format Document Upload**: Resumes, portfolios, certifications, performance reviews
- **Skills Assessment & Validation**: AI-powered skill gap analysis
- **Career Timeline Visualization**: Track professional growth and career progression

### 🤖 **AI-Powered Content Generation**
- **Custom Resume Builder**: Dynamically tailored resumes based on specific job postings
- **Intelligent Cover Letters**: Personalized cover letters referencing company research and role requirements
- **Application Optimization**: Content suggestions to improve ATS compatibility and keyword matching
- **Professional Communication Templates**: Follow-up emails, LinkedIn messages, thank-you notes

### 📊 **Job Application Tracking System**
- **Visual Pipeline Management**: Kanban-style boards tracking applications from "Interested" to "Offer"
- **Application Status Automation**: Automatic status updates and deadline reminders
- **Interview Scheduling Integration**: Calendar management and preparation workflows
- **Outcome Analytics**: Success rate tracking and performance insights

### 🎤 **Interview Preparation Suite**
- **Company Research Automation**: AI-generated company profiles, recent news, culture insights
- **Role-Specific Question Banks**: Curated interview questions with AI-coached responses
- **Mock Interview Practice**: Video practice sessions with performance feedback
- **Technical Interview Prep**: Coding challenges and case study practice relevant to target roles

### 👥 **Multi-User Collaboration**
- **Team Accounts**: Support for career coaches, mentors, and job search accountability partners
- **Shared Insights**: Collaborative feedback on applications and interview performance
- **Referral Network Management**: Track connections and warm introduction opportunities
- **Progress Sharing**: Configurable privacy settings for sharing job search progress

## Technical Architecture & Requirements

### 🏗️ **System Requirements**

#### **Authentication & Security**
- OAuth 2.0 integration (Google, LinkedIn, GitHub)
- Multi-factor authentication support
- Role-based access control for multi-user features
- Data encryption at rest and in transit
- GDPR/CCPA compliance framework

#### **Database Design**
- **User Profiles**: Personal information, skills, experience, preferences
- **Job Opportunities**: Scraped job postings, company information, application requirements
- **Application Tracking**: Status updates, timeline management, outcome recording
- **Document Management**: Version control for resumes, cover letters, portfolios
- **Analytics Data**: Performance metrics, success patterns, market intelligence

#### **API Integration**
- LinkedIn API for profile import and job discovery
- Indeed/Glassdoor APIs for salary benchmarking
- Company research APIs (Crunchbase, Clearbit)
- Calendar integration (Google Calendar, Outlook)
- Email automation (SendGrid, Mailchimp)

### 🧪 **Quality Assurance**
- **Unit Testing**: 100% code coverage for all functions and classes
- **Integration Testing**: API endpoint validation and database operations
- **End-to-End Testing**: Complete user workflow automation

### ☁️ **Cloud Deployment**
- **Infrastructure**: AWS/Azure cloud hosting with auto-scaling
- **Database**: PostgreSQL with read replicas for performance
- **File Storage**: S3/Blob storage for document management
- **CDN**: CloudFront/Azure CDN for global content delivery
- **CI/CD Pipeline**: Automated testing and deployment workflows

### 🎨 **Branding & User Experience**
- **Custom Brand Identity**: Team-developed logo, color scheme, typography system
- **Responsive Web Application**: Desktop and tablet-optimized design
- **User Onboarding**: Interactive tutorials and guided setup
- **Dashboard Analytics**: Personal job search performance metrics

## Development Methodology

### **Agile Sprint Structure (4 Sprints)**
- **Sprint 1**: Foundation & Authentication
  - Authentication system and user management
  - Database design and API architecture
  - Brand identity and design system
  - Basic user profiles and document upload

- **Sprint 2**: Job Management & AI Content Generation
  - Job entry and tracking system
  - Resume and cover letter generation AI
  - Company research and job matching algorithms
  - Application pipeline management

- **Sprint 3**: Interview Tools & Analytics
  - Interview preparation suite and mock practice
  - Network relationship management
  - Analytics dashboard and performance insights
  - Multi-user collaboration features

- **Sprint 4**: Advanced Features & Deployment
  - Integration with external APIs (LinkedIn, job boards)
  - Advanced AI features and workflow automation
  - Cloud deployment and production environment
  - Final testing and user feedback integration

### **Technology Stack**
- **Frontend**: React.js with TypeScript, Material-UI/Chakra UI
- **Backend**: Node.js/Express or Python/Django with RESTful APIs
- **Database**: PostgreSQL with Redis caching
- **AI/ML**: OpenAI GPT-4 API, custom NLP models for job matching
- **Testing**: Jest, Cypress, pytest, Selenium
- **DevOps**: Docker, Kubernetes, GitHub Actions, Terraform

## Success Metrics & KPIs

### **User Engagement**
- Monthly active users and retention rates
- Profile completion rates and feature adoption
- Application generation volume and success rates

### **Platform Performance**
- Application-to-interview conversion improvement
- Average time-to-hire reduction
- User satisfaction scores and Net Promoter Score (NPS)

### **Technical Metrics**
- System uptime and performance benchmarks
- Test coverage and code quality metrics
- Security audit compliance and incident response

## Project Timeline

### **Phase 1: Foundation**
- Project setup, authentication, basic user profiles
- Database design and initial API development
- Brand identity and UI/UX design system

### **Phase 2: Core Features**
- Job tracking system and application management
- AI-powered resume and cover letter generation
- Basic analytics and reporting dashboard

### **Phase 3: Advanced Features**
- Interview preparation tools and company research
- Multi-user support and collaboration features
- Performance optimization and testing

### **Phase 4: Deployment & Launch**
- Cloud deployment and production environment setup
- Comprehensive testing and security auditing
- Beta user onboarding and feedback collection

## Conclusion

This ATS for candidates represents an opportunity to improve the job search experience by placing powerful, AI-driven tools directly in the hands of candidates. By building a comprehensive, candidate-centric ATS platform, this capstone project demonstrates the potential to create meaningful technological solutions that address real-world career challenges while showcasing advanced software development skills and business acumen.

The platform's success will be measured not only by technical excellence and code quality but also by its ability to genuinely improve job search outcomes for users, making it a compelling portfolio piece that demonstrates both technical capability and market understanding.

## Operational guide: Account Deletion Email Flow (UC-009)

This project implements a two-step, email-confirmed account deletion flow:

- Step 1 (Request): The user clicks Delete Account in the app, which creates a time-limited deletion request token and sends a confirmation email with a link.
- Step 2 (Confirm): The user opens the link from the email, reviews a confirmation page, and confirms. Only then is the account fully deleted (Django user, Firebase user, profile, skills, and media).

### Configure email delivery

By default in development, emails are printed to the backend logs (console backend). For real delivery, set SMTP env vars.

Option A: Use console backend (default in DEBUG)
- No configuration required. Check emails in backend logs.
- Useful for local testing. The deletion request endpoint also returns the confirm URL in development to make testing easier.

Option B: Enable real SMTP (e.g., Gmail with App Password)
1. Create a Gmail App Password (recommended; do not use your normal password):
  - Enable 2‑step verification on your Google account
  - Go to Google Account → Security → App passwords
  - Create a new app password for “Mail” on “Other” (give it a name)
  - Copy the 16‑character app password
2. Set these in `backend/.env` (see `backend/.env.example` for reference):
  - DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
  - EMAIL_HOST=smtp.gmail.com
  - EMAIL_PORT=587
  - EMAIL_USE_TLS=True
  - EMAIL_HOST_USER=your@gmail.com
  - EMAIL_HOST_PASSWORD=your-16-char-app-password
  - DEFAULT_FROM_EMAIL=Your App Name <your@gmail.com>
3. Restart backend to apply changes:
  - docker compose restart backend
  - If you just added variables for the first time, rebuild: docker compose up -d --build backend

Notes
- When DJANGO_EMAIL_BACKEND is set, it overrides the default console backend even in DEBUG.
- If you prefer another provider (e.g., SendGrid, Mailgun), set the corresponding SMTP host, port, TLS/SSL, user, and password.

### End-to-end verification checklist

1. Start the stack and ensure backend can send email (console or SMTP):
  - Console backend: trigger a deletion request and watch backend logs for email output
  - SMTP backend: send a deletion request and verify you receive the email (check Spam/Promotions)
2. In the app, log in and go to Profile → Delete Account.
3. Enter your password if asked (re-auth) and submit. You should see “Confirmation email sent. Please check your email to confirm deletion.”
4. Open the email and click the confirmation link.
5. Confirm on the page that loads. Your account should now be fully removed and any subsequent login should fail.

### API reference (for troubleshooting/testing)

- Request deletion (authenticated): POST `/api/users/me/delete-request`
  - Development convenience: returns `confirm_url` in JSON when DEBUG=true so you can copy/paste into a browser
- Confirm deletion: GET/POST `/api/auth/delete/confirm/<token>`
- Immediate delete (legacy): DELETE `/api/users/me` is disabled and returns guidance to use the email flow

### Troubleshooting

- Not receiving emails:
  - Check backend logs for errors
  - Verify DJANGO_EMAIL_BACKEND and SMTP settings in `backend/.env`
  - For Gmail, ensure you’re using an App Password and TLS on port 587
  - Check Spam/Promotions folders
- For quick local testing, keep the console backend and use the `confirm_url` returned by the request endpoint in development
- After changing `.env`, restart or rebuild the backend container so settings take effect

Related docs
- ONBOARDING.md → full local setup and environment management
- ENV_SETUP.md → environment files, precedence, and compose tips
