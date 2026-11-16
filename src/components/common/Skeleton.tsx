import React from 'react';

export const SkeletonRow: React.FC<{ count?: number; heightClass?: string }> = ({
  count = 3,
  heightClass = 'h-12',
}) => {
  return (
    <div className="space-y-3 w-full" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`w-full ${heightClass} bg-stone-200/70 dark:bg-stone-800/60 rounded-control animate-pulse`}
        />
      ))}
    </div>
  );
};

export const SkeletonTable: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full border border-rule dark:border-rule-dark rounded-control overflow-hidden bg-surface dark:bg-surface-dark p-4 space-y-4">
      <div className="h-6 w-1/4 bg-stone-200/80 dark:bg-stone-800 animate-pulse rounded" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-10 w-full bg-stone-100 dark:bg-stone-800/40 rounded flex items-center justify-between px-3"
          >
            <div className="h-4 w-24 bg-stone-200 dark:bg-stone-700 rounded animate-pulse" />
            <div className="h-4 w-32 bg-stone-200 dark:bg-stone-700 rounded animate-pulse" />
            <div className="h-4 w-16 bg-stone-200 dark:bg-stone-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
};
