import React from 'react';
import { render, screen } from '@testing-library/react';
import ProfileProgress from './ProfileProgress';

describe('ProfileProgress', () => {
  it('renders with default percent and no suggestions', () => {
    render(<ProfileProgress />);
    expect(screen.getByText('Profile Completion')).toBeInTheDocument();
  const barDiv = screen.getByTestId('progress-bar');
  expect(barDiv).toBeTruthy();
  expect(window.getComputedStyle(barDiv).width).toBe(window.getComputedStyle(barDiv.parentElement).width ? window.getComputedStyle(barDiv.parentElement).width.replace(/\d+/, '0') : '0px');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('clamps percent to 100 and renders bar width', () => {
    render(<ProfileProgress percent={120} />);
  const barDiv = screen.getByTestId('progress-bar');
  const parentWidth = window.getComputedStyle(barDiv.parentElement).width;
  expect(window.getComputedStyle(barDiv).width).toBe(parentWidth);
  });

  it('clamps percent to 0 and renders bar width', () => {
    render(<ProfileProgress percent={-10} />);
  const barDiv = screen.getByTestId('progress-bar');
  expect(barDiv.style.width).toBe('0%');
  });

  it('renders bar with correct percent', () => {
    render(<ProfileProgress percent={55} />);
  const barDiv = screen.getByTestId('progress-bar');
  const parentWidth = window.getComputedStyle(barDiv.parentElement).width;
  expect(barDiv.style.width).toBe('55%');
  });

  it('renders suggestions as a list', () => {
    const suggestions = ['Add a profile picture', 'Fill out your education'];
    render(<ProfileProgress percent={40} suggestions={suggestions} />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    suggestions.forEach(s => {
      expect(screen.getByText(s)).toBeInTheDocument();
    });
  });

  it('renders with empty suggestions array', () => {
    render(<ProfileProgress percent={40} suggestions={[]} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders with null suggestions', () => {
    render(<ProfileProgress percent={40} suggestions={null} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
