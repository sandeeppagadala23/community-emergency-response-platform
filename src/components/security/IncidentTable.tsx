
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IncidentSummary } from '../../types/incident';
import { StatusBadge } from '../common/StatusBadge';
import { formatIstTime } from '../../utils/dateUtils';
import { Copy, Check, RefreshCw, Filter, MapPin, MapPinOff } from 'lucide-react';

interface IncidentTableProps {
  incidents: IncidentSummary[];
  isLoading: boolean;
  onRefresh: () => void;
  lastUpdated?: string;
  isAutoRefreshing?: boolean;
}

export const IncidentTable: React.FC<IncidentTableProps> = ({
  incidents,
  isLoading,
  onRefresh,
  lastUpdated,
  isAutoRefreshing = false,
}) => {
  const navigate = useNavigate();
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Track new items for highlight animation
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (incidents.length > 0 && prevIdsRef.current.size > 0) {
      const newlyAdded = incidents
        .filter((incident) => !prevIdsRef.current.has(incident.id))
        .map((incident) => incident.id);

      if (newlyAdded.length > 0) {
        setHighlightedIds(new Set(newlyAdded));

        const timer = setTimeout(() => {
          setHighlightedIds(new Set());
        }, 3000);

        return () => clearTimeout(timer);
      }
    }

    prevIdsRef.current = new Set(incidents.map((incident) => incident.id));
  }, [incidents]);

  // Filter and sort: OPEN incidents first, then newest first
  const filteredIncidents = incidents
    .filter((incident) => {
      if (statusFilter !== 'ALL' && incident.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== 'ALL' && incident.emergency_type !== typeFilter) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (a.status === 'OPEN' && b.status !== 'OPEN') return -1;
      if (b.status === 'OPEN' && a.status !== 'OPEN') return 1;

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });

  // Keep selected index within the filtered list
  useEffect(() => {
    setSelectedIdx((current) =>
      Math.min(current, Math.max(0, filteredIncidents.length - 1))
    );
  }, [filteredIncidents.length]);

  // Keyboard navigation: Arrow Up, Arrow Down and Enter
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (filteredIncidents.length === 0) return;

      const target = event.target as HTMLElement;

      if (
        ['input', 'textarea', 'select'].includes(
          target.tagName.toLowerCase()
        )
      ) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();

        setSelectedIdx((previous) =>
          Math.min(filteredIncidents.length - 1, previous + 1)
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();

        setSelectedIdx((previous) => Math.max(0, previous - 1));
      } else if (event.key === 'Enter') {
        const selectedIncident = filteredIncidents[selectedIdx];

        if (selectedIncident) {
          navigate(`/incidents/${selectedIncident.id}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredIncidents, navigate, selectedIdx]);

  const copyIncidentId = async (
    event: React.MouseEvent<HTMLButtonElement>,
    id: string
  ) => {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);

      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy incident ID:', error);
    }
  };

  return (
    <div className="space-y-3">
      {/* Table Toolbar & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark p-3 rounded-control text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter
            className="w-4 h-4 text-ink-muted shrink-0"
            strokeWidth={1.5}
          />

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="border border-rule dark:border-rule-dark rounded px-2 py-1 bg-paper dark:bg-paper-dark text-ink dark:text-ink-dark focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-action"
            aria-label="Filter by Status"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open only</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="border border-rule dark:border-rule-dark rounded px-2 py-1 bg-paper dark:bg-paper-dark text-ink dark:text-ink-dark focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-action"
            aria-label="Filter by Emergency Category"
          >
            <option value="ALL">All Categories</option>
            <option value="MEDICAL">Medical</option>
            <option value="FIRE">Fire</option>
            <option value="FALL">Fall</option>
            <option value="ACCIDENT">Accident</option>
            <option value="SECURITY">Security</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Refresh & Timestamp */}
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="font-mono text-[11px] text-ink-muted dark:text-ink-muted-dark">
              Updated {lastUpdated}
            </span>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading || isAutoRefreshing}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-rule dark:border-rule-dark bg-paper dark:bg-paper-dark hover:bg-stone-200 dark:hover:bg-stone-800 text-ink dark:text-ink-dark transition-colors"
            title="Refresh table now"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-action dark:text-teal-400 ${
                isLoading || isAutoRefreshing ? 'animate-spin' : ''
              }`}
              strokeWidth={1.75}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Dense Table for Security Desk */}
      <div className="incident-table-scroll border border-rule dark:border-rule-dark rounded-control bg-surface dark:bg-surface-dark overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-rule dark:border-rule-dark bg-stone-100/70 dark:bg-stone-900/60 font-semibold text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3">Incident ID</th>
              <th className="py-2.5 px-3">Resident / Flat</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Location</th>
              <th className="py-2.5 px-3">Raised (IST)</th>
              <th className="py-2.5 px-3">Notifications</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-rule dark:divide-rule-dark font-sans">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-ink-muted">
                  No incidents match the active filters.
                </td>
              </tr>
            ) : (
              filteredIncidents.map((incident, idx) => {
                const isSelected = idx === selectedIdx;
                const isNew = highlightedIds.has(incident.id);
                const notifSum = incident.notifications_summary;

                return (
                  <tr
                    key={incident.id}
                    tabIndex={0}
                    aria-label={`${incident.emergency_type} incident ${incident.id}, ${incident.status.replace('_', ' ').toLowerCase()}. Press Enter to open.`}
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.stopPropagation();
                        navigate(`/incidents/${incident.id}`);
                      }
                    }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? 'bg-action-light/60 dark:bg-action-light-dark/50'
                        : isNew
                          ? 'bg-amber-100/70 dark:bg-amber-950/40'
                          : 'hover:bg-stone-50 dark:hover:bg-stone-800/40'
                    }`}
                  >
                    {/* Monospace Incident ID with Copy */}
                    <td className="py-2.5 px-3 font-mono font-medium text-action dark:text-teal-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{incident.id}</span>

                        <button
                          type="button"
                          onClick={(event) =>
                            copyIncidentId(event, incident.id)
                          }
                          title="Copy Incident ID"
                          className="text-ink-muted hover:text-ink focus-visible:outline-none p-0.5 rounded"
                        >
                          {copiedId === incident.id ? (
                            <Check className="w-3 h-3 text-ok" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Resident Info (role-gated) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {incident.resident_name ? (
                        <div>
                          <div className="font-semibold text-ink dark:text-ink-dark">
                            {incident.resident_name}
                          </div>

                          <div className="text-[11px] font-mono text-ink-muted dark:text-ink-muted-dark">
                            Flat {incident.resident_flat}
                          </div>
                        </div>
                      ) : incident.resident_flat ? (
                        <span className="font-mono text-ink dark:text-ink-dark">
                          Flat {incident.resident_flat}
                        </span>
                      ) : (
                        <span className="text-ink-muted italic">
                          Restricted
                        </span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-3 font-semibold text-ink dark:text-ink-dark whitespace-nowrap">
                      {incident.emergency_type}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusBadge
                        status={incident.status}
                        type="incident"
                      />
                    </td>

                    {/* Location Summary */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {incident.has_location ? (
                        <span className="inline-flex items-center gap-1 text-ok text-[11px] font-medium">
                          <MapPin className="w-3 h-3" />
                          <span>Available</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-ink-muted text-[11px]">
                          <MapPinOff className="w-3 h-3" />
                          <span>Not available</span>
                        </span>
                      )}
                    </td>

                    {/* Raised Timestamp */}
                    <td
                      className="py-2.5 px-3 whitespace-nowrap text-ink-muted dark:text-ink-muted-dark font-mono text-[11px]"
                      title={formatIstTime(incident.created_at, '24h')}
                    >
                      <span>
                        {formatIstTime(incident.created_at, 'relative')}
                      </span>
                    </td>

                    {/* Compact Notification Summary */}
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                      {notifSum ? (
                        <div className="flex items-center gap-1.5">
                          <span
                            title={`${notifSum.delivered} Delivered`}
                            className="text-ok font-semibold"
                          >
                            {notifSum.delivered} dlvd
                          </span>

                          <span className="text-rule dark:text-rule-dark">
                            /
                          </span>

                          <span
                            title={`${notifSum.sent} Sent`}
                            className="text-action dark:text-teal-400 font-semibold"
                          >
                            {notifSum.sent} sent
                          </span>

                          {notifSum.failed > 0 && (
                            <>
                              <span className="text-rule dark:text-rule-dark">
                                /
                              </span>

                              <span
                                title={`${notifSum.failed} Failed`}
                                className="text-signal font-bold bg-signal-light dark:bg-signal-light-dark px-1 rounded"
                              >
                                {notifSum.failed} fail
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-[11px] text-ink-muted dark:text-ink-muted-dark px-1">
        <span>Use ↑ and ↓ arrow keys to navigate rows, Enter to open.</span>
        <span>Showing {filteredIncidents.length} incidents</span>
      </div>
    </div>
  );
};
