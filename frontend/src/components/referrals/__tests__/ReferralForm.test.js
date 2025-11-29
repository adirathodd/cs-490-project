import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../../services/api', () => ({
  __esModule: true,
  referralAPI: {
    generateMessage: jest.fn()
  },
  contactsAPI: {
    list: jest.fn().mockResolvedValue([
      { id: 'c1', display_name: 'John Doe', first_name: 'John', last_name: 'Doe', company_name: 'Acme' }
    ])
  },
  jobsAPI: {
    getJobs: jest.fn().mockResolvedValue([
      { id: 'j1', title: 'Frontend Engineer', company_name: 'Acme Corp', archived: false }
    ])
  }
}));

import ReferralForm from '../ReferralForm';

describe('ReferralForm manual-entry toggle', () => {
  test('toggles between contact selection and manual entry', async () => {
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    render(<ReferralForm onClose={onClose} onSuccess={onSuccess} />);

    // Wait for job select to populate
    await waitFor(() => expect(screen.getByLabelText(/Job Opportunity/i)).toBeInTheDocument());

    // Initially should show button to enter details manually
    const manualBtn = screen.getByRole('button', { name: /Enter details manually/i });
    expect(manualBtn).toBeInTheDocument();

    // Click to switch to manual entry mode
    await userEvent.click(manualBtn);

    // Name input should appear
    expect(await screen.findByLabelText(/Name \*/i)).toBeInTheDocument();

    // (Optional) Switching back to contact selection is exercised elsewhere;
    // here we assert we can switch into manual-entry mode and show the Name input.
  });
});
