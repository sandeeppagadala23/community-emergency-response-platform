import React from 'react';

interface EmptyStateProps {
  message: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`border border-dashed border-rule dark:border-rule-dark rounded-panel p-8 text-center bg-surface/50 dark:bg-surface-dark/50 my-4 ${className}`}
    >
      <p className="text-ink-muted dark:text-ink-muted-dark text-sm max-w-md mx-auto">
        {message}
      </p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-3 inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-medium rounded-control border border-action text-action hover:bg-action hover:text-white transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
