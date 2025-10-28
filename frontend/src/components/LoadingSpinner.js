import React from 'react';
import Icon from './Icon';
import './LoadingSpinner.css';

export default function LoadingSpinner({ size = 'md', color, className = '' }) {
  return (
    <span className={`loading-spinner ${className}`} aria-hidden="true">
      <Icon name="spinner" size={size} color={color} className="spin" />
    </span>
  );
}
