import React from 'react';
import { render, screen } from '@testing-library/react';
import SkillDistribution from './SkillDistribution';

describe('SkillDistribution', () => {
  it('renders title and no skills message when data is empty', () => {
    render(<SkillDistribution data={[]} />);
    expect(screen.getByText('Skills Distribution')).toBeInTheDocument();
    expect(screen.getByText('No skills yet')).toBeInTheDocument();
  });

  it('renders a skill with correct label and segments for beginner', () => {
    render(<SkillDistribution data={[{ name: 'Python', level: 'Beginner' }]} />);
    expect(screen.getByText('Python')).toBeInTheDocument();
    // Should have 1 filled segment, 3 empty
  const segments = screen.getAllByRole('presentation');
  expect(segments.filter(seg => window.getComputedStyle(seg).backgroundColor === 'rgb(16, 185, 129)').length).toBe(1);
  expect(segments.filter(seg => window.getComputedStyle(seg).backgroundColor === 'rgb(229, 231, 235)').length).toBe(3);
    expect(screen.getByText('Beginner')).toBeInTheDocument();
  });

  it('renders a skill with correct segments for expert', () => {
    render(<SkillDistribution data={[{ name: 'React', level: 'Expert' }]} />);
  const segments = screen.getAllByRole('presentation');
  expect(segments.filter(seg => window.getComputedStyle(seg).backgroundColor === 'rgb(16, 185, 129)').length).toBe(4);
    expect(screen.getByText('Expert')).toBeInTheDocument();
  });

  it('renders a skill with numeric value', () => {
    render(<SkillDistribution data={[{ name: 'JS', value: 80 }]} />);
    const segments = screen.getAllByRole('presentation');
  // 80/25 = 3.2 => 3 segments
  expect(segments.filter(seg => window.getComputedStyle(seg).backgroundColor === 'rgb(16, 185, 129)').length).toBe(3);
  });

  it('renders a skill with unknown level (fallback)', () => {
    render(<SkillDistribution data={[{ name: 'C++', level: 'Unknown' }]} />);
  const segments = screen.getAllByRole('presentation');
  expect(segments.filter(seg => window.getComputedStyle(seg).backgroundColor === 'rgb(16, 185, 129)').length).toBe(1);
  });

  it('renders multiple skills', () => {
    render(<SkillDistribution data={[{ name: 'A', level: 'Beginner' }, { name: 'B', level: 'Advanced' }]} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('Beginner')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('renders with missing level and value (fallback)', () => {
    render(<SkillDistribution data={[{ name: 'Mystery' }]} />);
  const segments = screen.getAllByRole('presentation');
  expect(segments.filter(seg => window.getComputedStyle(seg).backgroundColor === 'rgb(16, 185, 129)').length).toBe(1);
  });
});
