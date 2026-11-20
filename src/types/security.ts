export interface SecurityMetrics {
  total_active: number;
  new_sos: number;
  acknowledged: number;
  in_progress: number;
  resolved: number;
  cancelled: number;
  assigned_to_me: number;
  active_reports: number;
}

export interface SecurityGuard {
  id: number;
  username: string;
  name: string;
  email: string;
  phone: string;
  employee_id: string | null;
  shift: string;
  society: string | null;
  society_id: number | null;
  is_active: boolean;
  is_verified: boolean;
  role: 'SECURITY';
  date_joined: string;
}

export interface SecurityAlert {
  id: number;
  resident_name?: string;
  category?: string;
  emergency_type?: string;
  description?: string;
  message?: string;
  status: string;
  status_display?: string;
  created_at: string;
  location_text?: string;
  has_location?: boolean;
  my_assignment_id?: number | null;
  assigned_to_me?: boolean;
  acknowledged_by_name?: string | null;
}

export interface SecurityReport {
  id: number;
  title?: string;
  reporter_name?: string;
  category?: string;
  incident_type?: string;
  incident_type_display?: string;
  description?: string;
  status: string;
  status_display?: string;
  created_at: string;
  location?: string | null;
}

export interface SecurityDashboardData {
  metrics: SecurityMetrics;
  live_alerts: SecurityAlert[];
  recent_reports: SecurityReport[];
}
