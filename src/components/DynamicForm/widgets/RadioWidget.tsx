import { forwardRef } from 'react';
import { RadioGroup, Radio } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';
import type { FieldOption } from '../types/schema';

export const RadioWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, disabled, readonly, options = [], value, onChange }, _ref) => {
    return (
      <RadioGroup
        name={name}
        disabled={disabled || readonly}
        selectedValue={String(value)}
        onChange={e => {
          const target = e.target as HTMLInputElement;
          const stringValue = target.value;

          // 查找匹配的 option，使用原始值类型
          const matchedOption = options.find(opt => String(opt.value) === stringValue);
          const actualValue = matchedOption ? matchedOption.value : stringValue;

          onChange?.(actualValue);
        }}
      >
        {options.map((option: FieldOption) => (
          <Radio
            key={String(option.value)}
            label={option.label}
            value={String(option.value)}
            disabled={option.disabled}
          />
        ))}
      </RadioGroup>
    );
  }
);

RadioWidget.displayName = 'RadioWidget';
