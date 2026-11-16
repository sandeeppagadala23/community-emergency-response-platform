import { EmergencyType } from '../types/incident';

export interface EmergencyTypeOption {
  type: EmergencyType;
  label: string;
  description: string;
  iconName: string;
}

export const EMERGENCY_TYPES: EmergencyTypeOption[] = [
  {
    type: 'MEDICAL',
    label: 'Medical',
    description: 'Chest pain, breathing distress, sudden weakness, unconsciousness',
    iconName: 'Activity',
  },
  {
    type: 'FALL',
    label: 'Fall',
    description: 'Slip or fall, inability to stand, suspected fracture',
    iconName: 'AlertCircle',
  },
  {
    type: 'ACCIDENT',
    label: 'Accident',
    description: 'Domestic injury, severe burn, or electrical hazard',
    iconName: 'Flame',
  },
  {
    type: 'FIRE',
    label: 'Fire',
    description: 'Fire, smoke, gas leak, or immediate fire hazard',
    iconName: 'Flame',
  },
  {
    type: 'SECURITY',
    label: 'Security',
    description: 'Intrusion, harassment, threat, door disturbance',
    iconName: 'ShieldAlert',
  },
  {
    type: 'OTHER',
    label: 'Other',
    description: 'Any urgent emergency not listed above',
    iconName: 'HelpCircle',
  },
];
