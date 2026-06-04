import React, { forwardRef } from 'react';
import type { SelectOption } from '../types';

interface TriggerProps {
  selectedOptions: SelectOption[];
  placeholder?: string;
  isOpen: boolean;
  disabled?: boolean;
  clearable?: boolean;
  loading?: boolean;
  onClick: () => void;
  onClear?: () => void;
}

export const Trigger = forwardRef<HTMLDivElement, TriggerProps>(
  ({ selectedOptions, placeholder, isOpen, disabled, clearable, loading, onClick, onClear }, ref) => {
    const displayText =
      selectedOptions.length > 0
        ? selectedOptions.map(opt => opt.label).join(', ')
        : placeholder || 'Select...';

    const showClearButton = clearable && selectedOptions.length > 0 && !disabled && !loading;

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onClear?.();
    };

    return (
      <div
        ref={ref}
        className={`select-trigger ${isOpen ? 'select-trigger--open' : ''} ${
          disabled || loading ? 'select-trigger--disabled' : ''
        }`}
        role="button"
        onClick={disabled || loading ? undefined : onClick}
        aria-disabled={disabled || loading}
        aria-expanded={isOpen}
      >
        <span className="select-trigger__value">{displayText}</span>
        <div className="select-trigger__icons">
          {loading && <span className="select-trigger__loading">⟳</span>}
          {showClearButton && (
            <span className="select-trigger__clear" onClick={handleClear}>
              ×
            </span>
          )}
          {!loading && <span className="select-trigger__arrow">{isOpen ? '▲' : '▼'}</span>}
        </div>
      </div>
    );
  }
);

Trigger.displayName = 'Trigger';
