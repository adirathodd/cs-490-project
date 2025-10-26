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

  it('saves and displays all fields including media and categorization', async () => {
    const { projectsAPI } = require('../services/api');
    projectsAPI.getProjects.mockResolvedValueOnce([]);
    const created = {
      id: 2,
      name: 'Analytics Pipeline',
      description: 'Built a data pipeline for analytics',
      role: 'Data Engineer',
      start_date: '2025-03-01',
      end_date: '2025-06-15',
      project_url: 'https://github.com/example/analytics',
      team_size: 3,
      collaboration_details: 'Worked with analysts and SRE',
      outcomes: 'Reduced report time by 80%',
      industry: 'Finance',
      category: 'Data Pipeline',
      status: 'ongoing',
      technologies: ['Python', 'Airflow', 'PostgreSQL'],
      media: [{ id: 10, image_url: '/media/pipeline.png', caption: '', order: 1 }],
    };
    projectsAPI.addProject.mockResolvedValueOnce(created);

    render(<Projects />);
    await screen.findByRole('heading', { name: /Projects/i });

    // Fill form fields
    fireEvent.change(screen.getByLabelText(/Project Name/i), { target: { value: created.name } });
    fireEvent.change(screen.getByLabelText(/Your Role/i), { target: { value: created.role } });
    fireEvent.change(screen.getByLabelText(/Start Date/i), { target: { value: created.start_date } });
    fireEvent.change(screen.getByLabelText(/End Date/i), { target: { value: created.end_date } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: created.status } });
    fireEvent.change(screen.getByLabelText(/Team Size/i), { target: { value: String(created.team_size) } });
    fireEvent.change(screen.getByLabelText(/Industry/i), { target: { value: created.industry } });
    fireEvent.change(screen.getByLabelText(/Project Type/i), { target: { value: created.category } });
    fireEvent.change(screen.getByLabelText(/Project URL/i), { target: { value: created.project_url } });
    fireEvent.change(screen.getByLabelText(/Technologies \/ Skills Used/i), { target: { value: created.technologies.join(', ') } });
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: created.description } });
    fireEvent.change(screen.getByLabelText(/Team & Collaboration Details/i), { target: { value: created.collaboration_details } });
    fireEvent.change(screen.getByLabelText(/Outcomes & Achievements/i), { target: { value: created.outcomes } });

    // Simulate selecting media files (preview before submit)
    const file1 = new File(['content'], 'pipeline.png', { type: 'image/png' });
    const mediaInput = screen.getByLabelText(/Screenshots \(images\)/i);
    fireEvent.change(mediaInput, { target: { files: [file1] } });
    expect(await screen.findByText('pipeline.png')).toBeInTheDocument();

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /add project/i }));

    // Assert display of saved item with all data
    expect(await screen.findByText(created.name)).toBeInTheDocument();
  // Status badge label (Ongoing) - disambiguate from select option
  const ongoingEls = screen.getAllByText(/Ongoing/i);
  const badgeEl = ongoingEls.find((el) => el.className && el.className.includes('badge'));
  expect(badgeEl).toBeInTheDocument();
    // Role, dates, team size, industry, type, link
    expect(screen.getByText(new RegExp(created.role))).toBeInTheDocument();
    expect(screen.getByText(/2025-03-01 to 2025-06-15/)).toBeInTheDocument();
    expect(screen.getByText(/Team size: 3/)).toBeInTheDocument();
    expect(screen.getByText(/Industry: Finance/)).toBeInTheDocument();
    expect(screen.getByText(/Type: Data Pipeline/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /View/i });
    expect(link).toHaveAttribute('href', created.project_url);
    // Technologies tags
    created.technologies.forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
    // Sections
    expect(screen.getByText(/Description:/)).toBeInTheDocument();
    expect(screen.getByText(/Collaboration:/)).toBeInTheDocument();
    expect(screen.getByText(/Outcomes:/)).toBeInTheDocument();
    // Media image rendered
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', created.media[0].image_url);
  });
});
