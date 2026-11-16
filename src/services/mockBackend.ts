import { UserProfile, UserRole } from '../types/auth';
import { CreateSosPayload, IncidentDetail, IncidentStatusPollingResponse, IncidentSummary } from '../types/incident';
import { InAppNotification, IncidentNotificationRecord, RetryResponse } from '../types/notification';
import { ApiError } from '../types/api';

class MockBackendState {
  private incidents: IncidentDetail[] = [];
  private notifications: IncidentNotificationRecord[] = [];
  private inAppNotifications: InAppNotification[] = [];
  private lastRetryTimes: Record<string, number> = {};
  private retryAttempts: Record<string, number> = {};

  constructor() {
    this.reset();
  }

  reset() {
    this.incidents = [
      {
        id: 'INC-2026-BLR-1082',
        emergency_type: 'MEDICAL',
        status: 'OPEN',
        description: 'Severe shortness of breath and chest pressure',
        created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        has_location: true,
        resident_name: 'Mrs. Shanti Sharma',
        resident_flat: 'B-304',
        created_by_role: 'RESIDENT',
        is_reporter: false,
        can_check_in: false,
        my_assignment: null,
        assignments: [],
        resident_acknowledged_at: null,
        location: {
          latitude: 12.9249,
          longitude: 77.6748,
          accuracy: 12,
          captured_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        },
        notifications_summary: {
          total: 3,
          sent: 2,
          delivered: 1,
          failed: 1,
        },
        timeline: [
          {
            id: 't-1',
            timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            event: 'Incident Created',
            description: 'SOS alert initiated from mobile resident portal.',
            actor_role: 'Resident (Mrs. Shanti Sharma)',
          },
          {
            id: 't-2',
            timestamp: new Date(Date.now() - 2.8 * 60 * 1000).toISOString(),
            event: 'Notifications Dispatched',
            description: 'Routed 3 emergency notifications (SMS, Push, In-App).',
            channel: 'System Dispatcher',
          },
          {
            id: 't-3',
            timestamp: new Date(Date.now() - 2.5 * 60 * 1000).toISOString(),
            event: 'Delivery Update',
            description: 'Push notification confirmed delivered to Main Gate Security.',
            channel: 'Push',
          },
        ],
      },
      {
        id: 'INC-2026-BLR-0941',
        emergency_type: 'FALL',
        status: 'RESOLVED',
        description: 'Slipped in bathroom, received assistance from neighbor',
        created_at: '2026-09-14T08:15:20.000Z',
        resolved_at: '2026-09-14T09:02:10.000Z',
        has_location: true,
        resident_name: 'Mrs. Shanti Sharma',
        resident_flat: 'B-304',
        created_by_role: 'RESIDENT',
        is_reporter: false,
        can_check_in: false,
        my_assignment: null,
        assignments: [],
        resident_acknowledged_at: null,
        location: {
          latitude: 12.9250,
          longitude: 77.6749,
          accuracy: 15,
          captured_at: '2026-09-14T08:15:20.000Z',
        },
        notifications_summary: {
          total: 3,
          sent: 0,
          delivered: 3,
          failed: 0,
        },
        timeline: [
          {
            id: 't-prev-1',
            timestamp: '2026-09-14T08:15:20.000Z',
            event: 'Incident Created',
            description: 'Resident SOS recorded.',
          },
          {
            id: 't-prev-2',
            timestamp: '2026-09-14T08:15:45.000Z',
            event: 'All Notifications Delivered',
            description: 'Guardian and security received delivery confirmation.',
          },
          {
            id: 't-prev-3',
            timestamp: '2026-09-14T09:02:10.000Z',
            event: 'Incident Resolved',
            description: 'Resolved on-site by Floor Marshal Priya Nair and First Aider.',
          },
        ],
      },
      {
        id: 'INC-2026-BLR-1049',
        emergency_type: 'SECURITY',
        status: 'RESOLVED',
        description: 'Unidentified person attempting entry at basement C door',
        created_at: '2026-10-21T18:40:00.000Z',
        resolved_at: '2026-10-21T19:10:00.000Z',
        has_location: false,
        resident_name: 'K. V. Raman',
        resident_flat: 'C-101',
        created_by_role: 'RESIDENT',
        is_reporter: false,
        can_check_in: false,
        my_assignment: null,
        assignments: [],
        resident_acknowledged_at: null,
        notifications_summary: {
          total: 2,
          sent: 0,
          delivered: 2,
          failed: 0,
        },
        timeline: [
          {
            id: 't-c-1',
            timestamp: '2026-10-21T18:40:00.000Z',
            event: 'Incident Created',
            description: 'Basement security alert recorded.',
          },
          {
            id: 't-c-2',
            timestamp: '2026-10-21T19:10:00.000Z',
            event: 'Incident Resolved',
            description: 'Guard patrol checked and confirmed delivery executive misplaced door.',
          },
        ],
      },
    ];

    this.notifications = [
      {
        id: 'notif_rec_001',
        incident_id: 'INC-2026-BLR-1082',
        recipient_name: 'Mr. Arun Sharma',
        recipient_role: 'Guardian',
        channel: 'SMS',
        status: 'FAILED',
        provider_message_id: 'msg_tw_99182a47b',
        sent_at: new Date(Date.now() - 2.8 * 60 * 1000).toISOString(),
        failure_reason: 'Provider error 30008: Unknown error or handset unreachable on telecom network.',
        is_simulated: true,
        retry_count: 0,
      },
      {
        id: 'notif_rec_002',
        incident_id: 'INC-2026-BLR-1082',
        recipient_name: 'Ramesh Kumar',
        recipient_role: 'Security Desk',
        channel: 'PUSH',
        status: 'DELIVERED',
        provider_message_id: 'fcm_mid_881944bc',
        sent_at: new Date(Date.now() - 2.9 * 60 * 1000).toISOString(),
        delivered_at: new Date(Date.now() - 2.5 * 60 * 1000).toISOString(),
        is_simulated: true,
        retry_count: 0,
      },
      {
        id: 'notif_rec_003',
        incident_id: 'INC-2026-BLR-1082',
        recipient_name: 'Priya Nair',
        recipient_role: 'Volunteer (Floor Marshal)',
        channel: 'IN_APP',
        status: 'SENT',
        provider_message_id: 'iap_091834211',
        sent_at: new Date(Date.now() - 2.8 * 60 * 1000).toISOString(),
        is_simulated: true,
        retry_count: 0,
      },
    ];

    this.inAppNotifications = [
      {
        id: 'inapp_101',
        recipient_id: 'usr_sec_ramesh_04',
        incident_id: 'INC-2026-BLR-1082',
        title: 'EMERGENCY: Medical Alert · B-304',
        body: 'Resident Mrs. Shanti Sharma has triggered Medical SOS. Severe shortness of breath reported.',
        created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        read: false,
        emergency_type: 'MEDICAL',
        flat: 'B-304',
      },
      {
        id: 'inapp_102',
        recipient_id: 'usr_grd_arun_02',
        incident_id: 'INC-2026-BLR-1082',
        title: 'EMERGENCY: SOS Alert for Mrs. Shanti Sharma',
        body: 'Your mother has triggered SOS from Flat B-304. Security team has been notified.',
        created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        read: false,
        emergency_type: 'MEDICAL',
        flat: 'B-304',
      },
      {
        id: 'inapp_103',
        recipient_id: 'usr_vol_priya_03',
        incident_id: 'INC-2026-BLR-1082',
        title: 'VOLUNTEER ALERT: Medical SOS in Block B',
        body: 'Immediate first-aid or check-in requested for Flat B-304.',
        created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        read: false,
        emergency_type: 'MEDICAL',
        flat: 'B-304',
      },
      {
        id: 'inapp_104',
        recipient_id: 'usr_res_sharma_01',
        incident_id: 'INC-2026-BLR-1082',
        title: 'Your SOS alert is active',
        body: 'Alert recorded. Security and your guardian have been alerted.',
        created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        read: true,
        read_at: new Date(Date.now() - 2.9 * 60 * 1000).toISOString(),
        emergency_type: 'MEDICAL',
        flat: 'B-304',
      },
      {
        id: 'inapp_105',
        recipient_id: 'usr_adm_sunita_05',
        incident_id: 'INC-2026-BLR-1082',
        title: 'Incident Logged: Medical · B-304',
        body: 'New high priority incident logged for Flat B-304. 1 notification failed delivery.',
        created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        read: false,
        emergency_type: 'MEDICAL',
        flat: 'B-304',
      },
    ];
  }

  // SOS Creation: Resident only
  createSos(user: UserProfile, payload: CreateSosPayload): { incident: IncidentDetail } {
    if (user.role !== 'RESIDENT') {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Only registered residents can initiate an emergency SOS.',
      } as ApiError;
    }

    if (!payload.emergency_type) {
      throw {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Emergency category is required.',
        field_errors: { emergency_type: 'Please select an emergency category.' },
      } as ApiError;
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const incidentId = `INC-2026-BLR-${randomNum}`;
    const nowIso = new Date().toISOString();

    const hasLocation = Boolean(payload.latitude && payload.longitude);

    const newIncident: IncidentDetail = {
      id: incidentId,
      emergency_type: payload.emergency_type,
      status: 'OPEN',
      description: payload.description?.trim() || undefined,
      created_at: nowIso,
      has_location: hasLocation,
      resident_name: user.name,
      resident_flat: user.flat,
      created_by_role: 'RESIDENT',
      is_reporter: true,
      can_check_in: false,
      my_assignment: null,
      assignments: [],
      resident_acknowledged_at: null,
      location: hasLocation
        ? {
            latitude: payload.latitude!,
            longitude: payload.longitude!,
            accuracy: payload.accuracy ?? 14,
            captured_at: payload.location_captured_at ?? nowIso,
          }
        : undefined,
      notifications_summary: {
        total: 3,
        sent: 3,
        delivered: 0,
        failed: 0,
      },
      timeline: [
        {
          id: `t_${Date.now()}_1`,
          timestamp: nowIso,
          event: 'Incident Created',
          description: `SOS alert created with category ${payload.emergency_type}.`,
          actor_role: `Resident (${user.name})`,
        },
        {
          id: `t_${Date.now()}_2`,
          timestamp: nowIso,
          event: 'Notifications Queued',
          description: 'Emergency routing dispatched to Guardian, Security, and Block Volunteer.',
          channel: 'System Dispatcher',
        },
      ],
    };

    this.incidents.unshift(newIncident);

    // Create notifications for this incident
    const notif1: IncidentNotificationRecord = {
      id: `notif_${Date.now()}_1`,
      incident_id: incidentId,
      recipient_name: 'Mr. Arun Sharma',
      recipient_role: 'Guardian',
      channel: 'SMS',
      status: 'SENT',
      provider_message_id: `msg_sim_${Math.random().toString(36).substring(2, 9)}`,
      sent_at: nowIso,
      is_simulated: true,
      retry_count: 0,
    };

    const notif2: IncidentNotificationRecord = {
      id: `notif_${Date.now()}_2`,
      incident_id: incidentId,
      recipient_name: 'Main Gate Desk',
      recipient_role: 'Security',
      channel: 'PUSH',
      status: 'SENT',
      provider_message_id: `fcm_sim_${Math.random().toString(36).substring(2, 9)}`,
      sent_at: nowIso,
      is_simulated: true,
      retry_count: 0,
    };

    const notif3: IncidentNotificationRecord = {
      id: `notif_${Date.now()}_3`,
      incident_id: incidentId,
      recipient_name: 'Priya Nair',
      recipient_role: 'Volunteer (Floor Marshal)',
      channel: 'IN_APP',
      status: 'SENT',
      provider_message_id: `iap_sim_${Math.random().toString(36).substring(2, 9)}`,
      sent_at: nowIso,
      is_simulated: true,
      retry_count: 0,
    };

    this.notifications.unshift(notif1, notif2, notif3);

    // Create in-app notifications
    this.inAppNotifications.unshift(
      {
        id: `inapp_${Date.now()}_sec`,
        recipient_id: 'usr_sec_ramesh_04',
        incident_id: incidentId,
        title: `EMERGENCY: ${payload.emergency_type} · ${user.flat}`,
        body: `Resident ${user.name} raised SOS alert. Description: ${payload.description || 'No note attached.'}`,
        created_at: nowIso,
        read: false,
        emergency_type: payload.emergency_type,
        flat: user.flat,
      },
      {
        id: `inapp_${Date.now()}_res`,
        recipient_id: user.id,
        incident_id: incidentId,
        title: `Your ${payload.emergency_type} SOS has been recorded`,
        body: 'Security desk and your registered contacts have been notified.',
        created_at: nowIso,
        read: false,
        emergency_type: payload.emergency_type,
        flat: user.flat,
      }
    );

    return { incident: newIncident };
  }

  // Polling status for SOS Active screen
  getIncidentStatus(user: UserProfile, incidentId: string): IncidentStatusPollingResponse {
    const inc = this.incidents.find((i) => i.id === incidentId);
    if (!inc) {
      throw {
        status: 404,
        code: 'NOT_FOUND',
        message: "We couldn't find this incident.",
      } as ApiError;
    }

    // Role check: Residents can only view their own incident
    if (user.role === 'RESIDENT' && inc.resident_name !== user.name) {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: "You don't have access to this incident.",
      } as ApiError;
    }

    const notifs = this.notifications.filter((n) => n.incident_id === incidentId);

    // Progressive delivery simulation:
    // If incident was created > 6 seconds ago, mark security push as DELIVERED
    const ageSeconds = (Date.now() - new Date(inc.created_at).getTime()) / 1000;
    if (ageSeconds > 6) {
      notifs.forEach((n) => {
        if (n.channel === 'PUSH' && n.status === 'SENT') {
          n.status = 'DELIVERED';
          n.delivered_at = new Date(Date.now() - 2000).toISOString();
        }
      });
    }

    const sentCount = notifs.filter((n) => n.status === 'SENT').length;
    const deliveredCount = notifs.filter((n) => n.status === 'DELIVERED').length;
    const failedCount = notifs.filter((n) => n.status === 'FAILED').length;
    const totalRecipients = notifs.length || 3;

    const hasCheckedInResponder = inc.assignments.some(
      (assignment) => assignment.checked_in_at,
    );
    const isAcknowledged = Boolean(inc.resident_acknowledged_at);
    const stages = {
      recorded: true,
      sent: sentCount > 0 || deliveredCount > 0,
      delivered: deliveredCount > 0,
      acknowledged: isAcknowledged,
    };

    return {
      id: inc.id,
      status: inc.status,
      created_at: inc.created_at,
      emergency_type: inc.emergency_type,
      counts: {
        total_recipients: totalRecipients,
        sent: sentCount,
        delivered: deliveredCount,
        failed: failedCount,
        acknowledged: Number(isAcknowledged),
      },
      stages,
      is_reporter: inc.resident_name === user.name,
      has_checked_in_responder: hasCheckedInResponder,
      resident_acknowledged_at: inc.resident_acknowledged_at,
      is_simulated: true,
      recipient_roles: Array.from(new Set(notifs.map((n) => n.recipient_role))),
      failure_notes: failedCount > 0 ? `${failedCount} message could not be sent. The security team has been informed.` : undefined,
    };
  }

  // Resident's own incident history
  getResidentIncidents(user: UserProfile): IncidentSummary[] {
    if (user.role !== 'RESIDENT') {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: 'This view is only available for resident accounts.',
      } as ApiError;
    }

    return this.incidents
      .filter((i) => i.resident_name === user.name)
      .map((i) => this.toSummary(i, user.role));
  }

  // Incident list / board (Server decides what each user may see)
  getIncidents(user: UserProfile): IncidentSummary[] {
    switch (user.role) {
      case 'ADMIN':
      case 'SECURITY':
        // See all incidents
        return this.incidents.map((i) => this.toSummary(i, user.role));

      case 'GUARDIAN':
        // Only see linked resident's incidents
        return this.incidents
          .filter((i) => i.resident_name === 'Mrs. Shanti Sharma')
          .map((i) => this.toSummary(i, user.role));

      case 'VOLUNTEER':
        // Eligible alerts (e.g. Block B incidents)
        return this.incidents
          .filter((i) => i.resident_flat?.startsWith('B-'))
          .map((i) => this.toSummary(i, user.role));

      case 'RESIDENT':
        // Only own incidents
        return this.incidents
          .filter((i) => i.resident_name === user.name)
          .map((i) => this.toSummary(i, user.role));

      default:
        return [];
    }
  }

  // Incident detail
  getIncidentById(user: UserProfile, id: string): IncidentDetail {
    const inc = this.incidents.find((i) => i.id === id);
    if (!inc) {
      throw {
        status: 404,
        code: 'NOT_FOUND',
        message: "We couldn't find this incident.",
      } as ApiError;
    }

    // Role filtering:
    if (user.role === 'RESIDENT' && inc.resident_name !== user.name) {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: "You don't have access to this incident.",
      } as ApiError;
    }

    if (user.role === 'GUARDIAN' && inc.resident_name !== 'Mrs. Shanti Sharma') {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: "You don't have access to this incident.",
      } as ApiError;
    }

    // Clone and sanitize location according to role
    const detail: IncidentDetail = {
      ...inc,
      is_reporter: user.role === 'RESIDENT' && inc.resident_name === user.name,
      can_check_in: inc.assignments.some(
        (assignment) => assignment.responder_name === user.name,
      ),
      my_assignment:
        inc.assignments.find((assignment) => assignment.responder_name === user.name) ??
        null,
      notifications_summary: this.getNotificationsSummary(inc.id),
    };

    // Location privacy rule: Volunteer sees restricted location unless permitted
    if (user.role === 'VOLUNTEER') {
      detail.location_restricted = true;
      detail.location = undefined; // Never leak coordinates to DOM
    }

    return detail;
  }

  // Incident notifications log
  getIncidentNotifications(user: UserProfile, incidentId: string): IncidentNotificationRecord[] {
    const inc = this.incidents.find((i) => i.id === incidentId);
    if (!inc) {
      throw {
        status: 404,
        code: 'NOT_FOUND',
        message: "We couldn't find this incident.",
      } as ApiError;
    }

    if (user.role === 'RESIDENT') {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: 'Notification logs are reserved for response personnel.',
      } as ApiError;
    }

    return this.notifications.filter((n) => n.incident_id === incidentId);
  }

  // Retry failed notifications
  retryIncidentNotifications(user: UserProfile, incidentId: string): RetryResponse {
    if (user.role !== 'SECURITY' && user.role !== 'ADMIN') {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: 'You are not authorized to retry emergency notifications.',
      } as ApiError;
    }

    const failed = this.notifications.filter(
      (n) => n.incident_id === incidentId && n.status === 'FAILED'
    );

    if (failed.length === 0) {
      throw {
        status: 400,
        code: 'NOTHING_ELIGIBLE',
        message: 'There are no failed notifications eligible for retry.',
      } as ApiError;
    }

    // Enforce retry cooldown (handle backend refusal test case)
    const now = Date.now();
    const lastRetry = this.lastRetryTimes[incidentId] || 0;
    const attempts = this.retryAttempts[incidentId] || 0;

    if (attempts >= 3) {
      throw {
        status: 429,
        code: 'RETRY_LIMIT_EXCEEDED',
        message: 'Maximum retry attempts reached (3). Please contact carrier or emergency dispatch manually.',
      } as ApiError;
    }

    const cooldownMs = 20 * 1000; // 20s cooldown between attempts
    if (now - lastRetry < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - (now - lastRetry)) / 1000);
      throw {
        status: 429,
        code: 'RETRY_COOLDOWN',
        message: `Retry requested too quickly. Please wait ${waitSeconds}s before retrying again.`,
        retry_after: waitSeconds,
      } as ApiError;
    }

    this.lastRetryTimes[incidentId] = now;
    this.retryAttempts[incidentId] = attempts + 1;

    // Perform retry: mark back to SENT, provider simulated success
    const channelsRetried = Array.from(new Set(failed.map((f) => f.channel)));
    failed.forEach((f) => {
      f.status = 'SENT';
      f.sent_at = new Date().toISOString();
      f.retry_count += 1;
      f.failure_reason = undefined;
      f.provider_message_id = `msg_retry_${Math.random().toString(36).substring(2, 9)}`;
    });

    // Update incident summary
    const inc = this.incidents.find((i) => i.id === incidentId);
    if (inc) {
      inc.notifications_summary = this.getNotificationsSummary(incidentId);
      inc.timeline.push({
        id: `t_retry_${Date.now()}`,
        timestamp: new Date().toISOString(),
        event: 'Notifications Retried',
        description: `Retried ${failed.length} failed notifications across ${channelsRetried.join(', ')}.`,
        actor_role: `${user.name} (${user.role})`,
      });
    }

    return {
      retried_count: failed.length,
      channels_retried: channelsRetried,
      updated_notifications: [...this.notifications.filter((n) => n.incident_id === incidentId)],
      message: `Successfully re-queued ${failed.length} notification(s).`,
    };
  }

  // In-app notifications
  getInAppNotifications(user: UserProfile): InAppNotification[] {
    return this.inAppNotifications.filter((n) => n.recipient_id === user.id);
  }

  getInAppNotificationById(user: UserProfile, id: string): InAppNotification {
    const notif = this.inAppNotifications.find((n) => n.id === id);
    if (!notif) {
      throw {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Notification not found.',
      } as ApiError;
    }

    if (notif.recipient_id !== user.id && user.role !== 'ADMIN') {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: "You don't have access to this notification.",
      } as ApiError;
    }

    return notif;
  }

  markNotificationAsRead(user: UserProfile, id: string): InAppNotification {
    const notif = this.inAppNotifications.find((n) => n.id === id);
    if (!notif) {
      throw {
        status: 404,
        code: 'NOT_FOUND',
        message: 'Notification not found.',
      } as ApiError;
    }

    if (notif.recipient_id !== user.id && user.role !== 'ADMIN') {
      throw {
        status: 403,
        code: 'FORBIDDEN',
        message: "You don't have access to this notification.",
      } as ApiError;
    }

    // Crucial requirement: marking read only updates read state, NEVER delivery state!
    notif.read = true;
    notif.read_at = new Date().toISOString();
    return notif;
  }

  private getNotificationsSummary(incidentId: string) {
    const list = this.notifications.filter((n) => n.incident_id === incidentId);
    return {
      total: list.length,
      sent: list.filter((n) => n.status === 'SENT').length,
      delivered: list.filter((n) => n.status === 'DELIVERED').length,
      failed: list.filter((n) => n.status === 'FAILED').length,
    };
  }

  private toSummary(incident: IncidentDetail, role: UserRole): IncidentSummary {
    const summary: IncidentSummary = {
      id: incident.id,
      emergency_type: incident.emergency_type,
      status: incident.status,
      description: incident.description,
      created_at: incident.created_at,
      resolved_at: incident.resolved_at,
      has_location: incident.has_location,
      notifications_summary: this.getNotificationsSummary(incident.id),
    };

    // Only populate resident name/flat if API permits for this role
    if (role === 'ADMIN' || role === 'SECURITY' || role === 'GUARDIAN' || role === 'RESIDENT') {
      summary.resident_name = incident.resident_name;
      summary.resident_flat = incident.resident_flat;
    } else if (role === 'VOLUNTEER') {
      summary.resident_flat = incident.resident_flat;
    }

    return summary;
  }
}

export const mockBackend = new MockBackendState();
