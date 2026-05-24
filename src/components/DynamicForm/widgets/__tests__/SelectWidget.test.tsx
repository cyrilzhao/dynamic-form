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
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('应该渲染所有选项', () => {
      render(<SelectWidget {...defaultProps} />);
      expect(screen.getByText('选项A')).toBeInTheDocument();
      expect(screen.getByText('选项B')).toBeInTheDocument();
      expect(screen.getByText('选项C')).toBeInTheDocument();
    });

    it('应该显示 placeholder 作为第一个选项', () => {
      render(<SelectWidget {...defaultProps} placeholder="请选择" />);
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveTextContent('请选择');
      expect(options[0]).toHaveValue('');
    });
  });

  describe('选中状态', () => {
    it('应该选中指定的值', () => {
      render(<SelectWidget {...defaultProps} value="b" />);
      expect(screen.getByRole('combobox')).toHaveValue('b');
    });

    it('value 为 undefined 且有 placeholder 时应该选中空值', () => {
      render(<SelectWidget {...defaultProps} value={undefined} placeholder="请选择" />);
      expect(screen.getByRole('combobox')).toHaveValue('');
    });

    it('value 为 undefined 且无 placeholder 时应该选中第一个选项', () => {
      render(<SelectWidget {...defaultProps} value={undefined} />);
      expect(screen.getByRole('combobox')).toHaveValue('a');
    });
  });

  describe('onChange 回调', () => {
    it('选择选项时应该触发 onChange', () => {
      const onChange = jest.fn();
      render(<SelectWidget {...defaultProps} onChange={onChange} />);
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } });
      expect(onChange).toHaveBeenCalledWith('b');
    });
  });

  describe('禁用状态', () => {
    it('disabled 时应该禁用', () => {
      render(<SelectWidget {...defaultProps} disabled={true} />);
      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('readonly 时应该禁用', () => {
      render(<SelectWidget {...defaultProps} readonly={true} />);
      expect(screen.getByRole('combobox')).toBeDisabled();
    });

    it('单个选项可以被禁用', () => {
      const options = [
        { label: '选项A', value: 'a' },
        { label: '选项B', value: 'b', disabled: true },
      ];
      render(<SelectWidget {...defaultProps} options={options} />);
      const optionElements = screen.getAllByRole('option');
      expect(optionElements[0]).not.toBeDisabled();
      expect(optionElements[1]).toBeDisabled();
    });
  });
});
