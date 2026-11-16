export type NotificationChannel = 'PUSH' | 'SMS' | 'EMAIL' | 'IN_APP';

export type DeliveryStatus =
  | 'PENDING'
  | 'SENT'
  | 'SIMULATED'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';

export interface IncidentNotificationRecord {
  id: string;
  incident_id: string;
  recipient_name: string;
  recipient_role: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  provider_message_id?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string | null;
  created_at?: string;
  failure_reason?: string;
  is_simulated: boolean;
  retry_count: number;
}

export interface InAppNotification {
  id: string;
  raw_id?: number;
  recipient_id: string;
  incident_id: string;
  notification_type?: string;
  report_id?: string;
  resource_type?: 'REPORT' | 'INCIDENT' | 'SOS' | string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
  read_at?: string | null;
  emergency_type: string;
  flat: string;
}

export interface RetryRequest {
  incident_id: string;
  notification_ids?: string[];
}

export interface RetryResponse {
  retried_count: number;
  channels_retried: NotificationChannel[];
  updated_notifications?: IncidentNotificationRecord[];
  message: string;
}
