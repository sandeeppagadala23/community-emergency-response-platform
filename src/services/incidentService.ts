import { apiClient } from './apiClient';
import { mockBackend } from './mockBackend';
import {
  CreateSosPayload,
  IncidentDetail,
  IncidentStatus,
  IncidentStatusPollingResponse,
  IncidentSummary,
  EmergencyType,
  ResponderOption,
  ResponderAssignment,
} from '../types/incident';

function normalizeStatus(status: IncidentStatus | string): IncidentStatus {
  switch (status) {
    case 'ACKNOWLEDGED':
      return 'ACKNOWLEDGED';
    case 'IN_PROGRESS':
      return 'IN_PROGRESS';
    case 'INVESTIGATING':
      return 'INVESTIGATING';
    case 'RESOLVED':
      return 'RESOLVED';
    case 'CANCELLED':
    case 'CLOSED':
      return 'CLOSED';
    case 'PENDING':
    case 'OPEN':
      return 'OPEN';
    default:
      throw new Error(`Unsupported incident status returned by backend: ${status}`);
  }
}

function normalizeEmergencyType(type: EmergencyType | string): EmergencyType {
  switch (type) {
    case 'MEDICAL':
    case 'FALL':
    case 'FIRE':
    case 'ACCIDENT':
    case 'SECURITY':
    case 'OTHER':
      return type;
    default:
      throw new Error(`Unsupported emergency type returned by backend: ${type}`);
  }
}

function normalizeSummary(incident: IncidentSummary): IncidentSummary {
  const backendIncident = incident as IncidentSummary & {
    category?: string;
    message?: string;
    reporter_username?: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
    location_text?: string;
  };
  return {
    ...incident,
    id: String(incident.id),
    resident_name: backendIncident.resident_name ?? backendIncident.reporter_username,
    status: normalizeStatus(backendIncident.status),
    emergency_type: normalizeEmergencyType(
      backendIncident.emergency_type ?? backendIncident.category ?? '',
    ),
    description: backendIncident.description ?? backendIncident.message,
    has_location:
      backendIncident.has_location ??
      (backendIncident.latitude != null && backendIncident.longitude != null),
  };
}

function normalizeDetail(incident: IncidentDetail): IncidentDetail {
  const backendIncident = incident as IncidentDetail & {
    category?: string;
    message?: string;
    reporter_username?: string;
    latitude?: number | string | null;
    longitude?: number | string | null;
    location_text?: string;
    acknowledged_at?: string | null;
    notifications_created?: number;
  };
  const hasLocation =
    backendIncident.has_location ??
    (backendIncident.latitude != null && backendIncident.longitude != null);
  return {
    ...backendIncident,
    id: String(backendIncident.id),
    resident_name: backendIncident.resident_name ?? backendIncident.reporter_username,
    status: normalizeStatus(backendIncident.status),
    emergency_type: normalizeEmergencyType(
      backendIncident.emergency_type ?? backendIncident.category ?? '',
    ),
    description: backendIncident.description ?? backendIncident.message ?? '',
    has_location: hasLocation,
    location:
      backendIncident.location ??
      (hasLocation
        ? {
            latitude: Number(backendIncident.latitude),
            longitude: Number(backendIncident.longitude),
            captured_at: backendIncident.created_at,
          }
        : undefined),
    location_text: backendIncident.location_text ?? '',
    timeline: backendIncident.timeline ?? [
      {
        id: `created-${backendIncident.id}`,
        timestamp: backendIncident.created_at,
        event: 'Incident Created',
        description: 'Resident SOS recorded.',
      },
    ],
    created_by_role: backendIncident.created_by_role ?? 'RESIDENT',
    is_reporter: backendIncident.is_reporter ?? true,
    can_check_in: backendIncident.can_check_in ?? false,
    my_assignment: backendIncident.my_assignment ?? null,
    assignments: backendIncident.assignments ?? [],
    resident_acknowledged_at:
      backendIncident.resident_acknowledged_at ?? backendIncident.acknowledged_at ?? null,
    notifications_summary: backendIncident.notifications_summary ?? {
      total: backendIncident.notifications_created ?? 0,
      sent: 0,
      delivered: 0,
      failed: 0,
    },
  };
}

export const incidentService = {
  /**
   * POST /alerts/api/sos/
   * Request body contains only: emergency_type, description, location fields when available.
   * Never sends resident ID (per privacy requirements).
   */
  async createSos(
    payload: CreateSosPayload,
    idempotencyKey?: string,
  ): Promise<{ incident: IncidentDetail }> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 200));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.createSos(user, payload);
    }

    if ((payload.latitude === undefined) !== (payload.longitude === undefined)) {
      throw new Error('Both GPS coordinates are required. Retry location or submit without GPS.');
    }
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (payload.latitude !== undefined && payload.longitude !== undefined) {
      if (
        !Number.isFinite(payload.latitude)
        || !Number.isFinite(payload.longitude)
        || payload.latitude < -90
        || payload.latitude > 90
        || payload.longitude < -180
        || payload.longitude > 180
      ) {
        throw new Error('GPS coordinates are invalid. Retry location or submit an address instead.');
      }
      latitude = Number(payload.latitude.toFixed(6));
      longitude = Number(payload.longitude.toFixed(6));
    }

    const response = await apiClient.request<IncidentDetail | { incident: IncidentDetail }>(
      '/alerts/api/sos/',
      {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({
        emergency_type: payload.emergency_type,
        category: payload.emergency_type === 'FALL' ? 'MEDICAL' : payload.emergency_type,
        description: payload.description || undefined,
        message: payload.description || undefined,
        latitude,
        longitude,
        accuracy: payload.accuracy,
        location_captured_at: payload.location_captured_at,
        location_text: payload.location_text,
      }),
      },
    );
    const incident = 'incident' in response ? response.incident : response;
    return { incident: normalizeDetail(incident) };
  },

  /**
   * GET /alerts/api/sos/list/
   * Board view for Security, Admin, Guardian, Volunteer.
   */
  async getIncidents(): Promise<IncidentSummary[]> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 100));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.getIncidents(user);
    }

    const incidents = await apiClient.request<IncidentSummary[]>('/alerts/api/sos/list/');
    return incidents.map(normalizeSummary);
  },

  /**
   * GET /alerts/api/sos/{id}/
   * Single incident detail with timeline and location.
   */
  async getIncidentById(id: string): Promise<IncidentDetail> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 120));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.getIncidentById(user, id);
    }

    const incident = await apiClient.request<IncidentDetail>(`/alerts/api/sos/${id}/`);
    return normalizeDetail(incident);
  },

  /**
   * GET /alerts/api/sos/list/
   * Resident's own incident history.
   */
  async getResidentIncidents(): Promise<IncidentSummary[]> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 100));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.getResidentIncidents(user);
    }

    const incidents = await apiClient.request<IncidentSummary[]>('/alerts/api/sos/list/');
    return incidents.map(normalizeSummary);
  },

  /**
   * GET /alerts/api/sos/{id}/status/
   * Live status polling endpoint for the active SOS view.
   */
  async getIncidentStatus(id: string): Promise<IncidentStatusPollingResponse> {
    if (apiClient.isMockMode()) {
      await new Promise((r) => setTimeout(r, 80));
      const user = apiClient.getCurrentUser();
      if (!user) {
        throw { status: 401, code: 'UNAUTHORIZED', message: 'Please sign in.' };
      }
      return mockBackend.getIncidentStatus(user, id);
    }

    const status = await apiClient.request<IncidentStatusPollingResponse>(
      `/alerts/api/sos/${id}/status/`,
    );
    return {
      ...status,
      status: normalizeStatus(status.status),
      emergency_type: normalizeEmergencyType(status.emergency_type),
    };
  },

  async getAvailableResponders(): Promise<ResponderOption[]> {
    return apiClient.request<ResponderOption[]>('/alerts/api/responders/');
  },

  async assignResponder(id: string, responderId: number): Promise<ResponderAssignment> {
    return apiClient.request<ResponderAssignment>(`/alerts/api/sos/${id}/assign/`, {
      method: 'POST',
      body: JSON.stringify({ responder_id: responderId }),
    });
  },

  async checkInResponder(id: string): Promise<ResponderAssignment> {
    return apiClient.request<ResponderAssignment>(`/alerts/api/sos/${id}/check-in/`, {
      method: 'POST',
    });
  },

  async confirmResponderArrival(
    id: string,
    assignmentId: number,
    confirmationNote = '',
  ): Promise<ResponderAssignment> {
    return apiClient.request<ResponderAssignment>(
      `/alerts/api/sos/${id}/assignments/${assignmentId}/confirm-arrival/`,
      {
        method: 'POST',
        body: JSON.stringify({ confirmation_note: confirmationNote }),
      },
    );
  },

  async acknowledgeArrival(id: string): Promise<{ resident_acknowledged_at: string }> {
    return apiClient.request<{ resident_acknowledged_at: string }>(
      `/alerts/api/sos/${id}/resident-acknowledge/`,
      { method: 'POST' },
    );
  },

  async transitionIncident(
    id: string,
    targetStatus: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED',
    assignmentId?: number,
  ): Promise<void> {
    await apiClient.request(`/alerts/api/sos/${id}/transition/`, {
      method: 'POST',
      body: JSON.stringify({
        status: targetStatus,
        ...(assignmentId !== undefined ? { assignment_id: assignmentId } : {}),
      }),
    });
  },

  async updateIncidentLocation(
    id: string,
    locationText: string,
  ): Promise<{ location_text: string }> {
    return apiClient.request<{ location_text: string }>(
      `/alerts/api/sos/${id}/location/`,
      {
        method: 'PATCH',
        body: JSON.stringify({ location_text: locationText }),
      },
    );
  },
};
