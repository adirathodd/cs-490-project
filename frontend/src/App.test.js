import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login screen by default', async () => {
  render(<App />);
  // Expect the public login page header
  expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
});
