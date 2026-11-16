import { apiClient } from './apiClient';
import { mockBackend } from './mockBackend';
import {
  InAppNotification,
  IncidentNotificationRecord,
  RetryResponse,
} from '../types/notification';

interface BackendInAppNotification {
  id: number;
  alert_id?: number | string | null;
  incident_id?: number | string | null;
  report_id?: number | string | null;
  related_report_id?: number | string | null;
  emergency_report_id?: number | string | null;
  report?: number | string | { id?: number | string | null } | null;
  resource_type?: string | null;
  object_type?: string | null;
  entity_type?: string | null;
  target_type?: string | null;
  notification_type?: string | null;
  type?: string | null;
  category?: string | null;
  message: string;
  title?: string;
  status: string;
  created_at: string;
  read_at: string | null;
}

export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

function firstId(...values: Array<number | string | null | undefined>): string | undefined {
  const value = values.find((candidate) => candidate !== null && candidate !== undefined && String(candidate).trim() !== '');
  return value === undefined ? undefined : String(value);
}

function isReportLinked(notification: BackendInAppNotification, reportId?: string): boolean {
  if (reportId) return true;
  const resourceType = [
    notification.resource_type,
    notification.object_type,
    notification.entity_type,
    notification.target_type,
    notification.notification_type,
    notification.type,
  ]
    .find((value) => typeof value === 'string' && value.trim())
    ?.trim()
    .toUpperCase();
  return resourceType === 'REPORT'
    || resourceType === 'EMERGENCY_REPORT'
    || resourceType?.startsWith('REPORT_') === true;
}

export function normalizeNotification(notification: BackendInAppNotification): InAppNotification {
  const reportId = firstId(
    notification.report_id,
    notification.related_report_id,
    notification.emergency_report_id,
    typeof notification.report === 'object' && notification.report !== null
      ? notification.report.id
      : notification.report,
  );
  const reportLinked = isReportLinked(notification, reportId);
  const incidentId = firstId(notification.incident_id, notification.alert_id);
  const category = notification.category ?? 'Emergency';
  return {
    id: `inapp_${notification.id}`,
    raw_id: notification.id,
    recipient_id: apiClient.getCurrentUser()?.id ?? '',
    incident_id: reportLinked ? '' : (incidentId ?? ''),
    notification_type: notification.notification_type ?? notification.type ?? undefined,
    report_id: reportId,
    resource_type: reportLinked ? 'REPORT' : 'SOS',
    title: notification.title ?? (reportLinked
      ? 'Emergency report update'
      : `Emergency ${category} SOS`),
    body: notification.message,
    created_at: notification.created_at,
    read: notification.status === 'READ' || notification.read_at !== null,
    read_at: notification.read_at,
    emergency_type: category,
    flat: apiClient.getCurrentUser()?.flat ?? '',
  };
}

export function getNotificationInboxTarget(notification: InAppNotification): string {
  if (notification.resource_type === 'REPORT') {
    return notification.report_id
      ? `/reports#report-${encodeURIComponent(notification.report_id)}`
      : '/reports';
  }
  if (notification.incident_id) {
    return `/incidents/${encodeURIComponent(notification.incident_id)}`;
  }
  return `/notifications/${encodeURIComponent(notification.id)}`;
}

export function getNotificationRelatedTarget(notification: InAppNotification): string {
  if (notification.resource_type === 'REPORT') {
    return notification.report_id
      ? `/reports#report-${encodeURIComponent(notification.report_id)}`
      : '/reports';
  }
  if (notification.incident_id) {
    return `/incidents/${encodeURIComponent(notification.incident_id)}`;
  }
  return `/notifications/${encodeURIComponent(notification.id)}`;
}

export const notificationService = {
  /**
   * GET /alerts/api/notifications/
   * In-app notifications inbox.
   */
  async getNotifications(): Promise<InAppNotification[]> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 100));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.getInAppNotifications(user);
    }

    const notifications = await apiClient.request<BackendInAppNotification[]>(
      '/alerts/api/notifications/',
    );
    return notifications.map(normalizeNotification);
  },

  /**
   * GET /alerts/api/notifications/unread-count/
   * Lightweight count of unread in-app notifications for navigation badges.
   */
  async getUnreadCount(): Promise<number> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 60));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.getInAppNotifications(user).filter((n) => !n.read).length;
    }

    const res = await apiClient.request<{ count: number }>(
      '/alerts/api/notifications/unread-count/',
    );
    return typeof res.count === 'number' ? res.count : 0;
  },

  /**
   * GET single notification detail.
   */
  async getNotificationById(id: string): Promise<InAppNotification> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 100));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.getInAppNotificationById(user, id);
    }

    const list = await this.getNotifications();
    const found = list.find(
      (notification) =>
        notification.id === String(id) || notification.raw_id === Number(id)
    );
    if (!found) {
      throw { status: 404, code: 'NOT_FOUND', message: 'Notification not found.' };
    }
    return found;
  },

  /**
   * PATCH /alerts/api/notifications/{id}/read/
   * Mark as read. Updates only read state, never delivery state.
   */
  async markAsRead(
    id: string,
    currentNotification?: InAppNotification
  ): Promise<InAppNotification> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 120));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.markNotificationAsRead(user, id);
    }

    const cleanId = String(id).replace('inapp_', '');
    const res = await apiClient.request<{ read?: boolean; read_at?: string | null }>(
      `/alerts/api/notifications/${cleanId}/read/`,
      { method: 'PATCH' }
    );
    window.dispatchEvent(new CustomEvent('cerp:notification_read'));
    const notification = currentNotification ?? (await this.getNotificationById(id));
    return {
      ...notification,
      read: res.read ?? true,
      read_at: res.read_at ?? notification.read_at,
    };
  },

  /**
   * PATCH /alerts/api/notifications/read-all/
   * Mark this account's in-app notifications read after the server confirms.
   */
  async markAllAsRead(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw {
        status: 0,
        code: 'OFFLINE',
        message: 'You are offline. This action was not sent. Reconnect and try again.',
      };
    }

    if (apiClient.isMockMode()) {
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      mockBackend.getInAppNotifications(user)
        .filter((notification) => !notification.read)
        .forEach((notification) => mockBackend.markNotificationAsRead(user, notification.id));
      return;
    }

    await apiClient.request('/alerts/api/notifications/read-all/', {
      method: 'PATCH',
    });
    window.dispatchEvent(new CustomEvent('cerp:notification_read'));
  },

  /**
   * GET /alerts/api/sos/{id}/notifications/
   * Notification dispatch and delivery log for Security/Admin.
   */
  async getIncidentNotifications(incidentId: string): Promise<IncidentNotificationRecord[]> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 120));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.getIncidentNotifications(user, incidentId);
    }

    return apiClient.request<IncidentNotificationRecord[]>(`/alerts/api/sos/${incidentId}/notifications/`);
  },

  /**
   * POST /alerts/api/sos/{id}/notifications/retry/
   * Retry failed notifications.
   */
  async retryIncidentNotifications(incidentId: string): Promise<RetryResponse> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 250));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.retryIncidentNotifications(user, incidentId);
    }

    return apiClient.request<RetryResponse>(`/alerts/api/sos/${incidentId}/notifications/retry/`, {
      method: 'POST',
    });
  },
};
