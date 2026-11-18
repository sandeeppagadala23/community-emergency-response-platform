export type GuardianType = 'PRIMARY' | 'SECONDARY';

export interface GuardianContact {
  id: number;
  resident: number;
  resident_name?: string;
  resident_username?: string;
  name: string;
  relationship: string;
  phone_number: string;
  email: string;
  guardian_type: GuardianType;
  guardian_type_display: string;
  is_verified: boolean;
  created_at: string;
}

export interface GuardianContactInput {
  name: string;
  relationship: string;
  phone_number: string;
  email: string;
  guardian_type: GuardianType;
}

export interface ContactOtpResponse {
  detail: string;
  channel: 'EMAIL' | 'SMS';
  simulated: true;
  expires_at: string;
}
