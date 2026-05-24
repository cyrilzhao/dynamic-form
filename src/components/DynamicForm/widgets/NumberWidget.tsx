import React, { forwardRef, useCallback } from 'react';
import { NumericInput } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';

export const NumberWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, onChange, onBlur, value, ...rest }, ref) => {
    const handleValueChange = useCallback(
      (valueAsNumber: number, _valueAsString: string) => {
        // 确保输出的是数字类型，而不是字符串
        if (onChange) {
          onChange(isNaN(valueAsNumber) ? undefined : valueAsNumber);
        }
      },
      [onChange]
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;

        // 检查是否为合法数字
        if (inputValue && isNaN(Number(inputValue))) {
          // 不是合法数字，清空输入框并返回 undefined
          if (onChange) {
            onChange(undefined);
          }
        }

        // 调用原始的 onBlur 回调
        if (onBlur) {
          onBlur(e);
        }
      },
      [onChange, onBlur]
    );

    return (
      <NumericInput
        inputRef={ref}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        intent={error ? 'danger' : 'none'}
        fill
        value={value as string | number}
        onValueChange={handleValueChange}
        onBlur={handleBlur}
        {...rest}
      />
    );
  }
);

NumberWidget.displayName = 'NumberWidget';
