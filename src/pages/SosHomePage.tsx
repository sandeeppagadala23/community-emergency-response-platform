import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { EmergencyType, LocationData } from '../types/incident';
import { incidentService } from '../services/incidentService';
import { apiClient } from '../services/apiClient';
import { CategoryRadioGroup } from '../components/resident/CategoryRadioGroup';
import { LocationStatus } from '../components/resident/LocationStatus';
import { SosHoldButton } from '../components/resident/SosHoldButton';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { EmergencyCallBar } from '../components/resident/EmergencyCallBar';

export const SosHomePage: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<EmergencyType | null>(null);
  const [description, setDescription] = useState<string>('');
  const [manualLocation, setManualLocation] = useState<string>('');
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Geolocation State
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const isSubmittingRef = useRef(false);
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);

  // Request browser geolocation on mount
  const requestLocation = useCallback(() => {
    setIsGettingLocation(true);
    setLocationError(null);

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setIsGettingLocation(false);
      setLocationError('Geolocation not supported by device.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        const { latitude, longitude } = pos.coords;
        if (
          !Number.isFinite(latitude)
          || !Number.isFinite(longitude)
          || latitude < -90
          || latitude > 90
          || longitude < -180
          || longitude > 180
        ) {
          setLocation(null);
          setIsGettingLocation(false);
          setLocationError('GPS returned invalid coordinates. You can still submit an address or landmark.');
          return;
        }
        setLocation({
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          accuracy: pos.coords.accuracy || 12,
          captured_at: new Date().toISOString(),
        });
        setIsGettingLocation(false);
      },
      (err) => {
        if (!isMountedRef.current) return;
        setIsGettingLocation(false);
        setLocationError(err.message || 'Location permission denied.');
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 30000,
      }
    );
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    requestLocation();
    return () => {
      isMountedRef.current = false;
    };
  }, [requestLocation]);

  // SOS Trigger Handler
  const handleTriggerSos = async () => {
    setCategoryError(null);
    setSubmissionError(null);

    // If no category selected, prompt inline without blocking emergency
    if (!selectedCategory) {
      setCategoryError('Please tap an emergency category above.');
      // Auto-focus category section
      const catElem = document.getElementById('category-group-label');
      catElem?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // PRD Requirement: Request body contains ONLY emergency_type, description, and location fields.
      // NEVER send a resident ID.
      const payload = {
        emergency_type: selectedCategory,
        description: description.trim() || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        accuracy: location?.accuracy ?? undefined,
        location_captured_at: location?.captured_at,
        location_text: location ? undefined : manualLocation.trim() || undefined,
      };

      const signature = JSON.stringify(payload);
      if (idempotencyRef.current?.signature !== signature) {
        idempotencyRef.current = {
          signature,
          key: crypto.randomUUID(),
        };
      }
      const res = await incidentService.createSos(
        payload,
        idempotencyRef.current.key,
      );
      // Immediately navigate to active status
      navigate(`/sos/active/${res.incident.id}`);
    } catch (err: unknown) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      // PRD Requirement: Persistent high-contrast banner "Alert not sent. Tap to try again."
      setSubmissionError(
        apiClient.normalizeError(err).message
          || 'Alert not sent due to connection failure. Tap to try again.',
      );
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Resident Context Header */}
      <div className="flex flex-col gap-2 border-b border-rule pb-3 dark:border-rule-dark sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-ink dark:text-ink-dark">
            Emergency SOS
          </h1>
          <p className="text-sm font-medium text-ink-muted dark:text-ink-muted-dark mt-0.5">
            {user?.name} · Flat {user?.flat} · {user?.society.split(',')[0]}
          </p>
        </div>
        <Link
          to="/reports"
          className="inline-flex w-fit items-center justify-center rounded-control border border-action px-3 py-2 text-xs font-semibold text-action transition-colors hover:bg-action hover:text-white dark:text-teal-400"
        >
          Raise Complaint / Report Emergency
        </Link>
      </div>

      {/* Persistent Network Failure Banner */}
      {submissionError && (
        <ErrorBanner
          message={submissionError}
          onRetry={handleTriggerSos}
          isRetrying={isSubmitting}
        />
      )}

      {/* Emergency Category Selector */}
      <section aria-labelledby="category-group-label">
        <CategoryRadioGroup
          selected={selectedCategory}
          onSelect={(cat) => {
            setSelectedCategory(cat);
            setCategoryError(null);
          }}
          error={categoryError || undefined}
          disabled={isSubmitting}
        />
      </section>

      {/* Optional Message Field */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="sos-note"
            className="block text-xs font-semibold text-ink dark:text-ink-dark"
          >
            {t('addNoteOptional')}
          </label>
          <span className="font-mono text-[11px] text-ink-muted dark:text-ink-muted-dark">
            {description.length}/200
          </span>
        </div>
        <textarea
          id="sos-note"
          rows={2}
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSubmitting}
          placeholder="E.g. In living room, door unlatched, need wheelchair..."
          className="w-full p-2.5 text-sm rounded-control border border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-action resize-none"
        />
      </div>

      {/* Location Status Line */}
      <section aria-label="Device Location Status">
        <LocationStatus
          location={location}
          isLoading={isGettingLocation}
          error={locationError}
          onRetry={requestLocation}
        />
      </section>

      {!location && !isGettingLocation && (
        <label
          htmlFor="sos-manual-location"
          className="block space-y-1 text-xs font-semibold text-ink dark:text-ink-dark"
        >
          Address or landmark (if GPS is unavailable)
          <input
            id="sos-manual-location"
            type="text"
            maxLength={255}
            value={manualLocation}
            onChange={(event) => setManualLocation(event.target.value)}
            disabled={isSubmitting}
            placeholder={user?.flat && user.flat !== 'Not assigned' ? user.flat : 'Building, flat, entrance, or nearby landmark'}
            className="w-full rounded-control border border-rule bg-surface px-3 py-2 text-sm font-normal text-ink dark:border-rule-dark dark:bg-surface-dark dark:text-ink-dark"
          />
          <span className="block font-normal text-ink-muted dark:text-ink-muted-dark">
            GPS coordinates are still preferred. This text helps responders find you if location access is unavailable.
          </span>
        </label>
      )}

      {/* Central Hold-to-Send SOS Button */}
      <section aria-label="SOS Alert Trigger" className="pt-2">
        <SosHoldButton
          onTrigger={handleTriggerSos}
          isSubmitting={isSubmitting}
          disabled={false}
        />
      </section>

      {/* Persistent Call 112 Bar */}
      <EmergencyCallBar />
    </div>
  );
};
