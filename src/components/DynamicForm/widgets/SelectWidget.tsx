import { forwardRef } from 'react';
import { HTMLSelect } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';
import type { FieldOption } from '../types/schema';

export const SelectWidget = forwardRef<HTMLSelectElement, FieldWidgetProps>(
  (
    { name, placeholder, disabled, readonly, options = [], error, value, onChange, ...rest },
    ref
  ) => {
    return (
      <HTMLSelect
        ref={ref}
        name={name}
        disabled={disabled || readonly}
        fill
        value={value ?? ''}
        onChange={e => onChange?.(e.target.value)}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option: FieldOption) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </HTMLSelect>
    );
  }
);

SelectWidget.displayName = 'SelectWidget';
