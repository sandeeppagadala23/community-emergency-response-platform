
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { incidentService } from '../services/incidentService';
import { apiClient } from '../services/apiClient';
import { IncidentSummary } from '../types/incident';
import { IncidentTable } from '../components/security/IncidentTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonTable, SkeletonRow } from '../components/common/Skeleton';
import { formatIstTime } from '../utils/dateUtils';
import { ChevronRight, FilePlus2, MapPin } from 'lucide-react';

export const IncidentListPage: React.FC = () => {
  const { user, role } = useAuth();

  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchIncidents = async (silent = false, initialLoad = false) => {
    if (!silent && !initialLoad) setIsLoading(true);
    if (silent) setIsRefreshing(true);

    try {
      const data = await incidentService.getIncidents();
      setIncidents(data);
      setLastUpdated(formatIstTime(new Date().toISOString(), '24h'));
      setLoadError(null);
    } catch (error: unknown) {
      setLoadError(apiClient.normalizeError(error).message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchIncidents(false, true);

    const interval = setInterval(() => {
      void fetchIncidents(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  const isDeskRole = role === 'SECURITY' || role === 'ADMIN';

  const emptyMessage =
    role === 'VOLUNTEER'
      ? 'No incidents are assigned to you yet. An administrator will assign an emergency and notify you here. Check your notifications and refresh this page when you receive an assignment.'
      : 'No emergency incidents found.';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-rule dark:border-rule-dark pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-ink dark:text-ink-dark">
            {isDeskRole ? 'Incident Monitoring Board' : 'Emergency Alerts'}
          </h1>

          <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">
            {role === 'GUARDIAN'
              ? 'Showing alerts for residents linked to your verified guardian contacts.'
              : role === 'VOLUNTEER'
                ? 'Showing incidents assigned to you. Open an incident to view its details and check in when you arrive.'
                : 'Society-wide live emergency dispatch log'}
          </p>
        </div>

        <Link
          to="/reports"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control bg-action px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-action-hover"
        >
          <FilePlus2 className="h-4 w-4" />
          Raise Complaint
        </Link>
      </div>

      {/* Loading */}
      {isLoading ? (
        isDeskRole ? (
          <SkeletonTable rows={6} />
        ) : (
          <SkeletonRow count={3} heightClass="h-24" />
        )
      ) : loadError && incidents.length === 0 ? (
        <EmptyState
          message={`Could not load emergency incidents: ${loadError}`}
          actionText="Retry"
          onAction={() => void fetchIncidents(false)}
        />
      ) : incidents.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <>
          {loadError && (
            <p
              role="alert"
              className="rounded-control border border-signal/30 bg-signal/5 p-3 text-sm text-signal"
            >
              Could not refresh incidents. Showing the last loaded data. {loadError}
            </p>
          )}

          {/* Security and Admin Incident Table */}
          {isDeskRole ? (
            <IncidentTable
              incidents={incidents}
              isLoading={isLoading}
              onRefresh={() => void fetchIncidents(false)}
              lastUpdated={lastUpdated}
              isAutoRefreshing={isRefreshing}
            />
          ) : (
            /* Guardian and Volunteer Incident Cards */
            <div className="space-y-3">
              {incidents.map((inc) => (
                <Link
                  key={inc.id}
                  to={`/incidents/${inc.id}`}
                  aria-label={`View ${inc.emergency_type} incident ${inc.id}`}
                  onClick={() => {
                    console.log('INCIDENT CARD CLICKED:', inc.id);
                  }}
                  className="block bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-4 hover:border-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action transition-colors cursor-pointer shadow-sm space-y-2 text-inherit no-underline"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-base text-ink dark:text-ink-dark">
                        {inc.emergency_type} Alert
                      </span>

                      <StatusBadge status={inc.status} type="incident" />
                    </div>

                    <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
                  </div>

                  <div className="flex items-center justify-between text-xs text-ink-muted dark:text-ink-muted-dark">
                    <span>
                      {inc.resident_name
                        ? `${inc.resident_name}${inc.resident_flat ? ` · Flat ${inc.resident_flat}` : ''}`
                        : `Flat ${inc.resident_flat || 'Restricted'}`}
                    </span>

                    <span className="font-mono">
                      {formatIstTime(inc.created_at, '12h')}
                    </span>
                  </div>

                  {inc.description && (
                    <p className="text-xs text-ink dark:text-ink-dark bg-stone-50 dark:bg-stone-900 p-2 rounded-control border border-rule dark:border-rule-dark">
                      "{inc.description}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-rule dark:border-rule-dark text-[11px] font-mono text-ink-muted">
                    <span>ID: {inc.id}</span>

                    {inc.has_location && (
                      <span className="text-ok font-sans font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Location available
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
