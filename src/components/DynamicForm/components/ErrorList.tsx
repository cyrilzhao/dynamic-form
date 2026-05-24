import React from 'react';
import type { FieldErrors } from 'react-hook-form';
import { Callout } from '@blueprintjs/core';

interface ErrorListProps {
  errors: FieldErrors;
}

/**
 * 错误列表组件
 * 显示表单级别的所有错误信息
 */
export const ErrorList: React.FC<ErrorListProps> = ({ errors }) => {
  const errorEntries = Object.entries(errors);

  if (errorEntries.length === 0) {
    return null;
  }

  return (
    <Callout intent="danger" style={{ marginBottom: '20px' }}>
      <h4 className="bp5-heading">Please fix the following errors</h4>
      <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px' }}>
        {errorEntries.map(([fieldName, error]) => {
          const message = error?.message as string | undefined;
          if (!message) return null;

          return (
            <li key={fieldName} style={{ marginBottom: '5px' }}>
              <strong>{fieldName}</strong>: {message}
            </li>
          );
        })}
      </ul>
    </Callout>
  );
};
