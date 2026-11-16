import React from 'react';
import { EmergencyType } from '../../types/incident';
import { EMERGENCY_TYPES } from '../../constants/emergencyTypes';
import { Activity, AlertCircle, Flame, ShieldAlert, HelpCircle } from 'lucide-react';

interface CategoryRadioGroupProps {
  selected: EmergencyType | null;
  onSelect: (type: EmergencyType) => void;
  error?: string;
  disabled?: boolean;
}

export const CategoryRadioGroup: React.FC<CategoryRadioGroupProps> = ({
  selected,
  onSelect,
  error,
  disabled = false,
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Activity':
        return <Activity className="w-5 h-5 text-action dark:text-teal-400 shrink-0" strokeWidth={1.75} />;
      case 'AlertCircle':
        return <AlertCircle className="w-5 h-5 text-warn-text dark:text-warn-text-dark shrink-0" strokeWidth={1.75} />;
      case 'Flame':
        return <Flame className="w-5 h-5 text-signal shrink-0" strokeWidth={1.75} />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-5 h-5 text-action dark:text-teal-400 shrink-0" strokeWidth={1.75} />;
      case 'HelpCircle':
      default:
        return <HelpCircle className="w-5 h-5 text-ink-muted dark:text-ink-muted-dark shrink-0" strokeWidth={1.75} />;
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label
          id="category-group-label"
          className="block text-sm font-semibold tracking-wide text-ink dark:text-ink-dark"
        >
          Select emergency type
        </label>
        {selected && (
          <span className="text-xs text-action dark:text-teal-400 font-medium">Selected</span>
        )}
      </div>

      <div
        role="radiogroup"
        aria-labelledby="category-group-label"
        aria-required="true"
        aria-invalid={Boolean(error)}
        className="space-y-2"
      >
        {EMERGENCY_TYPES.map((cat) => {
          const isSelected = selected === cat.type;
          return (
            <div
              key={cat.type}
              role="radio"
              aria-checked={isSelected}
              tabIndex={disabled ? -1 : 0}
              onClick={() => !disabled && onSelect(cat.type)}
              onKeyDown={(e) => {
                if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
                  e.preventDefault();
                  onSelect(cat.type);
                }
              }}
              className={`w-full min-h-[52px] p-3 rounded-control border transition-all duration-150 cursor-pointer flex items-center justify-between select-none ${
                isSelected
                  ? 'border-action bg-action-light dark:bg-action-light-dark ring-2 ring-action'
                  : 'border-rule dark:border-rule-dark bg-surface dark:bg-surface-dark hover:border-ink-muted/50'
              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-action text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-ink-muted'
                  }`}
                >
                  {getIcon(cat.iconName)}
                </div>
                <div>
                  <div className="text-base font-semibold text-ink dark:text-ink-dark leading-snug">
                    {cat.label}
                  </div>
                  <div className="text-xs text-ink-muted dark:text-ink-muted-dark leading-tight mt-0.5">
                    {cat.description}
                  </div>
                </div>
              </div>

              {/* Radio Indicator */}
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                  isSelected
                    ? 'border-action bg-action text-white'
                    : 'border-ink-muted/40 bg-surface dark:bg-surface-dark'
                }`}
              >
                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="text-xs text-signal font-medium mt-1">
          {error}
        </p>
      )}
    </div>
  );
};
