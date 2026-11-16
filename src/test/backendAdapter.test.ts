import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../services/apiClient';
import { incidentService } from '../services/incidentService';
import { notificationService } from '../services/notificationService';
import { IncidentSummary } from '../types/incident';
import { InAppNotification } from '../types/notification';

describe('Current Django backend adapter', () => {
  beforeEach(() => {
    apiClient.setBaseUrl('http://localhost:8001');
    vi.restoreAllMocks();
  });

  it('maps backend acknowledgement, cancellation, and fire values to UI types', async () => {
    const backendIncidents: IncidentSummary[] = [
      {
        id: 'INC-2026-BLR-0001',
        emergency_type: 'FIRE',
        status: 'INVESTIGATING',
        created_at: '2026-10-24T10:00:00Z',
        has_location: false,
      },
      {
        id: 'INC-2026-BLR-0002',
        emergency_type: 'MEDICAL',
        status: 'CLOSED',
        created_at: '2026-10-24T10:00:00Z',
        has_location: false,
      },
    ];
    vi.spyOn(apiClient, 'request').mockImplementation(async function <T>() {
      return backendIncidents.map((incident, index) => ({
        ...incident,
        status: index === 0 ? 'ACKNOWLEDGED' : 'CANCELLED',
      })) as T;
    });

    const incidents = await incidentService.getIncidents();

    expect(incidents.map(({ emergency_type, status }) => [emergency_type, status])).toEqual([
      ['FIRE', 'ACKNOWLEDGED'],
      ['MEDICAL', 'CLOSED'],
    ]);
  });

  it('shows the backend reporter username on incident summaries', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue([
      {
        id: 43,
        reporter_username: 'new_resident',
        category: 'FIRE',
        message: 'Smoke in the kitchen',
        status: 'PENDING',
        created_at: '2026-10-28T10:00:00Z',
        latitude: null,
        longitude: null,
      },
    ]);

    const incidents = await incidentService.getIncidents();

    expect(incidents[0]).toMatchObject({
      id: '43',
      resident_name: 'new_resident',
      emergency_type: 'FIRE',
      description: 'Smoke in the kitchen',
      status: 'OPEN',
      has_location: false,
    });
  });

  it('normalizes Django SOS creation responses for the resident status page', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({
      id: 42,
      category: 'FIRE',
      message: 'Smoke in the kitchen',
      status: 'PENDING',
      created_at: '2026-10-27T15:00:00Z',
      latitude: '12.971600',
      longitude: '77.594600',
      notifications_created: 2,
    });

    const result = await incidentService.createSos({
      emergency_type: 'FIRE',
      description: 'Smoke in the kitchen',
      latitude: 12.971612347,
      longitude: 77.594612987,
    });

    expect(request).toHaveBeenCalledWith('/alerts/api/sos/', {
      method: 'POST',
      body: expect.stringContaining('"emergency_type":"FIRE"'),
    });
    expect(result.incident).toMatchObject({
      id: '42',
      emergency_type: 'FIRE',
      description: 'Smoke in the kitchen',
      status: 'OPEN',
      has_location: true,
      location: {
        latitude: 12.9716,
        longitude: 77.5946,
      },
      timeline: [{ event: 'Incident Created' }],
    });
    expect(JSON.parse(request.mock.calls[0][1]?.body as string)).toMatchObject({
      latitude: 12.971612,
      longitude: 77.594613,
    });
  });

  it('rejects invalid or incomplete coordinates before calling the SOS API', async () => {
    const request = vi.spyOn(apiClient, 'request');

    await expect(
      incidentService.createSos({
        emergency_type: 'MEDICAL',
        latitude: 91,
        longitude: 77,
      }),
    ).rejects.toThrow('GPS coordinates are invalid');

    await expect(
      incidentService.createSos({
        emergency_type: 'MEDICAL',
        latitude: 12,
      }),
    ).rejects.toThrow('Both GPS coordinates are required');

    expect(request).not.toHaveBeenCalled();
  });

  it('preserves the backend text location when GPS coordinates are unavailable', async () => {
    vi.spyOn(apiClient, 'request').mockResolvedValue({
      id: 44,
      category: 'MEDICAL',
      message: 'Need assistance',
      status: 'PENDING',
      created_at: '2026-10-28T10:00:00Z',
      latitude: null,
      longitude: null,
      location_text: 'Block B-304, Green Meadows',
    });

    const incident = await incidentService.getIncidentById('44');

    expect(incident).toMatchObject({
      id: '44',
      has_location: false,
      location_text: 'Block B-304, Green Meadows',
    });
    expect(incident.location).toBeUndefined();
  });

  it('preserves notification details while marking its backend record read', async () => {
    const notification: InAppNotification = {
      id: 'inapp_27',
      raw_id: 27,
      recipient_id: 'usr_4',
      incident_id: 'INC-2026-BLR-0001',
      title: 'EMERGENCY: MEDICAL Alert',
      body: 'A medical alert needs attention.',
      created_at: '2026-10-24T10:00:00Z',
      read: false,
      emergency_type: 'MEDICAL',
      flat: 'B-304',
    };
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({
      read: true,
      read_at: '2026-10-24T10:01:00Z',
    });

    const updated = await notificationService.markAsRead(notification.id, notification);

    expect(request).toHaveBeenCalledWith('/alerts/api/notifications/27/read/', {
      method: 'PATCH',
    });
    expect(updated).toMatchObject({
      ...notification,
      read: true,
      read_at: '2026-10-24T10:01:00Z',
    });
  });

  it('maps Django SOS notifications into the inbox model', async () => {
    apiClient.setAuth('session_4_security', {
      id: '4',
      name: 'Security Desk',
      role: 'SECURITY',
      flat: 'Main Gate',
      society: 'Green Meadows',
      phone: '',
      email: 'security@example.com',
    });
    vi.spyOn(apiClient, 'request').mockResolvedValue([
      {
        id: 27,
        alert_id: 42,
        category: 'FIRE',
        message: 'New fire SOS alert #42 requires attention.',
        status: 'PENDING',
        created_at: '2026-10-28T10:00:00Z',
        read_at: null,
      },
      {
        id: 28,
        alert_id: 41,
        category: 'MEDICAL',
        message: 'Medical response is complete.',
        status: 'READ',
        created_at: '2026-10-28T09:00:00Z',
        read_at: '2026-10-28T09:05:00Z',
      },
    ]);

    const notifications = await notificationService.getNotifications();

    expect(notifications).toMatchObject([
      {
        id: 'inapp_27',
        incident_id: '42',
        title: 'Emergency FIRE SOS',
        body: 'New fire SOS alert #42 requires attention.',
        recipient_id: '4',
        read: false,
        emergency_type: 'FIRE',
        flat: 'Main Gate',
      },
      {
        id: 'inapp_28',
        incident_id: '41',
        read: true,
        read_at: '2026-10-28T09:05:00Z',
      },
    ]);
  });

  it('uses the Django responder assignment, arrival report, and resident acknowledgment routes', async () => {
    const request = vi.spyOn(apiClient, 'request').mockResolvedValue({});

    await incidentService.getAvailableResponders();
    await incidentService.assignResponder('INC-2026-BLR-0001', 7);
    await incidentService.checkInResponder('INC-2026-BLR-0001');
    await incidentService.confirmResponderArrival('INC-2026-BLR-0001', 9);
    await incidentService.transitionIncident('INC-2026-BLR-0001', 'IN_PROGRESS', 9);
    await incidentService.acknowledgeArrival('INC-2026-BLR-0001');

    expect(request).toHaveBeenNthCalledWith(1, '/alerts/api/responders/');
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/alerts/api/sos/INC-2026-BLR-0001/assign/',
      {
        method: 'POST',
        body: JSON.stringify({ responder_id: 7 }),
      },
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      '/alerts/api/sos/INC-2026-BLR-0001/check-in/',
      {
        method: 'POST',
      },
    );
    expect(request).toHaveBeenNthCalledWith(
      4,
      '/alerts/api/sos/INC-2026-BLR-0001/assignments/9/confirm-arrival/',
      {
        method: 'POST',
        body: JSON.stringify({ confirmation_note: '' }),
      },
    );
    expect(request).toHaveBeenNthCalledWith(
      5,
      '/alerts/api/sos/INC-2026-BLR-0001/transition/',
      {
        method: 'POST',
        body: JSON.stringify({ status: 'IN_PROGRESS', assignment_id: 9 }),
      },
    );
    expect(request).toHaveBeenNthCalledWith(
      6,
      '/alerts/api/sos/INC-2026-BLR-0001/resident-acknowledge/',
      { method: 'POST' },
    );
  });

  it('shows invalid backend credentials instead of treating them as an expired session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid identifier or password.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');

    await expect(
      apiClient.request('/api/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'unknown', password: 'incorrect' }),
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid identifier or password.',
    });

    expect(dispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cerp:unauthorized' }),
    );
    vi.unstubAllGlobals();
  });

  it('preserves useful DRF field validation messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            incident_type: ['Select a valid choice.'],
            location: ['This field may not be blank.'],
          }),
          {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    await expect(apiClient.request('/reports/api/reports/', { method: 'POST' }))
      .rejects.toMatchObject({
        status: 400,
        message: 'incident_type: Select a valid choice. location: This field may not be blank.',
        field_errors: {
          incident_type: 'Select a valid choice.',
          location: 'This field may not be blank.',
        },
      });

    vi.unstubAllGlobals();
  });
});
