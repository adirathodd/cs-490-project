import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the entire api module
const mockGet = jest.fn();
jest.mock('../../services/api', () => ({
  authAPI: { getCurrentUser: jest.fn() },
  skillsAPI: { getSkills: jest.fn() },
  educationAPI: { getEducations: jest.fn() },
  projectsAPI: { getProjects: jest.fn() },
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args)
  }
}));

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
    // Reset mockGet to return empty suggestions by default
    mockGet.mockResolvedValue({ data: [] });
  });

  // Helper to access mocked api functions
  const getApiMocks = () => require('../../services/api');

  test.skip('shows loading spinner then summary counts when data loads (array employment)', async () => {
    // Arrange: mock APIs
  const apiMocks = getApiMocks();
  apiMocks.authAPI.getCurrentUser.mockResolvedValue({ profile: { first_name: 'A', last_name: 'B', headline: 'H', summary: 'S' } });
  apiMocks.skillsAPI.getSkills.mockResolvedValue([{ skill_name: 'JS', level: 'Advanced' }, { skill_name: 'React' }]);
  apiMocks.educationAPI.getEducations.mockResolvedValue({ results: [{ id: 1 }] });
  apiMocks.projectsAPI.getProjects.mockResolvedValue([{ id: 11 }, { id: 12 }]);

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

  test.skip('handles object-form employment response and shows suggestions when pieces missing', async () => {
    // Arrange: return no profile, no skills, no projects, no education
  const apiMocks = getApiMocks();
  apiMocks.authAPI.getCurrentUser.mockResolvedValue({ profile: null });
  apiMocks.skillsAPI.getSkills.mockResolvedValue([]);
  apiMocks.educationAPI.getEducations.mockResolvedValue({ results: [] });
  apiMocks.projectsAPI.getProjects.mockResolvedValue([]);

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

  test.skip('skill mapping uses fallback values when level is missing', async () => {
  const apiMocks = getApiMocks();
  apiMocks.authAPI.getCurrentUser.mockResolvedValue({ profile: { first_name: 'X' } });
  apiMocks.skillsAPI.getSkills.mockResolvedValue([{ name: 'FallbackSkill', level: '' }]);
  apiMocks.educationAPI.getEducations.mockResolvedValue({ results: [] });
  apiMocks.projectsAPI.getProjects.mockResolvedValue([]);
    global.fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ results: [] }) });

    render(<DashboardOverview />);
    await waitFor(() => expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument());

    // SkillDistribution data should contain value field set to 100 when level is missing
    const dataJson = JSON.parse(screen.getByTestId('skill-dist').textContent);
    expect(dataJson[0].name).toBe('FallbackSkill');
    expect(dataJson[0].value).toBe(100);
  });
});
