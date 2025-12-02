import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Nav.css';
// Contacts moved to dedicated page `/contacts`

const NavBar = () => {
  const navigate = useNavigate();
  const { currentUser, userProfile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resumeDropdownOpen, setResumeDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  
  const menuRef = useRef(null);
  const resumeDropdownRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const toolsDropdownRef = useRef(null);

  // Prefer backend candidate profile/user name to ensure consistency across providers
  const backendFullName = (userProfile?.full_name || '').trim();
  const backendFirstLast = `${(userProfile?.first_name || '').trim()} ${(userProfile?.last_name || '').trim()}`.trim();
  const firebaseName = (currentUser?.displayName || '').trim();
  const emailFallback = currentUser?.email || 'Account';
  const displayName = backendFullName || backendFirstLast || firebaseName || emailFallback;

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch {}
  };

  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
      if (resumeDropdownRef.current && !resumeDropdownRef.current.contains(e.target)) {
          setResumeDropdownOpen(false);
        }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
        if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(e.target)) {
          setToolsDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const menuStyles = {
    container: {
      position: 'absolute',
      right: '1rem',
      top: '56px',
      background: '#0f172a',
      border: '1px solid #334155',
      borderRadius: 6,
      padding: 6,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 180,
      zIndex: 1100,
    },
    item: {
      background: 'transparent',
      color: '#e2e8f0',
      border: 'none',
      textAlign: 'left',
      padding: '8px 10px',
      cursor: 'pointer',
    },
    divider: { height: 1, background: '#334155', margin: '4px 0' },
  };

  // Use app brand asset from public/
  const logoUrl = (process.env.PUBLIC_URL || '') + '/LogoandWords.png?v=20251028';

  return (
    <nav className="nav">
      <NavLink to="/dashboard" className="nav-brand" aria-label="ResumeRocket home" onClick={() => setOpen(false)}>
        <img src={logoUrl} alt="ResumeRocket" className="nav-brand-logo" />
      </NavLink>
      <button className="nav-toggle" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">☰</button>
      <div className={`nav-links ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <NavLink to="/dashboard" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
        <NavLink to="/jobs" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Jobs</NavLink>

  {/* Tools dropdown - groups resume, cover letters, documents, contacts */}
  <div className="nav-dropdown" ref={toolsDropdownRef}>
    <button
      className={`nav-link nav-dropdown-toggle ${(window.location.pathname.startsWith('/resume') || window.location.pathname.startsWith('/documents') || window.location.pathname.startsWith('/cover-letter') || window.location.pathname.startsWith('/contacts') || window.location.pathname.startsWith('/contact-discovery') || window.location.pathname.startsWith('/informational-interviews')) ? 'active' : ''}`}
      type="button"
      aria-haspopup="menu"
      aria-expanded={toolsDropdownOpen}
      onClick={(e) => { e.stopPropagation(); setToolsDropdownOpen(v => !v); }}
    >
      Tools ▾
    </button>
    {toolsDropdownOpen && (
      <div className="nav-dropdown-menu">
        <NavLink
          to="/resume/ai"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          AI Resume Generator
        </NavLink>
        <NavLink
          to="/resume/versions"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          Resume Version Control
        </NavLink>
        <NavLink
          to="/cover-letter/ai"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          AI Cover Letters
        </NavLink>
        <NavLink
          to="/documents"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          Documents
        </NavLink>
        <NavLink
          to="/contacts"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          Contacts
        </NavLink>
        <NavLink
          to="/contact-discovery"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          Discover Contacts
        </NavLink>
        <NavLink
          to="/informational-interviews"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          Informational Interviews
        </NavLink>
        <NavLink
          to="/networking/campaigns"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          Networking Campaigns
        </NavLink>
        <NavLink
          to="/references"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          References
        </NavLink>
        <NavLink
          to="/referrals"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          Referrals
        </NavLink>
        <NavLink
          to="/mock-interview"
          className="nav-dropdown-item"
          onClick={() => { setToolsDropdownOpen(false); setOpen(false); }}
        >
          Mock Interview Practice
        </NavLink>

      </div>
    )}
  </div>

  <NavLink to="/analytics" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Analytics</NavLink>
  <NavLink to="/peer-support" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Peers</NavLink>
  <NavLink to="/mentorship" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Mentors</NavLink>
        
  {/* Profile dropdown */}
  <div className="nav-dropdown" ref={profileDropdownRef}>
    <button 
      className={`nav-link nav-dropdown-toggle ${(window.location.pathname.startsWith('/profile')) ? 'active' : ''}`}
      type="button"
      aria-haspopup="menu"
      aria-expanded={profileDropdownOpen}
      onClick={(e) => { e.stopPropagation(); setProfileDropdownOpen(v => !v); }}
    >
      Profile ▾
    </button>
    {profileDropdownOpen && (
      <div className="nav-dropdown-menu">
        <NavLink 
          to="/employment" 
          className="nav-dropdown-item"
          onClick={() => { setProfileDropdownOpen(false); setOpen(false); }}
        >
          Employment
        </NavLink>
        <NavLink 
          to="/education" 
          className="nav-dropdown-item"
          onClick={() => { setProfileDropdownOpen(false); setOpen(false); }}
        >
          Education
        </NavLink>
        <NavLink 
          to="/skills" 
          className="nav-dropdown-item"
          onClick={() => { setProfileDropdownOpen(false); setOpen(false); }}
        >
          Skills
        </NavLink>
        <NavLink 
          to="/projects" 
          className="nav-dropdown-item"
          onClick={() => { setProfileDropdownOpen(false); setOpen(false); }}
        >
          Projects
        </NavLink>
        <NavLink 
          to="/profile" 
          className="nav-dropdown-item"
          onClick={() => { setProfileDropdownOpen(false); setOpen(false); }}
        >
          Basic Profile
        </NavLink>
        <NavLink 
          to="/certifications" 
          className="nav-dropdown-item"
          onClick={() => { setProfileDropdownOpen(false); setOpen(false); }}
        >
          Certifications
        </NavLink>
        
      </div>
    )}
  </div>
        {/* Mobile-only actions so Sign Out is accessible when the user menu is hidden */}
        <button
          type="button"
          className="nav-link mobile-only"
          onClick={(e) => { e.stopPropagation(); navigate('/profile'); setOpen(false); }}
        >
          View Profile
        </button>
        <button
          type="button"
          className="nav-link mobile-only"
          onClick={async (e) => { e.stopPropagation(); setOpen(false); await handleLogout(); }}
        >
          Sign Out
        </button>
      </div>
      <div className="nav-user" ref={menuRef}>
        <button
          className="nav-btn"
          onMouseDown={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls="user-menu"
          type="button"
        >
          {displayName} ▾
        </button>
        {menuOpen && (
          <div id="user-menu" style={menuStyles.container} role="menu">
            <button
              style={menuStyles.item}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); navigate('/profile'); }}
            >
              View Profile
            </button>
            <div style={menuStyles.divider} />
            <button style={menuStyles.item} onClick={handleLogout}>Sign Out</button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
