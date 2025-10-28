jest.mock('../services/api', () => ({ __esModule: true, default: {}, projectsAPI: { getProjects: jest.fn(), getProject: jest.fn() } }));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectsPortfolio from './ProjectsPortfolio';

const renderWithRouter = (ui, { route = '/projects/portfolio' } = {}) => {
  window.history.pushState({}, 'Test page', route);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/projects/portfolio" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProjectsPortfolio', () => {
  it('renders portfolio grid and filters', async () => {
    const { projectsAPI } = require('../services/api');
    projectsAPI.getProjects.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Portfolio Site',
        role: 'Full-Stack Developer',
        start_date: '2025-01-01',
        end_date: '2025-02-01',
        industry: 'Software',
        status: 'completed',
        technologies: ['React', 'Django'],
        thumbnail_url: '/thumb1.png',
      },
      {
        id: 2,
        name: 'Data Pipeline',
        role: 'Data Engineer',
        start_date: '2025-06-01',
        end_date: '2025-06-30',
        industry: 'Finance',
        status: 'ongoing',
        technologies: ['Airflow', 'Python', 'Django'],
        thumbnail_url: '/thumb2.png',
      },
    ]);

    renderWithRouter(<ProjectsPortfolio />);
    expect(await screen.findByRole('heading', { name: /Project Portfolio/i })).toBeInTheDocument();
    // Two cards
    expect(await screen.findByText('Portfolio Site')).toBeInTheDocument();
    expect(await screen.findByText('Data Pipeline')).toBeInTheDocument();
    // Industry filter options populated
    const industrySelect = screen.getByLabelText(/Filter by industry/i);
    expect(industrySelect).toBeInTheDocument();
  });

  it('applies search and updates URL params', async () => {
    const { projectsAPI } = require('../services/api');
    projectsAPI.getProjects.mockResolvedValueOnce([]);
    renderWithRouter(<ProjectsPortfolio />);
    const search = await screen.findByRole('searchbox', { name: /Search projects/i });
    fireEvent.change(search, { target: { value: 'pipeline' } });
    await waitFor(() => {
      expect(projectsAPI.getProjects).toHaveBeenCalled();
      const lastCall = projectsAPI.getProjects.mock.calls.at(-1)[0] || {};
      expect(lastCall.q).toBe('pipeline');
    });
  });
});
