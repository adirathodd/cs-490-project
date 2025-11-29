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

const renderDialog = async (props = {}) => {
  await act(async () => {
    render(<ResumeExportDialog isOpen={true} onClose={jest.fn()} {...props} />);
  });
};

beforeEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('loads fallback themes when API fails and shows theme options', async () => {
  resumeExportAPI.getThemes.mockRejectedValue(new Error('network'));
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  await renderDialog();

  await waitFor(() => {
    expect(screen.getByRole('option', { name: /Professional/i })).toBeInTheDocument();
  });

  expect(screen.getByRole('option', { name: /Modern/i })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /Minimal/i })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: /Creative/i })).toBeInTheDocument();
  consoleErrorSpy.mockRestore();
});

test('format selection updates hints and hides theme/watermark for plain text', async () => {
  resumeExportAPI.getThemes.mockResolvedValue({ themes: [{ id: 'professional', name: 'Professional', description: 'desc' }] });

  await renderDialog();

  expect(screen.getByText(/Word documents are editable/i)).toBeInTheDocument();

  const plainButton = screen.getByText('Plain Text');
  await act(async () => {
    fireEvent.click(plainButton);
  });

  expect(screen.getByText(/Plain text format works best/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/Theme Style/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Watermark/i)).not.toBeInTheDocument();
});

test('export success shows success message and auto-closes', async () => {
  resumeExportAPI.getThemes.mockResolvedValue({ themes: [{ id: 'professional', name: 'Professional', description: 'desc' }] });
  let resolveExport;
  const exportPromise = new Promise((res) => { resolveExport = res; });
  resumeExportAPI.exportResume.mockReturnValue(exportPromise);

  const onClose = jest.fn();
  jest.useFakeTimers();

  await act(async () => {
    render(<ResumeExportDialog isOpen={true} onClose={onClose} />);
  });

  const exportButton = screen.getByRole('button', { name: /Export Resume/i });

  await act(async () => {
    fireEvent.click(exportButton);
  });

  expect(await screen.findByText(/Exporting/i)).toBeInTheDocument();

  act(() => resolveExport({ filename: 'John_Doe_Resume.docx' }));

  await waitFor(() => expect(screen.getByText(/Successfully exported/i)).toBeInTheDocument());

  expect(resumeExportAPI.exportResume).toHaveBeenCalledWith('docx', 'professional', '', '');

  act(() => {
    jest.advanceTimersByTime(2000);
  });

  expect(onClose).toHaveBeenCalled();
});

test('export error displays error message', async () => {
  resumeExportAPI.getThemes.mockResolvedValue({ themes: [{ id: 'professional', name: 'Professional', description: 'desc' }] });
  resumeExportAPI.exportResume.mockRejectedValue(new Error('boom'));

  await renderDialog();

  const exportButton = screen.getByRole('button', { name: /Export Resume/i });

  await act(async () => {
    fireEvent.click(exportButton);
  });

  await waitFor(() => expect(screen.getByText(/boom|Failed to export resume/i)).toBeInTheDocument());
});

test('overlay click closes dialog when not loading and close button is disabled while loading', async () => {
  resumeExportAPI.getThemes.mockResolvedValue({ themes: [{ id: 'professional', name: 'Professional', description: 'desc' }] });
  let resolveExport;
  const exportPromise = new Promise((res) => { resolveExport = res; });
  resumeExportAPI.exportResume.mockReturnValue(exportPromise);

  const onClose = jest.fn();
  await act(async () => {
    render(<ResumeExportDialog isOpen={true} onClose={onClose} />);
  });

  const exportButton = screen.getByRole('button', { name: /Export Resume/i });
  await act(async () => {
    fireEvent.click(exportButton);
  });

  const closeButton = screen.getByRole('button', { name: /Close/i });
  expect(closeButton).toBeDisabled();

  act(() => resolveExport({ filename: 'file.docx' }));

  await waitFor(() => expect(screen.getByText(/Successfully exported/i)).toBeInTheDocument());

  const overlay = document.querySelector('.resume-export-overlay');
  await act(async () => {
    fireEvent.click(overlay);
  });
  expect(onClose).toHaveBeenCalled();
});
