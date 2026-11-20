import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { securityService } from '../services/securityService';
import { incidentService } from '../services/incidentService';
import { SecurityDashboardData } from '../types/security';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  FileText,
  RefreshCw,
  Building2,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso?: string | null): string {
  if (!iso) return 'Not Available';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Not Available';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Not Available';
  }
}

function statusColor(status?: string | null): string {
  const norm = String(status || '').trim().toUpperCase();
  switch (norm) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'ACKNOWLEDGED':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'IN_PROGRESS':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'RESOLVED':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'CANCELLED':
    case 'CLOSED':
      return 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400';
    default:
      return 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400';
  }
}

function etColor(type?: string | null): string {
  const norm = String(type || '').trim().toUpperCase();
  switch (norm) {
    case 'MEDICAL':
    case 'FALL':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'FIRE':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    case 'SECURITY':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'ACCIDENT':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    default:
      return 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400';
  }
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, accent, icon }) => (
  <div
    className={`bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-control p-4 flex items-start gap-3 border-l-4 ${accent}`}
  >
    <div className="text-ink-muted dark:text-ink-muted-dark mt-0.5 shrink-0">{icon}</div>
    <div>
      <p className="text-2xl font-bold tabular-nums text-ink dark:text-ink-dark">{value ?? 0}</p>
      <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">{label}</p>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main page view
// ---------------------------------------------------------------------------

const SecurityDashboardView: React.FC = () => {
  const [data, setData] = useState<SecurityDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setError(null);
    try {
      const result = await securityService.getDashboard();
      setData(result);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to load dashboard data.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const interval = setInterval(() => {
      void loadDashboard();
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  // Alert actions
  const handleAcknowledge = async (alertId: number) => {
    const key = `ack-${alertId}`;
    setActionLoading(key);
    setActionError(null);
    try {
      await incidentService.transitionIncident(String(alertId), 'ACKNOWLEDGED');
      await loadDashboard();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Action failed. Please try again.';
      setActionError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async (alertId: number) => {
    const key = `resolve-${alertId}`;
    setActionLoading(key);
    setActionError(null);
    try {
      await incidentService.transitionIncident(String(alertId), 'RESOLVED');
      await loadDashboard();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Action failed. Please try again.';
      setActionError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  // -------------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-rule dark:bg-rule-dark rounded w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 bg-rule dark:bg-rule-dark rounded-control" />
          ))}
        </div>
        <div className="h-64 bg-rule dark:bg-rule-dark rounded-control" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <XCircle className="w-10 h-10 text-signal" />
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark max-w-xs">
          {error || 'Unable to display dashboard.'}
        </p>
        <button
          onClick={() => {
            setLoading(true);
            void loadDashboard();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-action text-white text-sm font-semibold hover:bg-action/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const metrics = data.metrics || {
    total_active: 0,
    new_sos: 0,
    acknowledged: 0,
    in_progress: 0,
    resolved: 0,
    cancelled: 0,
    assigned_to_me: 0,
    active_reports: 0,
  };
  const live_alerts = Array.isArray(data.live_alerts) ? data.live_alerts : [];
  const recent_reports = Array.isArray(data.recent_reports) ? data.recent_reports : [];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-6 h-6 text-action" strokeWidth={2} />
            <h1 className="text-xl font-bold font-serif text-ink dark:text-ink-dark">
              Security Dashboard
            </h1>
          </div>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Green Meadows Apartments · Security Operations
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            void loadDashboard();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-rule dark:border-rule-dark text-xs font-semibold text-ink-muted dark:text-ink-muted-dark hover:border-action hover:text-action transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Action feedback */}
      {actionError && (
        <div className="rounded-control border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
          {actionError}
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          label="Total Active"
          value={metrics.total_active}
          accent="border-l-amber-500"
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <MetricCard
          label="New SOS"
          value={metrics.new_sos}
          accent="border-l-red-500"
          icon={<Zap className="w-4 h-4" />}
        />
        <MetricCard
          label="Acknowledged"
          value={metrics.acknowledged}
          accent="border-l-blue-500"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <MetricCard
          label="In Progress"
          value={metrics.in_progress}
          accent="border-l-purple-500"
          icon={<Clock className="w-4 h-4" />}
        />
        <MetricCard
          label="Resolved"
          value={metrics.resolved}
          accent="border-l-green-500"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <MetricCard
          label="Cancelled"
          value={metrics.cancelled}
          accent="border-l-stone-400"
          icon={<XCircle className="w-4 h-4" />}
        />
        <MetricCard
          label="Assigned to Me"
          value={metrics.assigned_to_me}
          accent="border-l-teal-500"
          icon={<Users className="w-4 h-4" />}
        />
        <MetricCard
          label="Active Reports"
          value={metrics.active_reports}
          accent="border-l-orange-500"
          icon={<FileText className="w-4 h-4" />}
        />
      </div>

      {/* Live Alerts */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold text-sm text-ink dark:text-ink-dark">
            Live Emergency Alerts
          </h2>
          {live_alerts.length > 0 && (
            <span className="text-xs font-bold bg-signal text-white rounded-full px-2 py-0.5">
              {live_alerts.length}
            </span>
          )}
        </div>

        {live_alerts.length === 0 ? (
          <div className="rounded-control border border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark px-6 py-10 text-center text-sm text-ink-muted dark:text-ink-muted-dark">
            <ShieldCheck className="w-8 h-8 mx-auto mb-3 opacity-30" />
            No active alerts at this time.
          </div>
        ) : (
          <div className="space-y-3">
            {live_alerts.map((alert) => {
              const isAcking = actionLoading === `ack-${alert.id}`;
              const isResolving = actionLoading === `resolve-${alert.id}`;
              const alertCategory = alert.emergency_type || alert.category || 'OTHER';
              const alertStatus = alert.status || 'PENDING';
              const alertStatusDisplay = alert.status_display || alertStatus;
              const alertDescription = alert.description || alert.message || '';

              return (
                <div
                  key={alert.id}
                  className="rounded-control border border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark p-4"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-ink-muted dark:text-ink-muted-dark">
                        #{alert.id}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${etColor(alertCategory)}`}
                      >
                        {alertCategory}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${statusColor(alertStatus)}`}
                      >
                        {alertStatusDisplay}
                      </span>
                      {alert.assigned_to_me && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
                          Assigned to Me
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-ink-muted dark:text-ink-muted-dark">
                      {fmtDate(alert.created_at)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-ink dark:text-ink-dark">
                    {alert.resident_name || 'Resident'}
                  </p>
                  {alertDescription ? (
                    <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-1 line-clamp-2">
                      {alertDescription}
                    </p>
                  ) : (
                    <p className="text-xs italic text-ink-muted dark:text-ink-muted-dark mt-1">
                      No additional description provided.
                    </p>
                  )}
                  {alert.location_text ? (
                    <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
                      📍 {alert.location_text}
                    </p>
                  ) : null}

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {alertStatus === 'PENDING' && (
                      <button
                        disabled={isAcking}
                        onClick={() => void handleAcknowledge(alert.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {isAcking ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Acknowledge
                      </button>
                    )}
                    {(alertStatus === 'ACKNOWLEDGED' || alertStatus === 'IN_PROGRESS') && (
                      <button
                        disabled={isResolving}
                        onClick={() => void handleResolve(alert.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isResolving ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Mark Resolved
                      </button>
                    )}
                    <Link
                      to={`/incidents/${alert.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-control border border-rule dark:border-rule-dark text-xs font-semibold text-ink-muted dark:text-ink-muted-dark hover:border-action hover:text-action transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Reports */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold text-sm text-ink dark:text-ink-dark">
            Resident Reports
          </h2>
          {recent_reports.length > 0 && (
            <span className="text-xs font-bold bg-action text-white rounded-full px-2 py-0.5">
              {recent_reports.length}
            </span>
          )}
        </div>

        {recent_reports.length === 0 ? (
          <div className="rounded-control border border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark px-6 py-10 text-center text-sm text-ink-muted dark:text-ink-muted-dark">
            <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
            No pending reports at this time.
          </div>
        ) : (
          <div className="space-y-3">
            {recent_reports.map((report) => {
              const reportCategory =
                report.category ||
                report.incident_type_display ||
                report.incident_type ||
                'Issue';
              const reportStatus = report.status || 'PENDING';
              const reportStatusDisplay = report.status_display || reportStatus;

              return (
                <div
                  key={report.id}
                  className="rounded-control border border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark p-4"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-ink-muted dark:text-ink-muted-dark">
                        #{report.id}
                      </span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                        {reportCategory}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${statusColor(reportStatus)}`}
                      >
                        {reportStatusDisplay}
                      </span>
                    </div>
                    <span className="text-[11px] text-ink-muted dark:text-ink-muted-dark">
                      {fmtDate(report.created_at)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-ink dark:text-ink-dark">
                    {report.reporter_name || 'Resident'}
                  </p>
                  {report.description ? (
                    <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-1 line-clamp-2">
                      {report.description}
                    </p>
                  ) : (
                    <p className="text-xs italic text-ink-muted dark:text-ink-muted-dark mt-1">
                      No description provided.
                    </p>
                  )}
                  {report.location ? (
                    <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
                      📍 {report.location}
                    </p>
                  ) : null}

                  <div className="mt-3">
                    <Link
                      to="/reports"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-control border border-rule dark:border-rule-dark text-xs font-semibold text-ink-muted dark:text-ink-muted-dark hover:border-action hover:text-action transition-colors"
                    >
                      View Reports
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export const SecurityDashboardPage: React.FC = () => {
  return (
    <ErrorBoundary fallbackMessage="An error occurred while loading the Security Dashboard. Please try again or refresh the page.">
      <SecurityDashboardView />
    </ErrorBoundary>
  );
};

export default SecurityDashboardPage;
