// Mock the API module BEFORE importing the component under test
jest.mock('../../services/api', () => ({
  educationAPI: {
    getLevels: jest.fn().mockResolvedValue([
      { value: 'hs', label: 'High School' },
      { value: 'aa', label: 'Associate' },
      { value: 'ba', label: "Bachelor" }
    ]),
    getEducations: jest.fn().mockResolvedValue([]),
    addEducation: jest.fn().mockResolvedValue({
      id: 1,
      institution: 'Test U',
      degree_type: 'ba',
      field_of_study: 'CS',
      start_date: null,
      graduation_date: '2024-05-15',
      currently_enrolled: false,
      gpa: null,
      gpa_private: false,
      honors: '',
      achievements: '',
      description: ''
    }),
    updateEducation: jest.fn(),
    deleteEducation: jest.fn().mockResolvedValue({ message: 'deleted' })
  }
}));

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Education from './Education';

describe('Education component', () => {
  it('renders and shows empty state', async () => {
    render(<Education />);
    // Wait for the real heading (not the loading text)
  expect(await screen.findByRole('heading', { name: /^Education$/i })).toBeInTheDocument();
    expect(await screen.findByText(/No education entries yet/i)).toBeInTheDocument();
  });

  it('validates required fields before submit', async () => {
    render(<Education />);

  // Ensure levels loaded (wait for heading instead of matching loading text)
  await screen.findByRole('heading', { name: /^Education$/i });
  // Open form and submit to trigger validation
  fireEvent.click(screen.getByRole('button', { name: /\+ Add Education/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Add Education$/i }));

    expect(await screen.findByText(/Institution is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/Education level is required/i)).toBeInTheDocument();
  });

  it('allows currently enrolled without graduation date', async () => {
    render(<Education />);
    await screen.findByRole('heading', { name: /^Education$/i });
    fireEvent.click(screen.getByRole('button', { name: /\+ Add Education/i }));

    fireEvent.change(screen.getByLabelText(/Institution/i), { target: { value: 'My College' } });
    fireEvent.change(screen.getByLabelText(/Education Level/i), { target: { value: 'ba' } });

    // Enable currently enrolled
    fireEvent.click(screen.getByLabelText(/Currently enrolled/i));

  // Submit
  fireEvent.click(screen.getByRole('button', { name: /^Add Education$/i }));

    // No graduation date error should appear
    await waitFor(() => {
      const err = screen.queryByText(/Graduation date required/i);
      expect(err).toBeNull();
    });
  });

  it('creates an entry and displays it in list', async () => {
    const { educationAPI } = require('../../services/api');
    // Ensure levels have a known option for this test
    educationAPI.getLevels.mockResolvedValueOnce([
      { value: 'ba', label: 'Bachelor' }
    ]);
    // Ensure add returns the created item
    educationAPI.addEducation.mockResolvedValueOnce({
      id: 1,
      institution: 'Test U',
      degree_type: 'ba',
      field_of_study: 'CS',
      start_date: null,
      graduation_date: '2024-05-15',
      currently_enrolled: false,
      gpa: null,
      gpa_private: false,
      honors: '',
      achievements: '',
      description: ''
    });
  render(<Education />);

  await screen.findByRole('heading', { name: /^Education$/i });
  fireEvent.click(screen.getByRole('button', { name: /\+ Add Education/i }));

    fireEvent.change(screen.getByLabelText(/Institution/i), { target: { value: 'Test U' } });
  fireEvent.change(screen.getByLabelText(/Education Level/i), { target: { value: 'ba' } });

    // Provide graduation date since not enrolled
    fireEvent.change(screen.getByLabelText(/Graduation Date/i), { target: { value: '2024-05-15' } });

  fireEvent.click(screen.getByRole('button', { name: /^Add Education$/i }));

    // New item should appear after successful add
    expect(await screen.findByText('Test U')).toBeInTheDocument();
    expect(screen.getByText(/Graduated 2024-05-15/i)).toBeInTheDocument();
  });
});
