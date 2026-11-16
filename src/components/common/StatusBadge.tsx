import React from 'react';
import { DeliveryStatus } from '../../types/notification';
import { IncidentStatus } from '../../types/incident';
import { INCIDENT_STATUS_META, NOTIFICATION_STATUS_META } from '../../constants/statusTokens';
import { CheckCircle2, Clock, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react';

interface StatusBadgeProps {
  status: IncidentStatus | DeliveryStatus;
  type?: 'incident' | 'notification';
  showTooltip?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'incident',
  showTooltip = true,
}) => {
  const meta =
    type === 'incident'
      ? INCIDENT_STATUS_META[status as IncidentStatus]
      : NOTIFICATION_STATUS_META[status as DeliveryStatus];

  if (!meta) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-control border border-rule text-ink-muted">
        {status}
      </span>
    );
  }

  const renderIcon = () => {
    switch (status) {
      case 'OPEN':
        return <AlertTriangle className="w-3.5 h-3.5 mr-1 text-signal shrink-0" strokeWidth={1.75} />;
      case 'INVESTIGATING':
      case 'ACKNOWLEDGED':
        return <Clock className="w-3.5 h-3.5 mr-1 text-warn-text dark:text-warn-text-dark shrink-0" strokeWidth={1.75} />;
      case 'IN_PROGRESS':
        return <Clock className="w-3.5 h-3.5 mr-1 text-info dark:text-info-text-dark shrink-0" strokeWidth={1.75} />;
      case 'RESOLVED':
      case 'DELIVERED':
      case 'READ':
        return <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-ok shrink-0" strokeWidth={1.75} />;
      case 'PENDING':
      case 'SIMULATED':
        return <Clock className="w-3.5 h-3.5 mr-1 text-warn-text shrink-0" strokeWidth={1.75} />;
      case 'SENT':
        return <ArrowUpRight className="w-3.5 h-3.5 mr-1 text-info dark:text-info-text-dark shrink-0" strokeWidth={1.75} />;
      case 'FAILED':
        return <XCircle className="w-3.5 h-3.5 mr-1 text-signal shrink-0" strokeWidth={1.75} />;
      default:
        return null;
    }
  };

  const isSent = status === 'SENT';

  return (
    <span
      title={showTooltip ? meta.description : undefined}
      className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-control border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder} tracking-wide select-none transition-colors duration-150`}
      aria-label={`${meta.label}: ${meta.description}`}
    >
      {renderIcon()}
      <span>{meta.label}</span>
      {isSent && showTooltip && (
        <span
          className="ml-1 text-[10px] opacity-75 font-normal hidden sm:inline"
          aria-hidden="true"
        >
          (Unconfirmed)
        </span>
      )}
    </span>
  );
};
