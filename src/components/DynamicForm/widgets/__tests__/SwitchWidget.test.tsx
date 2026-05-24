import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SwitchWidget } from '../SwitchWidget';

describe('SwitchWidget', () => {
  const defaultProps = {
    name: 'switch-field',
  };

  describe('基本渲染', () => {
    it('应该渲染开关', () => {
      render(<SwitchWidget {...defaultProps} />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('应该显示 label', () => {
      render(<SwitchWidget {...defaultProps} label="启用功能" />);
      expect(screen.getByText('启用功能')).toBeInTheDocument();
    });
  });

  describe('选中状态', () => {
    it('value 为 true 时应该选中', () => {
      render(<SwitchWidget {...defaultProps} value={true} />);
      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('value 为 false 时不应该选中', () => {
      render(<SwitchWidget {...defaultProps} value={false} />);
      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });
  });

  describe('onChange 回调', () => {
    it('点击时应该触发 onChange', () => {
      const onChange = jest.fn();
      render(<SwitchWidget {...defaultProps} onChange={onChange} />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(onChange).toHaveBeenCalledWith(true);
    });
  });

  describe('禁用状态', () => {
    it('disabled 时应该禁用', () => {
      render(<SwitchWidget {...defaultProps} disabled={true} />);
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('readonly 时应该禁用', () => {
      render(<SwitchWidget {...defaultProps} readonly={true} />);
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });
  });
});
