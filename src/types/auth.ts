export type UserRole = 'RESIDENT' | 'GUARDIAN' | 'VOLUNTEER' | 'SECURITY' | 'ADMIN';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  flat: string;
  society: string;
  phone: string;
  email: string;
  is_verified?: boolean;
  linkedResidentId?: string; // For guardians
}

export interface AuthSession {
  token: string;
  user: UserProfile;
  expiresAt: string;
}
