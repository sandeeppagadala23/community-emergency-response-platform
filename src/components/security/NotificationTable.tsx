import React, { useState } from 'react';
import { IncidentNotificationRecord } from '../../types/notification';
import { StatusBadge } from '../common/StatusBadge';
import { ChannelTag } from '../common/ChannelTag';
import { SimulatedBadge } from '../common/SimulatedBadge';
import { formatIstTime } from '../../utils/dateUtils';
import { Copy, Check, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface NotificationTableProps {
  notifications: IncidentNotificationRecord[];
  isLoading?: boolean;
}

export const NotificationTable: React.FC<NotificationTableProps> = ({
  notifications,
  isLoading = false,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedFailures, setExpandedFailures] = useState<Set<string>>(new Set());

  const copyId = (id?: string) => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleExpandFailure = (id: string) => {
    setExpandedFailures((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="border border-rule dark:border-rule-dark rounded-control bg-surface dark:bg-surface-dark overflow-x-auto shadow-sm">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-rule dark:border-rule-dark bg-stone-100/70 dark:bg-stone-900/60 font-semibold text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-[11px]">
            <th className="py-2.5 px-3">Recipient</th>
            <th className="py-2.5 px-3">Channel</th>
            <th className="py-2.5 px-3">Status</th>
            <th className="py-2.5 px-3">Record / provider ID</th>
            <th className="py-2.5 px-3">Created (IST)</th>
            <th className="py-2.5 px-3">Read / delivery time (IST)</th>
            <th className="py-2.5 px-3">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule dark:divide-rule-dark">
          {notifications.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-ink-muted">
                No in-app notification records found for this incident.
              </td>
            </tr>
          ) : (
            notifications.map((record) => {
              const isFailed = record.status === 'FAILED';
              const isExpanded = expandedFailures.has(record.id);

              return (
                <React.Fragment key={record.id}>
                  <tr
                    className={`transition-colors duration-150 ${
                      isFailed ? 'bg-signal-light/30 dark:bg-signal-light-dark/20' : ''
                    } hover:bg-stone-50 dark:hover:bg-stone-800/40`}
                  >
                    {/* Recipient */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-ink dark:text-ink-dark">
                        {record.recipient_name}
                      </div>
                      <div className="text-[11px] text-ink-muted dark:text-ink-muted-dark">
                        {record.recipient_role}
                      </div>
                    </td>

                    {/* Channel */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <ChannelTag channel={record.channel} />
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={record.status} type="notification" />
                        {isFailed && record.failure_reason && (
                          <button
                            type="button"
                            onClick={() => toggleExpandFailure(record.id)}
                            className="text-signal hover:underline text-[11px] inline-flex items-center gap-0.5 ml-1"
                          >
                            <span>Error details</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Internal or provider reference */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-ink-muted dark:text-ink-muted-dark">
                      {(() => {
                        const reference = record.provider_message_id ?? record.id;
                        return (
                          <div className="flex items-center gap-1.5">
                            <span title={reference}>
                              {reference.length > 14 ? `${reference.slice(0, 14)}…` : reference}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyId(reference)}
                              title="Copy record or provider ID"
                              className="hover:text-ink focus-visible:outline-none p-0.5"
                            >
                              {copiedId === reference ? (
                                <Check className="w-3 h-3 text-ok" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Record creation timestamp */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-ink-muted dark:text-ink-muted-dark">
                      {formatIstTime(record.created_at ?? record.sent_at, '24h')}
                    </td>

                    {/* Read receipt or provider delivery timestamp */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-ink-muted dark:text-ink-muted-dark">
                      {record.read_at || record.delivered_at ? (
                        <span className="text-ok font-semibold">
                          {formatIstTime(record.read_at ?? record.delivered_at, '24h')}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>

                    {/* Simulated Badge */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {record.is_simulated ? <SimulatedBadge size="sm" /> : <span>Live</span>}
                    </td>
                  </tr>

                  {/* Expandable Failure Row */}
                  {isFailed && isExpanded && record.failure_reason && (
                    <tr className="bg-signal-light/40 dark:bg-signal-light-dark/40 border-b border-rule dark:border-rule-dark">
                      <td colSpan={7} className="p-3 text-xs">
                        <div className="flex items-start gap-2 text-signal">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold">Delivery failure note:</p>
                            <p className="font-mono text-[11px] mt-0.5 text-ink dark:text-ink-dark">
                              {record.failure_reason}
                            </p>
                            {record.retry_count > 0 && (
                              <p className="text-[10px] text-ink-muted mt-1">
                                Retried {record.retry_count} time(s).
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
