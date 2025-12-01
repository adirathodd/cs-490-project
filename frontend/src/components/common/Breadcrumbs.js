import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Nav.css';

const titleMap = {
  'dashboard': 'Dashboard',
  'forgot-password': 'Forgot Password',
  'reset-password': 'Reset Password',
  'login': 'Login',
  'register': 'Register',
  'informational-interviews': 'Informational Interviews',
  'networking': 'Networking Events',
  'networking-campaigns': 'Networking Campaigns',
};

const Breadcrumbs = () => {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);

  // No breadcrumbs on root/auth-only pages
  if (parts.length <= 1) return null;

  const crumbs = parts.map((part, idx) => {
    const to = '/' + parts.slice(0, idx + 1).join('/');
    const isLast = idx === parts.length - 1;
    const label = titleMap[part] || part.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return isLast ? (
      <span key={to}>{label}</span>
    ) : (
      <span key={to}>
        <Link to={to}>{label}</Link>
        {' '}/{' '}
      </span>
    );
  });

  return (
    <div className="breadcrumbs">
      {crumbs}
    </div>
  );
};

export default Breadcrumbs;
