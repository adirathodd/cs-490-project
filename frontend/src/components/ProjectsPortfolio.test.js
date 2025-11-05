import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectsPortfolio from './ProjectsPortfolio';

const mockNavigate = jest.fn();
let mockLocationSearch = '';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({
    pathname: '/projects',
    search: mockLocationSearch,
  }),
}));

jest.mock('../services/api', () => ({
  projectsAPI: {
    getProjects: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('./Icon', () => ({ name }) => (
  <span data-testid={`icon-${name}`} />
));

const { projectsAPI } = require('../services/api');

const renderPortfolio = () => render(<ProjectsPortfolio />);

describe('ProjectsPortfolio', () => {
  const sampleProjects = [
    {
      id: 1,
      name: 'AI Dashboard',
      thumbnail_url: '/images/ai-dashboard.png',
      status: 'completed',
      role: 'Lead Developer',
      start_date: '2023-01-01',
      end_date: '2023-06-01',
      industry: 'Finance',
      technologies: ['React', 'Node.js', 'GraphQL', 'AWS', 'Docker'],
    },
    {
      id: 2,
      name: 'Legacy Upgrade',
      thumbnail_url: '',
      status: '',
      role: '',
      start_date: '2022-02-01',
      end_date: '',
      industry: '',
      technologies: ['TypeScript'],
    },
  ];

  beforeEach(() => {
    mockLocationSearch = '';
    mockNavigate.mockReset();
    projectsAPI.getProjects = jest.fn().mockResolvedValue([]);
  });

  it('applies query params, fetches projects, and renders cards', async () => {
    mockLocationSearch = '?q=design&industry=Finance&status=completed&tech=React,Node&date_from=2022-01-01&date_to=2022-05-01&sort=updated_desc';
    projectsAPI.getProjects.mockResolvedValueOnce(sampleProjects);

    renderPortfolio();

    await waitFor(() => expect(projectsAPI.getProjects).toHaveBeenCalledTimes(1));
    expect(projectsAPI.getProjects).toHaveBeenCalledWith({
      q: 'design',
      industry: 'Finance',
      status: 'completed',
      tech: ['React', 'Node'],
      date_from: '2022-01-01',
      date_to: '2022-05-01',
      sort: 'updated_desc',
    });

    const navigateArgs = mockNavigate.mock.calls[0];
    expect(navigateArgs[1]).toEqual({ replace: true });
    const searchParams = new URLSearchParams(navigateArgs[0].search);
    expect(searchParams.get('tech')).toBe('React,Node');

    expect(await screen.findByText('AI Dashboard')).toBeInTheDocument();

    // Inputs initialized from query string (after state settles)
    expect(screen.getByLabelText(/Search projects/i)).toHaveValue('design');
    expect(screen.getByLabelText(/Filter by industry/i)).toHaveValue('Finance');
    expect(screen.getByLabelText(/Filter by status/i)).toHaveValue('completed');
    expect(screen.getByLabelText(/Sort projects/i)).toHaveValue('updated_desc');
    expect(screen.getByLabelText(/^From$/i)).toHaveValue('2022-01-01');
    expect(screen.getByLabelText(/^To$/i)).toHaveValue('2022-05-01');

    expect(screen.getByText('Legacy Upgrade')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByAltText('AI Dashboard thumbnail')).toHaveAttribute('src', '/images/ai-dashboard.png');
    expect(screen.getByText('No Image')).toBeInTheDocument();
  });

  it('shows loading indicator while fetching and replaces it with data', async () => {
    let resolveFetch;
    const pendingFetch = new Promise((resolve) => { resolveFetch = resolve; });
    projectsAPI.getProjects.mockReturnValueOnce(pendingFetch);

    renderPortfolio();

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    resolveFetch(sampleProjects);

    expect(await screen.findByText('AI Dashboard')).toBeInTheDocument();
    expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
  });

  it('shows error banner when fetching projects fails', async () => {
    projectsAPI.getProjects.mockRejectedValueOnce(new Error('Network error'));

    renderPortfolio();

    expect(await screen.findByText(/Network error/i)).toBeInTheDocument();
    expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
  });

  it('uses default error message when no message is provided', async () => {
    projectsAPI.getProjects.mockRejectedValueOnce({});

    renderPortfolio();

    expect(await screen.findByText(/Failed to load projects/i)).toBeInTheDocument();
  });

  it('renders empty state when no projects match filters', async () => {
    projectsAPI.getProjects.mockResolvedValueOnce([]);

    renderPortfolio();

    expect(await screen.findByText(/No matching projects/i)).toBeInTheDocument();
  });

  it('toggles technology chips and refetches projects with updated filters', async () => {
    projectsAPI.getProjects.mockResolvedValue(sampleProjects);

    renderPortfolio();
    await screen.findByText('AI Dashboard');

    const chip = screen.getByRole('button', { name: 'React' });
    expect(chip).not.toHaveClass('active');

    fireEvent.click(chip);

    await waitFor(() => expect(chip).toHaveClass('active'));
    const lastCall = projectsAPI.getProjects.mock.calls.at(-1)[0];
    expect(lastCall.tech).toEqual(['React']);
    const lastNavigate = mockNavigate.mock.calls.at(-1)[0].search;
    const params = new URLSearchParams(lastNavigate);
    expect(params.get('tech')).toBe('React');

    fireEvent.click(chip);

    await waitFor(() => expect(chip).not.toHaveClass('active'));
    const finalCall = projectsAPI.getProjects.mock.calls.at(-1)[0];
    expect(finalCall.tech).toBeUndefined();
    const finalSearch = mockNavigate.mock.calls.at(-1)[0].search;
    expect(new URLSearchParams(finalSearch).get('tech')).toBeNull();
  });

  it('navigates to project details when a card is clicked', async () => {
    projectsAPI.getProjects.mockResolvedValueOnce(sampleProjects);

    renderPortfolio();

    const card = await screen.findByText('AI Dashboard');
    fireEvent.click(card.closest('.card'));

    expect(mockNavigate).toHaveBeenCalledWith('/projects/1');
  });

  it('renders placeholders when project metadata is missing', async () => {
    const sparseProjects = [
      {
        id: 3,
        name: 'Mystery Initiative',
        thumbnail_url: '',
        status: '',
        role: '',
        start_date: '',
        end_date: '2024-05-01',
        industry: null,
        technologies: null,
      },
    ];
    projectsAPI.getProjects.mockResolvedValueOnce(sparseProjects);

    renderPortfolio();

    expect(await screen.findByText('Mystery Initiative')).toBeInTheDocument();
    expect(screen.getByText('No Image')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-user')).not.toBeInTheDocument();
    expect(screen.getByText(/— → 2024-05-01/)).toBeInTheDocument();
    expect(screen.queryByTestId('icon-link')).not.toBeInTheDocument();
    expect(document.querySelector('.tags')).toBeNull();
  });

  it('clears all filters when reset is clicked', async () => {
    mockLocationSearch = '?q=test&industry=Finance&status=planned&tech=React,Node&date_from=2023-01-01&date_to=2023-12-31&sort=custom';
    projectsAPI.getProjects.mockResolvedValue(sampleProjects);

    renderPortfolio();
    await screen.findByText('AI Dashboard');

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    await waitFor(() => expect(screen.getByLabelText(/Search projects/i)).toHaveValue(''));
    expect(screen.getByLabelText(/Filter by industry/i)).toHaveValue('');
    expect(screen.getByLabelText(/Filter by status/i)).toHaveValue('');
    expect(screen.getByLabelText(/Sort projects/i)).toHaveValue('date_desc');
    expect(screen.getByLabelText(/^From$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^To$/i)).toHaveValue('');

    const lastFetchParams = projectsAPI.getProjects.mock.calls.at(-1)[0];
    expect(lastFetchParams).toEqual({ sort: 'date_desc' });
  });

  it('treats null project responses as empty results', async () => {
    projectsAPI.getProjects.mockResolvedValueOnce(null);

    renderPortfolio();

    expect(await screen.findByText(/No matching projects/i)).toBeInTheDocument();
  });

  it('falls back to empty list when getProjects function is missing', async () => {
    const original = projectsAPI.getProjects;
    projectsAPI.getProjects = null;

    renderPortfolio();

    expect(await screen.findByText(/No matching projects/i)).toBeInTheDocument();

    projectsAPI.getProjects = original;
  });
});
