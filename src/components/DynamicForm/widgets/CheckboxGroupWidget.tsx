import { forwardRef } from 'react';
import { Checkbox } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';
import type { FieldOption } from '../types/schema';

export const CheckboxGroupWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, disabled, readonly, options = [], value, onChange }, _ref) => {
    const selectedValues: any[] = Array.isArray(value) ? value : [];

    const handleChange = (optionValue: any, checked: boolean) => {
      const next = checked
        ? [...selectedValues, optionValue]
        : selectedValues.filter(v => String(v) !== String(optionValue));
      onChange?.(next);
    };

    return (
      <div>
        {options.map((option: FieldOption) => (
          <Checkbox
            key={String(option.value)}
            label={option.label}
            disabled={disabled || readonly || option.disabled}
            checked={selectedValues.some(v => String(v) === String(option.value))}
            onChange={e => handleChange(option.value, e.target.checked)}
          />
        ))}
      </div>
    );
  }
);

CheckboxGroupWidget.displayName = 'CheckboxGroupWidget';
