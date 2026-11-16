import React from 'react';
import { PhoneCall } from 'lucide-react';

export const EmergencyCallBar: React.FC = () => {
  return (
    <div className="sticky bottom-16 sm:bottom-0 left-0 right-0 z-30 p-2.5 bg-paper dark:bg-paper-dark border-t border-rule dark:border-rule-dark">
      <div className="max-w-md mx-auto">
        <a
          href="tel:112"
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-control bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 hover:opacity-90 active:scale-[0.99] font-medium text-xs tracking-wide transition-all shadow-sm"
        >
          <PhoneCall className="w-4 h-4 text-signal shrink-0" strokeWidth={2} />
          <span>Call National Emergency Services (112)</span>
        </a>
        <p className="text-[10px] text-center text-ink-muted dark:text-ink-muted-dark mt-1">
          This community app supplements local guard response. For critical danger, dial 112 directly.
        </p>
      </div>
    </div>
  );
};
