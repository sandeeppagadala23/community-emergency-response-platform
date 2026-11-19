export type GuardianType = 'PRIMARY' | 'SECONDARY';

export interface GuardianContact {
  id: number;
  resident: number;
  resident_name?: string;
  resident_username?: string;
  resident_flat?: string | null;
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
  resident?: number;
  name: string;
  relationship: string;
  phone_number: string;
  email: string;
  guardian_type: GuardianType;
}

export interface ResidentOption {
  id: number;
  username: string;
  name: string;
  email?: string;
  phone?: string;
  flat?: string;
}

export interface ContactOtpResponse {
  detail: string;
  channel: 'EMAIL' | 'SMS';
  simulated: true;
  expires_at: string;
}
