import { DeliveryStatus, NotificationChannel } from '../types/notification';
import { IncidentStatus } from '../types/incident';

export interface StatusMeta {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
}

export const INCIDENT_STATUS_META: Record<IncidentStatus, StatusMeta> = {
  OPEN: {
    label: 'Open',
    badgeBg: 'bg-signal-light dark:bg-signal-light-dark',
    badgeText: 'text-signal',
    badgeBorder: 'border-signal/30',
    description: 'Active emergency. Response in progress.',
  },
  INVESTIGATING: {
    label: 'Investigating',
    badgeBg: 'bg-warn-light dark:bg-warn-light-dark',
    badgeText: 'text-warn-text dark:text-warn-text-dark',
    badgeBorder: 'border-warn/30',
    description: 'Responders alerted and assessing.',
  },
  ACKNOWLEDGED: {
    label: 'Acknowledged',
    badgeBg: 'bg-warn-light dark:bg-warn-light-dark',
    badgeText: 'text-warn-text dark:text-warn-text-dark',
    badgeBorder: 'border-warn/30',
    description: 'Security has acknowledged this emergency.',
  },
  IN_PROGRESS: {
    label: 'In progress',
    badgeBg: 'bg-info-light dark:bg-info-light-dark',
    badgeText: 'text-info dark:text-info-text-dark',
    badgeBorder: 'border-info/30',
    description: 'A responder is handling this emergency.',
  },
  RESOLVED: {
    label: 'Resolved',
    badgeBg: 'bg-ok-light dark:bg-ok-light-dark',
    badgeText: 'text-ok',
    badgeBorder: 'border-ok/30',
    description: 'Incident addressed and verified safe.',
  },
  CLOSED: {
    label: 'Closed',
    badgeBg: 'bg-stone-100 dark:bg-stone-800',
    badgeText: 'text-ink-muted dark:text-ink-muted-dark',
    badgeBorder: 'border-rule dark:border-rule-dark',
    description: 'Archived record.',
  },
};

export const NOTIFICATION_STATUS_META: Record<DeliveryStatus, StatusMeta> = {
  PENDING: {
    label: 'Pending',
    badgeBg: 'bg-warn-light dark:bg-warn-light-dark',
    badgeText: 'text-warn-text dark:text-warn-text-dark',
    badgeBorder: 'border-warn/30',
    description: 'Stored for the recipient; no read receipt has been recorded.',
  },
  SENT: {
    label: 'Sent',
    badgeBg: 'bg-info-light dark:bg-info-light-dark',
    badgeText: 'text-info dark:text-info-text-dark',
    badgeBorder: 'border-info/30',
    description: 'Handed to the provider. Not confirmed as received.',
  },
  SIMULATED: {
    label: 'Simulated',
    badgeBg: 'bg-warn-light dark:bg-warn-light-dark',
    badgeText: 'text-warn-text dark:text-warn-text-dark',
    badgeBorder: 'border-warn/30',
    description: 'Written to the development console; not delivered externally.',
  },
  DELIVERED: {
    label: 'Delivered',
    badgeBg: 'bg-ok-light dark:bg-ok-light-dark',
    badgeText: 'text-ok',
    badgeBorder: 'border-ok/30',
    description: 'Provider confirmed delivery to recipient device.',
  },
  READ: {
    label: 'Read',
    badgeBg: 'bg-ok-light dark:bg-ok-light-dark',
    badgeText: 'text-ok',
    badgeBorder: 'border-ok/30',
    description: 'The recipient opened the in-app notification.',
  },
  FAILED: {
    label: 'Failed',
    badgeBg: 'bg-signal-light dark:bg-signal-light-dark',
    badgeText: 'text-signal',
    badgeBorder: 'border-signal/30',
    description: 'Could not be sent after dispatch attempt.',
  },
};

export const CHANNEL_META: Record<NotificationChannel, { label: string; icon: string }> = {
  PUSH: { label: 'Push', icon: 'Bell' },
  SMS: { label: 'SMS', icon: 'MessageSquare' },
  EMAIL: { label: 'Email', icon: 'Mail' },
  IN_APP: { label: 'In-app', icon: 'Smartphone' },
};
