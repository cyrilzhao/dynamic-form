import { forwardRef } from 'react';
import { InputGroup } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';

export const PasswordWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, ...rest }, ref) => {
    return (
      <InputGroup
        inputRef={ref}
        name={name}
        type="password"
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        intent={error ? 'danger' : 'none'}
        {...rest}
      />
    );
  }
);

PasswordWidget.displayName = 'PasswordWidget';
