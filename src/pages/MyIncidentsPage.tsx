import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { incidentService } from '../services/incidentService';
import { IncidentSummary } from '../types/incident';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonRow } from '../components/common/Skeleton';
import { formatIstTime, formatMonthGroup } from '../utils/dateUtils';
import { ChevronRight, Clock, AlertTriangle } from 'lucide-react';

export const MyIncidentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchIncidents = async () => {
      try {
        const data = await incidentService.getResidentIncidents();
        if (isMounted) {
          setIncidents(data);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Unable to load incident history.');
          setIsLoading(false);
        }
      }
    };

    fetchIncidents();
    return () => {
      isMounted = false;
    };
  }, []);

  // Group by month
  const grouped = incidents.reduce<Record<string, IncidentSummary[]>>((acc, inc) => {
    const month = formatMonthGroup(inc.created_at);
    if (!acc[month]) acc[month] = [];
    acc[month].push(inc);
    return acc;
  }, {});

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="border-b border-rule dark:border-rule-dark pb-3">
        <h1 className="font-serif text-xl sm:text-2xl font-bold text-ink dark:text-ink-dark">
          My Alert History
        </h1>
        <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">
          Past emergency alerts recorded for your apartment.
        </p>
      </div>

      {isLoading ? (
        <SkeletonRow count={4} heightClass="h-20" />
      ) : error ? (
        <EmptyState message={error} actionText="Retry" onAction={() => window.location.reload()} />
      ) : incidents.length === 0 ? (
        <EmptyState message="You haven’t raised any alerts." />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, items]) => (
            <div key={month} className="space-y-2">
              <h2 className="text-xs font-mono font-semibold text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider px-1">
                {month}
              </h2>

              <div className="border border-rule dark:border-rule-dark rounded-panel bg-surface dark:bg-surface-dark divide-y divide-rule dark:divide-rule-dark overflow-hidden shadow-sm">
                {items.map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => navigate(`/incidents/${inc.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        navigate(`/incidents/${inc.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="p-4 hover:bg-stone-50 dark:hover:bg-stone-800/40 cursor-pointer transition-colors flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:bg-stone-50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink dark:text-ink-dark">
                          {inc.emergency_type} Alert
                        </span>
                        <StatusBadge status={inc.status} type="incident" />
                      </div>

                      <div className="text-xs text-ink-muted dark:text-ink-muted-dark flex items-center gap-2">
                        <span>{formatIstTime(inc.created_at, '12h')}</span>
                        {inc.resolved_at && (
                          <>
                            <span>·</span>
                            <span>Resolved: {formatIstTime(inc.resolved_at, '12h')}</span>
                          </>
                        )}
                      </div>

                      <div className="font-mono text-[11px] text-action dark:text-teal-400">
                        {inc.id}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-ink-muted shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
