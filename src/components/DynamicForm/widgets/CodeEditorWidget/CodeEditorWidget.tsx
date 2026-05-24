import { forwardRef } from 'react';
import { CodeEditor } from '../../../CodeEditor';
import type { CodeEditorWidgetProps } from './types';

/**
 * DynamicForm 的代码编辑器 Widget
 * 基于通用 CodeEditor 组件的表单适配器
 */
export const CodeEditorWidget = forwardRef<HTMLDivElement, CodeEditorWidgetProps>(
  (
    {
      name,
      value = '',
      onChange,
      onBlur,
      disabled = false,
      readonly = false,
      error,
      language = 'javascript',
      config = {},
      theme = 'light',
      validator,
      formatter,
      ...rest
    },
    ref
  ) => {
    return (
      <CodeEditor
        ref={ref}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        readonly={readonly}
        error={error}
        language={language}
        config={config}
        theme={theme}
        validator={validator}
        formatter={formatter}
        {...rest}
      />
    );
  }
);

CodeEditorWidget.displayName = 'CodeEditorWidget';
