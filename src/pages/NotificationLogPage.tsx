import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';
import { IncidentNotificationRecord } from '../types/notification';
import { ApiError } from '../types/api';
import { NotificationTable } from '../components/security/NotificationTable';
import { RetryDialog } from '../components/security/RetryDialog';
import { SkeletonRow } from '../components/common/Skeleton';
import { PermissionDenied } from '../components/common/PermissionDenied';
import { NotFound } from '../components/common/NotFound';
import { apiClient } from '../services/apiClient';
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

export const NotificationLogPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();

  const [notifications, setNotifications] = useState<IncidentNotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Retry Flow State
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);
  const [refusalError, setRefusalError] = useState<ApiError | null>(null);
  const [retrySuccessMsg, setRetrySuccessMsg] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  const fetchRecords = useCallback(async () => {
    if (!id) return;
    try {
      const data = await notificationService.getIncidentNotifications(id);
      setNotifications(data);
      setErrorStatus(null);
    } catch (error: unknown) {
      const normalizedError = apiClient.normalizeError(error);
      setErrorStatus(normalizedError.status || 500);
      setLoadError(normalizedError.message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Handle countdown timer if backend imposed a retry cooldown
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  if (errorStatus === 403 || role === 'RESIDENT') {
    return <PermissionDenied backTo="/my-incidents" backLabel="Return to my incidents" />;
  }

  if (errorStatus === 404) {
    return <NotFound backTo="/incidents" backLabel="Return to incident board" />;
  }

  const failedRecords = notifications.filter((n) => n.status === 'FAILED');
  const hasEligibleFailures = apiClient.isMockMode() && failedRecords.length > 0;

  const handleExecuteRetry = async () => {
    if (!id) return;
    setIsRetrying(true);
    setRefusalError(null);
    setRetrySuccessMsg(null);

    try {
      const result = await notificationService.retryIncidentNotifications(id);
      setIsRetrying(false);
      setIsDialogOpen(false);
      setRetrySuccessMsg(result.message);
      // PRD Requirement: After success, refetch the table; do not optimistically mark rows as sent.
      await fetchRecords();
      setTimeout(() => setRetrySuccessMsg(null), 4000);
    } catch (error: unknown) {
      setIsRetrying(false);
      const normalizedError = apiClient.normalizeError(error);
      setRefusalError(normalizedError);
      if (normalizedError.retry_after) {
        setCooldownRemaining(normalizedError.retry_after);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Navigation */}
      <div>
        <Link
          to={`/incidents/${id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-action dark:text-teal-400 hover:text-action-hover"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Incident Detail</span>
        </Link>
      </div>

      {/* Top Header & Actions */}
      <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-ink dark:text-ink-dark">
            In-App Notification Log
          </h1>
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">
            Persisted in-app notifications for{' '}
            <span className="font-mono font-semibold text-ink dark:text-ink-dark">{id}</span>
          </p>
          {!apiClient.isMockMode() && (
            <p className="text-xs text-warn-text dark:text-warn-text-dark mt-1">
              SMS, email, and push delivery are not configured. These records do not indicate external delivery.
            </p>
          )}
        </div>

        {/* Retry Button - enabled only when eligible failed notifications exist */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRefusalError(null);
              setIsDialogOpen(true);
            }}
            disabled={!hasEligibleFailures || cooldownRemaining > 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-control bg-signal text-white hover:bg-signal-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm focus-visible:outline-none"
            title={
              hasEligibleFailures
                ? `Retry ${failedRecords.length} failed notifications`
                : 'No failed notifications eligible for retry'
            }
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>
              {cooldownRemaining > 0
                ? `Retry Cooldown (${cooldownRemaining}s)`
                : hasEligibleFailures
                ? `Retry Failed (${failedRecords.length})`
                : apiClient.isMockMode()
                  ? 'No Failures to Retry'
                  : 'External Retry Unavailable'}
            </span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {retrySuccessMsg && (
        <div
          role="status"
          className="p-3 border border-ok/30 bg-ok-light dark:bg-ok-light-dark text-ok text-xs font-semibold rounded-control flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{retrySuccessMsg}</span>
        </div>
      )}

      {/* Notification Table */}
      {isLoading ? (
        <SkeletonRow count={4} heightClass="h-14" />
      ) : loadError ? (
        <div
          role="alert"
          className="rounded-control border border-signal/30 bg-signal-light/40 p-4 text-sm text-ink dark:text-ink-dark"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
            <div className="flex-1">
              <p>{loadError}</p>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setLoadError(null);
                  fetchRecords();
                }}
                className="mt-2 inline-flex items-center gap-1.5 font-semibold text-action dark:text-teal-400"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry loading
              </button>
            </div>
          </div>
        </div>
      ) : (
        <NotificationTable notifications={notifications} />
      )}

      {/* Retry Confirmation Modal */}
      <RetryDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        failedNotifications={failedRecords}
        onConfirmRetry={handleExecuteRetry}
        isRetrying={isRetrying}
        refusalError={refusalError}
        cooldownSeconds={cooldownRemaining}
      />
    </div>
  );
};
