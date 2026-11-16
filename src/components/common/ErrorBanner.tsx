import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
  persistent?: boolean;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  onRetry,
  isRetrying = false,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`border-2 border-signal bg-signal-light dark:bg-signal-light-dark text-ink dark:text-ink-dark rounded-control p-3.5 my-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-overlay ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-5 h-5 text-signal shrink-0 mt-0.5" strokeWidth={2} />
        <div>
          <p className="text-sm font-semibold text-signal leading-tight">Action failed</p>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-control bg-signal text-white hover:bg-signal-hover disabled:opacity-50 transition-colors duration-150 self-end sm:self-auto shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          <span>{isRetrying ? 'Retrying...' : 'Tap to try again'}</span>
        </button>
      )}
    </div>
  );
};
