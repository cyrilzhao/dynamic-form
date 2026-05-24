import React from 'react';
import { CodeMirrorView } from './CodeMirrorView';
import type { CodeEditorPreviewProps } from './types';

/**
 * 代码编辑器预览态组件
 * 显示代码的前几行，提供进入编辑态的交互
 */
export const CodeEditorPreview: React.FC<CodeEditorPreviewProps> = ({
  value,
  language,
  theme,
  config,
  disabled,
  readonly,
  error,
  onEdit,
}) => {
  const lineCount = value.split('\n').length;
  const previewLines = config.previewLines || 3;
  const previewMaxHeight = config.previewMaxHeight || 120;

  const handleClick = () => {
    if (!disabled && !readonly) {
      onEdit();
    }
  };

  return (
    <div
      className={`code-editor-preview ${error ? 'has-error' : ''} ${
        disabled || readonly ? 'disabled' : ''
      }`}
      onClick={handleClick}
    >
      <div className="preview-header">
        <span className="language-badge">{language.toUpperCase()}</span>
        <span className="line-count">{lineCount} lines</span>
        {!disabled && !readonly && (
          <button
            className="edit-button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            Edit
          </button>
        )}
      </div>
      <div className="preview-content">
        <CodeMirrorView
          value={value}
          language={language}
          theme={theme}
          readonly={true}
          maxHeight={previewMaxHeight}
        />
        {lineCount > previewLines && <div className="preview-overlay" />}
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
