import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the services module with jest.fn() factories and reference them via require when needed
jest.mock('../../services/api', () => {
  const authAPI = { getCurrentUser: jest.fn() };
  const skillsAPI = { getSkills: jest.fn() };
  const educationAPI = { getEducations: jest.fn() };
  const projectsAPI = { getProjects: jest.fn() };
  return { authAPI, skillsAPI, educationAPI, projectsAPI };
});

// Mock child components to make assertions easy and deterministic
jest.mock('./SummaryCard', () => (props) => (
  <div data-testid={`summary-${props.title}`}>{props.value}</div>
));

jest.mock('./ProfileProgress', () => (props) => (
  <div data-testid="profile-progress" data-percent={props.percent}>{(props.suggestions || []).join('|')}</div>
));

jest.mock('./SkillDistribution', () => (props) => (
  <div data-testid="skill-dist">{JSON.stringify(props.data)}</div>
));

jest.mock('./ActivityTimeline', () => (props) => (
  <div data-testid="activity-timeline">{JSON.stringify(props.events || [])}</div>
));

jest.mock('./ExportProfile', () => (props) => (
  <div data-testid="export-profile">{JSON.stringify(props.payload || {})}</div>
));

// Mock LoadingSpinner to be easily detectable
jest.mock('../common/LoadingSpinner', () => (props) => (
  <div data-testid="loading-spinner">loading-{props.size}</div>
));

// Now import the component under test
import DashboardOverview from './DashboardOverview';

describe('DashboardOverview (same-folder test)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default environment variable
    process.env.REACT_APP_API_URL = 'http://test-api';
    // Reset fetch mock
    global.fetch = jest.fn();
    // Reset localStorage token
    localStorage.clear();
  });

  // Helper to access mocked api functions
  const getApiMocks = () => require('../../services/api');

  test('shows loading spinner then summary counts when data loads (array employment)', async () => {
    // Arrange: mock APIs
  const api = getApiMocks();
  api.authAPI.getCurrentUser.mockResolvedValue({ profile: { first_name: 'A', last_name: 'B', headline: 'H', summary: 'S' } });
  api.skillsAPI.getSkills.mockResolvedValue([{ skill_name: 'JS', level: 'Advanced' }, { skill_name: 'React' }]);
  api.educationAPI.getEducations.mockResolvedValue({ results: [{ id: 1 }] });
  api.projectsAPI.getProjects.mockResolvedValue([{ id: 11 }, { id: 12 }]);

    // mock fetch employment returning an array (r.ok true)
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ id: 1 }, { id: 2 }]) });

    // Act
    render(<DashboardOverview />);

    // Loading spinner should be present initially
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    // Wait for final render
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());

    // Assert SummaryCards got rendered with correct counts
    expect(screen.getByTestId('summary-Employment')).toHaveTextContent('2');
    expect(screen.getByTestId('summary-Skills')).toHaveTextContent('2');
    expect(screen.getByTestId('summary-Education')).toHaveTextContent('1');
    expect(screen.getByTestId('summary-Projects')).toHaveTextContent('2');

    // SkillDistribution should have been passed mapped data
    const skillDist = JSON.parse(screen.getByTestId('skill-dist').textContent);
    expect(Array.isArray(skillDist)).toBe(true);
    expect(skillDist[0].name).toMatch(/JS|React/);
  });

  test('handles object-form employment response and shows suggestions when pieces missing', async () => {
    // Arrange: return no profile, no skills, no projects, no education
  const api = getApiMocks();
  api.authAPI.getCurrentUser.mockResolvedValue({ profile: null });
  api.skillsAPI.getSkills.mockResolvedValue([]);
  api.educationAPI.getEducations.mockResolvedValue({ results: [] });
  api.projectsAPI.getProjects.mockResolvedValue([]);

    // fetch returns an object with results
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) });

    // Act
    render(<DashboardOverview />);

    // Wait for finish
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());

    // ProfileProgress should be present and contain suggestions separated by |
    const progress = screen.getByTestId('profile-progress');
    expect(progress).toBeInTheDocument();
    const suggestionsText = progress.textContent;
    // The component composes slightly different suggestion text; check for key phrases
    expect(suggestionsText).toContain('Add at least one employment entry');
    expect(suggestionsText).toContain('Add at least 5 relevant skills');
  });

  test('skill mapping uses fallback values when level is missing', async () => {
  const api = getApiMocks();
  api.authAPI.getCurrentUser.mockResolvedValue({ profile: { first_name: 'X' } });
  api.skillsAPI.getSkills.mockResolvedValue([{ name: 'FallbackSkill', level: '' }]);
  api.educationAPI.getEducations.mockResolvedValue({ results: [] });
  api.projectsAPI.getProjects.mockResolvedValue([]);
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) });

    render(<DashboardOverview />);
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());

    // SkillDistribution data should contain value field set to 100 when level is missing
    const dataJson = JSON.parse(screen.getByTestId('skill-dist').textContent);
    expect(dataJson[0].name).toBe('FallbackSkill');
    expect(dataJson[0].value).toBe(100);
  });
});
