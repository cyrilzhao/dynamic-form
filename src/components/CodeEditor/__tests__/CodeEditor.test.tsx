import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CodeEditor } from '../CodeEditor';
import type { CodeEditorProps } from '../types';

// Mock CodeEditorPreview 组件
jest.mock('../CodeEditorPreview', () => ({
  CodeEditorPreview: ({
    value,
    onEdit,
    disabled,
    readonly,
    error,
  }: {
    value: string;
    onEdit: () => void;
    disabled?: boolean;
    readonly?: boolean;
    error?: string;
  }) => (
    <div data-testid="code-editor-preview">
      <span data-testid="preview-value">{value}</span>
      {error && <span data-testid="preview-error">{error}</span>}
      {!disabled && !readonly && (
        <button data-testid="edit-button" onClick={onEdit}>
          Edit
        </button>
      )}
    </div>
  ),
}));

// Mock CodeEditorModal 组件
jest.mock('../CodeEditorModal', () => ({
  CodeEditorModal: ({
    value,
    onSave,
    onCancel,
  }: {
    value: string;
    onSave: (value: string) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="code-editor-modal">
      <span data-testid="modal-value">{value}</span>
      <button data-testid="save-button" onClick={() => onSave(value)}>
        Save
      </button>
      <button data-testid="cancel-button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

describe('CodeEditor', () => {
  const defaultProps: CodeEditorProps = {
    value: 'const x = 1;',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.style.overflow = '';
  });

  describe('基本渲染', () => {
    it('应该正确渲染预览组件', () => {
      render(<CodeEditor {...defaultProps} />);
      expect(screen.getByTestId('code-editor-preview')).toBeInTheDocument();
    });

    it('应该显示传入的值', () => {
      render(<CodeEditor {...defaultProps} />);
      expect(screen.getByTestId('preview-value')).toHaveTextContent('const x = 1;');
    });

    it('初始状态下不应该显示模态框', () => {
      render(<CodeEditor {...defaultProps} />);
      expect(screen.queryByTestId('code-editor-modal')).not.toBeInTheDocument();
    });

    it('initialMode 为 edit 时应该直接显示模态框', () => {
      render(<CodeEditor {...defaultProps} config={{ initialMode: 'edit' }} />);
      expect(screen.getByTestId('code-editor-modal')).toBeInTheDocument();
    });
  });

  describe('模态框交互', () => {
    it('点击编辑按钮应该打开模态框', () => {
      render(<CodeEditor {...defaultProps} />);
      fireEvent.click(screen.getByTestId('edit-button'));
      expect(screen.getByTestId('code-editor-modal')).toBeInTheDocument();
    });

    it('点击保存按钮应该关闭模态框并触发 onChange', () => {
      const onChange = jest.fn();
      render(<CodeEditor {...defaultProps} onChange={onChange} />);

      fireEvent.click(screen.getByTestId('edit-button'));
      fireEvent.click(screen.getByTestId('save-button'));

      expect(screen.queryByTestId('code-editor-modal')).not.toBeInTheDocument();
      expect(onChange).toHaveBeenCalled();
    });

    it('点击取消按钮应该关闭模态框', () => {
      render(<CodeEditor {...defaultProps} />);

      fireEvent.click(screen.getByTestId('edit-button'));
      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(screen.queryByTestId('code-editor-modal')).not.toBeInTheDocument();
    });
  });

  describe('onBlur 回调', () => {
    it('保存时应该触发 onBlur', () => {
      const onBlur = jest.fn();
      render(<CodeEditor {...defaultProps} onBlur={onBlur} />);

      fireEvent.click(screen.getByTestId('edit-button'));
      fireEvent.click(screen.getByTestId('save-button'));

      expect(onBlur).toHaveBeenCalled();
    });

    it('取消时应该触发 onBlur', () => {
      const onBlur = jest.fn();
      render(<CodeEditor {...defaultProps} onBlur={onBlur} />);

      fireEvent.click(screen.getByTestId('edit-button'));
      fireEvent.click(screen.getByTestId('cancel-button'));

      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('禁用和只读状态', () => {
    it('禁用状态下不应该显示编辑按钮', () => {
      render(<CodeEditor {...defaultProps} disabled={true} />);
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    });

    it('只读状态下不应该显示编辑按钮', () => {
      render(<CodeEditor {...defaultProps} readonly={true} />);
      expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
    });
  });

  describe('错误状态', () => {
    it('应该将错误信息传递给预览组件', () => {
      render(<CodeEditor {...defaultProps} error="Syntax error" />);
      expect(screen.getByTestId('preview-error')).toHaveTextContent('Syntax error');
    });
  });

  describe('值同步', () => {
    it('外部值变化时应该更新预览', () => {
      const { rerender } = render(<CodeEditor {...defaultProps} value="old value" />);
      expect(screen.getByTestId('preview-value')).toHaveTextContent('old value');

      rerender(<CodeEditor {...defaultProps} value="new value" />);
      expect(screen.getByTestId('preview-value')).toHaveTextContent('new value');
    });
  });

  describe('默认值', () => {
    it('value 未提供时应该使用空字符串', () => {
      render(<CodeEditor onChange={jest.fn()} />);
      expect(screen.getByTestId('preview-value')).toHaveTextContent('');
    });

    it('language 未提供时应该使用 javascript', () => {
      render(<CodeEditor {...defaultProps} />);
      expect(screen.getByTestId('code-editor-preview')).toBeInTheDocument();
    });
  });

  describe('ref 转发', () => {
    it('应该正确转发 ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<CodeEditor {...defaultProps} ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });
});
