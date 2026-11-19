import React, { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, FilePlus2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { reportService } from '../services/reportService';
import {
  AvailableVolunteer,
  CreateEmergencyReportPayload,
  EmergencyReport,
  EmergencyReportEvent,
  ReportCategory,
} from '../types/report';
import { formatIstTime } from '../utils/dateUtils';

const REPORT_CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'MEDICAL', label: 'Medical emergency' },
  { value: 'FIRE', label: 'Fire' },
  { value: 'SECURITY', label: 'Security issue' },
  { value: 'ACCIDENT', label: 'Accident' },
  { value: 'OTHER', label: 'Other' },
];

export const ReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const isDemo = apiClient.isMockMode();
  const [title, setTitle] = useState('');
  const [incidentType, setIncidentType] = useState<ReportCategory | ''>('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [reports, setReports] = useState<EmergencyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<EmergencyReport['status'] | 'ALL'>('ALL');
  const [statusDrafts, setStatusDrafts] = useState<Record<number, EmergencyReport['status']>>({});
  const [responseDrafts, setResponseDrafts] = useState<Record<number, string>>({});
  const [updatingReportId, setUpdatingReportId] = useState<number | null>(null);
  const [availableVolunteers, setAvailableVolunteers] = useState<AvailableVolunteer[]>([]);
  const [volunteerSelections, setVolunteerSelections] = useState<Record<number, string>>({});
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [historyByReport, setHistoryByReport] = useState<Record<number, EmergencyReportEvent[]>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<number | null>(null);

  const loadReports = async () => {
    if (apiClient.isMockMode()) {
      return;
    }

    try {
      setReports(await reportService.getReports());
    } catch (error: unknown) {
      setLoadError(apiClient.normalizeError(error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshVisibleReportHistory = async (reportId: number) => {
    if (!historyByReport[reportId]) return;
    try {
      const history = await reportService.getReportHistory(reportId);
      setHistoryByReport((current) => ({ ...current, [reportId]: history }));
    } catch (error: unknown) {
      setAssignmentError(
        `The report was updated, but its history could not be refreshed: ${apiClient.normalizeError(error).message}`,
      );
    }
  };

  useEffect(() => {
    let active = true;
    const fetchReports = async () => {
      if (apiClient.isMockMode()) return;
      try {
        const loadedReports = await reportService.getReports();
        if (active) {
          setReports(loadedReports);
          // If navigated with a hash pointing to a specific report, scroll to it once loaded
          if (window.location.hash) {
            const targetId = window.location.hash.replace('#report-', '');
            if (targetId) {
              setTimeout(() => {
                const el = document.getElementById(`report-${targetId}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
            }
          }
        }
      } catch (error: unknown) {
        if (active) setLoadError(apiClient.normalizeError(error).message);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void fetchReports();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (role !== 'ADMIN' || isDemo) return;
    reportService.getAvailableVolunteers()
      .then(setAvailableVolunteers)
      .catch((error: unknown) => setAssignmentError(apiClient.normalizeError(error).message));
  }, [isDemo, role]);

  const detectLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Location detection is not supported by this browser. Enter the address manually.');
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const detectedLatitude = Number(position.coords.latitude.toFixed(6));
        const detectedLongitude = Number(position.coords.longitude.toFixed(6));
        if (
          !Number.isFinite(detectedLatitude)
          || !Number.isFinite(detectedLongitude)
          || detectedLatitude < -90
          || detectedLatitude > 90
          || detectedLongitude < -180
          || detectedLongitude > 180
        ) {
          setLocationError('The browser returned invalid coordinates. Enter the address manually.');
        } else {
          setLatitude(detectedLatitude);
          setLongitude(detectedLongitude);
        }
        setIsDetectingLocation(false);
      },
      (error) => {
        const message = error.code === 1
          ? 'Location permission was denied. Enter the address manually or allow location access.'
          : error.code === 3
            ? 'Location detection timed out. Try again or enter the address manually.'
            : 'Your location is unavailable. Try again or enter the address manually.';
        setLocationError(message);
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const trimmedLocation = location.trim();
    const trimmedDescription = description.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !incidentType || !trimmedLocation || !trimmedDescription) {
      setSubmitError('Provide a title, select a category, and enter the location and details.');
      return;
    }
    if (trimmedTitle.length > 200) {
      setSubmitError('Title must be 200 characters or fewer.');
      return;
    }
    if (trimmedLocation.length > 255) {
      setSubmitError('Location must be 255 characters or fewer.');
      return;
    }
    if ((latitude === null) !== (longitude === null)) {
      setSubmitError('Latitude and longitude must both be available, or both be left blank.');
      return;
    }

    const payload: CreateEmergencyReportPayload = {
      title: trimmedTitle,
      incident_type: incidentType,
      location: trimmedLocation,
      description: trimmedDescription,
      ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
    };

    setIsSubmitting(true);
    try {
      const savedReport = await reportService.createReport(payload);
      setReports((current) => [
        savedReport,
        ...current.filter((report) => report.id !== savedReport.id),
      ]);
      setSuccessMessage(`Report #${savedReport.id} was saved successfully.`);
      setTitle('');
      setIncidentType('');
      setLocation('');
      setLatitude(null);
      setLongitude(null);
      setLocationError(null);
      setDescription('');
      setIsLoading(true);
      setLoadError(null);
      await loadReports();
      setReports((current) => [
        savedReport,
        ...current.filter((report) => report.id !== savedReport.id),
      ]);
    } catch (error: unknown) {
      setSubmitError(apiClient.normalizeError(error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateReportStatus = async (report: EmergencyReport) => {
    setSubmitError(null);
    setSuccessMessage(null);
    setUpdatingReportId(report.id);
    try {
      const updated = await reportService.updateReportStatus(
        report.id,
        statusDrafts[report.id] ?? report.status,
        responseDrafts[report.id] ?? report.response_notes ?? '',
      );
      setReports((current) =>
        current.map((item) => item.id === report.id ? { ...item, ...updated } : item),
      );
      setSuccessMessage(`Report #${report.id} status was updated.`);
      await refreshVisibleReportHistory(report.id);
    } catch (error: unknown) {
      setSubmitError(apiClient.normalizeError(error).message);
    } finally {
      setUpdatingReportId(null);
    }
  };

  const assignVolunteer = async (report: EmergencyReport) => {
    const selectedVolunteerId = volunteerSelections[report.id];
    if (!selectedVolunteerId) {
      setAssignmentError('Select an available volunteer before assigning.');
      return;
    }
    setAssignmentError(null);
    setUpdatingReportId(report.id);
    try {
      const updated = await reportService.assignVolunteer(
        report.id,
        Number(selectedVolunteerId),
      );
      setReports((current) =>
        current.map((item) => item.id === report.id ? updated : item),
      );
      setSuccessMessage(`Report #${report.id} was assigned to ${updated.assigned_volunteer_name}.`);
      await refreshVisibleReportHistory(report.id);
      try {
        setAvailableVolunteers(await reportService.getAvailableVolunteers());
      } catch (error: unknown) {
        setAssignmentError(
          `The report was assigned, but available volunteers could not be refreshed: ${apiClient.normalizeError(error).message}`,
        );
      }
    } catch (error: unknown) {
      setAssignmentError(apiClient.normalizeError(error).message);
    } finally {
      setUpdatingReportId(null);
    }
  };

  const toggleReportHistory = async (reportId: number) => {
    if (historyByReport[reportId]) {
      setHistoryByReport((current) => {
        const next = { ...current };
        delete next[reportId];
        return next;
      });
      return;
    }
    setHistoryLoadingId(reportId);
    setAssignmentError(null);
    try {
      const history = await reportService.getReportHistory(reportId);
      setHistoryByReport((current) => ({ ...current, [reportId]: history }));
    } catch (error: unknown) {
      setAssignmentError(apiClient.normalizeError(error).message);
    } finally {
      setHistoryLoadingId(null);
    }
  };

  const filteredReports = reports.filter((report) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      report.location,
      report.title,
      report.description,
      report.incident_type_display,
      report.status_display,
      report.responded_by_username ?? '',
      report.response_notes ?? '',
    ].some((value) => value.toLowerCase().includes(query));
    return matchesSearch
      && (categoryFilter === 'ALL' || report.incident_type === categoryFilter)
      && (statusFilter === 'ALL' || report.status === statusFilter);
  });
  const canUpdateReport = (report: EmergencyReport) => role === 'ADMIN'
    || (role === 'SECURITY' && user?.is_verified === true)
    || (
      role === 'VOLUNTEER'
      && user?.is_verified === true
      && report.assigned_volunteer === Number(user.id)
    );
  const nextStatusOptions = (report: EmergencyReport): EmergencyReport['status'][] => {
    if (report.status === 'PENDING') return ['ACKNOWLEDGED'];
    if (report.status === 'ACKNOWLEDGED') {
      return role === 'VOLUNTEER' ? [] : ['IN_PROGRESS'];
    }
    if (report.status === 'ASSIGNED') return ['IN_PROGRESS'];
    if (report.status === 'IN_PROGRESS') return ['RESOLVED'];
    if (report.status === 'RESOLVED' && role !== 'VOLUNTEER') return ['CLOSED'];
    return [];
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-col gap-3 border-b border-rule pb-3 dark:border-rule-dark sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-xl font-bold text-ink dark:text-ink-dark sm:text-2xl">
            {role === 'GUARDIAN' ? 'Resident Reports' : 'Raise a Complaint / Report Emergency'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-ink-muted-dark">
            {role === 'GUARDIAN'
              ? 'View and monitor emergency reports submitted by your verified linked residents.'
              : 'Submit a written report for the response team. For an immediate emergency, use SOS.'}
          </p>
        </div>
        {role === 'RESIDENT' ? (
          <Link
            to="/sos"
            className="inline-flex shrink-0 items-center justify-center rounded-control border border-signal px-3 py-2 text-xs font-semibold text-signal transition-colors hover:bg-signal hover:text-white"
          >
            Open Emergency SOS
          </Link>
        ) : (
          <Link
            to="/incidents"
            className="inline-flex shrink-0 items-center justify-center rounded-control border border-action px-3 py-2 text-xs font-semibold text-action transition-colors hover:bg-action hover:text-white"
          >
            Back to Incident Board
          </Link>
        )}
      </header>

      {isDemo && (
        <div className="rounded-control border border-warn/40 bg-warn-light p-3 text-sm text-ink dark:bg-warn-light-dark dark:text-ink-dark">
          Demo accounts cannot save reports. Sign in to a live account to submit and view database-backed reports.
        </div>
      )}

      {submitError && (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-signal/30 bg-signal-light/40 p-3 text-sm text-ink dark:text-ink-dark">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
          <span>{submitError}</span>
        </div>
      )}
      {successMessage && (
        <div role="status" className="flex items-start gap-2 rounded-control border border-ok/30 bg-ok-light p-3 text-sm text-ok dark:bg-ok-light-dark">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {assignmentError && (
        <p role="alert" className="rounded-control border border-signal/30 bg-signal-light/40 p-3 text-sm text-signal">
          {assignmentError}
        </p>
      )}

      {role !== 'GUARDIAN' && (
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-panel border border-rule bg-surface p-4 shadow-sm dark:border-rule-dark dark:bg-surface-dark sm:p-6"
      >
        <div>
          <label htmlFor="report-title" className="mb-1 block text-xs font-semibold text-ink dark:text-ink-dark">
            Incident title <span aria-hidden="true">*</span>
          </label>
          <input
            id="report-title"
            name="title"
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={isSubmitting || isDemo}
            placeholder="Short summary of the emergency"
            className="w-full rounded-control border border-rule bg-surface p-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-action dark:border-rule-dark dark:bg-surface-dark dark:text-ink-dark"
          />
        </div>

        <div>
          <label htmlFor="report-category" className="mb-1 block text-xs font-semibold text-ink dark:text-ink-dark">
            Complaint / emergency category <span aria-hidden="true">*</span>
          </label>
          <select
            id="report-category"
            name="incident_type"
            required
            value={incidentType}
            onChange={(event) => setIncidentType(event.target.value as ReportCategory | '')}
            disabled={isSubmitting || isDemo}
            className="w-full rounded-control border border-rule bg-surface p-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-action dark:border-rule-dark dark:bg-surface-dark dark:text-ink-dark"
          >
            <option value="">Select a category</option>
            {REPORT_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="report-location" className="mb-1 block text-xs font-semibold text-ink dark:text-ink-dark">
            Location / flat / address <span aria-hidden="true">*</span>
          </label>
          <input
            id="report-location"
            name="location"
            required
            maxLength={255}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            disabled={isSubmitting || isDemo}
            placeholder="Block, flat, entrance, or nearby landmark"
            className="w-full rounded-control border border-rule bg-surface p-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-action dark:border-rule-dark dark:bg-surface-dark dark:text-ink-dark"
          />
          <p className="mt-1 text-right text-[11px] text-ink-muted">{location.length}/255</p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={detectLocation}
            disabled={isDetectingLocation || isSubmitting || isDemo}
            className="rounded-control border border-action px-3 py-2 text-xs font-semibold text-action transition-colors hover:bg-action hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDetectingLocation ? 'Detecting location…' : 'Detect my location'}
          </button>
          {latitude !== null && longitude !== null && (
            <p role="status" className="text-xs text-ok">
              GPS coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          )}
          {locationError && (
            <p role="alert" className="text-xs text-signal">{locationError}</p>
          )}
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
            GPS is optional. You can enter the address above if location access is unavailable.
          </p>
        </div>

        <div>
          <label htmlFor="report-description" className="mb-1 block text-xs font-semibold text-ink dark:text-ink-dark">
            Detailed description <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="report-description"
            name="description"
            required
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isSubmitting || isDemo}
            placeholder="Describe what happened, when it happened, and any assistance needed."
            className="w-full resize-y rounded-control border border-rule bg-surface p-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-action dark:border-rule-dark dark:bg-surface-dark dark:text-ink-dark"
          />
        </div>

        <div className="flex flex-col-reverse justify-end gap-2 border-t border-rule pt-4 dark:border-rule-dark sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(role === 'RESIDENT' ? '/sos' : '/incidents')}
            disabled={isSubmitting}
            className="rounded-control border border-rule px-4 py-2 text-xs font-semibold text-ink-muted hover:bg-stone-100 disabled:opacity-50 dark:border-rule-dark dark:text-ink-muted-dark dark:hover:bg-stone-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isDemo}
            className="inline-flex items-center justify-center gap-2 rounded-control bg-action px-4 py-2 text-xs font-semibold text-white hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FilePlus2 className="h-4 w-4" />
            {isSubmitting ? 'Saving report…' : 'Submit report'}
          </button>
        </div>
      </form>
      )}

      <section aria-labelledby="submitted-reports-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="submitted-reports-heading" className="font-serif text-lg font-bold text-ink dark:text-ink-dark">
            {role === 'GUARDIAN' ? 'Reports from linked residents' : 'Reports you can access'}
          </h2>
          {!isDemo && (
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setLoadError(null);
                void loadReports();
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-control border border-rule px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-stone-100 disabled:opacity-50 dark:border-rule-dark dark:text-ink-muted-dark dark:hover:bg-stone-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="sr-only" htmlFor="report-search">Search reports</label>
          <input
            id="report-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reports, locations, and responses"
            className="min-w-0 rounded-control border border-rule bg-surface px-3 py-2 text-sm dark:border-rule-dark dark:bg-surface-dark"
          />
          <label className="sr-only" htmlFor="report-category-filter">Filter by category</label>
          <select
            id="report-category-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as ReportCategory | 'ALL')}
            className="rounded-control border border-rule bg-surface px-3 py-2 text-sm dark:border-rule-dark dark:bg-surface-dark"
          >
            <option value="ALL">All categories</option>
            {REPORT_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="report-status-filter">Filter by status</label>
          <select
            id="report-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as EmergencyReport['status'] | 'ALL')}
            className="rounded-control border border-rule bg-surface px-3 py-2 text-sm dark:border-rule-dark dark:bg-surface-dark"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Reported</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        {loadError && reports.length > 0 && (
          <p role="alert" className="rounded-control border border-warn/40 bg-warn-light p-3 text-sm text-ink dark:bg-warn-light-dark dark:text-ink-dark">
            Could not refresh reports. Showing the reports already loaded. {loadError}
          </p>
        )}
        {isDemo ? (
          <p className="rounded-control border border-dashed border-rule p-4 text-sm text-ink-muted dark:border-rule-dark dark:text-ink-muted-dark">
            Saved report history is available after signing in with a live account.
          </p>
        ) : isLoading ? (
          <p role="status" className="rounded-control border border-rule p-4 text-sm text-ink-muted dark:border-rule-dark dark:text-ink-muted-dark">
            Loading your reports…
          </p>
        ) : loadError && reports.length === 0 ? (
          <div role="alert" className="rounded-control border border-signal/30 bg-signal-light/40 p-4 text-sm text-ink dark:text-ink-dark">
            <p>{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setLoadError(null);
                void loadReports();
              }}
              className="mt-2 font-semibold text-action dark:text-teal-400"
            >
              Retry loading reports
            </button>
          </div>
        ) : reports.length === 0 ? (
          <p className="rounded-control border border-dashed border-rule p-4 text-sm text-ink-muted dark:border-rule-dark dark:text-ink-muted-dark">
            {role === 'GUARDIAN'
              ? 'No emergency reports from linked residents found.'
              : 'You have not submitted any reports yet.'}
          </p>
        ) : filteredReports.length === 0 ? (
          <p className="rounded-control border border-dashed border-rule p-4 text-sm text-ink-muted dark:border-rule-dark dark:text-ink-muted-dark">
            No reports match these filters.
          </p>
        ) : (
          <ul className="space-y-3">
            {filteredReports.map((report) => (
              <li
                key={report.id}
                id={`report-${report.id}`}
                className="space-y-2 rounded-panel border border-rule bg-surface p-4 dark:border-rule-dark dark:bg-surface-dark transition-all duration-300 target:ring-2 target:ring-action target:border-action"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-ink dark:text-ink-dark">
                    {report.title || report.incident_type_display} · #{report.id}
                  </h3>
                  <span className="rounded-control border border-action/30 bg-action-light px-2 py-0.5 text-[11px] font-semibold text-action dark:text-teal-400">
                    {report.status_display}
                  </span>
                </div>
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                  {report.location} · {formatIstTime(report.created_at, '12h')}
                </p>
                {(report.reporter_name || report.reporter_username || report.assigned_volunteer_name) && (
                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                    <span className="font-semibold text-ink dark:text-ink-dark">
                      Resident: {report.reporter_name || report.reporter_username}
                    </span>
                    {report.assigned_volunteer_name
                      ? ` · Assigned to ${report.assigned_volunteer_name}`
                      : ' · Not assigned'}
                  </p>
                )}
                {report.latitude !== null && report.longitude !== null && (
                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                    GPS coordinates: {Number(report.latitude).toFixed(6)}, {Number(report.longitude).toFixed(6)}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm text-ink dark:text-ink-dark">{report.description}</p>
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                  Attachments: {report.response_notes ? 'Response notes available' : 'None'}
                </p>
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                  Updated {formatIstTime(report.updated_at, '12h')}
                  {report.responded_by_username ? ` · Response by ${report.responded_by_username}` : ''}
                </p>
                {report.response_notes && (
                  <p className="rounded-control bg-stone-50 p-3 text-sm text-ink dark:bg-stone-900 dark:text-ink-dark">
                    {report.response_notes}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void toggleReportHistory(report.id)}
                  disabled={historyLoadingId === report.id}
                  className="rounded-control border border-rule px-3 py-1.5 text-xs font-semibold text-action disabled:opacity-50 dark:border-rule-dark"
                >
                  {historyLoadingId === report.id
                    ? 'Loading history…'
                    : historyByReport[report.id]
                      ? 'Hide history'
                      : 'View incident history'}
                </button>
                {historyByReport[report.id] && (
                  <ol className="space-y-2 border-l-2 border-action/30 pl-3">
                    {historyByReport[report.id].map((event) => (
                      <li key={event.id} className="text-xs">
                        <p className="font-semibold text-ink dark:text-ink-dark">
                          {event.event_type_display}
                          {event.actor_name ? ` · ${event.actor_name}` : ''}
                        </p>
                        <p className="text-ink-muted dark:text-ink-muted-dark">
                          {event.details || event.to_status}
                          {' · '}
                          {formatIstTime(event.created_at, '12h')}
                        </p>
                      </li>
                    ))}
                    {historyByReport[report.id].length === 0 && (
                      <li className="text-xs text-ink-muted">No history is available.</li>
                    )}
                  </ol>
                )}
                {role === 'ADMIN' && ['ACKNOWLEDGED', 'ASSIGNED'].includes(report.status) && (
                  <div className="grid gap-2 border-t border-rule pt-3 dark:border-rule-dark sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="sr-only" htmlFor={`report-volunteer-${report.id}`}>
                      Assign an available volunteer
                    </label>
                    <select
                      id={`report-volunteer-${report.id}`}
                      name={`report-volunteer-${report.id}`}
                      value={volunteerSelections[report.id] ?? ''}
                      onChange={(event) => setVolunteerSelections((current) => ({
                        ...current,
                        [report.id]: event.target.value,
                      }))}
                      className="min-w-0 rounded-control border border-rule bg-surface px-3 py-2 text-xs dark:border-rule-dark dark:bg-surface-dark"
                    >
                      <option value="">Select an available volunteer</option>
                      {availableVolunteers.map((volunteer) => (
                        <option key={volunteer.id} value={volunteer.id}>
                          {volunteer.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void assignVolunteer(report)}
                      disabled={updatingReportId === report.id || availableVolunteers.length === 0}
                      className="rounded-control border border-action px-3 py-2 text-xs font-semibold text-action disabled:opacity-50"
                    >
                      {updatingReportId === report.id ? 'Assigning…' : 'Assign volunteer'}
                    </button>
                    {availableVolunteers.length === 0 && (
                      <p className="text-xs text-ink-muted sm:col-span-2">
                        No verified, available volunteers are currently eligible.
                      </p>
                    )}
                  </div>
                )}
                {canUpdateReport(report) && (
                  <div className="grid gap-2 border-t border-rule pt-3 dark:border-rule-dark sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                    <label className="sr-only" htmlFor={`report-status-${report.id}`}>Update report status</label>
                    <select
                      id={`report-status-${report.id}`}
                      name={`report-status-${report.id}`}
                      value={statusDrafts[report.id] ?? report.status}
                      onChange={(event) => setStatusDrafts((current) => ({
                        ...current,
                        [report.id]: event.target.value as EmergencyReport['status'],
                      }))}
                      disabled={nextStatusOptions(report).length === 0}
                      className="rounded-control border border-rule bg-surface px-3 py-2 text-xs dark:border-rule-dark dark:bg-surface-dark"
                    >
                      <option value={report.status}>{report.status_display}</option>
                      {nextStatusOptions(report).map((nextStatus) => (
                        <option key={nextStatus} value={nextStatus}>
                          {nextStatus.replace('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())}
                        </option>
                      ))}
                    </select>
                    <label className="sr-only" htmlFor={`report-response-${report.id}`}>Response notes</label>
                    <input
                      id={`report-response-${report.id}`}
                      name={`report-response-${report.id}`}
                      maxLength={2000}
                      value={responseDrafts[report.id] ?? report.response_notes ?? ''}
                      onChange={(event) => setResponseDrafts((current) => ({
                        ...current,
                        [report.id]: event.target.value,
                      }))}
                      placeholder="Response details (optional)"
                      className="min-w-0 rounded-control border border-rule bg-surface px-3 py-2 text-xs dark:border-rule-dark dark:bg-surface-dark"
                    />
                    <button
                      type="button"
                      onClick={() => void updateReportStatus(report)}
                      disabled={updatingReportId === report.id}
                      className="rounded-control bg-action px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {updatingReportId === report.id ? 'Updating…' : 'Save status'}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
