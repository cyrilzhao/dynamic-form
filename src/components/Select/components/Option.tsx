import React from 'react';
import type { SelectOption } from '../types';

interface OptionProps {
  option: SelectOption;
  isSelected?: boolean;
  isFocused?: boolean;
  onClick: () => void;
}

export const Option: React.FC<OptionProps> = ({
  option,
  isSelected = false,
  isFocused = false,
  onClick,
}) => {
  const handleClick = () => {
    console.log('[Option handleClick]', { option, disabled: option.disabled });
    if (!option.disabled) {
      onClick();
    }
  };

  return (
    <div
      className={`select-option ${isSelected ? 'select-option--selected' : ''} ${
        isFocused ? 'select-option--focused' : ''
      } ${option.disabled ? 'select-option--disabled' : ''}`}
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
      aria-disabled={option.disabled}
    >
      {option.label}
    </div>
  );
};
