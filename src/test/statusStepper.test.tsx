import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusStepper } from '../components/resident/StatusStepper';

describe('StatusStepper (Acceptance Criteria 7)', () => {
  it('shows resident arrival acknowledgment as pending until the resident confirms', () => {
    const stages = {
      recorded: true,
      sent: true,
      delivered: false,
      acknowledged: false, // Never achieved in Milestone 2
    };

    const counts = {
      total_recipients: 3,
      sent: 2,
      delivered: 0,
      failed: 0,
      acknowledged: 0,
    };

    render(<StatusStepper stages={stages} counts={counts} />);

    // Stage 1: Alert recorded
    expect(screen.getByText('Alert recorded')).toBeInTheDocument();

    // Stage 2: In-app notifications recorded
    expect(screen.getByText('In-app inboxes updated')).toBeInTheDocument();

    // Stage 3: Recipient read receipts
    expect(screen.getByText('Read receipts')).toBeInTheDocument();

    expect(screen.getByText('Resident confirmed arrival')).toBeInTheDocument();

    expect(screen.getByText('Waiting for resident confirmation')).toBeInTheDocument();
  });

  it('marks resident arrival acknowledgment confirmed after confirmation', () => {
    render(
      <StatusStepper
        stages={{ recorded: true, sent: true, delivered: true, acknowledged: true }}
        counts={{
          total_recipients: 3,
          sent: 2,
          delivered: 1,
          failed: 0,
          acknowledged: 1,
        }}
      />,
    );

    expect(screen.getByText('Resident confirmed arrival')).toBeInTheDocument();
    expect(screen.getByText('Resident confirmed responder arrival')).toBeInTheDocument();
  });
});
