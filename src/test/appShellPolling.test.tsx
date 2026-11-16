import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { notificationService } from '../services/notificationService';

const mockUser = {
  id: '1',
  name: 'Bunny Guardian',
  flat: 'G-01',
  role: 'GUARDIAN' as const,
  society: 'Palm Meadows',
};

vi.mock('../services/notificationService', () => ({
  notificationService: {
    getUnreadCount: vi.fn(),
    getNotifications: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    role: 'GUARDIAN',
    logout: vi.fn(),
  }),
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: (key: string) => key,
  }),
}));

vi.mock('../components/common/DemoBar', () => ({
  DemoBar: () => <div data-testid="demo-bar" />,
}));

describe('AppShell unread notification count polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls only getUnreadCount and never calls getNotifications while viewing /incidents', async () => {
    vi.mocked(notificationService.getUnreadCount).mockResolvedValue(3);

    render(
      <MemoryRouter initialEntries={['/incidents']}>
        <AppShell>
          <div>Incident Content</div>
        </AppShell>
      </MemoryRouter>
    );

    // Initial mount calls getUnreadCount
    await act(async () => {
      await Promise.resolve();
    });

    const initialCallCount = vi.mocked(notificationService.getUnreadCount).mock.calls.length;
    expect(initialCallCount).toBeGreaterThanOrEqual(1);
    expect(notificationService.getNotifications).not.toHaveBeenCalled();

    // Advance 10 seconds
    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(notificationService.getUnreadCount).toHaveBeenCalledTimes(initialCallCount + 1);
    expect(notificationService.getNotifications).not.toHaveBeenCalled();

    // Advance another 10 seconds (total 20s)
    await act(async () => {
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
    });

    expect(notificationService.getUnreadCount).toHaveBeenCalledTimes(initialCallCount + 2);
    expect(notificationService.getNotifications).not.toHaveBeenCalled();
  });

  it('immediately updates unread count on cerp:notification_read event without waiting for interval', async () => {
    vi.mocked(notificationService.getUnreadCount).mockResolvedValue(5);

    render(
      <MemoryRouter initialEntries={['/incidents']}>
        <AppShell>
          <div>Incident Content</div>
        </AppShell>
      </MemoryRouter>
    );

    await act(async () => {
      await Promise.resolve();
    });

    const initialCallCount = vi.mocked(notificationService.getUnreadCount).mock.calls.length;
    expect(initialCallCount).toBeGreaterThanOrEqual(1);

    // Dispatch event
    vi.mocked(notificationService.getUnreadCount).mockResolvedValue(4);
    await act(async () => {
      window.dispatchEvent(new CustomEvent('cerp:notification_read'));
      await Promise.resolve();
    });

    expect(notificationService.getUnreadCount).toHaveBeenCalledTimes(initialCallCount + 1);
    expect(notificationService.getNotifications).not.toHaveBeenCalled();
  });
});
