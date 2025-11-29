import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import PreparationChecklist from '../components/jobs/PreparationChecklist';
import { interviewsAPI } from '../services/api';

jest.mock('../components/common/Icon', () => (props) => {
  const { name } = props;
  return <span data-testid={`icon-${name}`}>{name}</span>;
});

describe('PreparationChecklist', () => {
  const checklistData = {
    job_title: 'Software Engineer',
    company: 'Acme',
    scheduled_date: '2025-11-20T10:00:00Z',
    interview_type: 'technical_interview',
    progress: { total: 1, completed: 0, percentage: 0 },
    categories: {
      'Company Research': [
        {
          task_id: 't-1',
          category: 'Company Research',
          task: 'Review company website',
          completed: false,
        },
      ],
    },
  };

  beforeEach(() => {
    interviewsAPI.getPreparationChecklist.mockReset();
    interviewsAPI.toggleChecklistItem.mockReset();
  });

  test('loads checklist and toggles a task', async () => {
    interviewsAPI.getPreparationChecklist.mockResolvedValueOnce(checklistData);
    interviewsAPI.toggleChecklistItem.mockResolvedValueOnce({ completed: true, completed_at: '2025-11-15T12:00:00Z' });

    const onClose = jest.fn();

    render(<PreparationChecklist interview={{ id: 1 }} onClose={onClose} />);

    // Loading indicator appears first
    expect(screen.getByText(/Loading preparation checklist.../i)).toBeInTheDocument();

    // Wait for header to show after load
    expect(await screen.findByText(/Interview Preparation Checklist/i)).toBeInTheDocument();

    // Progress stats show
    expect(screen.getByText(/0 of 1 completed/i)).toBeInTheDocument();

    // The task checkbox should be present
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();

    // Click the checkbox to toggle
    fireEvent.click(checkbox);

    // Ensure API toggle called with expected payload
    await waitFor(() => expect(interviewsAPI.toggleChecklistItem).toHaveBeenCalledWith(1, {
      task_id: 't-1',
      category: 'Company Research',
      task: 'Review company website'
    }));

    // After toggle resolves, the UI should show the Completed marker
    await waitFor(() => expect(screen.getByText(/Completed/i)).toBeInTheDocument());
  });
});
