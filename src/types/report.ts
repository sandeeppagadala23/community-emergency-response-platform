export type ReportCategory = 'MEDICAL' | 'FIRE' | 'SECURITY' | 'ACCIDENT' | 'OTHER';

export type ReportStatus =
  | 'PENDING'
  | 'ACKNOWLEDGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export interface EmergencyReport {
  id: number;
  title: string;
  reporter?: number;
  reporter_username?: string;
  reporter_name?: string;
  reporter_flat?: string | null;
  responded_by: number | null;
  responded_by_username: string | null;
  assigned_volunteer: number | null;
  assigned_volunteer_username: string | null;
  assigned_volunteer_name: string | null;
  response_notes: string;
  incident_type: ReportCategory;
  incident_type_display: string;
  location: string;
  latitude: number | string | null;
  longitude: number | string | null;
  description: string;
  status: ReportStatus;
  status_display: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEmergencyReportPayload {
  title: string;
  incident_type: ReportCategory;
  location: string;
  description: string;
  latitude?: number;
  longitude?: number;
}

export interface EmergencyReportEvent {
  id: number;
  event_type: string;
  event_type_display: string;
  from_status: ReportStatus | '';
  to_status: ReportStatus | '';
  details: string;
  actor: number | null;
  actor_username: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface AvailableVolunteer {
  id: number;
  name: string;
  username: string;
}
