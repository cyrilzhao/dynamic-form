import React from 'react';

interface FieldHelpProps {
  text: string;
}

export const FieldHelp: React.FC<FieldHelpProps> = ({ text }) => {
  return (
    <div className="field-help bp5-text-muted" style={{ marginTop: '5px', fontSize: '12px' }}>
      {text}
    </div>
  );
};
