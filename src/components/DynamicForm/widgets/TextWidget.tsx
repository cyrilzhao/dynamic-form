import { forwardRef } from 'react';
import { InputGroup } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';

export const TextWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, ...rest }, ref) => {
    return (
      <InputGroup
        inputRef={ref}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        intent={error ? 'danger' : 'none'}
        {...rest}
      />
    );
  }
);

TextWidget.displayName = 'TextWidget';
