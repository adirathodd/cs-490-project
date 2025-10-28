import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Nav.css';

const NavBar = () => {
  const navigate = useNavigate();
  const { currentUser, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const displayName = (currentUser?.displayName?.trim()) || currentUser?.email || 'Account';

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

  return (
    <nav className="nav">
      <div className="nav-brand">ATS</div>
      <button
        className="nav-toggle"
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle navigation"
        aria-expanded={open}
      >☰</button>
      <div
        className={`nav-links ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
        role="navigation"
        aria-hidden={!open}
      >
        <NavLink to="/dashboard" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
        <NavLink to="/skills" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Skills</NavLink>
        <NavLink to="/employment" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Employment</NavLink>
        <NavLink to="/education" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Education</NavLink>
        <NavLink to="/projects" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Projects</NavLink>
        <NavLink to="/certifications" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Certifications</NavLink>
        <NavLink to="/profile" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Profile</NavLink>
      </div>
      <div className="nav-user" ref={menuRef}>
        <button className="nav-btn" onClick={() => setMenuOpen(v => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
          {displayName} ▾
        </button>
        {menuOpen && (
          <div style={menuStyles.container} role="menu">
            <button style={menuStyles.item} onClick={() => { setMenuOpen(false); navigate('/profile'); }}>View Profile</button>
            <div style={menuStyles.divider} />
            <button style={menuStyles.item} onClick={handleLogout}>Sign Out</button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;

