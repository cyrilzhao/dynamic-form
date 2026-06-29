/**
 * EffectEditor 组件测试
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EffectEditor } from '../components/PropertyEditor/components/EffectEditor';

// Mock ObjectEditor 组件
jest.mock('../../ObjectEditor', () => ({
  ObjectEditor: ({ value, onChange, disabled }: any) => (
    <textarea
      data-testid="object-editor"
      value={JSON.stringify(value)}
      onChange={e => onChange(JSON.parse(e.target.value))}
      disabled={disabled}
    />
  ),
}));

describe('EffectEditor', () => {
  const defaultProps = {
    linkageType: 'visibility' as const,
    onChange: jest.fn(),
    label: 'Test Effect',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('无效果配置时', () => {
    it('应该显示添加按钮', () => {
      render(<EffectEditor {...defaultProps} />);
      expect(screen.getByText('Add Test Effect')).toBeInTheDocument();
    });

    it('点击添加按钮应该创建默认效果 (visibility)', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor {...defaultProps} onChange={onChange} isFulfill={true} />
      );

      fireEvent.click(screen.getByText('Add Test Effect'));

      expect(onChange).toHaveBeenCalledWith({
        state: { visible: true },
      });
    });

    it('点击添加按钮应该创建默认效果 (disabled)', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="disabled"
          onChange={onChange}
          isFulfill={true}
        />
      );

      fireEvent.click(screen.getByText('Add Test Effect'));

      expect(onChange).toHaveBeenCalledWith({
        state: { disabled: true },
      });
    });
  });

  describe('visibility 类型', () => {
    it('应该显示 visible 开关', () => {
      render(
        <EffectEditor
          {...defaultProps}
          value={{ state: { visible: true } }}
        />
      );

      expect(screen.getByText(/Set visible/i)).toBeInTheDocument();
    });
  });

  describe('disabled 类型', () => {
    it('应该显示 disabled 开关', () => {
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="disabled"
          value={{ state: { disabled: true } }}
        />
      );

      expect(screen.getByText(/Set disabled/i)).toBeInTheDocument();
    });
  });

  describe('readonly 类型', () => {
    it('应该显示 readonly 开关', () => {
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="readonly"
          value={{ state: { readonly: true } }}
        />
      );

      expect(screen.getByText(/Set readonly/i)).toBeInTheDocument();
    });
  });

  describe('value 类型', () => {
    it('应该显示函数名和固定值输入框', () => {
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="value"
          value={{ function: 'calc', value: '100' }}
        />
      );

      expect(screen.getByText('Function Name')).toBeInTheDocument();
      expect(screen.getByText('Or Fixed Value')).toBeInTheDocument();
    });
  });

  describe('options 类型', () => {
    it('应该显示函数名和静态选项配置', () => {
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="options"
          value={{ function: 'getOptions', options: [] }}
        />
      );

      expect(screen.getByText('Function Name')).toBeInTheDocument();
      expect(screen.getByText('Or Static Options')).toBeInTheDocument();
    });
  });

  describe('schema 类型', () => {
    it('应该显示函数名和静态 Schema 配置', () => {
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="schema"
          value={{ function: 'getSchema', schema: {} }}
        />
      );

      expect(screen.getByText('Function Name')).toBeInTheDocument();
      expect(screen.getByText('Or Static Schema')).toBeInTheDocument();
    });
  });

  describe('清除效果', () => {
    it('点击清除按钮应该清除效果', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ state: { visible: true } }}
        />
      );

      // 找到清除按钮（X 图标按钮）
      const clearButton = screen.getByRole('button', { name: '' });
      fireEvent.click(clearButton);

      expect(onChange).toHaveBeenCalledWith(undefined);
    });
  });

  describe('禁用状态', () => {
    it('禁用状态下添加按钮应该被禁用', () => {
      render(<EffectEditor {...defaultProps} disabled />);

      expect(screen.getByText('Add Test Effect').closest('button')).toBeDisabled();
    });
  });

  describe('readonly 类型添加', () => {
    it('点击添加按钮应该创建默认效果 (readonly)', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="readonly"
          onChange={onChange}
          isFulfill={true}
        />
      );

      fireEvent.click(screen.getByText('Add Test Effect'));

      expect(onChange).toHaveBeenCalledWith({
        state: { readonly: true },
      });
    });
  });

  describe('value 类型添加', () => {
    it('点击添加按钮应该创建默认效果 (value)', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="value"
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText('Add Test Effect'));

      expect(onChange).toHaveBeenCalledWith({
        function: '',
        value: '',
      });
    });
  });

  describe('options 类型添加', () => {
    it('点击添加按钮应该创建默认效果 (options)', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="options"
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText('Add Test Effect'));

      expect(onChange).toHaveBeenCalledWith({
        function: '',
        options: [],
      });
    });
  });

  describe('schema 类型添加', () => {
    it('点击添加按钮应该创建默认效果 (schema)', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="schema"
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText('Add Test Effect'));

      expect(onChange).toHaveBeenCalledWith({
        function: '',
        schema: {},
      });
    });
  });

  describe('isFulfill 为 false 时', () => {
    it('visibility 类型应该设置 visible 为 false', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          onChange={onChange}
          isFulfill={false}
        />
      );

      fireEvent.click(screen.getByText('Add Test Effect'));

      expect(onChange).toHaveBeenCalledWith({
        state: { visible: false },
      });
    });
  });

  describe('Switch 交互', () => {
    it('切换 visibility 开关应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ state: { visible: true } }}
        />
      );

      const switchInput = screen.getByRole('checkbox');
      fireEvent.click(switchInput);

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('value 类型输入交互', () => {
    it('修改函数名应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="value"
          onChange={onChange}
          value={{ function: '', value: '' }}
        />
      );

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'calcTotal' } });

      expect(onChange).toHaveBeenCalled();
    });

    it('修改固定值应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="value"
          onChange={onChange}
          value={{ function: '', value: '' }}
        />
      );

      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[1], { target: { value: '100' } });

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('options 类型输入交互', () => {
    it('修改函数名应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="options"
          onChange={onChange}
          value={{ function: '', options: [] }}
        />
      );

      // options 类型有多个 textbox，使用 getAllByRole 获取第一个
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'getOptions' } });

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('schema 类型输入交互', () => {
    it('修改函数名应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <EffectEditor
          {...defaultProps}
          linkageType="schema"
          onChange={onChange}
          value={{ function: '', schema: {} }}
        />
      );

      // schema 类型有多个 textbox，使用 getAllByRole 获取第一个
      const inputs = screen.getAllByRole('textbox');
      fireEvent.change(inputs[0], { target: { value: 'getSchema' } });

      expect(onChange).toHaveBeenCalled();
    });
  });
});
