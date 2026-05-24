import { forwardRef } from 'react';
import { Checkbox } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';

export const CheckboxWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, label, disabled, readonly, error, value, onChange, ...rest }, ref) => {
    return (
      <Checkbox
        inputRef={ref}
        name={name}
        label={label}
        disabled={disabled || readonly}
        checked={!!value}
        onChange={e => onChange?.(e.target.checked)}
        {...rest}
      />
    );
  }
);

CheckboxWidget.displayName = 'CheckboxWidget';
