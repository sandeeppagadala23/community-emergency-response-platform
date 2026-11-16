import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RetryDialog } from '../components/security/RetryDialog';
import { IncidentNotificationRecord } from '../types/notification';

describe('Notification Retry Flow (Acceptance Criteria 10)', () => {
  const mockFailedRecord: IncidentNotificationRecord = {
    id: 'fail_1',
    incident_id: 'INC-2026-BLR-1082',
    recipient_name: 'Mr. Arun Sharma',
    recipient_role: 'Guardian',
    channel: 'SMS',
    status: 'FAILED',
    failure_reason: 'Provider error 30008: Unknown error or handset unreachable.',
    is_simulated: true,
    retry_count: 0,
  };

  it('renders confirmation dialog stating count and affected channels', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <RetryDialog
        isOpen={true}
        onClose={handleClose}
        failedNotifications={[mockFailedRecord]}
        onConfirmRetry={handleConfirm}
        isRetrying={false}
        refusalError={null}
      />
    );

    // States how many notifications and on which channels
    expect(screen.getByText(/You are about to re-dispatch/i)).toBeInTheDocument();
    const smsTags = screen.getAllByText('SMS');
    expect(smsTags.length).toBeGreaterThan(0);
    expect(screen.getByText(/Mr. Arun Sharma/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Confirm Retry/i });
    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it('handles backend refusal and shows cooldown wait time while keeping button disabled', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    const refusalError = {
      status: 429,
      code: 'RETRY_COOLDOWN',
      message: 'Retry requested too quickly. Please wait 20s before retrying again.',
      retry_after: 20,
    };

    render(
      <RetryDialog
        isOpen={true}
        onClose={handleClose}
        failedNotifications={[mockFailedRecord]}
        onConfirmRetry={handleConfirm}
        isRetrying={false}
        refusalError={refusalError}
        cooldownSeconds={20}
      />
    );

    // Displays backend refusal message
    expect(screen.getByText(/Retry request rejected by backend/i)).toBeInTheDocument();
    const waitTexts = screen.getAllByText(/Please wait 20s before retrying/i);
    expect(waitTexts.length).toBeGreaterThan(0);

    // Confirm button is disabled with countdown
    const retryBtn = screen.getByRole('button', { name: /Wait 20s/i });
    expect(retryBtn).toBeDisabled();
  });
});
