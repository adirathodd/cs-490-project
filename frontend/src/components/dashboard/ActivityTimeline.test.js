import React from 'react';
import { render, screen } from '@testing-library/react';
import ActivityTimeline from './ActivityTimeline';

describe('ActivityTimeline', () => {
  it('renders with no events', () => {
    render(<ActivityTimeline />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('renders with empty events array', () => {
    render(<ActivityTimeline events={[]} />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('renders a single event', () => {
    const events = [{ title: 'Logged in', time: '2025-11-04 10:00' }];
    render(<ActivityTimeline events={events} />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('Logged in')).toBeInTheDocument();
    expect(screen.getByText('2025-11-04 10:00')).toBeInTheDocument();
    expect(screen.queryByText('No recent activity')).not.toBeInTheDocument();
  });

  it('renders multiple events', () => {
    const events = [
      { title: 'Logged in', time: '2025-11-04 10:00' },
      { title: 'Updated profile', time: '2025-11-04 10:05' },
      { title: 'Logged out', time: '2025-11-04 10:10' },
    ];
    render(<ActivityTimeline events={events} />);
    events.forEach(e => {
      expect(screen.getByText(e.title)).toBeInTheDocument();
      expect(screen.getByText(e.time)).toBeInTheDocument();
    });
    expect(screen.queryByText('No recent activity')).not.toBeInTheDocument();
  });

  it('renders event with empty title and time', () => {
    const events = [{ title: '', time: '' }];
    render(<ActivityTimeline events={events} />);
    // There should be two <p> elements with empty text
    // Only count <p> elements inside the event container
      const { container } = render(<ActivityTimeline events={[{ title: '', time: '' }]} />);
      // Find all event containers (divs with border-bottom style)
      const eventDivs = Array.from(container.querySelectorAll('div')).filter(div =>
        div.style.borderBottom === '1px solid #f3f4f6'
      );
      expect(eventDivs.length).toBeGreaterThan(0);
      // For the first event, count <p> elements with empty text
      const emptyPs = Array.from(eventDivs[0].querySelectorAll('p')).filter(p => p.textContent === '');
      expect(emptyPs.length).toBe(2);
  });

  it('renders with null events prop', () => {
    render(<ActivityTimeline events={null} />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });
});
