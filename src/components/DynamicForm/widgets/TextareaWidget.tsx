import { forwardRef } from 'react';
import { TextArea } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';

export const TextareaWidget = forwardRef<HTMLTextAreaElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, rows = 4, ...rest }, ref) => {
    return (
      <TextArea
        inputRef={ref}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        rows={rows}
        intent={error ? 'danger' : 'none'}
        fill
        {...rest}
      />
    );
  }
);

TextareaWidget.displayName = 'TextareaWidget';
