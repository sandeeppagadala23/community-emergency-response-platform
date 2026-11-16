import React from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ArrowLeft } from 'lucide-react';

interface NotFoundProps {
  message?: string;
  backTo?: string;
  backLabel?: string;
}

export const NotFound: React.FC<NotFoundProps> = ({
  message = "We couldn't find this incident.",
  backTo = '/',
  backLabel = 'Return to dashboard',
}) => {
  return (
    <div className="max-w-md mx-auto my-12 p-6 bg-surface dark:bg-surface-dark border border-rule dark:border-rule-dark rounded-panel text-center">
      <div className="w-10 h-10 mx-auto rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-ink-muted mb-3">
        <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <h2 className="font-serif text-lg font-bold text-ink dark:text-ink-dark">
        Not found
      </h2>
      <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-2 mb-6">
        {message}
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
