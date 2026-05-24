import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CodeEditorModal } from '../CodeEditorModal';
import type { CodeEditorModalProps } from '../types';

// Mock CodeMirrorView 组件
jest.mock('../CodeMirrorView', () => ({
  CodeMirrorView: ({
    value,
    onChange,
  }: {
    value: string;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      data-testid="code-mirror-view"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

// Mock ReactDOM.createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

describe('CodeEditorModal', () => {
  const defaultProps: CodeEditorModalProps = {
    value: 'const x = 1;',
    language: 'javascript',
    config: {},
    onSave: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本渲染', () => {
    it('应该正确渲染模态框', () => {
      render(<CodeEditorModal {...defaultProps} />);
      expect(screen.getByTestId('code-mirror-view')).toBeInTheDocument();
    });

    it('应该显示语言标签', () => {
      render(<CodeEditorModal {...defaultProps} />);
      expect(screen.getByText('JAVASCRIPT')).toBeInTheDocument();
    });

    it('应该显示行数', () => {
      render(<CodeEditorModal {...defaultProps} />);
      expect(screen.getByText('1 lines')).toBeInTheDocument();
    });

    it('应该显示保存和取消按钮', () => {
      render(<CodeEditorModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  describe('保存功能', () => {
    it('点击保存按钮应该触发 onSave 回调', () => {
      const onSave = jest.fn();
      render(<CodeEditorModal {...defaultProps} onSave={onSave} />);
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(onSave).toHaveBeenCalledWith('const x = 1;');
    });

    it('有验证错误时保存按钮应该被禁用', async () => {
      const validator = jest.fn().mockReturnValue('Validation error');
      render(<CodeEditorModal {...defaultProps} validator={validator} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      });
    });

    it('禁用状态下保存按钮应该被禁用', () => {
      render(<CodeEditorModal {...defaultProps} disabled={true} />);
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });
  });

  describe('取消功能', () => {
    it('点击取消按钮应该触发 onCancel 回调', () => {
      const onCancel = jest.fn();
      render(<CodeEditorModal {...defaultProps} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('ESC 键关闭', () => {
    it('按 ESC 键应该触发 onCancel 回调', () => {
      const onCancel = jest.fn();
      render(<CodeEditorModal {...defaultProps} onCancel={onCancel} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('closeOnEscape 为 false 时按 ESC 键不应该触发 onCancel', () => {
      const onCancel = jest.fn();
      render(
        <CodeEditorModal
          {...defaultProps}
          onCancel={onCancel}
          config={{ closeOnEscape: false }}
        />
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('遮罩层点击', () => {
    it('点击遮罩层应该触发 onCancel 回调', () => {
      const onCancel = jest.fn();
      render(<CodeEditorModal {...defaultProps} onCancel={onCancel} />);
      const backdrop = document.querySelector('.code-editor-modal-backdrop');
      fireEvent.click(backdrop!);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('closeOnBackdropClick 为 false 时点击遮罩层不应该触发 onCancel', () => {
      const onCancel = jest.fn();
      render(
        <CodeEditorModal
          {...defaultProps}
          onCancel={onCancel}
          config={{ closeOnBackdropClick: false }}
        />
      );
      const backdrop = document.querySelector('.code-editor-modal-backdrop');
      fireEvent.click(backdrop!);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('点击模态框内容区域不应该触发 onCancel', () => {
      const onCancel = jest.fn();
      render(<CodeEditorModal {...defaultProps} onCancel={onCancel} />);
      const container = document.querySelector('.code-editor-modal-container');
      fireEvent.click(container!);
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe('验证功能', () => {
    it('应该显示验证错误信息', async () => {
      const validator = jest.fn().mockReturnValue('Invalid code');
      render(<CodeEditorModal {...defaultProps} validator={validator} />);

      await waitFor(() => {
        expect(screen.getByText('Invalid code')).toBeInTheDocument();
      });
    });

    it('验证通过时不应该显示错误信息', async () => {
      const validator = jest.fn().mockReturnValue(null);
      render(<CodeEditorModal {...defaultProps} validator={validator} />);

      await waitFor(() => {
        expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();
      });
    });
  });

  describe('格式化功能', () => {
    it('有格式化器时应该显示格式化按钮', () => {
      const formatter = jest.fn((code) => code);
      render(<CodeEditorModal {...defaultProps} formatter={formatter} />);
      expect(screen.getByRole('button', { name: 'Format' })).toBeInTheDocument();
    });

    it('没有格式化器时不应该显示格式化按钮', () => {
      render(<CodeEditorModal {...defaultProps} />);
      expect(screen.queryByRole('button', { name: 'Format' })).not.toBeInTheDocument();
    });

    it('禁用状态下格式化按钮应该被禁用', () => {
      const formatter = jest.fn((code) => code);
      render(<CodeEditorModal {...defaultProps} formatter={formatter} disabled={true} />);
      expect(screen.getByRole('button', { name: 'Format' })).toBeDisabled();
    });

    it('只读状态下格式化按钮应该被禁用', () => {
      const formatter = jest.fn((code) => code);
      render(<CodeEditorModal {...defaultProps} formatter={formatter} readonly={true} />);
      expect(screen.getByRole('button', { name: 'Format' })).toBeDisabled();
    });
  });

  describe('配置选项', () => {
    it('应该应用自定义遮罩层透明度', () => {
      render(<CodeEditorModal {...defaultProps} config={{ backdropOpacity: 0.8 }} />);
      const backdrop = document.querySelector('.code-editor-modal-backdrop');
      expect(backdrop).toHaveStyle({ background: 'rgba(0, 0, 0, 0.8)' });
    });

    it('应该应用自定义模态边距', () => {
      render(<CodeEditorModal {...defaultProps} config={{ modalPadding: 60 }} />);
      const container = document.querySelector('.code-editor-modal-container');
      expect(container).toHaveStyle({
        width: 'calc(100vw - 120px)',
        height: 'calc(100vh - 120px)',
      });
    });
  });
});
