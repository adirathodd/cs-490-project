import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Nav.css';

const NavBar = () => {
  const [open, setOpen] = useState(false);
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = (currentUser?.displayName || currentUser?.email || '?')
    .split(' ')
    .map(s => s[0])
    .join('')
    .slice(0,2)
    .toUpperCase();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (e) {
      // no-op; optionally surface toast
    }
  };

  return (
    <nav className="nav">
      <div className="nav-brand">ATS</div>
      <button className="nav-toggle" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">☰</button>
      <div className={`nav-links ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <NavLink to="/dashboard" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
        <NavLink to="/skills" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Skills</NavLink>
        <NavLink to="/employment" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Employment</NavLink>
        <NavLink to="/education" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Education</NavLink>
        <NavLink to="/projects" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Projects</NavLink>
        <NavLink to="/profile" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Profile</NavLink>
      </div>
      <div className="nav-user">
        <button className="nav-btn" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
};

export default NavBar;
