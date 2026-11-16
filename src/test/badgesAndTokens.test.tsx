import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/common/StatusBadge';
import { SimulatedBadge } from '../components/common/SimulatedBadge';

describe('Badges and Tokens (Acceptance Criteria 8 & 12)', () => {
  it('SENT and DELIVERED look and read differently with honest copy', () => {
    const { rerender } = render(<StatusBadge status="SENT" type="notification" />);

    // Sent text and aria label
    const sentBadge = screen.getByLabelText(/Sent: Handed to the provider. Not confirmed as received./i);
    expect(sentBadge).toBeInTheDocument();
    expect(screen.getByText('(Unconfirmed)')).toBeInTheDocument();

    // Re-render as DELIVERED
    rerender(<StatusBadge status="DELIVERED" type="notification" />);
    const deliveredBadge = screen.getByLabelText(/Delivered: Provider confirmed delivery to recipient device./i);
    expect(deliveredBadge).toBeInTheDocument();
    expect(screen.queryByText('(Unconfirmed)')).not.toBeInTheDocument();
  });

  it('Simulated badge renders clearly with test environment indication', () => {
    render(<SimulatedBadge size="md" />);
    expect(screen.getByText('Simulated')).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Simulated test environment record/i)
    ).toBeInTheDocument();
  });
});
