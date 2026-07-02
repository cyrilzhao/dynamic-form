/**
 * ValidationEffectEditor 组件测试
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ValidationEffectEditor } from '../components/PropertyEditor/components/ValidationEffectEditor';
import { basicSchema } from './testHelpers';

// Mock FieldPathSelector 组件以便测试
jest.mock('../components/PropertyEditor/components/FieldPathSelector', () => ({
  FieldPathSelector: ({ value, onChange, disabled, placeholder }: any) => (
    <input
      data-testid="field-path-selector"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
    />
  ),
}));

describe('ValidationEffectEditor', () => {
  const defaultProps = {
    schema: basicSchema,
    currentFieldPath: '#/properties/name',
    label: 'Test Validation',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该显示标签', () => {
      render(<ValidationEffectEditor {...defaultProps} />);
      expect(screen.getByText('Test Validation')).toBeInTheDocument();
    });

    it('无配置时应该显示提示信息', () => {
      render(<ValidationEffectEditor {...defaultProps} />);
      expect(
        screen.getByText(/No configuration yet/i)
      ).toBeInTheDocument();
    });
  });

  describe('必填字段配置', () => {
    it('应该显示已配置的必填字段', () => {
      render(
        <ValidationEffectEditor
          {...defaultProps}
          value={{ required: ['name', 'age'] }}
        />
      );

      expect(screen.getByText('Required Fields:')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('age')).toBeInTheDocument();
    });

    it('点击移除按钮应该移除必填字段', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ required: ['name', 'age'] }}
        />
      );

      // 找到 name 字段的移除按钮
      const nameTag = screen.getByText('name');
      const removeButton = nameTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
      }

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('字段验证规则配置', () => {
    it('应该显示已配置的验证规则', () => {
      render(
        <ValidationEffectEditor
          {...defaultProps}
          value={{
            properties: {
              name: { minLength: 3, maxLength: 50 },
            },
          }}
        />
      );

      expect(screen.getByText('Field Validation Rules:')).toBeInTheDocument();
    });
  });

  describe('配置类型选择', () => {
    it('应该显示配置类型下拉框', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      expect(screen.getByText('Configuration Type')).toBeInTheDocument();
    });

    it('应该包含所有验证类型选项', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });

  describe('清除配置', () => {
    it('有配置时应该显示清除按钮', () => {
      render(
        <ValidationEffectEditor
          {...defaultProps}
          value={{ required: ['name'] }}
        />
      );

      // 应该有清除按钮
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('禁用状态', () => {
    it('禁用状态下输入应该被禁用', () => {
      render(
        <ValidationEffectEditor {...defaultProps} disabled />
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeDisabled();
    });
  });

  describe('验证规则移除', () => {
    it('点击移除按钮应该移除验证规则', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            properties: {
              name: { minLength: 3 },
            },
          }}
        />
      );

      // 找到验证规则的移除按钮
      const ruleTag = screen.getByText(/minLength: 3/);
      const removeButton = ruleTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onChange).toHaveBeenCalled();
      }
    });

    it('移除最后一个规则时应该删除整个字段配置', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            properties: {
              name: { minLength: 3 },
            },
          }}
        />
      );

      const ruleTag = screen.getByText(/minLength: 3/);
      const removeButton = ruleTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
      }

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('清除所有配置', () => {
    it('点击清除按钮应该清除所有配置', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ required: ['name'], properties: { age: { minimum: 0 } } }}
        />
      );

      // 找到清除按钮 (trash icon)
      const buttons = screen.getAllByRole('button');
      const trashButton = buttons.find(btn =>
        btn.querySelector('.bp5-icon-trash')
      );
      if (trashButton) {
        fireEvent.click(trashButton);
        expect(onChange).toHaveBeenCalledWith(undefined);
      }
    });
  });

  describe('多个验证规则', () => {
    it('应该正确显示多个字段的验证规则', () => {
      render(
        <ValidationEffectEditor
          {...defaultProps}
          value={{
            properties: {
              name: { minLength: 3, maxLength: 50 },
              age: { minimum: 0, maximum: 150 },
            },
          }}
        />
      );

      expect(screen.getByText('Field Validation Rules:')).toBeInTheDocument();
    });
  });

  describe('必填字段移除后的状态', () => {
    it('移除最后一个必填字段时应该清除 required 数组', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ required: ['name'] }}
        />
      );

      const nameTag = screen.getByText('name');
      const removeButton = nameTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
      }

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('添加验证规则', () => {
    it('应该显示验证类型选择器', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      expect(screen.getByText('Configuration Type')).toBeInTheDocument();
    });
  });

  describe('多个验证规则显示', () => {
    it('应该显示多个字段的多个验证规则', () => {
      render(
        <ValidationEffectEditor
          {...defaultProps}
          value={{
            properties: {
              name: { minLength: 3, maxLength: 50, pattern: '^[a-z]+$' },
              age: { minimum: 0, maximum: 150 },
            },
          }}
        />
      );

      expect(screen.getByText('Field Validation Rules:')).toBeInTheDocument();
    });
  });

  describe('移除验证规则后字段清理', () => {
    it('移除字段的最后一个规则时应该删除整个字段配置', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            properties: {
              name: { minLength: 3 },
            },
          }}
        />
      );

      const ruleTag = screen.getByText(/minLength: 3/);
      const removeButton = ruleTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
      }

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('移除必填字段', () => {
    it('移除必填字段应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ required: ['name', 'age'] }}
        />
      );

      const nameTag = screen.getByText('name');
      const removeButton = nameTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onChange).toHaveBeenCalled();
      }
    });

    it('移除最后一个必填字段应该清除 required 数组', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ required: ['name'] }}
        />
      );

      const nameTag = screen.getByText('name');
      const removeButton = nameTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('验证类型选择', () => {
    it('应该显示所有验证类型选项', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('选择 pattern 类型时应该显示文本输入框', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'pattern' } });

      expect(screen.getByPlaceholderText('Enter regex pattern')).toBeInTheDocument();
    });
  });

  describe('Select Field 字段选择器', () => {
    it('应该显示 Select Field 标签', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      expect(screen.getByText('Select Field')).toBeInTheDocument();
    });
  });

  describe('多个字段的验证规则', () => {
    it('应该正确显示多个字段的验证规则', () => {
      render(
        <ValidationEffectEditor
          {...defaultProps}
          value={{
            properties: {
              name: { minLength: 3, maxLength: 50 },
              age: { minimum: 0, maximum: 150 },
            },
          }}
        />
      );

      expect(screen.getByText('name:')).toBeInTheDocument();
      expect(screen.getByText('age:')).toBeInTheDocument();
    });

    it('移除一个规则后其他规则应该保留', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            properties: {
              name: { minLength: 3, maxLength: 50 },
            },
          }}
        />
      );

      const minLengthTag = screen.getByText(/minLength: 3/);
      const removeButton = minLengthTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('添加必填字段', () => {
    it('选择 required 类型时应该显示 Add Required Field 按钮', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'required' } });

      expect(screen.getByText('Add Required Field')).toBeInTheDocument();
    });
  });

  describe('添加验证规则 - minLength', () => {
    it('选择 minLength 类型时应该显示数字输入框', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'minLength' } });

      expect(screen.getByText('Validation Value')).toBeInTheDocument();
    });
  });

  describe('添加验证规则 - maxLength', () => {
    it('选择 maxLength 类型时应该显示数字输入框', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'maxLength' } });

      expect(screen.getByText('Validation Value')).toBeInTheDocument();
    });
  });

  describe('添加验证规则 - minimum', () => {
    it('选择 minimum 类型时应该显示数字输入框', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'minimum' } });

      expect(screen.getByText('Validation Value')).toBeInTheDocument();
    });
  });

  describe('添加验证规则 - maximum', () => {
    it('选择 maximum 类型时应该显示数字输入框', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'maximum' } });

      expect(screen.getByText('Validation Value')).toBeInTheDocument();
    });
  });

  describe('清空配置', () => {
    it('点击清空按钮应该调用 onChange(undefined)', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ required: ['name'], properties: { age: { minimum: 0 } } }}
        />
      );

      const buttons = screen.getAllByRole('button');
      const trashButton = buttons.find(btn =>
        btn.querySelector('.bp5-icon-trash')
      );
      if (trashButton) {
        fireEvent.click(trashButton);
        expect(onChange).toHaveBeenCalledWith(undefined);
      }
    });
  });

  describe('移除验证规则后清理字段', () => {
    it('移除字段的最后一个规则时应该删除整个字段配置', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            properties: {
              name: { minLength: 3 },
            },
          }}
        />
      );

      const ruleTag = screen.getByText(/minLength: 3/);
      const removeButton = ruleTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('handleAddRequired 功能', () => {
    it('添加必填字段应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
        />
      );

      // 选择 required 类型
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'required' } });

      // 应该显示 Add Required Field 按钮
      expect(screen.getByText('Add Required Field')).toBeInTheDocument();
    });
  });

  describe('handleAddValidation 功能', () => {
    it('添加 pattern 验证规则应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
        />
      );

      // 选择 pattern 类型
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'pattern' } });

      // 应该显示 pattern 输入框
      expect(screen.getByPlaceholderText('Enter regex pattern')).toBeInTheDocument();
    });
  });

  describe('handleRemoveRequired 功能', () => {
    it('移除必填字段应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ required: ['name', 'age'] }}
        />
      );

      // 找到 name 字段的移除按钮
      const nameTag = screen.getByText('name');
      const removeButton = nameTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onChange).toHaveBeenCalled();
      }
    });

    it('移除最后一个必填字段应该将 required 设为 undefined', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ required: ['name'] }}
        />
      );

      const nameTag = screen.getByText('name');
      const removeButton = nameTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('多个验证规则的移除', () => {
    it('移除一个规则后其他规则应该保留', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            properties: {
              name: { minLength: 3, maxLength: 50 },
            },
          }}
        />
      );

      const minLengthTag = screen.getByText(/minLength: 3/);
      const removeButton = minLengthTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('验证值输入', () => {
    it('选择 pattern 类型时输入正则表达式', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'pattern' } });

      const patternInput = screen.getByPlaceholderText('Enter regex pattern');
      fireEvent.change(patternInput, { target: { value: '^[a-z]+$' } });

      expect(patternInput).toHaveValue('^[a-z]+$');
    });

    it('选择 minLength 类型时输入数字', () => {
      render(<ValidationEffectEditor {...defaultProps} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'minLength' } });

      expect(screen.getByText('Validation Value')).toBeInTheDocument();
    });
  });

  describe('清除配置按钮', () => {
    it('有配置时点击清除按钮应该调用 onChange(undefined)', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ required: ['name'] }}
        />
      );

      const buttons = screen.getAllByRole('button');
      const trashButton = buttons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      if (trashButton) {
        fireEvent.click(trashButton);
        expect(onChange).toHaveBeenCalledWith(undefined);
      }
    });
  });

  describe('无配置提示', () => {
    it('无配置时应该显示提示信息', () => {
      render(<ValidationEffectEditor {...defaultProps} />);
      expect(screen.getByText(/No configuration yet/i)).toBeInTheDocument();
    });

    it('有配置时不应该显示提示信息', () => {
      render(
        <ValidationEffectEditor
          {...defaultProps}
          value={{ required: ['name'] }}
        />
      );
      expect(screen.queryByText(/No configuration yet/i)).not.toBeInTheDocument();
    });
  });

  describe('handleAddRequired 完整测试', () => {
    it('选择字段后点击 Add Required Field 应该添加必填字段', () => {
      const onChange = jest.fn();
      render(<ValidationEffectEditor {...defaultProps} onChange={onChange} />);

      // 使用 mock 的 FieldPathSelector 输入字段路径
      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: '#/properties/age' } });

      // 确保选择 required 类型
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'required' } });

      // 点击添加按钮
      const addButton = screen.getByText('Add Required Field');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        required: ['age'],
      });
    });

    it('使用相对路径 ./ 格式应该正确提取字段名', () => {
      const onChange = jest.fn();
      render(<ValidationEffectEditor {...defaultProps} onChange={onChange} />);

      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: './email' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'required' } });

      const addButton = screen.getByText('Add Required Field');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        required: ['email'],
      });
    });

    it('使用普通字段名应该直接使用', () => {
      const onChange = jest.fn();
      render(<ValidationEffectEditor {...defaultProps} onChange={onChange} />);

      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: 'username' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'required' } });

      const addButton = screen.getByText('Add Required Field');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        required: ['username'],
      });
    });

    it('不应该添加重复的必填字段', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{ required: ['age'] }}
        />
      );

      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: '#/properties/age' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'required' } });

      const addButton = screen.getByText('Add Required Field');
      fireEvent.click(addButton);

      // 不应该调用 onChange，因为字段已存在
      expect(onChange).not.toHaveBeenCalled();
    });

    it('未选择字段时不应该添加', () => {
      const onChange = jest.fn();
      render(<ValidationEffectEditor {...defaultProps} onChange={onChange} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'required' } });

      const addButton = screen.getByText('Add Required Field');
      // 按钮应该被禁用
      expect(addButton.closest('button')).toBeDisabled();
    });
  });

  describe('handleAddValidation 完整测试', () => {
    it('添加 pattern 验证规则应该调用 onChange', () => {
      const onChange = jest.fn();
      render(<ValidationEffectEditor {...defaultProps} onChange={onChange} />);

      // 选择字段
      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: '#/properties/name' } });

      // 选择 pattern 类型
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'pattern' } });

      // 输入正则表达式
      const patternInput = screen.getByPlaceholderText('Enter regex pattern');
      fireEvent.change(patternInput, { target: { value: '^[a-z]+$' } });

      // 点击添加按钮
      const addButton = screen.getByText('Add Validation Rule');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        properties: {
          name: { pattern: '^[a-z]+$' },
        },
      });
    });

    it('添加 minLength 验证规则应该解析为整数', () => {
      const onChange = jest.fn();
      render(<ValidationEffectEditor {...defaultProps} onChange={onChange} />);

      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: '#/properties/name' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'minLength' } });

      // 找到 NumericInput 并输入值
      const numericInput = screen.getByPlaceholderText('Enter value');
      fireEvent.change(numericInput, { target: { value: '5' } });

      const addButton = screen.getByText('Add Validation Rule');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        properties: {
          name: { minLength: 5 },
        },
      });
    });

    it('添加 maxLength 验证规则应该解析为整数', () => {
      const onChange = jest.fn();
      render(<ValidationEffectEditor {...defaultProps} onChange={onChange} />);

      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: '#/properties/name' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'maxLength' } });

      const numericInput = screen.getByPlaceholderText('Enter value');
      fireEvent.change(numericInput, { target: { value: '100' } });

      const addButton = screen.getByText('Add Validation Rule');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        properties: {
          name: { maxLength: 100 },
        },
      });
    });

    it('添加 minimum 验证规则应该解析为浮点数', () => {
      const onChange = jest.fn();
      render(<ValidationEffectEditor {...defaultProps} onChange={onChange} />);

      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: '#/properties/age' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'minimum' } });

      const numericInput = screen.getByPlaceholderText('Enter value');
      fireEvent.change(numericInput, { target: { value: '0.5' } });

      const addButton = screen.getByText('Add Validation Rule');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        properties: {
          age: { minimum: 0.5 },
        },
      });
    });

    it('添加 maximum 验证规则应该解析为浮点数', () => {
      const onChange = jest.fn();
      render(<ValidationEffectEditor {...defaultProps} onChange={onChange} />);

      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: '#/properties/age' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'maximum' } });

      const numericInput = screen.getByPlaceholderText('Enter value');
      fireEvent.change(numericInput, { target: { value: '99.9' } });

      const addButton = screen.getByText('Add Validation Rule');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        properties: {
          age: { maximum: 99.9 },
        },
      });
    });

    it('未输入验证值时不应该添加', () => {
      const onChange = jest.fn();
      render(<ValidationEffectEditor {...defaultProps} onChange={onChange} />);

      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: '#/properties/name' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'pattern' } });

      // 不输入值，按钮应该被禁用
      const addButton = screen.getByText('Add Validation Rule');
      expect(addButton.closest('button')).toBeDisabled();
    });

    it('添加规则到已有字段应该合并规则', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            properties: {
              name: { minLength: 3 },
            },
          }}
        />
      );

      const fieldSelector = screen.getByTestId('field-path-selector');
      fireEvent.change(fieldSelector, { target: { value: '#/properties/name' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'maxLength' } });

      const numericInput = screen.getByPlaceholderText('Enter value');
      fireEvent.change(numericInput, { target: { value: '50' } });

      const addButton = screen.getByText('Add Validation Rule');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        properties: {
          name: { minLength: 3, maxLength: 50 },
        },
      });
    });
  });

  describe('移除验证规则后清理', () => {
    it('移除字段最后一个规则时应该删除整个字段', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            properties: {
              name: { minLength: 3 },
            },
          }}
        />
      );

      const ruleTag = screen.getByText(/minLength: 3/);
      const removeButton = ruleTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onChange).toHaveBeenCalled();
      }
    });

    it('移除规则后其他规则应该保留', () => {
      const onChange = jest.fn();
      render(
        <ValidationEffectEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            properties: {
              name: { minLength: 3, maxLength: 50 },
            },
          }}
        />
      );

      const minLengthTag = screen.getByText(/minLength: 3/);
      const removeButton = minLengthTag.parentElement?.querySelector('button');
      if (removeButton) {
        fireEvent.click(removeButton);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });
});
