import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { incidentService } from '../services/incidentService';
import { apiClient } from '../services/apiClient';
import { IncidentDetail } from '../types/incident';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatIstTime } from '../utils/dateUtils';
import { SkeletonRow } from '../components/common/Skeleton';
import { PermissionDenied } from '../components/common/PermissionDenied';
import { NotFound } from '../components/common/NotFound';
import {
  MapPin,
  ExternalLink,
  Bell,
  ArrowLeft,
  Copy,
  Check,
  Lock,
  Save,
} from 'lucide-react';

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [responders, setResponders] = useState<
    Awaited<ReturnType<typeof incidentService.getAvailableResponders>>
  >([]);
  const [selectedResponderId, setSelectedResponderId] = useState('');
  const [selectedArrivalAssignmentId, setSelectedArrivalAssignmentId] = useState('');
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [isWorkflowLoading, setIsWorkflowLoading] = useState(false);
  const [locationDraft, setLocationDraft] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const refreshIncident = async () => {
    if (!id) return;
    setIncident(await incidentService.getIncidentById(id));
  };

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      if (!id) return;
      try {
        const data = await incidentService.getIncidentById(id);
        if (isMounted) {
          setIncident(data);
          setLocationDraft(data.location_text ?? '');
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setErrorStatus(apiClient.normalizeError(err).status || 500);
          setIsLoading(false);
        }
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (role !== 'SECURITY' && role !== 'ADMIN') return;
    incidentService
      .getAvailableResponders()
      .then(setResponders)
      .catch((error: unknown) => {
        setWorkflowError(apiClient.normalizeError(error).message);
      });
  }, [role]);

  const handleAssignResponder = async () => {
    if (!id || !selectedResponderId) return;
    setIsWorkflowLoading(true);
    setWorkflowError(null);
    setWorkflowMessage(null);
    try {
      await incidentService.assignResponder(id, Number(selectedResponderId));
      await refreshIncident();
      setSelectedResponderId('');
      setWorkflowMessage('Responder assigned to this incident.');
    } catch (error) {
      setWorkflowError(apiClient.normalizeError(error).message);
    } finally {
      setIsWorkflowLoading(false);
    }
  };

  const handleResponderCheckIn = async () => {
    if (!id) return;

    setIsWorkflowLoading(true);
    setWorkflowError(null);
    setWorkflowMessage(null);
    try {
      await incidentService.checkInResponder(id);
      await refreshIncident();
      setWorkflowMessage(
        'Arrival reported. Security or an administrator must confirm before the response starts.',
      );
    } catch (error) {
      setWorkflowError(apiClient.normalizeError(error).message);
    } finally {
      setIsWorkflowLoading(false);
    }
  };

  const handleResidentAcknowledgment = async () => {
    if (!id) return;
    setIsWorkflowLoading(true);
    setWorkflowError(null);
    try {
      await incidentService.acknowledgeArrival(id);
      await refreshIncident();
      setWorkflowMessage('You confirmed that a responder arrived.');
    } catch (error) {
      setWorkflowError(apiClient.normalizeError(error).message);
    } finally {
      setIsWorkflowLoading(false);
    }
  };

  const handleArrivalConfirmation = async (assignmentId: number) => {
    if (!id) return;
    setIsWorkflowLoading(true);
    setWorkflowError(null);
    setWorkflowMessage(null);
    try {
      await incidentService.confirmResponderArrival(id, assignmentId);
      await refreshIncident();
      setWorkflowMessage('Responder arrival independently confirmed.');
    } catch (error) {
      setWorkflowError(apiClient.normalizeError(error).message);
    } finally {
      setIsWorkflowLoading(false);
    }
  };

  const handleStatusTransition = async (
    targetStatus: 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED',
    assignmentId?: number,
  ) => {
    if (!id) return;
    setIsWorkflowLoading(true);
    setWorkflowError(null);
    setWorkflowMessage(null);
    try {
      await incidentService.transitionIncident(id, targetStatus, assignmentId);
      await refreshIncident();
      setWorkflowMessage(`Incident status updated to ${targetStatus.replace('_', ' ').toLowerCase()}.`);
    } catch (error) {
      setWorkflowError(apiClient.normalizeError(error).message);
    } finally {
      setIsWorkflowLoading(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!id || !locationDraft.trim()) {
      setWorkflowError('Enter an address or landmark before saving.');
      return;
    }
    setIsSavingLocation(true);
    setWorkflowError(null);
    setWorkflowMessage(null);
    try {
      const updated = await incidentService.updateIncidentLocation(id, locationDraft);
      setIncident((current) =>
        current ? { ...current, location_text: updated.location_text } : current,
      );
      setLocationDraft(updated.location_text);
      setWorkflowMessage('Location description saved.');
    } catch (error: unknown) {
      setWorkflowError(apiClient.normalizeError(error).message);
    } finally {
      setIsSavingLocation(false);
    }
  };

  const copyId = () => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (errorStatus === 403) {
    return (
      <PermissionDenied
        backTo={role === 'RESIDENT' ? '/my-incidents' : '/incidents'}
        backLabel={role === 'RESIDENT' ? 'Back to my incidents' : 'Back to incidents board'}
      />
    );
  }

  if (errorStatus === 404) {
    return (
      <NotFound
        backTo={role === 'RESIDENT' ? '/my-incidents' : '/incidents'}
        backLabel="Back to incidents"
      />
    );
  }

  if (isLoading || !incident) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <SkeletonRow count={4} heightClass="h-24" />
      </div>
    );
  }

  const isDesk = role === 'SECURITY' || role === 'ADMIN';
  const hasResponderPanel =
    isDesk || incident.assignments.length > 0 || incident.can_check_in;
  const canVolunteerResolve =
    role === 'VOLUNTEER'
    && Boolean(incident.my_assignment?.checked_in_at)
    && incident.my_assignment?.arrival_confirmation?.confirmation_result === 'CONFIRMED'
    && incident.status === 'IN_PROGRESS';
  const confirmedAssignments = incident.assignments.filter(
    (assignment) => assignment.arrival_confirmation?.confirmation_result === 'CONFIRMED',
  );
  const selectedArrivalAssignment = confirmedAssignments.find(
    (assignment) => `${id}:${assignment.id}` === selectedArrivalAssignmentId,
  );
  const canUpdateResponseStatus = isDesk || canVolunteerResolve;
  const nextStatus = isDesk
    ? incident.status === 'OPEN'
      ? 'ACKNOWLEDGED'
      : incident.status === 'ACKNOWLEDGED'
        ? 'IN_PROGRESS'
        : incident.status === 'IN_PROGRESS'
          ? 'RESOLVED'
          : null
    : canVolunteerResolve
      ? 'RESOLVED'
      : null;
  const nextStatusLabel = {
    ACKNOWLEDGED: 'Acknowledge alert',
    IN_PROGRESS: 'Start response',
    RESOLVED: 'Mark resolved',
  } as const;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back Link */}
      <div>
        <Link
          to={role === 'RESIDENT' ? '/my-incidents' : '/incidents'}
          className="inline-flex items-center gap-1 text-xs font-semibold text-action dark:text-teal-400 hover:text-action-hover"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{role === 'RESIDENT' ? 'Back to my alerts' : 'Back to incident board'}</span>
        </Link>
      </div>

      {/* Header Banner */}
      <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-ink dark:text-ink-dark">
              {incident.emergency_type} Emergency
            </h1>
            <StatusBadge status={incident.status} type="incident" />
          </div>

          {/* Security / Admin Link to Notification Log */}
          {isDesk && (
            <Link
              to={`/incidents/${incident.id}/notifications`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control bg-action text-white hover:bg-action-hover transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notification Dispatch Log & Retry</span>
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-ink-muted dark:text-ink-muted-dark border-t border-rule dark:border-rule-dark pt-2.5">
          <div className="flex items-center gap-1">
            <span>ID:</span>
            <span className="font-semibold text-ink dark:text-ink-dark">{incident.id}</span>
            <button
              onClick={copyId}
              title="Copy ID"
              className="p-0.5 hover:text-ink focus-visible:outline-none"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <span>•</span>
          <span>Raised: {formatIstTime(incident.created_at, isDesk ? '24h' : '12h')}</span>
          {incident.resolved_at && (
            <>
              <span>•</span>
              <span className="text-ok font-semibold">
                Resolved: {formatIstTime(incident.resolved_at, isDesk ? '24h' : '12h')}
              </span>
            </>
          )}
        </div>
      </div>

      {hasResponderPanel && (
        <section className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 shadow-sm space-y-3">
          <div>
            <h2 className="text-xs font-mono uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark font-bold">
              Responder assignment and arrival
            </h2>
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
              Arrival reports are self-reported. Security or an administrator must confirm before starting the response.
            </p>
          </div>

          {incident.assignments.length > 0 ? (
            <ul className="space-y-2 text-xs">
              {incident.assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-rule dark:border-rule-dark p-2.5"
                >
                  <span className="font-semibold text-ink dark:text-ink-dark">
                    {assignment.responder_name} · {assignment.responder_role}
                  </span>
                  <span className="text-ink-muted dark:text-ink-muted-dark">
                    {assignment.checked_in_at
                      ? assignment.arrival_confirmation
                        ? `Independently confirmed by ${assignment.arrival_confirmation.confirmed_by_name} at ${formatIstTime(assignment.arrival_confirmation.confirmed_at, isDesk ? '24h' : '12h')}`
                        : incident.status === 'IN_PROGRESS'
                          ? `Arrival reported at ${formatIstTime(assignment.checked_in_at, isDesk ? '24h' : '12h')} · no independent confirmation on record`
                          : `Arrival reported · awaiting independent confirmation (${formatIstTime(assignment.checked_in_at, isDesk ? '24h' : '12h')})`
                      : incident.status === 'OPEN'
                        ? 'Assigned · waiting for security acknowledgement'
                        : incident.status === 'ACKNOWLEDGED'
                          ? 'Assigned · ready to report arrival'
                          : incident.status === 'IN_PROGRESS'
                              ? 'Response in progress'
                            : 'Incident no longer accepts arrival reports'}
                  </span>
                  {isDesk &&
                    incident.status === 'ACKNOWLEDGED' &&
                    assignment.checked_in_at &&
                    !assignment.arrival_confirmation && (
                      <button
                        type="button"
                        onClick={() => void handleArrivalConfirmation(assignment.id)}
                        disabled={isWorkflowLoading}
                        className="rounded-control bg-action px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {isWorkflowLoading ? 'Confirming…' : `Confirm ${assignment.responder_name} arrived`}
                      </button>
                    )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
              No responders have been assigned yet.
            </p>
          )}

          {canUpdateResponseStatus && (
            <section className="rounded-panel border border-rule bg-surface p-4 shadow-sm dark:border-rule-dark dark:bg-surface-dark">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark">
                    Response status
                  </h2>
                  <p className="mt-1 text-xs text-ink-muted dark:text-ink-muted-dark">
                    {isDesk
                      ? 'Follow the incident workflow: active, acknowledged, in progress, then resolved.'
                      : 'You can resolve this incident because your arrival was independently confirmed.'}
                    {incident.acknowledged_by_name
                      ? ` Acknowledged by ${incident.acknowledged_by_name}.`
                      : ''}
                    {incident.resolved_by_name
                      ? ` Resolved by ${incident.resolved_by_name}.`
                      : ''}
                  </p>
                </div>
                {nextStatus && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleStatusTransition(
                        nextStatus,
                        nextStatus === 'IN_PROGRESS'
                          ? selectedArrivalAssignment?.id
                          : undefined,
                      )
                    }
                    disabled={
                      isWorkflowLoading ||
                      (nextStatus === 'IN_PROGRESS' && !selectedArrivalAssignment)
                    }
                    className="shrink-0 rounded-control bg-action px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isWorkflowLoading ? 'Updating…' : nextStatusLabel[nextStatus]}
                  </button>
                )}
              </div>
              {isDesk && nextStatus === 'IN_PROGRESS' && (
                <div className="mt-2 space-y-2">
                  {confirmedAssignments.length > 0 ? (
                    <label className="block text-xs text-ink-muted dark:text-ink-muted-dark">
                      Start the response for an independently confirmed responder
                      <select
                        id="arrival-responder-select"
                        name="arrival-responder-select"
                        aria-label="Select independently confirmed responder"
                        value={selectedArrivalAssignmentId}
                        onChange={(event) => setSelectedArrivalAssignmentId(event.target.value)}
                        className="mt-1 min-h-11 w-full rounded-control border border-rule bg-paper px-3 py-2 text-xs text-ink dark:border-rule-dark dark:bg-paper-dark dark:text-ink-dark"
                      >
                        <option value="">Select confirmed responder</option>
                        {confirmedAssignments.map((assignment) => (
                          <option
                            key={assignment.id}
                            value={`${id}:${assignment.id}`}
                          >
                            {assignment.responder_name} · confirmed by{' '}
                            {assignment.arrival_confirmation?.confirmed_by_name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                      A responder’s arrival must be independently confirmed before the response can start.
                    </p>
                  )}
                </div>
              )}
              {incident.resolved_at && (
                <p className="mt-2 text-xs text-ok">
                  Resolved {formatIstTime(incident.resolved_at, isDesk ? '24h' : '12h')}.
                </p>
              )}
              {!hasResponderPanel && workflowError && (
                <p role="alert" className="mt-2 text-xs font-medium text-signal">
                  {workflowError}
                </p>
              )}
              {!hasResponderPanel && workflowMessage && (
                <p role="status" className="mt-2 text-xs font-medium text-ok">
                  {workflowMessage}
                </p>
              )}
            </section>
          )}

          {isDesk && incident.status !== 'RESOLVED' && incident.status !== 'CLOSED' && (
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                id="assign-responder-select"
                name="assign-responder-select"
                aria-label="Choose responder"
                value={selectedResponderId}
                onChange={(event) => setSelectedResponderId(event.target.value)}
                className="min-w-0 flex-1 rounded-control border border-rule dark:border-rule-dark bg-paper dark:bg-paper-dark px-3 py-2 text-xs text-ink dark:text-ink-dark"
              >
                <option value="">Select Security or Volunteer</option>
                {responders
                  .filter(
                    (responder) =>
                      !incident.assignments.some(
                        (assignment) => assignment.responder_id === responder.id,
                      ),
                  )
                  .map((responder) => (
                    <option key={responder.id} value={responder.id}>
                      {responder.name} · {responder.role}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleAssignResponder}
                disabled={!selectedResponderId || isWorkflowLoading}
                className="rounded-control bg-action px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                Assign responder
              </button>
            </div>
          )}

          {incident.can_check_in && incident.my_assignment && !incident.my_assignment.checked_in_at && (
            <button
              type="button"
              onClick={handleResponderCheckIn}
              disabled={isWorkflowLoading || incident.status === 'RESOLVED' || incident.status === 'CLOSED'}
              className="rounded-control bg-action px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isWorkflowLoading ? 'Reporting arrival…' : 'Report arrival'}
            </button>
          )}

          {workflowError && (
            <p role="alert" className="text-xs font-medium text-signal">
              {workflowError}
            </p>
          )}
          {workflowMessage && (
            <p role="status" className="text-xs font-medium text-ok">
              {workflowMessage}
            </p>
          )}
        </section>
      )}

      {/* Two Column Layout on Desktop, Single Column on Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left Column: Resident Info & Resident Note */}
        <div className="space-y-4">
          <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark font-bold">
              Resident & Apartment Information
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-rule/50 dark:border-rule-dark/50">
                <span className="text-ink-muted">Resident Name:</span>
                <span className="font-semibold text-ink dark:text-ink-dark">
                  {incident.resident_name || 'Restricted for role'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-rule/50 dark:border-rule-dark/50">
                <span className="text-ink-muted">Flat Number:</span>
                <span className="font-mono font-semibold text-ink dark:text-ink-dark">
                  {incident.resident_flat || 'Restricted'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-rule/50 dark:border-rule-dark/50">
                <span className="text-ink-muted">Initiated By:</span>
                <span className="font-mono text-ink dark:text-ink-dark">
                  {incident.created_by_role}
                </span>
              </div>
            </div>

            {/* Note from resident */}
            <div className="pt-2">
              <span className="block text-xs font-semibold text-ink dark:text-ink-dark mb-1">
                Resident's Attached Note:
              </span>
              <div className="p-3 bg-stone-50 dark:bg-stone-900 border border-rule dark:border-rule-dark rounded-control text-xs text-ink dark:text-ink-dark italic">
                {incident.description ? `"${incident.description}"` : 'No note was attached.'}
              </div>
            </div>
          </div>

          {/* Compact Notification Dispatch Status */}
          {incident.notifications_summary && (
            <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 shadow-sm space-y-2">
              <h2 className="text-xs font-mono uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark font-bold">
                Emergency Routing Summary
              </h2>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded bg-ok-light dark:bg-ok-light-dark border border-ok/30">
                  <div className="font-mono text-base font-bold text-ok">
                    {incident.notifications_summary.delivered}
                  </div>
                  <div className="text-[11px] text-ok font-semibold">Read</div>
                </div>
                <div className="p-2 rounded bg-action-light dark:bg-action-light-dark border border-action/30">
                  <div className="font-mono text-base font-bold text-action dark:text-teal-400">
                    {incident.notifications_summary.sent}
                  </div>
                  <div className="text-[11px] text-action dark:text-teal-400 font-semibold">Inbox</div>
                </div>
                <div className="p-2 rounded bg-signal-light dark:bg-signal-light-dark border border-signal/30">
                  <div className="font-mono text-base font-bold text-signal">
                    {incident.notifications_summary.failed}
                  </div>
                  <div className="text-[11px] text-signal font-semibold">Failed</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Location Block & Timeline */}
        <div className="space-y-4">
          {/* Location Block */}
          <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark font-bold flex items-center justify-between">
              <span>Location Data</span>
              <MapPin className="w-3.5 h-3.5 text-ink-muted" />
            </h2>

            {incident.location_restricted ? (
              <div className="p-3 bg-stone-100 dark:bg-stone-900 border border-rule dark:border-rule-dark rounded-control text-xs flex items-center gap-2 text-ink-muted">
                <Lock className="w-4 h-4 text-ink-muted shrink-0" />
                <span>Precise location is restricted for your role.</span>
              </div>
            ) : incident.location ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-rule/50 dark:border-rule-dark/50">
                  <span className="text-ink-muted">Coordinates:</span>
                  <span className="font-mono font-semibold text-ink dark:text-ink-dark">
                    {incident.location.latitude.toFixed(5)}, {incident.location.longitude.toFixed(5)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-rule/50 dark:border-rule-dark/50">
                  <span className="text-ink-muted">Accuracy:</span>
                  <span className="font-mono text-ink dark:text-ink-dark">
                    {incident.location.accuracy != null
                      ? `About ${Math.round(incident.location.accuracy)} meters`
                      : 'Not recorded'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-rule/50 dark:border-rule-dark/50">
                  <span className="text-ink-muted">Captured At:</span>
                  <span className="font-mono text-ink dark:text-ink-dark">
                    {formatIstTime(incident.location.captured_at, isDesk ? '24h' : '12h')}
                  </span>
                </div>

                <div className="pt-2">
                  <a
                    href={`https://www.google.com/maps?q=${incident.location.latitude},${incident.location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control border border-action text-action hover:bg-action hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Google Maps</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {incident.location_text ? (
                  <div className="rounded-control border border-rule bg-stone-50 p-3 text-xs text-ink dark:border-rule-dark dark:bg-stone-900 dark:text-ink-dark">
                    <p className="font-semibold">Address or landmark (not GPS)</p>
                    <p className="mt-1 whitespace-pre-wrap">{incident.location_text}</p>
                    <p className="mt-2 text-[11px] text-ink-muted dark:text-ink-muted-dark">
                      GPS coordinates were not available when this alert was submitted.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-control border border-rule bg-stone-50 p-3 text-xs text-ink-muted dark:border-rule-dark dark:bg-stone-900">
                    No GPS or address was included with this alert. Add an address or nearby landmark below.
                  </p>
                )}
                {workflowError && (
                  <p role="alert" className="text-xs font-medium text-signal">
                    {workflowError}
                  </p>
                )}
                {workflowMessage && (
                  <p role="status" className="text-xs font-medium text-ok">
                    {workflowMessage}
                  </p>
                )}
                {(isDesk || incident.is_reporter) && (
                  <div className="space-y-2">
                    <label
                      htmlFor="incident-location-description"
                      className="block text-xs font-semibold text-ink dark:text-ink-dark"
                    >
                      {incident.location_text ? 'Update address or landmark' : 'Add address or landmark'}
                      <input
                        id="incident-location-description"
                        type="text"
                        maxLength={255}
                        value={locationDraft}
                        onChange={(event) => setLocationDraft(event.target.value)}
                        disabled={isSavingLocation}
                        placeholder="Building, flat, entrance, or nearby landmark"
                        className="mt-1 w-full rounded-control border border-rule bg-surface px-3 py-2 text-xs font-normal dark:border-rule-dark dark:bg-surface-dark"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleSaveLocation()}
                      disabled={isSavingLocation || !locationDraft.trim()}
                      className="inline-flex items-center gap-1.5 rounded-control border border-action px-3 py-2 text-xs font-semibold text-action disabled:opacity-50 dark:text-teal-400"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {isSavingLocation ? 'Saving location…' : 'Save location'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 shadow-sm space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark font-bold">
              Incident Audit Timeline
            </h2>

            <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-rule dark:before:bg-rule-dark pl-5">
              {incident.timeline.map((entry) => (
                <div key={entry.id} className="relative">
                  <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-action" />
                  <div className="text-xs font-semibold text-ink dark:text-ink-dark">
                    {entry.event}
                  </div>
                  <div className="text-[11px] text-ink-muted dark:text-ink-muted-dark">
                    {entry.description}
                  </div>
                  <div className="text-[10px] font-mono text-ink-muted/80 mt-0.5">
                    {formatIstTime(entry.timestamp, isDesk ? '24h' : '12h')}
                    {entry.actor_role && ` · ${entry.actor_role}`}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-dashed border-rule dark:border-rule-dark">
              <h3 className="text-xs font-semibold text-ink dark:text-ink-dark">
                Resident acknowledgment
              </h3>
              {incident.resident_acknowledged_at ? (
                <p className="mt-1 text-[11px] text-ok">
                  Resident confirmed responder arrival at{' '}
                  {formatIstTime(incident.resident_acknowledged_at, isDesk ? '24h' : '12h')}.
                </p>
              ) : incident.assignments.some((assignment) => assignment.checked_in_at) ? (
                <p className="mt-1 text-[11px] text-ink-muted dark:text-ink-muted-dark">
                  An assigned responder reported arrival. Waiting for the resident to confirm.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-ink-muted dark:text-ink-muted-dark">
                  The resident can confirm arrival after an assigned responder reports it.
                </p>
              )}
              {incident.is_reporter &&
                !incident.resident_acknowledged_at &&
                incident.assignments.some((assignment) => assignment.checked_in_at) && (
                  <button
                    type="button"
                    onClick={handleResidentAcknowledgment}
                    disabled={isWorkflowLoading}
                    className="mt-2 rounded-control bg-action px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Confirm responder arrived
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
