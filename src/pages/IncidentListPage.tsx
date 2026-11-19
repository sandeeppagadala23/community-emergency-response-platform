
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { incidentService } from '../services/incidentService';
import { reportService } from '../services/reportService';
import { contactService } from '../services/contactService';
import { apiClient } from '../services/apiClient';
import { IncidentSummary } from '../types/incident';
import { EmergencyReport } from '../types/report';
import { GuardianContact } from '../types/contact';
import { IncidentTable } from '../components/security/IncidentTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { SkeletonTable, SkeletonRow } from '../components/common/Skeleton';
import { formatIstTime } from '../utils/dateUtils';
import { AlertTriangle, ChevronRight, ContactRound, FilePlus2, FileText, MapPin, RefreshCw } from 'lucide-react';

export const IncidentListPage: React.FC = () => {
  const { user, role } = useAuth();

  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [guardianContacts, setGuardianContacts] = useState<GuardianContact[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingReports, setIsLoadingReports] = useState<boolean>(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [guardianTab, setGuardianTab] = useState<'alerts' | 'reports'>('alerts');

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

  const fetchGuardianData = async () => {
    if (role !== 'GUARDIAN') return;
    setIsLoadingReports(true);
    setReportsError(null);
    try {
      const [reportsData, contactsData] = await Promise.all([
        reportService.getReports().catch((err: unknown) => {
          setReportsError(apiClient.normalizeError(err).message);
          return [] as EmergencyReport[];
        }),
        contactService.getContacts().catch(() => [] as GuardianContact[]),
      ]);
      setReports(reportsData);
      setGuardianContacts(contactsData);
    } catch (error: unknown) {
      setReportsError(apiClient.normalizeError(error).message);
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    void fetchIncidents(false, true);
    if (role === 'GUARDIAN') {
      void fetchGuardianData();
    }

    const interval = setInterval(() => {
      void fetchIncidents(true);
      if (role === 'GUARDIAN') {
        reportService.getReports()
          .then(setReports)
          .catch(() => {});
        contactService.getContacts()
          .then(setGuardianContacts)
          .catch(() => {});
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user, role]);

  const isDeskRole = role === 'SECURITY' || role === 'ADMIN';

  const emptyMessage =
    role === 'VOLUNTEER'
      ? 'No incidents are assigned to you yet. An administrator will assign an emergency and notify you here. Check your notifications and refresh this page when you receive an assignment.'
      : role === 'GUARDIAN'
        ? 'No emergency incidents found for your linked residents.'
        : 'No emergency incidents found.';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border-b border-rule dark:border-rule-dark pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-ink dark:text-ink-dark">
            {role === 'GUARDIAN'
              ? 'Guardian Emergency Board'
              : isDeskRole
                ? 'Incident Monitoring Board'
                : 'Emergency Alerts'}
          </h1>

          <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">
            {role === 'GUARDIAN'
              ? 'Showing alerts and reports for residents linked to your verified guardian contacts.'
              : role === 'VOLUNTEER'
                ? 'Showing incidents assigned to you. Open an incident to view its details and check in when you arrive.'
                : 'Society-wide live emergency dispatch log'}
          </p>
        </div>

        {role !== 'GUARDIAN' && (
          <Link
            to="/reports"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-control bg-action px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-action-hover"
          >
            <FilePlus2 className="h-4 w-4" />
            Raise Complaint
          </Link>
        )}
      </div>

      {/* Guardian: My Linked Residents Section */}
      {role === 'GUARDIAN' && (
        <section aria-label="My Residents" className="rounded-panel border border-rule bg-surface p-4 shadow-sm dark:border-rule-dark dark:bg-surface-dark space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-sm font-bold text-ink dark:text-ink-dark flex items-center gap-2">
              <ContactRound className="w-4 h-4 text-action" />
              My Linked Residents
            </h2>
            <Link
              to="/contacts"
              className="text-xs font-semibold text-action hover:underline"
            >
              View resident details &rarr;
            </Link>
          </div>

          {guardianContacts.length === 0 ? (
            <p className="rounded-control border border-dashed border-rule p-3 text-xs text-ink-muted dark:border-rule-dark dark:text-ink-muted-dark">
              No verified residents are linked to your account yet. Emergency alerts and reports will appear once an administrator or resident links and verifies your guardian contact.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {guardianContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="rounded-control border border-rule bg-paper p-3 text-xs space-y-1 dark:border-rule-dark dark:bg-paper-dark"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-ink dark:text-ink-dark">
                      {contact.resident_name || contact.resident_username}
                    </span>
                    <span className="rounded-control border border-ok/30 bg-ok-light px-1.5 py-0.5 text-[10px] font-semibold text-ok dark:bg-ok-light-dark">
                      Verified
                    </span>
                  </div>
                  <p className="text-ink-muted dark:text-ink-muted-dark">
                    {contact.relationship} · {contact.guardian_type_display}
                  </p>
                  {contact.resident_flat && (
                    <p className="text-[11px] text-ink-muted dark:text-ink-muted-dark">
                      Flat: {contact.resident_flat}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Guardian Tabs: Alerts vs Reports */}
      {role === 'GUARDIAN' && (
        <div className="flex items-center gap-2 border-b border-rule dark:border-rule-dark pb-2">
          <button
            type="button"
            onClick={() => setGuardianTab('alerts')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-control transition-colors ${
              guardianTab === 'alerts'
                ? 'bg-action text-white'
                : 'text-ink-muted hover:text-ink hover:bg-stone-100 dark:text-ink-muted-dark dark:hover:bg-stone-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Emergency Alerts ({incidents.length})
          </button>
          <button
            type="button"
            onClick={() => setGuardianTab('reports')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-control transition-colors ${
              guardianTab === 'reports'
                ? 'bg-action text-white'
                : 'text-ink-muted hover:text-ink hover:bg-stone-100 dark:text-ink-muted-dark dark:hover:bg-stone-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Resident Reports ({reports.length})
          </button>
        </div>
      )}

      {/* Main Content: Guardian Reports Tab */}
      {role === 'GUARDIAN' && guardianTab === 'reports' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-base font-bold text-ink dark:text-ink-dark">
              Emergency Reports from Linked Residents
            </h2>
            <button
              type="button"
              onClick={() => void fetchGuardianData()}
              disabled={isLoadingReports}
              className="inline-flex items-center gap-1 rounded-control border border-rule px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-stone-100 disabled:opacity-50 dark:border-rule-dark dark:text-ink-muted-dark dark:hover:bg-stone-800"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingReports ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {isLoadingReports ? (
            <SkeletonRow count={3} heightClass="h-28" />
          ) : reportsError && reports.length === 0 ? (
            <EmptyState
              message={`Could not load resident reports: ${reportsError}`}
              actionText="Retry"
              onAction={() => void fetchGuardianData()}
            />
          ) : reports.length === 0 ? (
            <EmptyState message="No emergency reports submitted by linked residents yet." />
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-panel border border-rule bg-surface p-4 shadow-sm dark:border-rule-dark dark:bg-surface-dark space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-base text-ink dark:text-ink-dark">
                        {report.title || report.incident_type_display}
                      </span>
                      <span className="font-mono text-xs text-ink-muted">#{report.id}</span>
                      <span className="rounded-control border border-rule px-2 py-0.5 text-[11px] font-semibold text-ink-muted dark:border-rule-dark dark:text-ink-muted-dark">
                        {report.incident_type_display}
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-control border border-rule text-ink dark:border-rule-dark dark:text-ink-dark">{report.status_display || report.status}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-xs text-ink-muted dark:text-ink-muted-dark gap-2">
                    <span>
                      Resident: <strong className="text-ink dark:text-ink-dark">{report.reporter_name || report.reporter_username}</strong>
                      {report.reporter_flat ? ` · Flat ${report.reporter_flat}` : ''}
                    </span>
                    <span className="font-mono">
                      {formatIstTime(report.created_at, '12h')}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm text-ink dark:text-ink-dark bg-stone-50 dark:bg-stone-900 p-2.5 rounded-control border border-rule dark:border-rule-dark">
                    {report.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between pt-1 border-t border-rule dark:border-rule-dark text-xs text-ink-muted gap-2">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-action shrink-0" />
                      <span>{report.location}</span>
                      {report.latitude !== null && report.longitude !== null && (
                        <span className="text-[10px] font-mono text-ok">
                          ({Number(report.latitude).toFixed(4)}, {Number(report.longitude).toFixed(4)})
                        </span>
                      )}
                    </div>
                    <span>
                      Attachments: {report.response_notes ? 'Response notes attached' : 'None'}
                    </span>
                  </div>

                  {report.response_notes && (
                    <div className="rounded-control bg-ok-light/30 border border-ok/20 p-2 text-xs text-ink dark:text-ink-dark">
                      <span className="font-semibold text-ok">Response: </span>
                      {report.response_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Alerts View (Default for Guardian and other roles) */
        <>
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
        </>
      )}
    </div>
  );
};

