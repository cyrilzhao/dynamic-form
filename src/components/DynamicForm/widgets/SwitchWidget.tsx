import { forwardRef } from 'react';
import { Switch } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';

export const SwitchWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, label, disabled, readonly, error, value, onChange, ...rest }, ref) => {
    return (
      <Switch
        inputRef={ref}
        name={name}
        label={label}
        disabled={disabled || readonly}
        checked={value}
        onChange={e => onChange?.(e.target.checked)}
        {...rest}
      />
    );
  }
);

SwitchWidget.displayName = 'SwitchWidget';
