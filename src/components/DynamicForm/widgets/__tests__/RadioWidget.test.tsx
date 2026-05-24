import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RadioWidget } from '../RadioWidget';

describe('RadioWidget', () => {
  const defaultProps = {
    name: 'radio-field',
    options: [
      { label: '选项A', value: 'a' },
      { label: '选项B', value: 'b' },
      { label: '选项C', value: 'c' },
    ],
  };

  describe('基本渲染', () => {
    it('应该渲染所有选项', () => {
      render(<RadioWidget {...defaultProps} />);
      expect(screen.getByText('选项A')).toBeInTheDocument();
      expect(screen.getByText('选项B')).toBeInTheDocument();
      expect(screen.getByText('选项C')).toBeInTheDocument();
    });

    it('应该渲染正确数量的单选按钮', () => {
      render(<RadioWidget {...defaultProps} />);
      expect(screen.getAllByRole('radio')).toHaveLength(3);
    });
  });

  describe('选中状态', () => {
    it('应该选中指定的值', () => {
      render(<RadioWidget {...defaultProps} value="b" />);
      const radios = screen.getAllByRole('radio');
      expect(radios[1]).toBeChecked();
    });
  });

  describe('onChange 回调', () => {
    it('点击选项时应该触发 onChange', () => {
      const onChange = jest.fn();
      render(<RadioWidget {...defaultProps} onChange={onChange} />);
      fireEvent.click(screen.getByText('选项B'));
      expect(onChange).toHaveBeenCalledWith('b');
    });
  });

  describe('禁用状态', () => {
    it('disabled 时所有选项应该禁用', () => {
      render(<RadioWidget {...defaultProps} disabled={true} />);
      screen.getAllByRole('radio').forEach(radio => {
        expect(radio).toBeDisabled();
      });
    });

    it('readonly 时所有选项应该禁用', () => {
      render(<RadioWidget {...defaultProps} readonly={true} />);
      screen.getAllByRole('radio').forEach(radio => {
        expect(radio).toBeDisabled();
      });
    });

    it('单个选项可以被禁用', () => {
      const options = [
        { label: '选项A', value: 'a' },
        { label: '选项B', value: 'b', disabled: true },
      ];
      render(<RadioWidget {...defaultProps} options={options} />);
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).not.toBeDisabled();
      expect(radios[1]).toBeDisabled();
    });
  });
});
