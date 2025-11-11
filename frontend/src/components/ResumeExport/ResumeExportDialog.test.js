import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ResumeExportDialog from './ResumeExportDialog';
import { resumeExportAPI } from '../../services/api';

jest.mock('../../services/api', () => ({
  resumeExportAPI: {
    getThemes: jest.fn(),
    exportResume: jest.fn(),
  },
}));

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('loads fallback themes when API fails and shows theme options', async () => {
  resumeExportAPI.getThemes.mockRejectedValue(new Error('network'));

  render(<ResumeExportDialog isOpen={true} onClose={jest.fn()} />);

  // Wait for fallback themes to appear
  await waitFor(() => {
    expect(screen.getByRole('option', { name: /Professional/i })).toBeInTheDocument();
  });

  expect(screen.getByRole('option', { name: /Modern/i })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /Minimal/i })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /Creative/i })).toBeInTheDocument();
});

test('format selection updates hints and hides theme/watermark for plain text', async () => {
  resumeExportAPI.getThemes.mockResolvedValue({ themes: [{ id: 'professional', name: 'Professional', description: 'desc' }] });

  render(<ResumeExportDialog isOpen={true} onClose={jest.fn()} />);

  // Initially docx hint
  expect(screen.getByText(/Word documents are editable/i)).toBeInTheDocument();

  // Switch to Plain Text
  const plainButton = screen.getByText('Plain Text');
  fireEvent.click(plainButton);

  // Hint should change for plain text
  expect(screen.getByText(/Plain text format works best/i)).toBeInTheDocument();

  // Theme select and watermark inputs are not present for plain text
  expect(screen.queryByLabelText(/Theme Style/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Watermark/i)).not.toBeInTheDocument();
});

test('export success shows success message and auto-closes', async () => {
  resumeExportAPI.getThemes.mockResolvedValue({ themes: [{ id: 'professional', name: 'Professional', description: 'desc' }] });
  resumeExportAPI.exportResume.mockResolvedValue({ filename: 'John_Doe_Resume.docx' });

  const onClose = jest.fn();
  jest.useFakeTimers();

  render(<ResumeExportDialog isOpen={true} onClose={onClose} />);

  const exportButton = screen.getByRole('button', { name: /Export Resume/i });

  // Click export
  act(() => {
    fireEvent.click(exportButton);
  });

  // Should show loading state text
  expect(screen.getByText(/Exporting/i)).toBeInTheDocument();

  // Wait for success message to appear
  await waitFor(() => expect(screen.getByText(/Successfully exported/i)).toBeInTheDocument());

  // Ensure API called with defaults (docx, professional, '', '')
  expect(resumeExportAPI.exportResume).toHaveBeenCalledWith('docx', 'professional', '', '');

  // Advance timers to allow auto-close timeout (2s)
  act(() => {
    jest.advanceTimersByTime(2000);
  });

  expect(onClose).toHaveBeenCalled();
});

test('export error displays error message', async () => {
  resumeExportAPI.getThemes.mockResolvedValue({ themes: [{ id: 'professional', name: 'Professional', description: 'desc' }] });
  resumeExportAPI.exportResume.mockRejectedValue(new Error('boom'));

  render(<ResumeExportDialog isOpen={true} onClose={jest.fn()} />);

  const exportButton = screen.getByRole('button', { name: /Export Resume/i });

  fireEvent.click(exportButton);

  // The component uses err.message when available; accept either the message or the generic text
  await waitFor(() => expect(screen.getByText(/boom|Failed to export resume/i)).toBeInTheDocument());
});

test('overlay click closes dialog when not loading and close button is disabled while loading', async () => {
  resumeExportAPI.getThemes.mockResolvedValue({ themes: [{ id: 'professional', name: 'Professional', description: 'desc' }] });
  // Make exportResume return a promise we can control to simulate loading
  let resolveExport;
  const exportPromise = new Promise((res) => { resolveExport = res; });
  resumeExportAPI.exportResume.mockReturnValue(exportPromise);

  const onClose = jest.fn();
  render(<ResumeExportDialog isOpen={true} onClose={onClose} />);

  const exportButton = screen.getByRole('button', { name: /Export Resume/i });
  fireEvent.click(exportButton);

  // Close button should be disabled while loading
  const closeButton = screen.getByRole('button', { name: /Close/i });
  expect(closeButton).toBeDisabled();

  // Clicking overlay should not close while loading (we won't click overlay now), resolve the export
  act(() => resolveExport({ filename: 'file.docx' }));

  // Wait for success message
  await waitFor(() => expect(screen.getByText(/Successfully exported/i)).toBeInTheDocument());

  // Now overlay click should close
  const overlay = document.querySelector('.resume-export-overlay');
  fireEvent.click(overlay);
  expect(onClose).toHaveBeenCalled();
});
