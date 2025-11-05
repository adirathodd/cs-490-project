import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import Breadcrumbs from './Breadcrumbs';

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<Breadcrumbs />} />
      </Routes>
    </MemoryRouter>
  );

describe('Breadcrumbs', () => {
  it('hides breadcrumbs when at top-level route', () => {
    const { container } = renderAt('/dashboard');
    expect(container.firstChild).toBeNull();
  });

  it('renders mapped labels and links for nested paths', () => {
    renderAt('/projects/portfolio');
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
    expect(screen.getByText('Portfolio')).toBeInTheDocument();
  });

  it('applies title map overrides when available', () => {
    renderAt('/forgot-password/security');
    expect(screen.getByRole('link', { name: 'Forgot Password' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByText('Security')).toBeInTheDocument();
  });
});
