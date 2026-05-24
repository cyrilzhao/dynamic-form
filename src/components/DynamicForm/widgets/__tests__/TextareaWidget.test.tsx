import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TextareaWidget } from '../TextareaWidget';

describe('TextareaWidget', () => {
  const defaultProps = {
    name: 'textarea-field',
  };

  describe('基本渲染', () => {
    it('应该渲染文本域', () => {
      render(<TextareaWidget {...defaultProps} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('应该设置正确的 name 属性', () => {
      render(<TextareaWidget {...defaultProps} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('name', 'textarea-field');
    });

    it('应该显示 placeholder', () => {
      render(<TextareaWidget {...defaultProps} placeholder="请输入内容" />);
      expect(screen.getByPlaceholderText('请输入内容')).toBeInTheDocument();
    });

    it('应该使用默认行数 4', () => {
      render(<TextareaWidget {...defaultProps} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('rows', '4');
    });

    it('应该支持自定义行数', () => {
      render(<TextareaWidget {...defaultProps} rows={6} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('rows', '6');
    });
  });

  describe('禁用和只读状态', () => {
    it('应该支持禁用状态', () => {
      render(<TextareaWidget {...defaultProps} disabled={true} />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('应该支持只读状态', () => {
      render(<TextareaWidget {...defaultProps} readonly={true} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    });
  });

  describe('错误状态', () => {
    it('有错误时 textarea 应该有 danger class', () => {
      render(<TextareaWidget {...defaultProps} error="错误" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('bp6-intent-danger');
    });
  });
});
