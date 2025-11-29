import React from 'react';
import { render, screen } from '@testing-library/react';
import Icon from './Icon';

describe('Icon', () => {
  it('renders mapped icons with sizing, color, and accessibility label', () => {
    render(<Icon name="user" size="lg" color="#123456" className="extra" ariaLabel="Profile icon" />);
    const wrapper = screen.getByRole('img', { name: /profile icon/i });
    expect(wrapper.className).toContain('extra');
    expect(wrapper).toHaveStyle({ width: '24px', height: '24px', color: '#123456' });
  });

  it('falls back to empty span when icon name is unknown', () => {
    const { container } = render(<Icon name="mystery" size={18} />);
    const span = container.querySelector('span');
    expect(span).toHaveClass('icon');
    expect(span).toHaveAttribute('aria-hidden', 'true');
    expect(span).toHaveStyle({ fontSize: '18px' });
  });

  // Test new icons added for cover letter features
  it('renders clock icon for version history', () => {
    render(<Icon name="clock" size="sm" ariaLabel="Version history" />);
    const wrapper = screen.getByRole('img', { name: /version history/i });
    expect(wrapper).toBeInTheDocument();
  });

  it('renders book icon for synonym suggestions', () => {
    const { container } = render(<Icon name="book" size="md" ariaLabel="Synonyms" />);
    const wrapper = screen.getByRole('img', { name: /synonyms/i });
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('icon');
    expect(wrapper).toHaveStyle({ width: '20px', height: '20px' });
  });

  it('renders activity icon for readability', () => {
    render(<Icon name="activity" size="sm" ariaLabel="Readability score" />);
    const wrapper = screen.getByRole('img', { name: /readability/i });
    expect(wrapper).toBeInTheDocument();
  });

  it('renders corner-up-left icon for undo', () => {
    render(<Icon name="corner-up-left" size="sm" ariaLabel="Undo" />);
    const wrapper = screen.getByRole('img', { name: /undo/i });
    expect(wrapper).toBeInTheDocument();
  });

  it('renders corner-up-right icon for redo', () => {
    render(<Icon name="corner-up-right" size="sm" ariaLabel="Redo" />);
    const wrapper = screen.getByRole('img', { name: /redo/i });
    expect(wrapper).toBeInTheDocument();
  });

  it('renders zap icon for improvements', () => {
    const { container } = render(<Icon name="zap" size="md" ariaLabel="Improvements" />);
    const wrapper = screen.getByRole('img', { name: /improvements/i });
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('icon');
    expect(wrapper).toHaveStyle({ width: '20px', height: '20px' });
  });

  it('renders mail icon for email', () => {
    const { container } = render(<Icon name="mail" size="sm" ariaLabel="Email" />);
    const wrapper = screen.getByRole('img', { name: /email/i });
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('icon');
    expect(wrapper).toHaveStyle({ width: '16px', height: '16px' });
  });

  it('handles size prop as string', () => {
    render(<Icon name="user" size="xl" ariaLabel="User icon" />);
    const wrapper = screen.getByRole('img', { name: /user icon/i });
    expect(wrapper).toHaveStyle({ width: '32px', height: '32px' });
  });

  it('handles size prop as number', () => {
    render(<Icon name="user" size={28} ariaLabel="User icon" />);
    const wrapper = screen.getByRole('img', { name: /user icon/i });
    expect(wrapper).toHaveStyle({ width: '28px', height: '28px' });
  });

  it('applies custom className', () => {
    render(<Icon name="check-circle" className="custom-class" ariaLabel="Success" />);
    const wrapper = screen.getByRole('img', { name: /success/i });
    expect(wrapper).toHaveClass('custom-class');
  });
});
