
import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface PermissionDeniedProps {
  backTo?: string;
  backLabel?: string;
}

export const PermissionDenied: React.FC<PermissionDeniedProps> = ({
  backTo = '/',
  backLabel = 'Return to home',
}) => {
  return (
    <div className="max-w-md mx-auto my-12 p-6 bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel text-center">
      <div className="w-10 h-10 mx-auto rounded-full bg-warn-light dark:bg-warn-light-dark flex items-center justify-center text-warn mb-3">
        <ShieldAlert className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <h2 className="font-serif text-lg font-bold text-ink dark:text-ink-dark">
        Access restricted
      </h2>
      <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-2 mb-6">
        You don’t have access to this.
      </p>
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-control bg-action text-white hover:bg-action-hover transition-colors duration-150"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
        <span>{backLabel}</span>
      </Link>
    </div>
  );
};
