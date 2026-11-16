import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { incidentService } from '../services/incidentService';
import { apiClient } from '../services/apiClient';
import { IncidentStatusPollingResponse } from '../types/incident';
import { StatusStepper } from '../components/resident/StatusStepper';
import { formatIstTime } from '../utils/dateUtils';
import { SkeletonRow } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { EmergencyCallBar } from '../components/resident/EmergencyCallBar';
import { PermissionDenied } from '../components/common/PermissionDenied';
import { NotFound } from '../components/common/NotFound';
import { Copy, Check, ShieldCheck, AlertCircle } from 'lucide-react';

export const SosStatusPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [statusData, setStatusData] = useState<IncidentStatusPollingResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [isAcknowledgingArrival, setIsAcknowledgingArrival] = useState(false);
  const [acknowledgmentError, setAcknowledgmentError] = useState<string | null>(null);

  const mountTimeRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;
    mountTimeRef.current = Date.now();

    const fetchStatus = async () => {
      if (!id) return;
      try {
        const data = await incidentService.getIncidentStatus(id);
        if (!isCancelled) {
          setStatusData(data);
          setErrorStatus(null);
          setLoadError(null);
          setIsLoading(false);
          // Determine next poll interval:
          // 5 seconds initially, backing off to 15 seconds after 2 minutes (120,000ms)
          const elapsedMs = Date.now() - mountTimeRef.current;
          const intervalMs = elapsedMs > 120000 ? 15000 : 5000;

          // Stop polling if terminal status (RESOLVED or CLOSED)
          if (data.status !== 'RESOLVED' && data.status !== 'CLOSED') {
            timerRef.current = setTimeout(fetchStatus, intervalMs);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          const normalizedError = apiClient.normalizeError(err);
          setErrorStatus(normalizedError.status || 500);
          setLoadError(normalizedError.message);
          setIsLoading(false);
        }
      }
    };

    fetchStatus();

    // Pause polling when document tab is hidden, resume when visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchStatus();
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isCancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [id]);

  const copyId = () => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const acknowledgeArrival = async () => {
    if (!id) return;
    setIsAcknowledgingArrival(true);
    setAcknowledgmentError(null);
    try {
      const result = await incidentService.acknowledgeArrival(id);
      setStatusData((current) =>
        current
          ? {
              ...current,
              resident_acknowledged_at: result.resident_acknowledged_at,
              stages: { ...current.stages, acknowledged: true },
              counts: { ...current.counts, acknowledged: 1 },
            }
          : current,
      );
    } catch (error) {
      setAcknowledgmentError(apiClient.normalizeError(error).message);
    } finally {
      setIsAcknowledgingArrival(false);
    }
  };

  if (errorStatus === 403) {
    return <PermissionDenied backTo="/my-incidents" backLabel="View my incidents" />;
  }

  if (errorStatus === 404) {
    return <NotFound backTo="/sos" backLabel="Return to SOS" />;
  }

  if (isLoading || !statusData) {
    if (!isLoading && loadError) {
      return (
        <div className="max-w-lg mx-auto py-6">
          <EmptyState
            message={`Could not load SOS status: ${loadError}`}
            actionText="Retry"
            onAction={() => window.location.reload()}
          />
        </div>
      );
    }
    return (
      <div className="max-w-lg mx-auto space-y-4 py-6">
        <SkeletonRow count={4} heightClass="h-16" />
      </div>
    );
  }

  const {
    counts,
    stages,
    is_simulated,
    recipient_roles,
    failure_notes,
    is_reporter,
    has_checked_in_responder,
    arrival_reports,
    resident_acknowledged_at,
  } = statusData;
  const hasIndependentArrivalConfirmation = arrival_reports?.some(
    (arrival) => arrival.arrival_confirmation?.confirmation_result === 'CONFIRMED',
  ) ?? false;

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-20">
      {/* Delivery Notice Banner */}
      {is_simulated ? (
        <div className="flex items-center justify-between p-2.5 rounded-control bg-sim-light dark:bg-sim-light-dark border border-sim/30 text-sim text-xs">
          <div className="flex items-center gap-2">
            <span>
              SMS/email output is simulated in the Django console; external delivery is not confirmed.
            </span>
          </div>
        </div>
      ) : (
        <div className="p-2.5 rounded-control bg-warn-light dark:bg-warn-light-dark border border-warn/30 text-warn-text dark:text-warn-text-dark text-xs">
          Only in-app notifications are recorded. SMS, email, and push delivery are not configured.
        </div>
      )}

      {/* Main Headline */}
      <div className="bg-surface dark:bg-surface-dark border-2 border-ok/40 rounded-panel p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-ok-light dark:bg-ok-light-dark flex items-center justify-center text-ok shrink-0">
              <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-serif text-lg sm:text-xl font-bold text-ink dark:text-ink-dark leading-tight">
                Your alert has been recorded
              </h1>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">
                Category: <strong>{statusData.emergency_type}</strong> · Raised at{' '}
                {formatIstTime(statusData.created_at, '12h')}
              </p>
            </div>
          </div>
        </div>

        {/* Monospace Incident ID */}
        <div className="mt-4 pt-3 border-t border-rule dark:border-rule-dark flex items-center justify-between text-xs font-mono">
          <span className="text-ink-muted dark:text-ink-muted-dark">Incident Reference:</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-action dark:text-teal-400 bg-paper dark:bg-paper-dark px-2 py-0.5 rounded border border-rule dark:border-rule-dark">
              {statusData.id}
            </span>
            <button
              onClick={copyId}
              title="Copy incident reference"
              className="p-1 text-ink-muted hover:text-ink rounded focus-visible:outline-none"
            >
              {copiedId ? (
                <Check className="w-4 h-4 text-ok" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Staged Progress Section */}
      <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 shadow-sm">
        <h2 className="text-xs font-mono uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark font-bold mb-3">
          Live Dispatch Status
        </h2>

        {/* Summary Line in Plain Words */}
        <div className="p-3 bg-stone-50 dark:bg-stone-900 rounded-control border border-rule dark:border-rule-dark mb-4 text-xs text-ink dark:text-ink-dark leading-relaxed">
          <p className="font-medium">
            {counts.sent} of {counts.total_recipients} recipients have an in-app notification.{' '}
            {counts.delivered > 0
              ? `${counts.delivered} recipient${counts.delivered > 1 ? 's have' : ' has'} read it.`
              : 'No read receipts yet.'}
          </p>
          {recipient_roles && recipient_roles.length > 0 && (
            <p className="text-[11px] text-ink-muted dark:text-ink-muted-dark mt-1">
              Recipients alerted: {recipient_roles.join(', ')}
            </p>
          )}
        </div>

        {/* Failure alert if provider failed */}
        {failure_notes && (
          <div className="p-3 bg-warn-light dark:bg-warn-light-dark border border-warn/40 rounded-control mb-4 text-xs text-ink dark:text-ink-dark flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warn-text dark:text-warn-text-dark shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-warn-text dark:text-warn-text-dark">Delivery delay notice</p>
              <p className="mt-0.5">{failure_notes}</p>
            </div>
          </div>
        )}

        {/* 4-Stage Vertical Stepper */}
        <StatusStepper stages={stages} counts={counts} />

        {arrival_reports && arrival_reports.length > 0 && (
          <div className="mt-4 space-y-2" aria-label="Responder arrival status">
            {arrival_reports.map((arrival) => (
              <p
                key={arrival.id}
                className="rounded-control border border-rule bg-paper p-3 text-xs text-ink dark:border-rule-dark dark:bg-paper-dark dark:text-ink-dark"
              >
                {arrival.arrival_confirmation ? (
                  <>
                    {arrival.responder_name}’s arrival was independently confirmed by{' '}
                    {arrival.arrival_confirmation.confirmed_by_name} at{' '}
                    {formatIstTime(arrival.arrival_confirmation.confirmed_at, '12h')}.
                  </>
                ) : (
                  <>
                    {arrival.responder_name} reported arrival at{' '}
                    {arrival.checked_in_at
                      ? formatIstTime(arrival.checked_in_at, '12h')
                      : 'an unknown time'}
                    . Dispatch confirmation is pending.
                  </>
                )}
              </p>
            ))}
          </div>
        )}

        {is_reporter && has_checked_in_responder && !resident_acknowledged_at && (
          <div className="mt-4 rounded-control border border-action/30 bg-action-light/40 p-3">
            <p className="text-xs text-ink dark:text-ink-dark">
              {hasIndependentArrivalConfirmation
                ? 'Dispatch independently confirmed the responder’s arrival. Please separately confirm whether help has arrived.'
                : 'A responder reported arrival. Please confirm whether help has arrived.'}
            </p>
            <button
              type="button"
              onClick={acknowledgeArrival}
              disabled={isAcknowledgingArrival}
              className="mt-3 rounded-control bg-action px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isAcknowledgingArrival ? 'Saving confirmation…' : 'Confirm responder arrived'}
            </button>
            {acknowledgmentError && (
              <p role="alert" className="mt-2 text-xs font-medium text-signal">
                {acknowledgmentError}
              </p>
            )}
          </div>
        )}
        {is_reporter && resident_acknowledged_at && (
          <p role="status" className="mt-3 text-xs font-semibold text-ok">
            You confirmed that a responder arrived at{' '}
            {formatIstTime(resident_acknowledged_at, '12h')}.
          </p>
        )}
      </div>

      {/* Instructions for resident while waiting */}
      <div className="border border-rule dark:border-rule-dark rounded-panel p-4 bg-paper dark:bg-paper-dark text-xs space-y-1.5 text-ink-muted dark:text-ink-muted-dark">
        <p className="font-semibold text-ink dark:text-ink-dark">While assistance arrives:</p>
        <p>• If safe, keep your front door unlocked so responders can enter immediately.</p>
        <p>• Keep this screen open; status updates automatically every few seconds.</p>
      </div>

      {/* Persistent Call 112 Bar */}
      <EmergencyCallBar />
    </div>
  );
};
