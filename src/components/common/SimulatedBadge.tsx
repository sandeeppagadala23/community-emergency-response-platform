import React from 'react';
import { Beaker } from 'lucide-react';

interface SimulatedBadgeProps {
  size?: 'sm' | 'md';
  className?: string;
}

export const SimulatedBadge: React.FC<SimulatedBadgeProps> = ({ size = 'sm', className = '' }) => {
  const isSmall = size === 'sm';
  return (
    <span
      title="This message or result was produced in a simulated test environment."
      className={`inline-flex items-center gap-1 font-mono uppercase tracking-wider font-semibold rounded-control border border-sim/30 bg-sim-light dark:bg-sim-light-dark text-sim ${
        isSmall ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
      } ${className}`}
      aria-label="Simulated test environment record"
    >
      <Beaker className={`${isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'} shrink-0`} strokeWidth={1.5} />
      <span>Simulated</span>
    </span>
  );
};
