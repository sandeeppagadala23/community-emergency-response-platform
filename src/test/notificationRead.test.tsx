import { describe, it, expect, beforeEach } from 'vitest';
import { mockBackend } from '../services/mockBackend';
import { DEMO_PERSONAS } from '../constants/personas';

describe('Notification Read Behavior (Acceptance Criteria 9)', () => {
  beforeEach(() => {
    mockBackend.reset();
  });

  it('marking an in-app notification read changes ONLY read state, never the delivery state of notifications', () => {
    const user = DEMO_PERSONAS.SECURITY.profile;

    // Get security notifications
    const inAppList = mockBackend.getInAppNotifications(user);
    expect(inAppList.length).toBeGreaterThan(0);
    const unread = inAppList[0];
    expect(unread.read).toBe(false);

    // Also get incident delivery records
    const initialRecords = mockBackend.getIncidentNotifications(user, unread.incident_id);
    const initialStatuses = initialRecords.map((r) => r.status);

    // Mark as read
    const readResult = mockBackend.markNotificationAsRead(user, unread.id);
    expect(readResult.read).toBe(true);
    expect(readResult.read_at).toBeDefined();

    // Verify incident delivery statuses were completely untouched
    const afterRecords = mockBackend.getIncidentNotifications(user, unread.incident_id);
    const afterStatuses = afterRecords.map((r) => r.status);

    expect(afterStatuses).toEqual(initialStatuses);
  });
});
