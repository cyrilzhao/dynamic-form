import { forwardRef, useCallback, useMemo } from 'react';
import { CodeEditor } from '../CodeEditor';
import type { ObjectEditorProps } from './types';

/**
 * 通用对象/数组编辑器
 * 基于 CodeEditor，支持 JSON 格式编辑
 */
export const ObjectEditor = forwardRef<HTMLDivElement, ObjectEditorProps>(
  (
    {
      value,
      onChange,
      onBlur,
      disabled = false,
      readonly = false,
      error,
      config,
      theme = 'light',
      indent = 2,
    },
    ref
  ) => {
    // 将值转换为 JSON 字符串
    const jsonString = useMemo(() => {
      if (value === undefined || value === null) {
        return '';
      }
      try {
        return JSON.stringify(value, null, indent);
      } catch {
        return '';
      }
    }, [value, indent]);

    // 处理编辑器值变化，将 JSON 字符串转换为对象
    const handleChange = useCallback(
      (newValue: string) => {
        if (!newValue || newValue.trim() === '') {
          onChange?.(undefined);
          return;
        }
        try {
          const parsed = JSON.parse(newValue);
          onChange?.(parsed);
        } catch {
          // JSON 解析失败时不触发 onChange
        }
      },
      [onChange]
    );

    return (
      <CodeEditor
        ref={ref}
        value={jsonString}
        language="json"
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        readonly={readonly}
        error={error}
        config={config}
        theme={theme}
      />
    );
  }
);

ObjectEditor.displayName = 'ObjectEditor';
