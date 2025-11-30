import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InterviewScheduler from './InterviewScheduler';
import { interviewsAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  interviewsAPI: {
    createInterview: jest.fn(),
    updateInterview: jest.fn(),
  },
}));

const mockJob = {
  id: 1,
  title: 'Software Engineer',
  company_name: 'Test Corp',
};

const mockOnClose = jest.fn();
const mockOnSuccess = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('InterviewScheduler (UC-071: Interview Scheduling)', () => {
  test('renders scheduler modal for new interview', () => {
    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

  // Header should be present (avoid matching the submit button text)
  expect(screen.getByRole('heading', { name: /schedule interview/i })).toBeInTheDocument();
    expect(screen.getByText(/test corp/i)).toBeInTheDocument();
  });

  test('renders scheduler modal for editing existing interview', () => {
    const existingInterview = {
      id: 1,
      interview_type: 'video',
      scheduled_at: '2025-12-01T10:00:00Z',
      duration_minutes: 60,
      location: '',
      meeting_link: 'https://zoom.us/j/123',
      interviewer_name: 'John Doe',
      interviewer_email: 'john@example.com',
      interviewer_title: 'Senior Engineer',
      preparation_notes: 'Review algorithms',
    };

    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        existingInterview={existingInterview}
      />
    );

  expect(screen.getByText(/reschedule interview/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://zoom.us/j/123')).toBeInTheDocument();
  });

  test('creates new interview successfully', async () => {
    interviewsAPI.createInterview.mockResolvedValueOnce({
      id: 1,
      job: 1,
      interview_type: 'video',
      scheduled_at: '2025-12-01T10:00:00Z',
    });

    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Select interview type by clicking the corresponding button
    const videoBtn = screen.getByRole('button', { name: /video interview/i });
    await userEvent.click(videoBtn);

    // Enter scheduled date/time
  const dateInput = screen.getByLabelText(/date & time/i);
  fireEvent.change(dateInput, { target: { value: '2025-12-01T10:00' } });

    // Enter duration
    const durationSelect = screen.getByLabelText(/duration/i);
    await userEvent.selectOptions(durationSelect, '60');

    // Enter meeting link
    const linkInput = screen.getByLabelText(/meeting link/i);
    await userEvent.type(linkInput, 'https://zoom.us/j/123');

  // Enter interviewer name (input placeholder contains example name)
  const nameInput = screen.getByPlaceholderText(/john doe/i);
  await userEvent.type(nameInput, 'Jane Smith');

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /schedule interview/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(interviewsAPI.createInterview).toHaveBeenCalledWith(
        expect.objectContaining({
          job: 1,
          interview_type: 'video',
          duration_minutes: expect.any(String),
          meeting_link: 'https://zoom.us/j/123',
          interviewer_name: 'Jane Smith',
        })
      );
    });

    expect(mockOnSuccess).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('updates existing interview successfully', async () => {
    const existingInterview = {
      id: 1,
      interview_type: 'video',
      scheduled_at: '2025-12-01T10:00:00Z',
      duration_minutes: 60,
      meeting_link: 'https://zoom.us/j/123',
      interviewer_name: 'John Doe',
    };

    interviewsAPI.updateInterview.mockResolvedValueOnce({
      ...existingInterview,
      interviewer_name: 'Jane Smith',
    });

    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        existingInterview={existingInterview}
      />
    );

    // Update interviewer name
    const nameInput = screen.getByDisplayValue('John Doe');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Jane Smith');

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /update interview/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(interviewsAPI.updateInterview).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          interviewer_name: 'Jane Smith',
        })
      );
    });

    expect(mockOnSuccess).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('validates required fields', async () => {
    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Try to submit without filling required fields
    const submitBtn = screen.getByRole('button', { name: /schedule interview/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/please select a date and time/i)).toBeInTheDocument();
    expect(interviewsAPI.createInterview).not.toHaveBeenCalled();
  });

  test('validates in-person interview requires location', async () => {
    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Select in-person interview type
  const inPersonBtn = screen.getByRole('button', { name: /in-person interview/i });
  await userEvent.click(inPersonBtn);

    // Enter scheduled date/time
  const dateInput = screen.getByLabelText(/date & time/i);
  fireEvent.change(dateInput, { target: { value: '2025-12-01T10:00' } });

    // Submit without location
    const submitBtn = screen.getByRole('button', { name: /schedule interview/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/location is required for in-person interviews/i)).toBeInTheDocument();
    expect(interviewsAPI.createInterview).not.toHaveBeenCalled();
  });

  test('validates video interview requires meeting link', async () => {
    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

  // Select video interview type by clicking the corresponding button
  const videoBtn = screen.getByRole('button', { name: /video interview/i });
  await userEvent.click(videoBtn);

    // Enter scheduled date/time
  const dateInput = screen.getByLabelText(/date & time/i);
  fireEvent.change(dateInput, { target: { value: '2025-12-01T10:00' } });

    // Submit without meeting link
    const submitBtn = screen.getByRole('button', { name: /schedule interview/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/meeting link is required for video interviews/i)).toBeInTheDocument();
    expect(interviewsAPI.createInterview).not.toHaveBeenCalled();
  });

  test('displays scheduling conflict error', async () => {
    interviewsAPI.createInterview.mockRejectedValueOnce({
      scheduled_at: 'This time conflicts with another interview: Backend Engineer on Dec 01 at 10:00 AM',
    });

    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

  // Fill form: select video interview type by clicking button
  const videoBtn = screen.getByRole('button', { name: /video interview/i });
  await userEvent.click(videoBtn);

  const dateInput = screen.getByLabelText(/date & time/i);
  fireEvent.change(dateInput, { target: { value: '2025-12-01T10:00' } });

    const linkInput = screen.getByLabelText(/meeting link/i);
    await userEvent.type(linkInput, 'https://zoom.us/j/123');

    // Submit
    const submitBtn = screen.getByRole('button', { name: /schedule interview/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/conflicts with another interview/i)).toBeInTheDocument();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  test('displays conflicts array from backend', async () => {
    interviewsAPI.createInterview.mockRejectedValueOnce({
      conflicts: [
        {
          job_title: 'Backend Engineer',
          conflict_time: 'Dec 01 at 10:00 AM',
        },
      ],
    });

    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

  // Fill and submit form: select video interview type by clicking button
  const videoBtn = screen.getByRole('button', { name: /video interview/i });
  await userEvent.click(videoBtn);

  const dateInput = screen.getByLabelText(/date & time/i);
  fireEvent.change(dateInput, { target: { value: '2025-12-01T10:00' } });

    const linkInput = screen.getByLabelText(/meeting link/i);
    await userEvent.type(linkInput, 'https://zoom.us/j/123');

    const submitBtn = screen.getByRole('button', { name: /schedule interview/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/scheduling conflict detected/i)).toBeInTheDocument();
    expect(screen.getByText(/backend engineer/i)).toBeInTheDocument();
  });

  test('closes modal when cancel is clicked', async () => {
    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalled();
    expect(interviewsAPI.createInterview).not.toHaveBeenCalled();
  });

  test('closes modal when clicking outside', async () => {
    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const overlay = document.querySelector('.modal-overlay');
    await userEvent.click(overlay);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('does not close modal when clicking inside content', async () => {
    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const modalContent = document.querySelector('.modal-content');
    await userEvent.click(modalContent);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('displays all interview type options', () => {
    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

  // The interview type options are rendered as buttons in a grid
  expect(screen.getByText(/phone screen/i)).toBeInTheDocument();
  expect(screen.getByText(/video interview/i)).toBeInTheDocument();
  expect(screen.getByText(/in-person interview/i)).toBeInTheDocument();
  expect(screen.getByText(/technical assessment/i)).toBeInTheDocument();
  expect(screen.getByText(/group interview/i)).toBeInTheDocument();
  });

  test('displays duration options', () => {
    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const durationSelect = screen.getByLabelText(/duration/i);
    expect(durationSelect).toContainHTML('30');
    expect(durationSelect).toContainHTML('45');
    expect(durationSelect).toContainHTML('60');
    expect(durationSelect).toContainHTML('90');
    expect(durationSelect).toContainHTML('120');
    expect(durationSelect).toContainHTML('180');
  });

  test('handles API error gracefully', async () => {
    interviewsAPI.createInterview.mockRejectedValueOnce({
      message: 'Network error',
    });

    render(
      <InterviewScheduler
        job={mockJob}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

  // Fill form: select video interview type by clicking button
  const videoBtn = screen.getByRole('button', { name: /video interview/i });
  await userEvent.click(videoBtn);

  const dateInput = screen.getByLabelText(/date & time/i);
  fireEvent.change(dateInput, { target: { value: '2025-12-01T10:00' } });

    const linkInput = screen.getByLabelText(/meeting link/i);
    await userEvent.type(linkInput, 'https://zoom.us/j/123');

    // Submit
    const submitBtn = screen.getByRole('button', { name: /schedule interview/i });
    await userEvent.click(submitBtn);

    expect(await screen.findByText(/unable to schedule interview due to network issues/i)).toBeInTheDocument();
  });
});
