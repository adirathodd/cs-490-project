import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/common/PrivateRoute';
import Register from './components/auth/Register';
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import Profile from './components/profile/Profile';
import DashboardOverview from './components/dashboard/DashboardOverview';
import ProfileForm from './components/profile/ProfileForm';
import Skills from './components/profile/Skills';
import SkillsOrganized from './components/profile/SkillsOrganized';
import Education from './components/profile/Education';
import Documents from './components/profile/Documents';
import Certifications from './components/profile/Certifications';
import Projects from './components/profile/Projects';
import Employment from './components/profile/Employment';
import ProjectsPortfolio from './components/profile/ProjectsPortfolio';
import ProjectDetail from './components/profile/ProjectDetail';
import Jobs from './components/jobs/Jobs';
import JobsPipeline from './components/jobs/JobsPipeline';
import JobStats from './components/jobs/JobStats';
import Analytics from './components/analytics/Analytics';
import JobDetailView from './components/jobs/JobDetailView';
import JobTimelineView from './components/jobs/JobTimelineView';
import SalaryResearch from './components/jobs/SalaryResearch';
import SalaryNegotiation from './components/jobs/SalaryNegotiation';
import Goals from './components/goals/Goals';
import ContactsPage from './components/contacts/ContactsPage';
import NetworkingEvents from './components/networking/NetworkingEvents';
import ReferencesPage from './components/references/ReferencesPage';
import MentorshipDashboard from './components/mentorship/MentorshipDashboard';
import ReferralManagement from './components/referrals/ReferralManagement';
import MentorshipMenteeDashboard from './components/mentorship/MenteeDashboard';
import { CompanyInsights } from './features/company';
import { AiResumeGenerator } from './features/resume';
import { AiCoverLetterGenerator } from './features/cover-letter';
import ResumeVersionControl from './components/resume/ResumeVersionControl';
import SharedResumeView from './components/resume/SharedResumeView';
import ScrollToTop from './components/common/ScrollToTop';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import NavBar from './components/common/NavBar';
import Breadcrumbs from './components/common/Breadcrumbs';
import './App.css';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <AuthProvider>
        <Routes>
          {/* public */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Public shared resume view */}
          <Route path="/shared-resume/:shareToken" element={<SharedResumeView />} />

          {/* protected */}
          <Route
            path="/dashboard"
            element={
            <PrivateRoute>
            <>
            <NavBar />
            <Breadcrumbs />
            <Dashboard />
            </>
            </PrivateRoute>
            }
            />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <>
                  <NavBar />
                  <Breadcrumbs />
                  <Profile />
                  <DashboardOverview />
                </>
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/:userId"
            element={
              <PrivateRoute>
                <NavBar />
            <Breadcrumbs />
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <PrivateRoute>
                <NavBar />
              <Breadcrumbs />
                <ProfileForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/basic"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <ProfileForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/skills"
            element={
              <PrivateRoute>
                <NavBar />
            <Breadcrumbs />
                <Skills />
              </PrivateRoute>
            }
          />
          <Route
            path="/skills/organized"
            element={
              <PrivateRoute>
                <NavBar />
            <Breadcrumbs />
                <SkillsOrganized />
              </PrivateRoute>
            }
          />
          <Route
            path="/education"
            element={
              <PrivateRoute>
                <NavBar />
              <Breadcrumbs />
                <Education />
              </PrivateRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <Documents />
              </PrivateRoute>
            }
          />
          <Route
            path="/employment"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <Employment />
              </PrivateRoute>
            }
          />
          <Route
            path="/certifications"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <Certifications />
              </PrivateRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <Projects />
              </PrivateRoute>
            }
          />
          <Route
            path="/projects/portfolio"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <ProjectsPortfolio />
              </PrivateRoute>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <ProjectDetail />
              </PrivateRoute>
            }
          />

          <Route
            path="/jobs"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <Jobs />
              </PrivateRoute>
            }
          />

          <Route
            path="/jobs/pipeline"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <JobsPipeline />
              </PrivateRoute>
            }
          />

          <Route
            path="/jobs/stats"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <JobStats />
              </PrivateRoute>
            }
          />

          <Route
            path="/analytics"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <Analytics />
              </PrivateRoute>
            }
          />

          <Route
            path="/jobs/:id"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <JobDetailView />
              </PrivateRoute>
            }
          />
          <Route
            path="/jobs/:id/timeline"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <JobTimelineView />
              </PrivateRoute>
            }
          />
          <Route
            path="/jobs/:id/company"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <CompanyInsights />
              </PrivateRoute>
            }
          />
          <Route
            path="/jobs/:jobId/salary-research"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <SalaryResearch />
              </PrivateRoute>
            }
          />
          <Route
            path="/jobs/:jobId/salary-negotiation"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <SalaryNegotiation />
              </PrivateRoute>
            }
          />
          <Route
            path="/goals"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <Goals />
              </PrivateRoute>
            }
          />
          <Route
            path="/resume/ai"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <AiResumeGenerator />
              </PrivateRoute>
            }
          />

          <Route
            path="/cover-letter/ai"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <AiCoverLetterGenerator />
              </PrivateRoute>
            }
          />

          <Route
            path="/contacts"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <ContactsPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/networking"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <NetworkingEvents />
              </PrivateRoute>
            }
          />
          <Route
            path="/mentorship"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <MentorshipDashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/referrals"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <ReferralManagement />
              </PrivateRoute>
            }
          />

          <Route
            path="/mentorship/mentees/:teamMemberId"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <MentorshipMenteeDashboard />
              </PrivateRoute>
            }
          />

          <Route
            path="/references"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <ReferencesPage />
              </PrivateRoute>
            }
          />

          <Route

            path="/resume/versions"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <ResumeVersionControl />
              </PrivateRoute>
            }
          />

          {/* catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
