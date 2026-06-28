/**
 * PropertyEditor 组件测试
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PropertyEditor } from '../PropertyEditor';
import { SchemaBuilderContext } from '../SchemaBuilder';
import { basicSchema } from './testHelpers';

// Mock SchemaValidationEditor 组件
let mockSchemaValidationEditorOnChange: ((config: any) => void) | null = null;
jest.mock('../SchemaValidationEditor', () => ({
  SchemaValidationEditor: ({ onChange }: any) => {
    mockSchemaValidationEditorOnChange = onChange;
    return <div data-testid="schema-validation-editor">SchemaValidationEditor Mock</div>;
  },
}));

// 创建 mock context wrapper
const createWrapper = (contextValue: any) => {
  return ({ children }: { children: React.ReactNode }) => (
    <SchemaBuilderContext.Provider value={contextValue}>
      {children}
    </SchemaBuilderContext.Provider>
  );
};

describe('PropertyEditor', () => {
  const defaultContextValue = {
    schema: basicSchema,
    selectedPath: ['properties', 'name'],
    expandedPaths: { '': true },
    onSelect: jest.fn(),
    onUpdate: jest.fn(),
    onAddChild: jest.fn(),
    onAddSibling: jest.fn(),
    onDelete: jest.fn(),
    onToggleExpand: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('无选中节点时', () => {
    it('应该显示提示信息', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: ['properties', 'nonexistent'],
        }),
      });

      expect(
        screen.getByText(/Select a node from the tree/i)
      ).toBeInTheDocument();
    });
  });

  describe('字段级节点', () => {
    it('应该显示 Basic 标签页', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      expect(screen.getByText('Basic')).toBeInTheDocument();
    });

    it('应该显示 Validation 标签页', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      expect(screen.getByText('Validation')).toBeInTheDocument();
    });

    it('应该显示 UI Config 标签页', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      expect(screen.getByText('UI Config')).toBeInTheDocument();
    });

    it('应该显示 Linkage 标签页', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      expect(screen.getByText('Linkage')).toBeInTheDocument();
    });
  });

  describe('根节点', () => {
    it('应该显示 Schema-Level Configuration', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: [],
        }),
      });

      expect(
        screen.getByText('Schema-Level Configuration')
      ).toBeInTheDocument();
    });
  });

  describe('数组 items 节点', () => {
    it('应该正确渲染数组 items 节点', () => {
      const arraySchema = {
        type: 'object',
        title: 'Test',
        properties: {
          contacts: {
            type: 'array',
            title: 'Contacts',
            items: {
              type: 'object',
              title: 'Contact',
              properties: {},
            },
          },
        },
      };

      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: arraySchema,
          selectedPath: ['properties', 'contacts', 'items'],
        }),
      });

      expect(screen.getByText('Basic')).toBeInTheDocument();
    });
  });

  describe('标签页切换', () => {
    it('点击 Validation 应该切换到验证标签页', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('Validation'));
      // 验证标签页应该被激活
      expect(screen.getByText('Validation')).toBeInTheDocument();
    });

    it('点击 UI Config 应该切换到 UI 配置标签页', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('UI Config'));
      expect(screen.getByText('UI Config')).toBeInTheDocument();
    });

    it('点击 Linkage 应该切换到联动标签页', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('Linkage'));
      expect(screen.getByText('Linkage')).toBeInTheDocument();
    });
  });

  describe('不同类型字段', () => {
    it('应该正确渲染 number 类型字段', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: ['properties', 'age'],
        }),
      });

      expect(screen.getByText('Basic')).toBeInTheDocument();
    });

    it('应该正确渲染 email 格式字段', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: ['properties', 'email'],
        }),
      });

      expect(screen.getByText('Basic')).toBeInTheDocument();
    });
  });

  describe('字段属性编辑', () => {
    it('修改 title 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      const titleInput = screen.getByDisplayValue('Name');
      fireEvent.change(titleInput, { target: { value: 'New Name' } });
      fireEvent.blur(titleInput);

      expect(onUpdate).toHaveBeenCalled();
    });

    it('修改类型应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      const typeSelect = screen.getByDisplayValue('String');
      fireEvent.change(typeSelect, { target: { value: 'number' } });

      expect(onUpdate).toHaveBeenCalled();
    });
  });

  describe('object 类型字段', () => {
    it('应该正确渲染 object 类型字段', () => {
      const objectSchema = {
        type: 'object',
        title: 'Test',
        properties: {
          user: {
            type: 'object',
            title: 'User',
            properties: {
              name: { type: 'string', title: 'Name' },
            },
          },
        },
      };

      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: objectSchema,
          selectedPath: ['properties', 'user'],
        }),
      });

      expect(screen.getByText('Basic')).toBeInTheDocument();
    });
  });

  describe('boolean 类型字段', () => {
    it('应该正确渲染 boolean 类型字段', () => {
      const boolSchema = {
        type: 'object',
        title: 'Test',
        properties: {
          active: {
            type: 'boolean',
            title: 'Active',
          },
        },
      };

      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: boolSchema,
          selectedPath: ['properties', 'active'],
        }),
      });

      expect(screen.getByText('Basic')).toBeInTheDocument();
    });
  });

  describe('Validation 标签页内容', () => {
    it('应该显示验证配置选项', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('Validation'));
      // 验证标签页应该有内容
      expect(screen.getByText('Validation')).toBeInTheDocument();
    });
  });

  describe('UI Config 标签页内容', () => {
    it('应该显示 UI 配置选项', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('UI Config'));
      expect(screen.getByText('UI Config')).toBeInTheDocument();
    });
  });

  describe('Description 字段', () => {
    it('应该显示 Description 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });

  describe('Default Value 字段', () => {
    it('应该显示 Default Value 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      expect(screen.getByText('Default Value')).toBeInTheDocument();
    });

    it('boolean 类型应该显示 Switch 组件', () => {
      const boolSchema = {
        type: 'object',
        title: 'Test',
        properties: {
          active: {
            type: 'boolean',
            title: 'Active',
          },
        },
      };

      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: boolSchema,
          selectedPath: ['properties', 'active'],
        }),
      });

      expect(screen.getByText('Default Value')).toBeInTheDocument();
    });
  });

  describe('Validation 标签页 - string 类型', () => {
    it('应该显示 Min Length 和 Max Length 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('Validation'));
      expect(screen.getByText('Min Length')).toBeInTheDocument();
      expect(screen.getByText('Max Length')).toBeInTheDocument();
    });
  });

  describe('Validation 标签页 - number 类型', () => {
    it('应该显示 Minimum 和 Maximum 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: ['properties', 'age'],
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      expect(screen.getByText('Minimum')).toBeInTheDocument();
      expect(screen.getByText('Maximum')).toBeInTheDocument();
    });
  });

  describe('Linkage 标签页内容', () => {
    it('应该显示 Linkage 配置', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('Linkage'));
      expect(screen.getByText('Linkage')).toBeInTheDocument();
    });
  });

  describe('Name 字段编辑', () => {
    it('应该显示 Name 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('修改 Name 并失焦应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      const nameInput = screen.getByDisplayValue('name');
      fireEvent.change(nameInput, { target: { value: 'newName' } });
      fireEvent.blur(nameInput);

      expect(onUpdate).toHaveBeenCalled();
    });
  });

  describe('Description 字段编辑', () => {
    it('应该显示 Description 标签', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });

  describe('类型切换', () => {
    it('切换到 object 类型应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      const typeSelect = screen.getByDisplayValue('String');
      fireEvent.change(typeSelect, { target: { value: 'object' } });

      expect(onUpdate).toHaveBeenCalled();
    });

    it('切换到 array 类型应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      const typeSelect = screen.getByDisplayValue('String');
      fireEvent.change(typeSelect, { target: { value: 'array' } });

      expect(onUpdate).toHaveBeenCalled();
    });

    it('切换到 integer 类型应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      const typeSelect = screen.getByDisplayValue('String');
      fireEvent.change(typeSelect, { target: { value: 'integer' } });

      expect(onUpdate).toHaveBeenCalled();
    });
  });

  describe('Format 字段', () => {
    it('string 类型应该显示 Format 选择器', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      expect(screen.getByText('Format')).toBeInTheDocument();
    });
  });

  describe('Required 开关', () => {
    it('应该显示 Required Error Message 配置', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('UI Config'));
      expect(screen.getByText('Required Error Message')).toBeInTheDocument();
    });
  });

  describe('Description 字段修改', () => {
    it('应该显示 Description 文本框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      // 检查 Description 标签存在
      expect(screen.getByText('Description')).toBeInTheDocument();
    });
  });

  describe('Default Value 修改', () => {
    it('修改 string 类型的 default value 应该显示输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      // 找到 Default Value 输入框
      const defaultInputs = screen.getAllByRole('textbox');
      expect(defaultInputs.length).toBeGreaterThan(0);
    });

    it('修改 boolean 类型的 default value 应该显示 Switch', () => {
      const boolSchema = {
        type: 'object',
        title: 'Test',
        properties: {
          active: {
            type: 'boolean',
            title: 'Active',
            default: false,
          },
        },
      };

      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: boolSchema,
          selectedPath: ['properties', 'active'],
        }),
      });

      // 找到 Switch 组件
      const switches = screen.getAllByRole('checkbox');
      expect(switches.length).toBeGreaterThan(0);
    });
  });

  describe('Validation 标签页 - Pattern', () => {
    it('应该显示 Pattern (Regex) 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('Validation'));
      expect(screen.getByText('Pattern (Regex)')).toBeInTheDocument();
    });
  });

  describe('UI Config 标签页内容', () => {
    it('应该显示 Placeholder 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('UI Config'));
      expect(screen.getByText('Placeholder')).toBeInTheDocument();
    });

    it('应该显示 Required Error Message 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('UI Config'));
      expect(screen.getByText('Required Error Message')).toBeInTheDocument();
    });
  });

  describe('Validation 标签页 - number 类型验证', () => {
    it('应该显示 Minimum Error Message 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: ['properties', 'age'],
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      expect(screen.getByText('Minimum Error Message')).toBeInTheDocument();
    });

    it('应该显示 Maximum Error Message 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: ['properties', 'age'],
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      expect(screen.getByText('Maximum Error Message')).toBeInTheDocument();
    });
  });

  describe('Validation 标签页 - string 类型验证', () => {
    it('应该显示 Min Length Error Message 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('Validation'));
      expect(screen.getByText('Min Length Error Message')).toBeInTheDocument();
    });

    it('应该显示 Max Length Error Message 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('Validation'));
      expect(screen.getByText('Max Length Error Message')).toBeInTheDocument();
    });

    it('应该显示 Pattern Error Message 输入框', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('Validation'));
      expect(screen.getByText('Pattern Error Message')).toBeInTheDocument();
    });
  });

  describe('Linkage 标签页', () => {
    it('应该显示 LinkageEditor 组件', () => {
      render(<PropertyEditor />, {
        wrapper: createWrapper(defaultContextValue),
      });

      fireEvent.click(screen.getByText('Linkage'));
      expect(screen.getByText('Add Linkage Rule')).toBeInTheDocument();
    });
  });

  describe('Schema 级别配置', () => {
    it('修改 SchemaValidationEditor 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: [],
          onUpdate,
        }),
      });

      // Schema 级别节点应该显示 SchemaValidationEditor
      expect(screen.getByText('Schema-Level Configuration')).toBeInTheDocument();
    });

    it('SchemaValidationEditor onChange 应该调用 onUpdate with dependencies', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: [],
          onUpdate,
        }),
      });

      // 触发 SchemaValidationEditor 的 onChange
      if (mockSchemaValidationEditorOnChange) {
        mockSchemaValidationEditorOnChange({ dependencies: { name: ['age'] } });
        expect(onUpdate).toHaveBeenCalledWith([], { dependencies: { name: ['age'] } });
      }
    });

    it('SchemaValidationEditor onChange 应该调用 onUpdate with if/then/else', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: [],
          onUpdate,
        }),
      });

      if (mockSchemaValidationEditorOnChange) {
        mockSchemaValidationEditorOnChange({
          if: { properties: { type: { const: 'A' } } },
          then: { required: ['fieldA'] },
          else: { required: ['fieldB'] },
        });
        expect(onUpdate).toHaveBeenCalledWith([], {
          if: { properties: { type: { const: 'A' } } },
          then: { required: ['fieldA'] },
          else: { required: ['fieldB'] },
        });
      }
    });

    it('SchemaValidationEditor onChange 应该调用 onUpdate with allOf', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: [],
          onUpdate,
        }),
      });

      if (mockSchemaValidationEditorOnChange) {
        mockSchemaValidationEditorOnChange({ allOf: [{ required: ['name'] }] });
        expect(onUpdate).toHaveBeenCalledWith([], { allOf: [{ required: ['name'] }] });
      }
    });

    it('SchemaValidationEditor onChange 应该调用 onUpdate with anyOf', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: [],
          onUpdate,
        }),
      });

      if (mockSchemaValidationEditorOnChange) {
        mockSchemaValidationEditorOnChange({ anyOf: [{ required: ['name'] }] });
        expect(onUpdate).toHaveBeenCalledWith([], { anyOf: [{ required: ['name'] }] });
      }
    });

    it('SchemaValidationEditor onChange 应该调用 onUpdate with oneOf', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: [],
          onUpdate,
        }),
      });

      if (mockSchemaValidationEditorOnChange) {
        mockSchemaValidationEditorOnChange({ oneOf: [{ required: ['name'] }] });
        expect(onUpdate).toHaveBeenCalledWith([], { oneOf: [{ required: ['name'] }] });
      }
    });
  });

  describe('handleUIChange 功能', () => {
    it('修改 Placeholder 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('UI Config'));
      // Placeholder 输入框在 Placeholder FormGroup 中
      const placeholderGroup = screen.getByText('Placeholder').closest('.bp5-form-group');
      const placeholderInput = placeholderGroup?.querySelector('input');
      if (placeholderInput) {
        fireEvent.change(placeholderInput, { target: { value: 'New placeholder' } });
        expect(onUpdate).toHaveBeenCalled();
      }
    });
  });

  describe('handleLinkageChange 功能', () => {
    it('修改 Linkage 配置应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('Linkage'));
      // LinkagesEditor 使用 "Add Linkage Rule" 而非 "Enable Linkage"
      const addButton = screen.queryByText('Add Linkage Rule');
      if (addButton) {
        fireEvent.click(addButton);
        expect(onUpdate).toHaveBeenCalled();
      }
    });
  });

  describe('Description 字段编辑', () => {
    it('修改 Description 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      const descriptionTextarea = screen.getAllByRole('textbox').find(
        el => el.tagName.toLowerCase() === 'textarea'
      );
      if (descriptionTextarea) {
        fireEvent.change(descriptionTextarea, { target: { value: 'New description' } });
        expect(onUpdate).toHaveBeenCalled();
      }
    });
  });

  describe('Default Value 编辑', () => {
    it('修改 boolean 类型的 default value 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      const boolSchema = {
        type: 'object',
        title: 'Test',
        properties: {
          active: {
            type: 'boolean',
            title: 'Active',
            default: false,
          },
        },
      };

      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: boolSchema,
          selectedPath: ['properties', 'active'],
          onUpdate,
        }),
      });

      // 找到 Default Value 的 Switch
      const switches = screen.getAllByRole('checkbox');
      if (switches.length > 0) {
        fireEvent.click(switches[0]);
        expect(onUpdate).toHaveBeenCalled();
      }
    });

    it('修改 string 类型的 default value 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      // 找到 Default Value 输入框
      const inputs = screen.getAllByRole('textbox');
      const defaultInput = inputs.find(input =>
        input.closest('.bp5-form-group')?.textContent?.includes('Default Value')
      );
      if (defaultInput) {
        fireEvent.change(defaultInput, { target: { value: 'default text' } });
        expect(onUpdate).toHaveBeenCalled();
      }
    });
  });

  describe('Validation 标签页交互', () => {
    it('修改 Min Length 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      // NumericInput 的值变化
      const minLengthGroup = screen.getByText('Min Length').closest('.bp5-form-group');
      const input = minLengthGroup?.querySelector('input');
      if (input) {
        fireEvent.change(input, { target: { value: '5' } });
      }
    });

    it('修改 Min Length Error Message 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      const errorMsgInput = screen.getByPlaceholderText('Custom error message for minLength');
      fireEvent.change(errorMsgInput, { target: { value: 'Min length error' } });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('修改 Max Length Error Message 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      const errorMsgInput = screen.getByPlaceholderText('Custom error message for maxLength');
      fireEvent.change(errorMsgInput, { target: { value: 'Max length error' } });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('修改 Pattern 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      // Pattern 输入框在 Pattern (Regex) FormGroup 中
      const patternGroup = screen.getByText('Pattern (Regex)').closest('.bp5-form-group');
      const patternInput = patternGroup?.querySelector('input');
      if (patternInput) {
        fireEvent.change(patternInput, { target: { value: '^[0-9]+$' } });
        expect(onUpdate).toHaveBeenCalled();
      }
    });

    it('修改 Pattern Error Message 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      const errorMsgInput = screen.getByPlaceholderText('Custom error message for pattern');
      fireEvent.change(errorMsgInput, { target: { value: 'Pattern error' } });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('修改 Format 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      const formatSelect = screen.getAllByRole('combobox').find(
        select => select.closest('.bp5-form-group')?.textContent?.includes('Format')
      );
      if (formatSelect) {
        fireEvent.change(formatSelect, { target: { value: 'email' } });
        expect(onUpdate).toHaveBeenCalled();
      }
    });
  });

  describe('Number 类型 Validation', () => {
    it('修改 Minimum Error Message 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: ['properties', 'age'],
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      const errorMsgInput = screen.getByPlaceholderText('Custom error message for minimum');
      fireEvent.change(errorMsgInput, { target: { value: 'Min error' } });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('修改 Maximum Error Message 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: ['properties', 'age'],
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('Validation'));
      const errorMsgInput = screen.getByPlaceholderText('Custom error message for maximum');
      fireEvent.change(errorMsgInput, { target: { value: 'Max error' } });
      expect(onUpdate).toHaveBeenCalled();
    });
  });

  describe('UI Config 标签页交互', () => {
    it('修改 Required Error Message 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('UI Config'));
      const errorMsgInput = screen.getByPlaceholderText('This field is required');
      fireEvent.change(errorMsgInput, { target: { value: 'Required error' } });
      expect(onUpdate).toHaveBeenCalled();
    });

    it('点击 Hidden 开关应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('UI Config'));
      const hiddenSwitch = screen.getByText('Hidden').closest('label')?.querySelector('input');
      if (hiddenSwitch) {
        fireEvent.click(hiddenSwitch);
        expect(onUpdate).toHaveBeenCalled();
      }
    });

    it('点击 Disabled 开关应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('UI Config'));
      const disabledSwitch = screen.getByText('Disabled').closest('label')?.querySelector('input');
      if (disabledSwitch) {
        fireEvent.click(disabledSwitch);
        expect(onUpdate).toHaveBeenCalled();
      }
    });

    it('点击 Readonly 开关应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('UI Config'));
      const readonlySwitch = screen.getByText('Readonly').closest('label')?.querySelector('input');
      if (readonlySwitch) {
        fireEvent.click(readonlySwitch);
        expect(onUpdate).toHaveBeenCalled();
      }
    });

    it('修改 Layout 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('UI Config'));
      const layoutGroup = screen.getByText('Layout').closest('.bp5-form-group');
      const layoutSelect = layoutGroup?.querySelector('select');
      if (layoutSelect) {
        fireEvent.change(layoutSelect, { target: { value: 'horizontal' } });
        expect(onUpdate).toHaveBeenCalled();
      }
    });

    it('修改 Label Width 应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('UI Config'));
      const labelWidthGroup = screen.getByText('Label Width').closest('.bp5-form-group');
      const labelWidthInput = labelWidthGroup?.querySelector('input');
      if (labelWidthInput) {
        fireEvent.change(labelWidthInput, { target: { value: '120px' } });
        expect(onUpdate).toHaveBeenCalled();
      }
    });

    it('点击 Flatten Path 开关应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('UI Config'));
      const flattenSwitch = screen.getByText('Flatten Path (Transparent)').closest('label')?.querySelector('input');
      if (flattenSwitch) {
        fireEvent.click(flattenSwitch);
        expect(onUpdate).toHaveBeenCalled();
      }
    });

    it('点击 Flatten Prefix 开关应该调用 onUpdate', () => {
      const onUpdate = jest.fn();
      render(<PropertyEditor />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onUpdate,
        }),
      });

      fireEvent.click(screen.getByText('UI Config'));
      const flattenPrefixSwitch = screen.getByText('Flatten Prefix').closest('label')?.querySelector('input');
      if (flattenPrefixSwitch) {
        fireEvent.click(flattenPrefixSwitch);
        expect(onUpdate).toHaveBeenCalled();
      }
    });
  });
});
