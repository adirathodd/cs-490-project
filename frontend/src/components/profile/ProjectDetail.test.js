import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock projectsAPI.getProject
const mockGetProject = jest.fn();
jest.mock('../../services/api', () => ({
  projectsAPI: {
    getProject: (...args) => mockGetProject(...args),
  },
}));

// Provide controlled router hooks
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: '42' }),
    useNavigate: () => mockNavigate,
  };
});

// Now import the component under test
import ProjectDetail from './ProjectDetail';

describe('ProjectDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // default clipboard mock
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
    // default print mock
    window.print = jest.fn();
  });

  test('shows loading and then renders project details', async () => {
    const project = {
      id: 42,
      name: 'Test Project',
      status: 'active',
      role: 'Developer',
      start_date: '2023-01-01',
      end_date: '2023-06-01',
      team_size: 5,
      industry: 'Software',
      category: 'Web',
      project_url: 'https://example.com',
      technologies: ['React', 'Django'],
      media: [{ id: 1, image_url: 'https://example.com/img.png', caption: 'screenshot' }],
      description: 'This is a description',
      collaboration_details: 'Collab details',
      outcomes: 'Outcomes here',
    };

    mockGetProject.mockResolvedValueOnce(project);

    render(<ProjectDetail />);

    // Loading text shown
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    // Wait for name to appear
    await waitFor(() => expect(screen.getByText(project.name)).toBeInTheDocument());

    // Check meta fields
    expect(screen.getByText(project.role)).toBeInTheDocument();
    expect(screen.getByText(/Team size: 5/)).toBeInTheDocument();
    expect(screen.getByText(project.industry)).toBeInTheDocument();
    expect(screen.getByText(project.category)).toBeInTheDocument();

    // technologies tags
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Django')).toBeInTheDocument();

    // media image
    const img = screen.getByAltText('screenshot');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', project.media[0].image_url);

    // description and sections
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText(project.description)).toBeInTheDocument();
    expect(screen.getByText('Collaboration')).toBeInTheDocument();
    expect(screen.getByText(project.collaboration_details)).toBeInTheDocument();
    expect(screen.getByText('Outcomes')).toBeInTheDocument();
    expect(screen.getByText(project.outcomes)).toBeInTheDocument();
  });

  test('shows error banner when API fails', async () => {
    mockGetProject.mockRejectedValueOnce(new Error('Network fail'));

    render(<ProjectDetail />);

    await waitFor(() => expect(screen.getByText(/Failed to load project|Network fail/i)).toBeInTheDocument());
  });

  test('copy link and print buttons call appropriate APIs', async () => {
    const project = { id: 42, name: 'Copy Test' };
    mockGetProject.mockResolvedValueOnce(project);

    render(<ProjectDetail />);

    await waitFor(() => expect(screen.getByText(project.name)).toBeInTheDocument());

    const shareBtn = screen.getByRole('button', { name: /Share Link|Link Copied/ });
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href));

    const printBtn = screen.getByText(/Print Summary/);
    fireEvent.click(printBtn);

    expect(window.print).toHaveBeenCalled();
  });

  test('back button calls navigate(-1)', async () => {
    const project = { id: 42, name: 'Back Test' };
    mockGetProject.mockResolvedValueOnce(project);

    render(<ProjectDetail />);

    await waitFor(() => expect(screen.getByText(project.name)).toBeInTheDocument());

  const back = screen.getByRole('button', { name: /Back/ });
  fireEvent.click(back);

  expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
