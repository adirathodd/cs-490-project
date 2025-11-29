import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('./Icon', () => ({
  __esModule: true,
  default: jest.fn(() => <span data-testid="icon" />),
}));

const Icon = require('./Icon').default;
const LoadingSpinner = require('./LoadingSpinner').default;

describe('LoadingSpinner', () => {
  it('renders icon with spinner props and wrapper classes', () => {
    const { container } = render(<LoadingSpinner size="xl" color="#ff00ff" className="extra" />);
    expect(container.firstChild).toHaveClass('loading-spinner', 'extra');
    const [props] = Icon.mock.calls[0];
    expect(props).toMatchObject({
      name: 'spinner',
      size: 'xl',
      color: '#ff00ff',
      className: 'spin',
    });
  });
});
