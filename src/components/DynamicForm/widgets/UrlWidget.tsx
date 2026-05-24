import { forwardRef } from 'react';
import { InputGroup } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';

/**
 * URL 输入组件
 */
export const UrlWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, ...rest }, ref) => {
    return (
      <InputGroup
        inputRef={ref}
        type="url"
        name={name}
        placeholder={placeholder || 'Enter URL'}
        disabled={disabled}
        readOnly={readonly}
        intent={error ? 'danger' : 'none'}
        {...rest}
      />
    );
  }
);

UrlWidget.displayName = 'UrlWidget';
