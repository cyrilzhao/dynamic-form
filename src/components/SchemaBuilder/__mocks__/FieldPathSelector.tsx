import React from 'react';

interface FieldPathSelectorProps {
  schema: any;
  currentFieldPath: string;
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Mock FieldPathSelector 组件
 * 用于测试 ValidationEffectEditor 等组件
 */
export const FieldPathSelector: React.FC<FieldPathSelectorProps> = ({
  value,
  onChange,
  disabled,
  placeholder,
}) => {
  return (
    <input
      data-testid="field-path-selector"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
};
