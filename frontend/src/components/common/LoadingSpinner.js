import React from 'react';
import Icon from './Icon';
import './LoadingSpinner.css';

export default function LoadingSpinner({ size = 'md', color, className = '', ...props }) {
  return (
    <span className={`loading-spinner ${className}`} aria-hidden="true" data-testid="spinner" {...props}>
      <Icon name="spinner" size={size} color={color} className="spin" />
    </span>
  );
}
