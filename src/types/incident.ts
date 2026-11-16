export type EmergencyType = 'MEDICAL' | 'FALL' | 'FIRE' | 'ACCIDENT' | 'SECURITY' | 'OTHER';

export type IncidentStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'CLOSED';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number | null; // in meters, absent when the backend has no GPS accuracy
  captured_at: string; // ISO 8601
}

export interface IncidentLocationInput {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  location_captured_at?: string;
  location_text?: string;
}

export interface CreateSosPayload extends IncidentLocationInput {
  emergency_type: EmergencyType;
  description?: string;
}

export interface IncidentSummary {
  id: string;
  emergency_type: EmergencyType;
  status: IncidentStatus;
  description?: string;
  created_at: string;
  resolved_at?: string;
  acknowledged_by_name?: string | null;
  resolved_by_name?: string | null;
  has_location: boolean;
  // Role-gated resident details (null/undefined if restricted)
  resident_name?: string;
  resident_flat?: string;
  // Compact notification summary counts
  notifications_summary?: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
  };
}

export interface IncidentDetail extends IncidentSummary {
  location?: LocationData;
  location_text?: string;
  location_restricted?: boolean;
  timeline: IncidentTimelineEntry[];
  created_by_role: string;
  is_reporter: boolean;
  can_check_in: boolean;
  my_assignment: ResponderAssignment | null;
  assignments: ResponderAssignment[];
  resident_acknowledged_at: string | null;
}

export interface ResponderOption {
  id: number;
  name: string;
  role: 'SECURITY' | 'VOLUNTEER';
}

export interface ResponderAssignment {
  id: number;
  responder_id: number;
  responder_name: string;
  responder_role: 'SECURITY' | 'VOLUNTEER' | string;
  assigned_at: string;
  checked_in_at: string | null;
  arrival_confirmation?: ArrivalConfirmation | null;
}

export interface ArrivalConfirmation {
  id: number;
  incident_id: string | number;
  assignment_id: number;
  responder_id: number;
  responder_name: string;
  confirmed_by_id: number;
  confirmed_by_name: string;
  confirmed_by_role: string;
  confirmed_at: string;
  confirmation_result: 'CONFIRMED';
  confirmation_note: string;
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: string;
  event: string;
  description: string;
  channel?: string;
  actor_role?: string;
}

export interface IncidentStatusPollingResponse {
  id: string;
  status: IncidentStatus;
  created_at: string;
  emergency_type: EmergencyType;
  counts: {
    total_recipients: number;
    sent: number;
    delivered: number;
    failed: number;
    acknowledged: number;
  };
  stages: {
    recorded: boolean;
    sent: boolean;
    delivered: boolean;
    acknowledged: boolean;
  };
  is_reporter: boolean;
  has_checked_in_responder: boolean;
  arrival_reports?: ResponderAssignment[];
  resident_acknowledged_at: string | null;
  is_simulated: boolean;
  recipient_roles: string[];
  failure_notes?: string;
}
