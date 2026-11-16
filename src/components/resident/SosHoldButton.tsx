import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, Check } from 'lucide-react';

interface SosHoldButtonProps {
  onTrigger: () => void;
  isSubmitting?: boolean;
  disabled?: boolean;
  holdDurationMs?: number;
}

export const SosHoldButton: React.FC<SosHoldButtonProps> = ({
  onTrigger,
  isSubmitting = false,
  disabled = false,
  holdDurationMs = 1500, // 1.5s requirement
}) => {
  const [progress, setProgress] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [showAccessibleDialog, setShowAccessibleDialog] = useState<boolean>(false);

  const holdActiveRef = useRef<boolean>(false);
  const holdStartedAtRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancelHold = useCallback(() => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    holdTimeoutRef.current = null;
    progressIntervalRef.current = null;
    holdStartedAtRef.current = null;
    holdActiveRef.current = false;
    setIsHolding(false);
    setProgress(0);
  }, []);

  const triggerSos = useCallback(() => {
    if (!holdActiveRef.current || isSubmitting || disabled) return;
    cancelHold();

    // Haptic vibration if supported (pattern: short, short, long)
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate([60, 50, 150]);
      } catch {
        // ignore
      }
    }

    onTrigger();
  }, [cancelHold, disabled, isSubmitting, onTrigger]);

  const startHold = useCallback(
    (e: React.SyntheticEvent) => {
      if (disabled || isSubmitting || holdActiveRef.current) return;
      if ('button' in e && e.button !== 0) return;
      e.preventDefault();

      holdActiveRef.current = true;
      holdStartedAtRef.current = Date.now();
      setIsHolding(true);
      setProgress(0);
      progressIntervalRef.current = setInterval(() => {
        if (holdStartedAtRef.current === null) return;
        setProgress(Math.min(100, ((Date.now() - holdStartedAtRef.current) / holdDurationMs) * 100));
      }, 16);
      holdTimeoutRef.current = setTimeout(triggerSos, holdDurationMs);

      if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
        try {
          navigator.vibrate(40);
        } catch {
          // ignore
        }
      }
    },
    [disabled, holdDurationMs, isSubmitting, triggerSos]
  );

  useEffect(() => {
    if (!isHolding) return;

    const handlePointerRelease = () => cancelHold();
    const handleKeyRelease = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') cancelHold();
    };

    window.addEventListener('pointerup', handlePointerRelease);
    window.addEventListener('pointercancel', handlePointerRelease);
    window.addEventListener('keyup', handleKeyRelease);
    window.addEventListener('blur', handlePointerRelease);
    return () => {
      window.removeEventListener('pointerup', handlePointerRelease);
      window.removeEventListener('pointercancel', handlePointerRelease);
      window.removeEventListener('keyup', handleKeyRelease);
      window.removeEventListener('blur', handlePointerRelease);
    };
  }, [cancelHold, isHolding]);

  useEffect(
    () => () => {
      if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    },
    [],
  );

  // SVG calculations for the hold-to-send filling ring
  const size = 160;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center select-none py-4">
      <div className="relative flex items-center justify-center">
        {/* SVG Progress Ring */}
        <svg
          className="w-[172px] h-[172px] -rotate-90 transform pointer-events-none"
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
        >
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-rule dark:stroke-rule-dark"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Active Fill Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="stroke-signal transition-all duration-75 ease-linear"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>

        {/* SOS Primary Button */}
        <button
          type="button"
          data-testid="sos-hold-button"
          aria-label="Emergency SOS button. Press and hold for 1.5 seconds to send alert."
          aria-pressed={isHolding}
          aria-busy={isSubmitting}
          disabled={disabled || isSubmitting}
          onPointerDown={startHold}
          onKeyDown={(event) => {
            if ((event.key === ' ' || event.key === 'Enter') && !holdActiveRef.current) {
              startHold(event);
            }
          }}
          className={`absolute w-[140px] h-[140px] touch-none select-none rounded-full flex flex-col items-center justify-center font-bold text-white shadow-lg transition-transform duration-100 ease-out active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
            isHolding ? 'bg-signal-hover scale-95 ring-4 ring-signal/30' : 'bg-signal hover:bg-signal-hover'
          } focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action`}
        >
          {isSubmitting ? (
            <div className="flex flex-col items-center gap-1">
              <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span className="text-xs uppercase tracking-wider font-semibold">Sending…</span>
            </div>
          ) : (
            <>
              <span className="text-2xl font-black tracking-wider">SOS</span>
              <span className="text-[11px] font-medium tracking-normal text-white/90 mt-0.5 text-center px-2 leading-tight">
                {isHolding ? 'Keep holding…' : 'Hold 1.5s'}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Accessible instruction & screen-reader alternative */}
      <div className="mt-4 text-center">
        <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
          {isHolding
            ? 'Release to cancel'
            : 'Hold for 1.5 seconds to prevent accidental alerts'}
        </p>

        {/* Screen Reader & Mobility Assistance Dialog Trigger */}
        <button
          type="button"
          onClick={() => setShowAccessibleDialog(true)}
          className="mt-2 text-xs text-action dark:text-teal-400 underline underline-offset-2 hover:text-action-hover focus-visible:outline-none"
        >
          Can't hold? Tap for one-click confirmation
        </button>
      </div>

      {/* Accessible Confirmation Dialog Modal */}
      {showAccessibleDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-sos-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-surface dark:bg-surface-dark border-2 border-signal rounded-panel p-6 max-w-sm w-full shadow-modal">
            <div className="flex items-center gap-2 text-signal mb-2">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 id="dialog-sos-title" className="font-serif font-bold text-lg text-ink dark:text-ink-dark">
                Confirm Emergency SOS
              </h3>
            </div>
            <p className="text-sm text-ink-muted dark:text-ink-muted-dark mb-6">
              This will immediately notify building security, floor marshals, and your registered guardian.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAccessibleDialog(false);
                  onTrigger();
                }}
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-signal text-white rounded-control font-bold text-sm hover:bg-signal-hover transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Confirm and Send SOS</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAccessibleDialog(false)}
                className="w-full py-2.5 px-4 bg-stone-100 dark:bg-stone-800 text-ink dark:text-ink-dark rounded-control text-xs font-medium hover:bg-stone-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
