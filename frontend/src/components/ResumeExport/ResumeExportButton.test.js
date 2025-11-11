import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResumeExportButton from './ResumeExportButton';

// Mock the ResumeExportDialog to make tests focused and deterministic.
jest.mock('./ResumeExportDialog', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ isOpen, onClose }) =>
      isOpen ? (
        <div data-testid="mock-dialog">
          <button onClick={onClose}>Close Mock Dialog</button>
        </div>
      ) : null,
  };
});

describe('ResumeExportButton', () => {
  test('renders primary button with icon and aria label', () => {
    render(<ResumeExportButton />);

    const button = screen.getByRole('button', { name: /Export Resume/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('resume-export-trigger');
    expect(button).toHaveClass('primary');

    // Icon is rendered as a span with the emoji
    const icon = screen.getByText('📥');
    expect(icon).toBeInTheDocument();
  });

  test('opens dialog when clicked and closes when dialog onClose called', () => {
    render(<ResumeExportButton />);

    const button = screen.getByRole('button', { name: /Export Resume/i });
    fireEvent.click(button);

    // Mock dialog should be present after click
    const dialog = screen.getByTestId('mock-dialog');
    expect(dialog).toBeInTheDocument();

    // Clicking the mock dialog's close button should call onClose and hide the dialog
    const closeBtn = screen.getByText('Close Mock Dialog');
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('mock-dialog')).not.toBeInTheDocument();
  });

  test('applies secondary variant and custom className', () => {
    render(<ResumeExportButton variant="secondary" className="my-class" />);

    const button = screen.getByRole('button', { name: /Export Resume/i });
    expect(button).toHaveClass('resume-export-trigger');
    expect(button).toHaveClass('secondary');
    expect(button).toHaveClass('my-class');
  });

  test('matches snapshot', () => {
    const { container } = render(<ResumeExportButton />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
