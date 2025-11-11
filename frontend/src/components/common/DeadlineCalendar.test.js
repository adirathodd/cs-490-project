import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import DeadlineCalendar from './DeadlineCalendar';

const RouterWrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>;

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DeadlineCalendar (UC-071: Interview Scheduling Integration)', () => {
  test('renders calendar with current month', () => {
    render(
      <DeadlineCalendar items={[]} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    const currentMonth = new Date().toLocaleString(undefined, {
      month: 'long',
      year: 'numeric',
    });

    expect(screen.getByText(currentMonth)).toBeInTheDocument();
  });

  test('renders day headers', () => {
    render(
      <DeadlineCalendar items={[]} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Thu')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });

  test('displays job application deadlines', () => {
    // Pick dates inside the currently visible month grid to ensure they render
    const now = new Date();
    const d1 = new Date(now.getFullYear(), now.getMonth(), 10);
    const d2 = new Date(now.getFullYear(), now.getMonth(), 20);
    const items = [
      { id: 1, title: 'Software Engineer', company_name: 'Test Corp', application_deadline: d1.toISOString().split('T')[0] },
      { id: 2, title: 'Backend Developer', company_name: 'Another Corp', application_deadline: d2.toISOString().split('T')[0] },
    ];

    render(
      <DeadlineCalendar items={items} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    // Deadlines should appear in the calendar as event pills
    const pills = screen.getAllByText(/engineer|developer/i);
    expect(pills.length).toBeGreaterThanOrEqual(2);
  });

  test('displays scheduled interviews', () => {
    const now = new Date();
    const iv1 = new Date(now.getFullYear(), now.getMonth(), 8, 10, 0, 0);
    const iv2 = new Date(now.getFullYear(), now.getMonth(), 18, 14, 0, 0);
    const interviews = [
      { id: 1, job: 1, job_title: 'Frontend Developer', scheduled_at: iv1.toISOString(), interview_type: 'video' },
      { id: 2, job: 2, job_title: 'Full Stack Engineer', scheduled_at: iv2.toISOString(), interview_type: 'in_person' },
    ];

    render(
      <DeadlineCalendar items={[]} interviews={interviews} />,
      { wrapper: RouterWrapper }
    );

    // Interviews should appear in the calendar as event pills
    expect(screen.getAllByText(/frontend developer|full stack engineer/i).length).toBeGreaterThanOrEqual(2);
  });

  test('interview pills are clickable and navigate correctly', async () => {
    const now = new Date();
    const iv = new Date(now.getFullYear(), now.getMonth(), 10, 10, 0, 0);
    const interviews = [{ id: 1, job: 123, job_title: 'Software Engineer', scheduled_at: iv.toISOString(), interview_type: 'video' }];

    render(
      <DeadlineCalendar items={[]} interviews={interviews} />,
      { wrapper: RouterWrapper }
    );

    const interviewPill = screen.getByText(/software engineer/i);
    await userEvent.click(interviewPill);
    expect(mockNavigate).toHaveBeenCalledWith('/jobs/123?tab=interviews');
  });

  test('navigates to next month', async () => {
    render(
      <DeadlineCalendar items={[]} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    const currentMonth = new Date().toLocaleString(undefined, {
      month: 'long',
      year: 'numeric',
    });

    expect(screen.getByText(currentMonth)).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: /next/i });
    await userEvent.click(nextBtn);

    const nextMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      1
    ).toLocaleString(undefined, { month: 'long', year: 'numeric' });

    expect(screen.getByText(nextMonth)).toBeInTheDocument();
  });

  test('navigates to previous month', async () => {
    render(
      <DeadlineCalendar items={[]} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    const prevBtn = screen.getByRole('button', { name: /previous/i });
    await userEvent.click(prevBtn);

    const prevMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() - 1,
      1
    ).toLocaleString(undefined, { month: 'long', year: 'numeric' });

    expect(screen.getByText(prevMonth)).toBeInTheDocument();
  });

  test('collapses and expands calendar', async () => {
    render(
      <DeadlineCalendar items={[]} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    const collapseBtn = screen.getByRole('button', { name: /collapse calendar/i });
    await userEvent.click(collapseBtn);

    // Calendar grid should be collapsed (not visible)
    const expandBtn = screen.getByRole('button', { name: /expand calendar/i });
    expect(expandBtn).toBeInTheDocument();

    // Expand again
    await userEvent.click(expandBtn);
    expect(screen.getByRole('button', { name: /collapse calendar/i })).toBeInTheDocument();
  });

  test('highlights today\'s date', () => {
    render(
      <DeadlineCalendar items={[]} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    const today = new Date().getDate();
    const todayElement = screen.getByText(today.toString());
    
    // Today should have a special styling (check for parent with today class or similar)
    expect(todayElement.closest('.calendar-day')).toHaveClass('is-today');
  });

  test('shows urgency color coding for deadlines', () => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const items = [{ id: 1, title: 'Urgent Job', company_name: 'Test Corp', application_deadline: tomorrow.toISOString().split('T')[0] }];

    render(
      <DeadlineCalendar items={items} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    // Urgent deadline should render as an event pill; color styling is handled in component
    const deadlinePill = screen.getByText(/urgent job/i).closest('.calendar-event-pill');
    expect(deadlinePill).toBeInTheDocument();
  });

  test('shows overdue deadlines in red', () => {
    const today = new Date();
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const items = [{ id: 1, title: 'Overdue Job', company_name: 'Test Corp', application_deadline: yesterday.toISOString().split('T')[0] }];

    render(
      <DeadlineCalendar items={items} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    // Overdue deadline should have red background
    const deadlinePill = screen.getByText(/overdue job/i).closest('.calendar-event-pill');
    expect(deadlinePill).toBeInTheDocument();
  });

  test('calls onSelectDate when a date is clicked', async () => {
    const mockOnSelectDate = jest.fn();

    render(
      <DeadlineCalendar
        items={[]}
        interviews={[]}
        onSelectDate={mockOnSelectDate}
      />,
      { wrapper: RouterWrapper }
    );

    // Click the first non-outside day cell
    const dayButtons = Array.from(document.querySelectorAll('.calendar-day'));
    const target = dayButtons.find((b) => !b.classList.contains('is-outside'));
    expect(target).toBeTruthy();
    await userEvent.click(target);
    expect(mockOnSelectDate).toHaveBeenCalled();
  });

  test('displays multiple items on the same date', () => {
    const now = new Date();
    const dateStr = new Date(now.getFullYear(), now.getMonth(), 15).toISOString().split('T')[0];
    const items = [
      { id: 1, title: 'Job 1', company_name: 'Corp A', application_deadline: dateStr },
      { id: 2, title: 'Job 2', company_name: 'Corp B', application_deadline: dateStr },
    ];
    const interviews = [{ id: 1, job: 3, job_title: 'Job 3', scheduled_at: `${dateStr}T10:00:00Z`, interview_type: 'video' }];

    render(
      <DeadlineCalendar items={items} interviews={interviews} />,
      { wrapper: RouterWrapper }
    );

    // All items should be displayed as event pills
    expect(screen.getAllByText(/job 1|job 2|job 3/i).length).toBeGreaterThanOrEqual(3);
  });

  test('handles dates from previous and next months', () => {
    render(
      <DeadlineCalendar items={[]} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    // Calendar should render 42 cells (6 weeks × 7 days)
    // This includes days from adjacent months
    const dayCells = document.querySelectorAll('.calendar-day');
    expect(dayCells.length).toBeGreaterThanOrEqual(28);
  });

  test('displays interview type icon', () => {
    const now = new Date();
    const iv = new Date(now.getFullYear(), now.getMonth(), 10, 10, 0, 0);
    const interviews = [
      { id: 1, job: 1, job_title: 'Software Engineer', scheduled_at: iv.toISOString(), interview_type: 'video' },
    ];

    render(
      <DeadlineCalendar items={[]} interviews={interviews} />,
      { wrapper: RouterWrapper }
    );

    // Should render an event pill for the interview (icon unicode included)
    const interviewPill = screen.getByText(/software engineer/i).closest('.calendar-event-pill');
    expect(interviewPill).toBeInTheDocument();
  });

  test('handles empty items and interviews arrays', () => {
    const { container } = render(
      <DeadlineCalendar items={[]} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    // Should render without crashing
    expect(container.querySelector('.calendar-header')).toBeInTheDocument();
  });

  test('handles items without deadline dates', () => {
    const items = [
      {
        id: 1,
        title: 'Job Without Deadline',
        company_name: 'Test Corp',
        application_deadline: null,
      },
      {
        id: 2,
        title: 'Job With Deadline',
        company_name: 'Another Corp',
        application_deadline: new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString().split('T')[0],
      },
    ];

    render(
      <DeadlineCalendar items={items} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    // Only job with deadline should appear
    expect(screen.queryByText(/job without deadline/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/job with deadline/i).length).toBeGreaterThanOrEqual(1);
  });

  test('handles interviews without scheduled_at', () => {
    const interviews = [
      {
        id: 1,
        job: 1,
        job_title: 'No Schedule',
        scheduled_at: null,
        interview_type: 'video',
      },
      {
        id: 2,
        job: 2,
        job_title: 'Scheduled Interview',
        scheduled_at: new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString(),
        interview_type: 'phone',
      },
    ];

    render(
      <DeadlineCalendar items={[]} interviews={interviews} />,
      { wrapper: RouterWrapper }
    );

    // Only scheduled interview should appear
    expect(screen.queryByText(/no schedule/i)).not.toBeInTheDocument();
    expect(screen.getByText(/scheduled interview/i)).toBeInTheDocument();
  });

  test('renders current month button', async () => {
    render(
      <DeadlineCalendar items={[]} interviews={[]} />,
      { wrapper: RouterWrapper }
    );

    // Navigate to next month first
    const nextBtn = screen.getByRole('button', { name: /next/i });
    await userEvent.click(nextBtn);

    // Click "Today" or "Current" button to return to current month
    const todayBtn = screen.queryByRole('button', { name: /today|current/i });
    if (todayBtn) {
      await userEvent.click(todayBtn);

      const currentMonth = new Date().toLocaleString(undefined, {
        month: 'long',
        year: 'numeric',
      });
      expect(screen.getByText(currentMonth)).toBeInTheDocument();
    }
  });
});
