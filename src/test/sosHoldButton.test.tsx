import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SosHoldButton } from '../components/resident/SosHoldButton';

describe('SosHoldButton (Acceptance Criteria 5 & 6)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancels cleanly if released early before 1.5 seconds without triggering SOS', () => {
    const handleTrigger = vi.fn();
    render(<SosHoldButton onTrigger={handleTrigger} holdDurationMs={1500} />);

    const button = screen.getByTestId('sos-hold-button');

    // Start holding
    fireEvent.pointerDown(button, { button: 0 });

    // Advance 800ms (less than 1500ms)
    act(() => {
      vi.advanceTimersByTime(800);
    });

    // Release mouse early
    fireEvent.pointerUp(button);

    // Advance remaining time
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Verify SOS was NOT triggered
    expect(handleTrigger).not.toHaveBeenCalled();
    expect(button).not.toBeDisabled();
  });

  it('triggers SOS after the full hold duration', () => {
    const handleTrigger = vi.fn();
    render(<SosHoldButton onTrigger={handleTrigger} holdDurationMs={1500} />);

    const button = screen.getByTestId('sos-hold-button');

    fireEvent.pointerDown(button, { button: 0 });

    act(() => {
      vi.advanceTimersByTime(1499);
    });
    expect(handleTrigger).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(handleTrigger).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('cancels when the pointer is released outside the button', () => {
    const handleTrigger = vi.fn();
    render(<SosHoldButton onTrigger={handleTrigger} holdDurationMs={1500} />);

    fireEvent.pointerDown(screen.getByTestId('sos-hold-button'), { button: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.pointerUp(window);
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(handleTrigger).not.toHaveBeenCalled();
  });

  it('supports holding the keyboard activation key', () => {
    const handleTrigger = vi.fn();
    render(<SosHoldButton onTrigger={handleTrigger} holdDurationMs={1500} />);

    const button = screen.getByTestId('sos-hold-button');
    fireEvent.keyDown(button, { key: ' ' });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(handleTrigger).toHaveBeenCalledTimes(1);
  });

  it('provides accessible alternative for mobility and screen reader users', () => {
    const handleTrigger = vi.fn();
    render(<SosHoldButton onTrigger={handleTrigger} />);

    // Click accessible link
    const helpBtn = screen.getByText(/Can't hold\? Tap for one-click confirmation/i);
    fireEvent.click(helpBtn);

    // Modal dialog appears
    const confirmBtn = screen.getByRole('button', { name: /Confirm and Send SOS/i });
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);
    expect(handleTrigger).toHaveBeenCalledTimes(1);
  });

  it('prevents double triggering while submitting', () => {
    const handleTrigger = vi.fn();
    render(<SosHoldButton onTrigger={handleTrigger} isSubmitting={true} />);

    const button = screen.getByTestId('sos-hold-button');
    expect(button).toBeDisabled();

    fireEvent.pointerDown(button);
    expect(handleTrigger).not.toHaveBeenCalled();
  });
});
