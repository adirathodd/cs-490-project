import React from 'react';
import { render, screen } from '@testing-library/react';
import SummaryCard from './SummaryCard';

describe('SummaryCard', () => {
  it('renders title and value', () => {
    render(<SummaryCard title="Total Users" value={42} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders hint when provided', () => {
    render(<SummaryCard title="Active" value={10} hint="Last 24h" />);
    expect(screen.getByText('Last 24h')).toBeInTheDocument();
  });

  it('does not render hint when not provided', () => {
    render(<SummaryCard title="Inactive" value={5} />);
    expect(screen.queryByText('hint')).not.toBeInTheDocument();
  });

  it('renders action element when provided', () => {
    render(
      <SummaryCard
        title="Projects"
        value={7}
        action={<button>View</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
  });

  it('renders with falsy value (0)', () => {
    render(<SummaryCard title="Zero" value={0} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders with string value', () => {
    render(<SummaryCard title="Status" value="Good" />);
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('renders with complex action', () => {
    const action = <a href="#">Link</a>;
    render(<SummaryCard title="Link" value={1} action={action} />);
    expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument();
  });
});
