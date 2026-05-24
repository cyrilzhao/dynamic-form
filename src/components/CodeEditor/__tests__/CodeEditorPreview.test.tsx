import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CodeEditorPreview } from '../CodeEditorPreview';
import type { CodeEditorPreviewProps } from '../types';

// Mock CodeMirrorView 组件
jest.mock('../CodeMirrorView', () => ({
  CodeMirrorView: ({ value }: { value: string }) => (
    <div data-testid="code-mirror-view">{value}</div>
  ),
}));

describe('CodeEditorPreview', () => {
  const defaultProps: CodeEditorPreviewProps = {
    value: 'const x = 1;',
    language: 'javascript',
    config: {},
    onEdit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本渲染', () => {
    it('应该正确渲染代码内容', () => {
      render(<CodeEditorPreview {...defaultProps} />);
      expect(screen.getByTestId('code-mirror-view')).toHaveTextContent('const x = 1;');
    });

    it('应该显示语言标签', () => {
      render(<CodeEditorPreview {...defaultProps} />);
      expect(screen.getByText('JAVASCRIPT')).toBeInTheDocument();
    });

    it('应该显示行数', () => {
      render(<CodeEditorPreview {...defaultProps} />);
      expect(screen.getByText('1 lines')).toBeInTheDocument();
    });

    it('应该正确计算多行代码的行数', () => {
      const multiLineCode = 'line1\nline2\nline3';
      render(<CodeEditorPreview {...defaultProps} value={multiLineCode} />);
      expect(screen.getByText('3 lines')).toBeInTheDocument();
    });
  });

  describe('编辑按钮', () => {
    it('应该在非禁用状态下显示编辑按钮', () => {
      render(<CodeEditorPreview {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('应该在禁用状态下隐藏编辑按钮', () => {
      render(<CodeEditorPreview {...defaultProps} disabled={true} />);
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('应该在只读状态下隐藏编辑按钮', () => {
      render(<CodeEditorPreview {...defaultProps} readonly={true} />);
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('点击编辑按钮应该触发 onEdit 回调', () => {
      const onEdit = jest.fn();
      render(<CodeEditorPreview {...defaultProps} onEdit={onEdit} />);
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(onEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('点击交互', () => {
    it('点击预览区域应该触发 onEdit 回调', () => {
      const onEdit = jest.fn();
      render(<CodeEditorPreview {...defaultProps} onEdit={onEdit} />);
      const preview = document.querySelector('.code-editor-preview');
      fireEvent.click(preview!);
      expect(onEdit).toHaveBeenCalledTimes(1);
    });

    it('禁用状态下点击预览区域不应该触发 onEdit', () => {
      const onEdit = jest.fn();
      render(<CodeEditorPreview {...defaultProps} onEdit={onEdit} disabled={true} />);
      const preview = document.querySelector('.code-editor-preview');
      fireEvent.click(preview!);
      expect(onEdit).not.toHaveBeenCalled();
    });

    it('只读状态下点击预览区域不应该触发 onEdit', () => {
      const onEdit = jest.fn();
      render(<CodeEditorPreview {...defaultProps} onEdit={onEdit} readonly={true} />);
      const preview = document.querySelector('.code-editor-preview');
      fireEvent.click(preview!);
      expect(onEdit).not.toHaveBeenCalled();
    });
  });

  describe('错误状态', () => {
    it('应该显示错误信息', () => {
      render(<CodeEditorPreview {...defaultProps} error="Invalid syntax" />);
      expect(screen.getByText('Invalid syntax')).toBeInTheDocument();
    });

    it('有错误时应该添加 has-error 类名', () => {
      render(<CodeEditorPreview {...defaultProps} error="Invalid syntax" />);
      const preview = document.querySelector('.code-editor-preview');
      expect(preview).toHaveClass('has-error');
    });

    it('无错误时不应该有 has-error 类名', () => {
      render(<CodeEditorPreview {...defaultProps} />);
      const preview = document.querySelector('.code-editor-preview');
      expect(preview).not.toHaveClass('has-error');
    });
  });

  describe('禁用/只读状态样式', () => {
    it('禁用状态应该添加 disabled 类名', () => {
      render(<CodeEditorPreview {...defaultProps} disabled={true} />);
      const preview = document.querySelector('.code-editor-preview');
      expect(preview).toHaveClass('disabled');
    });

    it('只读状态应该添加 disabled 类名', () => {
      render(<CodeEditorPreview {...defaultProps} readonly={true} />);
      const preview = document.querySelector('.code-editor-preview');
      expect(preview).toHaveClass('disabled');
    });
  });

  describe('预览遮罩层', () => {
    it('当行数超过预览行数时应该显示遮罩层', () => {
      const manyLines = 'line1\nline2\nline3\nline4\nline5';
      render(
        <CodeEditorPreview
          {...defaultProps}
          value={manyLines}
          config={{ previewLines: 3 }}
        />
      );
      expect(document.querySelector('.preview-overlay')).toBeInTheDocument();
    });

    it('当行数不超过预览行数时不应该显示遮罩层', () => {
      const fewLines = 'line1\nline2';
      render(
        <CodeEditorPreview
          {...defaultProps}
          value={fewLines}
          config={{ previewLines: 3 }}
        />
      );
      expect(document.querySelector('.preview-overlay')).not.toBeInTheDocument();
    });

    it('应该使用默认的预览行数 3', () => {
      const fourLines = 'line1\nline2\nline3\nline4';
      render(<CodeEditorPreview {...defaultProps} value={fourLines} />);
      expect(document.querySelector('.preview-overlay')).toBeInTheDocument();
    });
  });

  describe('不同语言类型', () => {
    const languages = ['json', 'python', 'sql', 'yaml', 'markdown', 'html', 'css'] as const;

    languages.forEach((lang) => {
      it(`应该正确显示 ${lang.toUpperCase()} 语言标签`, () => {
        render(<CodeEditorPreview {...defaultProps} language={lang} />);
        expect(screen.getByText(lang.toUpperCase())).toBeInTheDocument();
      });
    });
  });
});
