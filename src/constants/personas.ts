import { UserProfile, UserRole } from '../types/auth';

export interface DemoPersona {
  profile: UserProfile;
  username: string;
  passwordHint: string;
  badge: string;
  description: string;
}

export const DEMO_PERSONAS: Record<UserRole, DemoPersona> = {
  RESIDENT: {
    profile: {
      id: 'usr_res_sharma_01',
      name: 'Mrs. Shanti Sharma',
      role: 'RESIDENT',
      flat: 'B-304',
      society: 'Green Meadows Apartments, Bengaluru',
      phone: '+91 98450 11223',
      email: 'shanti.sharma@example.in',
    },
    username: 'shanti.sharma',
    passwordHint: 'pass123',
    badge: 'Resident (Age 72)',
    description: 'Lives in B-304. Mid-range phone, reading glasses. Needs quick, honest SOS trigger.',
  },
  GUARDIAN: {
    profile: {
      id: 'usr_grd_arun_02',
      name: 'Mr. Arun Sharma',
      role: 'GUARDIAN',
      flat: 'B-304 (Linked)',
      society: 'Green Meadows Apartments, Bengaluru',
      phone: '+91 98450 88771',
      email: 'arun.sharma@example.in',
      linkedResidentId: 'usr_res_sharma_01',
    },
    username: 'arun.sharma',
    passwordHint: 'pass123',
    badge: 'Guardian',
    description: 'Son of Mrs. Sharma. Receives urgent alerts specifically for Flat B-304.',
  },
  VOLUNTEER: {
    profile: {
      id: 'usr_vol_priya_03',
      name: 'Priya Nair',
      role: 'VOLUNTEER',
      flat: 'B-102',
      society: 'Green Meadows Apartments, Bengaluru',
      phone: '+91 99012 33445',
      email: 'priya.nair@example.in',
    },
    username: 'priya.nair',
    passwordHint: 'pass123',
    badge: 'Floor Marshal (B Block)',
    description: 'Trained resident volunteer eligible for B-block emergency alerts.',
  },
  SECURITY: {
    profile: {
      id: 'usr_sec_ramesh_04',
      name: 'Ramesh Kumar',
      role: 'SECURITY',
      flat: 'Main Gate Control',
      society: 'Green Meadows Apartments, Bengaluru',
      phone: '+91 80 2844 5500',
      email: 'security.gate1@greenmeadows.in',
    },
    username: 'ramesh.gate1',
    passwordHint: 'pass123',
    badge: 'Security Desk',
    description: 'On-duty desk guard. Monitors dense incident board and dispatches guards.',
  },
  ADMIN: {
    profile: {
      id: 'usr_adm_sunita_05',
      name: 'Sunita Rao',
      role: 'ADMIN',
      flat: 'Clubhouse Office',
      society: 'Green Meadows Apartments, Bengaluru',
      phone: '+91 98800 66554',
      email: 'manager@greenmeadows.in',
    },
    username: 'sunita.admin',
    passwordHint: 'pass123',
    badge: 'Society Admin (GMAOA)',
    description: 'Estate manager. Full visibility over all incidents, notification logs, and retries.',
  },
};
