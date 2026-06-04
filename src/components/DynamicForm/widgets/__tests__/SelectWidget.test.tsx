import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SelectWidget } from '../SelectWidget';

describe('SelectWidget', () => {
  const defaultProps = {
    name: 'select-field',
    options: [
      { label: '选项A', value: 'a' },
      { label: '选项B', value: 'b' },
      { label: '选项C', value: 'c' },
    ],
  };

  describe('基本渲染', () => {
    it('应该渲染下拉选择框', () => {
      render(<SelectWidget {...defaultProps} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('应该在点击后渲染所有选项', () => {
      render(<SelectWidget {...defaultProps} />);
      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      expect(document.querySelector('.select-option')).toBeInTheDocument();
      expect(screen.getByText('选项A')).toBeInTheDocument();
      expect(screen.getByText('选项B')).toBeInTheDocument();
      expect(screen.getByText('选项C')).toBeInTheDocument();
    });

    it('应该显示 placeholder', () => {
      render(<SelectWidget {...defaultProps} placeholder="请选择" />);
      expect(screen.getByText('请选择')).toBeInTheDocument();
    });
  });

  describe('选中状态', () => {
    it('应该显示选中的值', () => {
      render(<SelectWidget {...defaultProps} value="b" />);
      expect(screen.getByText('选项B')).toBeInTheDocument();
    });

    it('value 为 undefined 且有 placeholder 时应该显示 placeholder', () => {
      render(<SelectWidget {...defaultProps} value={undefined} placeholder="请选择" />);
      expect(screen.getByText('请选择')).toBeInTheDocument();
    });

    it('value 为 undefined 且无 placeholder 时应该显示默认文本', () => {
      render(<SelectWidget {...defaultProps} value={undefined} />);
      expect(screen.getByText('Select...')).toBeInTheDocument();
    });
  });

  describe('onChange 回调', () => {
    it('选择选项时应该触发 onChange', () => {
      const onChange = jest.fn();
      render(<SelectWidget {...defaultProps} onChange={onChange} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const optionB = screen.getByText('选项B');
      fireEvent.click(optionB);

      expect(onChange).toHaveBeenCalledWith('b');
    });
  });

  describe('禁用状态', () => {
    it('disabled 时应该禁用', () => {
      render(<SelectWidget {...defaultProps} disabled={true} />);
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');
    });

    it('readonly 时应该禁用', () => {
      render(<SelectWidget {...defaultProps} readonly={true} />);
      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');
    });

    it('单个选项可以被禁用', () => {
      const options = [
        { label: '选项A', value: 'a' },
        { label: '选项B', value: 'b', disabled: true },
      ];
      render(<SelectWidget {...defaultProps} options={options} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      const optionElements = screen.getAllByRole('option');
      expect(optionElements[0]).not.toHaveAttribute('aria-disabled', 'true');
      expect(optionElements[1]).toHaveAttribute('aria-disabled', 'true');
    });
  });
});
