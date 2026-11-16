import React from 'react';
import { Check, Clock } from 'lucide-react';

interface StatusStepperProps {
  stages: {
    recorded: boolean;
    sent: boolean;
    delivered: boolean;
    acknowledged: boolean;
  };
  counts: {
    total_recipients: number;
    sent: number;
    delivered: number;
    failed: number;
    acknowledged: number;
  };
}

export const StatusStepper: React.FC<StatusStepperProps> = ({ stages, counts }) => {
  const stepItems = [
    {
      id: 1,
      title: 'Alert recorded',
      isComplete: stages.recorded,
      description: 'Recorded by community emergency dispatch system.',
      note: 'Status: OPEN',
    },
    {
      id: 2,
      title: 'In-app inboxes updated',
      isComplete: stages.sent,
      description: `${counts.sent} of ${counts.total_recipients} recipients have an in-app notification.`,
      note: 'External messages are simulated in the Django console.',
    },
    {
      id: 3,
      title: 'Read receipts',
      isComplete: stages.delivered,
      description:
        counts.delivered > 0
          ? `${counts.delivered} recipient${counts.delivered === 1 ? '' : 's'} opened the in-app notification.`
          : 'No recipients have opened the in-app notification yet.',
      note: 'No external SMS or email delivery receipt is available.',
    },
    {
      id: 4,
      title: 'Resident confirmed arrival',
      isComplete: stages.acknowledged,
      description: 'The resident confirms that an assigned responder has arrived.',
      note:
        counts.acknowledged > 0
          ? 'Resident confirmed responder arrival'
          : 'Waiting for resident confirmation',
    },
  ];

  return (
    <div className="w-full py-2">
      <h3 className="sr-only">Incident Progress Stages</h3>
      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-rule dark:before:bg-rule-dark">
        {stepItems.map((step) => {
          const isDone = step.isComplete;

          return (
            <div key={step.id} className="relative flex items-start group">
              {/* Step indicator node */}
              <div
                className={`absolute -left-6 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isDone
                    ? 'bg-ok text-white ring-4 ring-ok/20'
                    : 'bg-surface dark:bg-surface-dark border-2 border-warn text-warn-text dark:text-warn-text-dark'
                }`}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : (
                  <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                )}
              </div>

              {/* Step content */}
              <div className="ml-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-ink dark:text-ink-dark">
                    {step.title}
                  </span>
                  {isDone ? (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-ok-light dark:bg-ok-light-dark text-ok font-bold border border-ok/30">
                      Confirmed
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-warn-light dark:bg-warn-light-dark text-warn-text dark:text-warn-text-dark font-semibold border border-warn/30">
                      In progress
                    </span>
                  )}
                </div>

                <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5 leading-relaxed">
                  {step.description}
                </p>

                <p className="text-[11px] font-mono text-ink-muted/80 dark:text-ink-muted-dark/80 mt-0.5">
                  {step.note}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
