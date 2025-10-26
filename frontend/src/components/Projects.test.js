// Mock the API module BEFORE importing the component under test
jest.mock('../services/api', () => ({
  projectsAPI: {
    getProjects: jest.fn().mockResolvedValue([]),
    addProject: jest.fn().mockResolvedValue({
      id: 1,
      name: 'Portfolio Site',
      description: 'Personal portfolio website',
      role: 'Full-Stack Developer',
      start_date: '2025-01-01',
      end_date: '2025-02-01',
      project_url: 'https://example.com',
      team_size: 1,
      collaboration_details: 'Solo project',
      outcomes: 'Showcased projects and blogs',
      industry: 'Software',
      category: 'Web App',
      status: 'completed',
      technologies: ['React', 'Django'],
      media: [],
    }),
    updateProject: jest.fn(),
    deleteProject: jest.fn().mockResolvedValue({ message: 'deleted' }),
  },
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Projects from './Projects';

describe('Projects component', () => {
  it('renders heading and shows empty state', async () => {
    render(<Projects />);
    expect(await screen.findByRole('heading', { name: /Projects/i })).toBeInTheDocument();
    expect(await screen.findByText(/No projects yet/i)).toBeInTheDocument();
  });

  it('validates required fields before submit', async () => {
    render(<Projects />);
    await screen.findByRole('heading', { name: /Projects/i });

    // Submit without project name
    fireEvent.click(screen.getByRole('button', { name: /add project/i }));
    expect(await screen.findByText(/Project name is required/i)).toBeInTheDocument();
  });

  it('creates a project and displays it', async () => {
    const { projectsAPI } = require('../services/api');
    projectsAPI.getProjects.mockResolvedValueOnce([]);
    projectsAPI.addProject.mockResolvedValueOnce({
      id: 1,
      name: 'Portfolio Site',
      description: 'Personal portfolio website',
      role: 'Full-Stack Developer',
      start_date: '2025-01-01',
      end_date: '2025-02-01',
      project_url: 'https://example.com',
      team_size: 1,
      collaboration_details: 'Solo project',
      outcomes: 'Showcased projects and blogs',
      industry: 'Software',
      category: 'Web App',
      status: 'completed',
      technologies: ['React', 'Django'],
      media: [],
    });

    render(<Projects />);
    await screen.findByRole('heading', { name: /Projects/i });

    fireEvent.change(screen.getByLabelText(/Project Name/i), { target: { value: 'Portfolio Site' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'completed' } });
    fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: '2025-02-01' } });
    fireEvent.change(screen.getByLabelText(/Technologies/i), { target: { value: 'React, Django' } });

    fireEvent.click(screen.getByRole('button', { name: /add project/i }));

    expect(await screen.findByText('Portfolio Site')).toBeInTheDocument();
    expect(screen.getByText(/React/)).toBeInTheDocument();
    expect(screen.getByText(/Django/)).toBeInTheDocument();
  });
});
