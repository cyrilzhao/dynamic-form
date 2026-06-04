import React from 'react';

interface OptionGroupProps {
  label: string;
  children: React.ReactNode;
}

export const OptionGroup: React.FC<OptionGroupProps> = ({ label, children }) => {
  return (
    <div className="select-option-group">
      <div className="select-option-group__label">{label}</div>
      <div className="select-option-group__options">{children}</div>
    </div>
  );
};
