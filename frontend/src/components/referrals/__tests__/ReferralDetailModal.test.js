import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { referralAPI } from '../../../services/api';
import ReferralDetailModal from '../ReferralDetailModal';

describe('ReferralDetailModal Mark Active', () => {
  beforeEach(() => {
    referralAPI.unmarkCompleted.mockReset();
    referralAPI.unmarkCompleted.mockResolvedValue({});
  });

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
    await act(async () => {
      await userEvent.click(markActiveBtn);
    });

    await waitFor(() => expect(referralAPI.unmarkCompleted).toHaveBeenCalledWith('test-uuid'));
    expect(onUpdate).toHaveBeenCalled();
  });
});
