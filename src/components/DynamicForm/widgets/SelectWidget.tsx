import { forwardRef } from 'react';
import { Select } from '../../Select';
import type { FieldWidgetProps } from '../types';
import type { FieldOption } from '../types/schema';

export const SelectWidget = forwardRef<HTMLElement, FieldWidgetProps>(
  (
    { name, placeholder, disabled, readonly, options = [], error, value, onChange, ...rest },
    ref
  ) => {
    return (
      <Select
        options={options.map((opt: FieldOption) => ({
          label: opt.label,
          value: opt.value,
          disabled: opt.disabled,
        }))}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled || readonly}
        {...rest}
      />
    );
  }
);

SelectWidget.displayName = 'SelectWidget';
