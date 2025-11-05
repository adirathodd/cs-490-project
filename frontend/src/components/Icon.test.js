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
});
