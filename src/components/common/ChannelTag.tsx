import React from 'react';
import { NotificationChannel } from '../../types/notification';
import { Bell, MessageSquare, Mail, Smartphone } from 'lucide-react';

interface ChannelTagProps {
  channel: NotificationChannel;
  className?: string;
}

export const ChannelTag: React.FC<ChannelTagProps> = ({ channel, className = '' }) => {
  const getMeta = () => {
    switch (channel) {
      case 'PUSH':
        return { label: 'Push', icon: Bell };
      case 'SMS':
        return { label: 'SMS', icon: MessageSquare };
      case 'EMAIL':
        return { label: 'Email', icon: Mail };
      case 'IN_APP':
        return { label: 'In-app', icon: Smartphone };
      default:
        return { label: channel, icon: Bell };
    }
  };

  const { label, icon: Icon } = getMeta();

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium rounded-control border border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark text-ink-muted dark:text-ink-muted-dark ${className}`}
    >
      <Icon className="w-3 h-3 text-ink-muted dark:text-ink-muted-dark shrink-0" strokeWidth={1.5} />
      <span>{label}</span>
    </span>
  );
};
