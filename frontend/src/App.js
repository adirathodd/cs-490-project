import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Register from './components/Register';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import DashboardOverview from './components/DashboardOverview';
import ProfileForm from './components/ProfileForm';
import Skills from './components/Skills';
import SkillsOrganized from './components/SkillsOrganized';
import Education from './components/Education';
import Documents from './components/Documents';
import Certifications from './components/Certifications';
import Projects from './components/Projects';
import Employment from './components/Employment';
import ProjectsPortfolio from './components/ProjectsPortfolio';
import ProjectDetail from './components/ProjectDetail';
import Jobs from './components/Jobs';
import JobsPipeline from './components/JobsPipeline';
import JobStats from './components/JobStats';
import JobDetailView from './components/JobDetailView';
import JobsCalendar from './components/JobsCalendar';
import CompanyInsights from './components/CompanyInsights';
import ScrollToTop from './components/ScrollToTop';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import NavBar from './components/NavBar';
import Breadcrumbs from './components/Breadcrumbs';
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
            path="/jobs/deadlines"
            element={
              <PrivateRoute>
                <NavBar />
                <Breadcrumbs />
                <JobsCalendar />
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
