import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import './Dashboard.css';
import LoadingSpinner from '../common/LoadingSpinner';
import Icon from '../common/Icon';
import DeadlinesWidget from '../common/DeadlinesWidget';
import DashboardCalendar from './DashboardCalendar';

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);

  // Prefer the user's saved profile name first (what they edited),
  // then fall back to the Firebase provider displayName, then email.
  const displayName = (
    (userProfile?.full_name && userProfile.full_name.trim()) ||
    (((userProfile?.first_name || userProfile?.last_name) && `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()) || '') ||
    (currentUser?.displayName && currentUser.displayName.trim()) ||
    currentUser?.email
  );

  // Avoid showing the email twice: if the computed displayName is the same as the account email,
  // don't show it as the 'name' — the email will still appear in the account-email row below.
  const displayNameToShow = (displayName && currentUser?.email && displayName === currentUser.email)
    ? ''
    : displayName;

  useEffect(() => {
    // Fetch profile picture
    const fetchProfilePicture = async () => {
      if (currentUser) {
        try {
          const response = await authAPI.getProfilePicture();
          console.log('Profile picture response:', response);

          // The response from authAPI.getProfilePicture is already response.data
          if (response.profile_picture_url) {
            // Build full URL - the backend returns relative path like /media/profile_pictures/...
            const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
            const fullUrl = response.profile_picture_url.startsWith('http') 
              ? response.profile_picture_url 
              : `${apiBaseUrl}${response.profile_picture_url}`;
            setProfilePictureUrl(fullUrl);
            return;
          }

          // Fallback: if backend has no uploaded profile picture, use portfolio_url (we store Google photo there)
          if (userProfile && userProfile.portfolio_url) {
            const photo = userProfile.portfolio_url;
            const fullPhoto = photo.startsWith('http') ? photo : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${photo}`;
            setProfilePictureUrl(fullPhoto);
            return;
          }

          // No picture available
          setProfilePictureUrl(null);
        } catch (error) {
          console.log('Profile picture fetch error:', error);
          // Silently handle 404 or 400 - no profile picture exists
          if (error.response && (error.response.status === 404 || error.response.status === 400)) {
            // Fallback to portfolio_url if available
            if (userProfile && userProfile.portfolio_url) {
              const photo = userProfile.portfolio_url;
              const fullPhoto = photo.startsWith('http') ? photo : `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${photo}`;
              setProfilePictureUrl(fullPhoto);
            } else {
              setProfilePictureUrl(null);
            }
          }
        }
      }
    };

    fetchProfilePicture();
  }, [currentUser]);

  const handleUpdateProfile = () => {
    if (!authLoading && currentUser) {
      navigate('/profile/edit');
    }
  };

  // Dashboard section control — default to 'Profile'
  const [activeSection, setActiveSection] = useState('Profile');
  const [calendarSummary, setCalendarSummary] = useState(null);

  const showCard = (section) => activeSection === section;

  if (authLoading) {
    return (
      <div className="dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', transform: 'translateY(5vh)' }}>
          <LoadingSpinner size={48} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      

      <div className="dashboard-content">
        {/* Account Information Banner */}
        <div className="account-banner">
          <div className="account-banner-content">
            <div className="account-profile-section">
              <div className="account-avatar">
                {profilePictureUrl ? (
                  <img src={profilePictureUrl} alt="Profile" className="account-avatar-img" />
                ) : (
                  <div className="account-avatar-placeholder">
                    {userProfile?.first_name?.[0]?.toUpperCase() || currentUser?.email?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
              <div className="account-details">
                <h2 className="account-name">
                  {displayNameToShow || 'Welcome'}
                </h2>
                <p className="account-email">{currentUser?.email}</p>
                {userProfile && (
                  <div className="account-info-row">
                        {userProfile.phone && (
                          <span className="account-info-item"><Icon name="camera" size="sm" /> {userProfile.phone}</span>
                        )}
                        {userProfile.location && (
                          <span className="account-info-item"><Icon name="location" size="sm" /> {userProfile.location}</span>
                        )}
                        {userProfile.city && userProfile.state && (
                          <span className="account-info-item"><Icon name="home" size="sm" /> {userProfile.city}, {userProfile.state}</span>
                        )}
                  </div>
                )}
              </div>
            </div>
            <button className="edit-profile-button" onClick={handleUpdateProfile}>
              <Icon name="edit" size="sm" /> Edit Profile
            </button>
          </div>
        </div>

        <div className="welcome-section">
          <h2>Your Dashboard</h2>
          <p>Manage your professional profile and showcase your experience.</p>
        </div>

        <div className="dashboard-layout">
          <div className="dashboard-layout__main">
            {/* Profile Overview (UC-033) */}
            <DashboardCalendar onSummaryChange={setCalendarSummary} />

            {/* Section toggles: accordion list under the calendar */}
            <div className="section-toggles" style={{ marginTop: 12 }}>
              {(() => {
                const sections = [
                  { id: 'Profile', label: 'Profile' },
                  { id: 'Applications', label: 'Applications' },
                  { id: 'Tools', label: 'Tools' },
                  { id: 'Networking', label: 'Networking' },
                ];

                // Card sets for each section (same as rendered previously)
                const profileCards = [
                  { key: 'skills', icon: <Icon name="idea" size="lg" color="#000000" ariaLabel="Skills" />, title: 'Skills', desc: 'Add and manage your skills', action: () => navigate('/skills'), actionText: 'Manage Skills', secondaryAction: () => navigate('/skills/organized'), secondaryActionText: 'Organize by Category' },
                  { key: 'employment', icon: <Icon name="briefcase" size="lg" ariaLabel="Employment" />, title: 'Employment History', desc: 'Add and manage your work experience', action: () => navigate('/employment'), actionText: 'View/Edit Employment' },
                  { key: 'education', icon: <Icon name="education" size="lg" ariaLabel="Education" />, title: 'Education', desc: 'Add and manage your educational background', action: () => navigate('/education'), actionText: 'Manage Education' },
                  { key: 'certs', icon: <Icon name="cert" size="lg" ariaLabel="Certifications" />, title: 'Certifications', desc: 'Add and manage your professional certifications', action: () => navigate('/certifications'), actionText: 'Manage Certifications' },
                  { key: 'projects', icon: <Icon name="project" size="lg" ariaLabel="Projects" />, title: 'Projects', desc: 'Showcase significant work beyond employment', action: () => navigate('/projects'), actionText: 'Manage Projects' },
                  { key: 'goals', icon: <Icon name="target" size="lg" color="#000000" ariaLabel="Career Goals" />, title: 'Goals & Milestones', desc: 'Set goals, add milestones, and track your progress', action: () => navigate('/goals'), actionText: 'Open Goals' },
                ];

                const applicationCards = [
                  { key: 'jobs', icon: <Icon name="briefcase" size="lg" ariaLabel="Jobs" />, title: 'Jobs', desc: 'Track opportunities you want to apply for', action: () => navigate('/jobs'), actionText: 'Add Job Entry' },
                  { key: 'documents', icon: <Icon name="file-text" size="lg" ariaLabel="Documents" />, title: 'Documents', desc: 'Manage resumes, cover letters, and application materials', action: () => navigate('/documents'), actionText: 'Manage Documents' },
                ];

                const toolsCards = [
                  { key: 'ai_resume', icon: <Icon name="sparkles" size="lg" ariaLabel="AI Resume" />, title: 'AI Resume', desc: 'Generate an AI-optimized resume', action: () => navigate('/resume/ai'), actionText: 'Open AI Resume' },
                  { key: 'ai_cover_letter', icon: <Icon name="sparkles" size="lg" ariaLabel="AI Cover Letter" />, title: 'AI Cover Letter', desc: 'Generate tailored cover letters using AI', action: () => navigate('/cover-letter/ai'), actionText: 'Open AI Cover Letter' },
                  { key: 'market_intelligence', icon: <Icon name="chart" size="lg" ariaLabel="Market Intelligence" />, title: 'Market Intelligence', desc: 'Track market trends, salaries, and skill demand', action: () => navigate('/tools/market-intelligence'), actionText: 'Open Market Intelligence' },
                ];

                const networkingCards = [
                  { key: 'contacts', icon: <Icon name="users" size="lg" ariaLabel="Contacts" />, title: 'Contacts', desc: 'Manage your professional contacts, notes and reminders', action: () => navigate('/contacts'), actionText: 'Manage Contacts' },
                  { key: 'events', icon: <Icon name="calendar" size="lg" ariaLabel="Networking Events" />, title: 'Networking Events', desc: 'Track events, set goals, and manage professional connections', action: () => navigate('/networking'), actionText: 'Manage Events' },
                  { key: 'references', icon: <Icon name="award" size="lg" ariaLabel="References" />, title: 'Professional References', desc: 'Manage references, track requests, and prepare talking points', action: () => navigate('/references'), actionText: 'Manage References' },
                  { key: 'referrals', icon: <Icon name="users" size="lg" ariaLabel="Referrals" />, title: 'Referral Requests', desc: 'Track referral requests, follow-ups, and status', action: () => navigate('/referrals'), actionText: 'Manage Referrals' },

                ];

                const cardsFor = (id) => {
                  switch (id) {
                    case 'Profile': return profileCards;
                    case 'Applications': return applicationCards;
                    case 'Tools': return toolsCards;
                    case 'Networking': return networkingCards;
                    default: return profileCards;
                  }
                };

                return sections.map((s) => {
                  const expanded = activeSection === s.id;
                  return (
                    <div key={s.id} className="section-item">
                      <button
                        className={`section-toggle ${expanded ? 'active' : ''}`}
                        onClick={() => setActiveSection(expanded ? '' : s.id)}
                        aria-expanded={expanded}
                        aria-controls={`section-body-${s.id}`}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {s.label}
                          <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size="sm" ariaLabel={expanded ? 'Collapse' : 'Expand'} />
                        </span>
                      </button>

                      <div id={`section-body-${s.id}`} className={`section-body ${expanded ? 'expanded' : 'collapsed'}`}>
                        <div className="accordion-cards">
                          {cardsFor(s.id).map((c) => (
                            <div key={c.key} className="dashboard-card" style={{ marginBottom: 12 }}>
                              <div className="card-icon">{c.icon}</div>
                              <h3>{c.title}</h3>
                              <p>{c.desc}</p>
                              <button className="card-button" onClick={c.action}>{c.actionText}</button>
                              {c.secondaryActionText && (
                                <button className="card-button" onClick={c.secondaryAction}>{c.secondaryActionText}</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <aside className="dashboard-layout__sidebar">
            <div className="dashboard-card dashboard-card--sidebar">
              <DeadlinesWidget />
            </div>
            {calendarSummary && (
              <div className="dashboard-card dashboard-card--sidebar calendar-summary-card" role="region" aria-label="Calendar snapshot">
                <h4 style={{ margin: '0 0 8px 0' }}><Icon name="dashboard" size="sm" /> Pipeline snapshot</h4>
                <div className="calendar-summary-chips">
                  <div className="calendar-meta-chip" aria-label={`${calendarSummary.deadlinesCount} deadlines tracked`}>
                    <span className="label">Deadlines</span>
                    <span className="value">{calendarSummary.deadlinesCount}</span>
                  </div>
                  <div className="calendar-meta-chip" aria-label={`${calendarSummary.interviewsCount} interviews scheduled`}>
                    <span className="label">Interviews</span>
                    <span className="value">{calendarSummary.interviewsCount}</span>
                  </div>
                  <div className="calendar-meta-chip" aria-label={`${calendarSummary.remindersCount} active reminders`}>
                    <span className="label">Reminders</span>
                    <span className="value">{calendarSummary.remindersCount}</span>
                  </div>
                </div>
                <div className="calendar-meta-next" aria-label="Next upcoming event">
                  <span className="label">Next</span>
                  <div className="value">{calendarSummary.nextLabel}</div>
                  {calendarSummary.nextTime && <span className="time">{calendarSummary.nextTime}</span>}
                </div>
              </div>
            )}
          </aside>
        </div>


      </div>
    </div>
  );
};

export default Dashboard;
