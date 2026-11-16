import React, { useState } from 'react';
import { MapPin, AlertCircle, RefreshCw, Info } from 'lucide-react';
import { LocationData } from '../../types/incident';

interface LocationStatusProps {
  location: LocationData | null;
  isLoading: boolean;
  error?: string | null;
  onRetry: () => void;
}

export const LocationStatus: React.FC<LocationStatusProps> = ({
  location,
  isLoading,
  error,
  onRetry,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs py-2 px-3 rounded-control border border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark">
        <div className="flex items-center gap-2 overflow-hidden">
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 text-action dark:text-teal-400 animate-spin shrink-0" />
              <span className="text-ink-muted dark:text-ink-muted-dark">Getting location…</span>
            </>
          ) : location ? (
            <>
              <MapPin className="w-4 h-4 text-ok shrink-0" />
              <span className="text-ink dark:text-ink-dark font-medium">
                {location.accuracy != null
                  ? `Location ready (accuracy about ${Math.round(location.accuracy)} m)`
                  : 'Location ready'}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-warn-text dark:text-warn-text-dark shrink-0" />
              <span className="text-warn-text dark:text-warn-text-dark font-medium truncate">
                Location unavailable. Alert can still be sent.
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!location && !isLoading && (
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="text-action dark:text-teal-400 font-medium underline underline-offset-2 hover:text-action-hover focus-visible:outline-none"
            >
              Turn on location
            </button>
          )}
          {location && (
            <button
              type="button"
              onClick={onRetry}
              title="Refresh GPS location"
              className="p-1 text-ink-muted hover:text-ink focus-visible:outline-none"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {error && !isLoading && !location && (
        <p role="status" className="mt-1 text-xs text-warn-text dark:text-warn-text-dark">
          {error}
        </p>
      )}

      {/* Help Dialog Modal */}
      {showHelp && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-help-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel p-5 max-w-sm w-full shadow-modal">
            <div className="flex items-start gap-2.5 mb-3">
              <Info className="w-5 h-5 text-action dark:text-teal-400 shrink-0 mt-0.5" />
              <div>
                <h3 id="location-help-title" className="font-serif font-bold text-base text-ink dark:text-ink-dark">
                  How to enable location
                </h3>
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
                  Accurate GPS helps guards locate your apartment or outdoor spot quickly.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-ink-muted dark:text-ink-muted-dark bg-stone-50 dark:bg-stone-900 p-3 rounded-control my-3 border border-rule dark:border-rule-dark">
              <p>1. Open your browser address bar (tap the lock or tune icon).</p>
              <p>2. Set <strong>Location</strong> permissions to <strong>Allow</strong>.</p>
              <p>3. Ensure GPS / Location is switched on in your phone's quick settings.</p>
            </div>

            <p className="text-xs text-ink-muted dark:text-ink-muted-dark italic mb-4">
              If GPS is unavailable, you can still submit an address or landmark. A registered flat is used when available.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowHelp(false);
                  onRetry();
                }}
                className="flex-1 py-2 bg-action text-white rounded-control text-xs font-semibold hover:bg-action-hover transition-colors"
              >
                Try getting location again
              </button>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="py-2 px-3 border border-rule dark:border-rule-dark text-ink dark:text-ink-dark rounded-control text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
