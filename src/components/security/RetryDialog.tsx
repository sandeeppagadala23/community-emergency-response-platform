import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, X } from 'lucide-react';
import { IncidentNotificationRecord } from '../../types/notification';
import { ApiError } from '../../types/api';

interface RetryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  failedNotifications: IncidentNotificationRecord[];
  onConfirmRetry: () => Promise<void>;
  isRetrying: boolean;
  refusalError: ApiError | null;
  cooldownSeconds?: number;
}

export const RetryDialog: React.FC<RetryDialogProps> = ({
  isOpen,
  onClose,
  failedNotifications,
  onConfirmRetry,
  isRetrying,
  refusalError,
  cooldownSeconds = 0,
}) => {
  if (!isOpen) return null;

  const count = failedNotifications.length;
  const channels = Array.from(new Set(failedNotifications.map((n) => n.channel)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="retry-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-6 max-w-md w-full shadow-modal">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-rule dark:border-rule-dark">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-action dark:text-teal-400" strokeWidth={2} />
            <h3
              id="retry-dialog-title"
              className="font-serif font-bold text-base text-ink dark:text-ink-dark"
            >
              Retry Failed Notifications
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isRetrying}
            className="text-ink-muted hover:text-ink p-1 rounded focus-visible:outline-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 space-y-3">
          <p className="text-sm text-ink dark:text-ink-dark">
            You are about to re-dispatch <strong>{count}</strong> failed notification
            {count > 1 ? 's' : ''} across channel{channels.length > 1 ? 's' : ''}:{' '}
            <span className="font-mono font-semibold text-action dark:text-teal-400">
              {channels.join(', ')}
            </span>
            .
          </p>

          <div className="border border-rule dark:border-rule-dark rounded-control bg-stone-50 dark:bg-stone-900 p-3 space-y-2 text-xs">
            <div className="font-semibold text-ink dark:text-ink-dark">Recipients affected:</div>
            {failedNotifications.map((n) => (
              <div key={n.id} className="flex items-center justify-between">
                <span>
                  {n.recipient_name} ({n.recipient_role})
                </span>
                <span className="font-mono text-ink-muted">{n.channel}</span>
              </div>
            ))}
          </div>

          {/* Refusal error banner if backend rejected */}
          {refusalError && (
            <div
              role="alert"
              className="border border-warn/40 bg-warn-light dark:bg-warn-light-dark p-3 rounded-control text-xs text-ink dark:text-ink-dark flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-warn-text dark:text-warn-text-dark shrink-0 mt-0.5" strokeWidth={2} />
              <div>
                <p className="font-semibold text-warn-text dark:text-warn-text-dark">Retry request rejected by backend</p>
                <p className="mt-0.5">{refusalError.message}</p>
                {cooldownSeconds > 0 && (
                  <p className="font-mono text-warn-text dark:text-warn-text-dark mt-1 font-semibold">
                    Cooldown active: Please wait {cooldownSeconds}s before retrying.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-rule dark:border-rule-dark">
          <button
            type="button"
            onClick={onClose}
            disabled={isRetrying}
            className="px-3 py-2 text-xs font-medium rounded-control border border-rule dark:border-rule-dark text-ink dark:text-ink-dark hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmRetry}
            disabled={isRetrying || cooldownSeconds > 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-control bg-action text-white hover:bg-action-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>
              {isRetrying
                ? 'Dispatching...'
                : cooldownSeconds > 0
                ? `Wait ${cooldownSeconds}s`
                : 'Confirm Retry'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
