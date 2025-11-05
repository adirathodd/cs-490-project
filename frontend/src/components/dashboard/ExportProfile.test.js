import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ExportProfile from './ExportProfile';

describe('ExportProfile', () => {
  const payload = { name: 'John Doe', email: 'john@example.com', skills: ['JS', 'React'] };

  beforeEach(() => {
    // Clean up any created anchor elements
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('renders export button', () => {
    render(<ExportProfile payload={payload} />);
    expect(screen.getByRole('button', { name: /export summary/i })).toBeInTheDocument();
  });

  it('exports profile as JSON when clicked', () => {
    const createObjectURL = jest.fn(() => 'blob:url');
    const revokeObjectURL = jest.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    render(<ExportProfile payload={payload} />);
    // Patch anchor click after render
    const anchor = document.body.querySelector('a');
    if (anchor) anchor.click = jest.fn();
    fireEvent.click(screen.getByRole('button'));
    expect(createObjectURL).toHaveBeenCalled();
    if (anchor) expect(anchor.click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:url');
  });

  it('handles export errors gracefully', () => {
    // Simulate error in Blob creation
    const origBlob = window.Blob;
    window.Blob = function() { throw new Error('fail'); };
    render(<ExportProfile payload={payload} />);
    const anchor = document.body.querySelector('a');
    if (anchor) anchor.click = jest.fn();
    expect(() => {
      fireEvent.click(screen.getByRole('button'));
    }).not.toThrow();
    window.Blob = origBlob;
  });

  it('exports empty payload', () => {
    const createObjectURL = jest.fn(() => 'blob:url');
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = jest.fn();
    render(<ExportProfile payload={null} />);
    const anchor = document.body.querySelector('a');
    if (anchor) anchor.click = jest.fn();
    fireEvent.click(screen.getByRole('button'));
    expect(createObjectURL).toHaveBeenCalled();
    if (anchor) expect(anchor.click).toHaveBeenCalled();
  });
});
