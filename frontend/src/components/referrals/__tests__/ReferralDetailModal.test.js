import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUnmark = jest.fn(() => Promise.resolve({}));

jest.mock('../../../services/api', () => ({
  referralAPI: {
    unmarkCompleted: (id) => mockUnmark(id),
    markSent: jest.fn(),
    markResponse: jest.fn(),
    markCompleted: jest.fn(),
    expressGratitude: jest.fn(),
    suggestFollowUp: jest.fn()
  }
}));

import ReferralDetailModal from '../ReferralDetailModal';

describe('ReferralDetailModal Mark Active', () => {
  test('calls unmarkCompleted and triggers onUpdate', async () => {
    const onClose = jest.fn();
    const onUpdate = jest.fn();

    const referral = {
      id: 'test-uuid',
      status: 'completed',
      job_title: 'SWE',
      job_company: 'Acme',
      referral_source_display_name: 'Jane',
      created_at: new Date().toISOString(),
    };

    render(<ReferralDetailModal referral={referral} onClose={onClose} onUpdate={onUpdate} />);

    const markActiveBtn = await screen.findByRole('button', { name: /Mark Active/i });
    await userEvent.click(markActiveBtn);

    await waitFor(() => expect(mockUnmark).toHaveBeenCalledWith('test-uuid'));
    expect(onUpdate).toHaveBeenCalled();
  });
});
