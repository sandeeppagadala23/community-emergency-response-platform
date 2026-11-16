import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../services/apiClient';
import {
  getNotificationInboxTarget,
  getNotificationRelatedTarget,
  notificationService,
} from '../services/notificationService';

describe('notification routing and bulk read service', () => {
  beforeEach(() => {
    apiClient.clearAuth();
    apiClient.resetBaseUrl();
    apiClient.setAuth('tab-session', {
      id: 'resident-1',
      name: 'Resident Example',
      role: 'RESIDENT',
      flat: 'A-101',
      society: 'Example',
      phone: '',
      email: '',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    apiClient.clearAuth();
    apiClient.resetBaseUrl();
  });

  it('normalizes report notifications without treating report IDs as SOS IDs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [{
        id: 8,
        report_id: 73,
        notification_type: 'REPORT_ASSIGNED',
        category: 'MEDICAL',
        title: 'A volunteer was assigned',
        message: 'A volunteer is responding to your report.',
        status: 'UNREAD',
        created_at: '2026-11-05T12:00:00Z',
        read_at: null,
      }],
    }));

    const [notification] = await notificationService.getNotifications();

    expect(notification).toMatchObject({
      report_id: '73',
      incident_id: '',
      resource_type: 'REPORT',
      title: 'A volunteer was assigned',
    });
    expect(getNotificationInboxTarget(notification)).toBe('/reports#report-73');
    expect(getNotificationRelatedTarget(notification)).toBe('/reports#report-73');
  });

  it('preserves SOS notification destinations', () => {
    const notification = {
      id: 'inapp_12',
      recipient_id: 'resident-1',
      incident_id: 'INC-2026-BLR-12',
      title: 'Emergency MEDICAL SOS',
      body: 'Responders are on the way.',
      created_at: '2026-11-05T12:00:00Z',
      read: false,
      emergency_type: 'MEDICAL',
      flat: 'A-101',
      resource_type: 'SOS',
    };

    expect(getNotificationInboxTarget(notification)).toBe('/incidents/INC-2026-BLR-12');
    expect(getNotificationRelatedTarget(notification)).toBe('/incidents/INC-2026-BLR-12');
  });

  it('routes an assigned SOS notification to its incident and preserves its type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => [{
        id: 31,
        alert_id: 31,
        incident_id: 31,
        notification_type: 'SOS_ASSIGNED',
        category: 'MEDICAL',
        title: 'SOS incident assigned',
        message: 'Medical SOS alert #31 has been assigned to you.',
        status: 'PENDING',
        created_at: '2026-11-09T12:00:00Z',
        read_at: null,
      }],
    }));

    const [notification] = await notificationService.getNotifications();

    expect(notification).toMatchObject({
      id: 'inapp_31',
      incident_id: '31',
      notification_type: 'SOS_ASSIGNED',
      resource_type: 'SOS',
      read: false,
    });
    expect(getNotificationInboxTarget(notification)).toBe('/incidents/31');
    expect(getNotificationRelatedTarget(notification)).toBe('/incidents/31');
  });

  it('patches mark-all-read to the existing endpoint and requires server success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ updated_count: 2 }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(notificationService.markAllAsRead()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      '/alerts/api/notifications/read-all/',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'omit',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer /),
        }),
      }),
    );
  });

  it('does not report mark-all success or send a request while offline', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    apiClient.setBaseUrl('mock');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    await expect(notificationService.markAllAsRead()).rejects.toMatchObject({
      code: 'OFFLINE',
    });
    expect(fetchMock).not.toHaveBeenCalled();

    Reflect.deleteProperty(navigator, 'onLine');
  });
});
