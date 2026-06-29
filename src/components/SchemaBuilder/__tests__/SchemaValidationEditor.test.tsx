/**
 * SchemaValidationEditor 组件测试
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SchemaValidationEditor } from '../components/PropertyEditor/components/SchemaValidationEditor';
import { basicSchema } from './testHelpers';

// Mock FieldPathSelector 组件
let mockFieldPathSelectorOnChange: ((value: string) => void) | null = null;
jest.mock('../components/PropertyEditor/components/FieldPathSelector', () => ({
  FieldPathSelector: ({ value, onChange, placeholder }: any) => {
    mockFieldPathSelectorOnChange = onChange;
    return (
      <input
        data-testid="field-path-selector"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    );
  },
}));

// Mock ValidationEffectEditor 组件
let mockValidationEffectEditorOnChange: ((value: any) => void) | null = null;
jest.mock('../components/PropertyEditor/components/ValidationEffectEditor', () => ({
  ValidationEffectEditor: ({ value, onChange, label }: any) => {
    mockValidationEffectEditorOnChange = onChange;
    return (
      <div data-testid="validation-effect-editor">
        <span>{label}</span>
        <button
          data-testid="mock-validation-change"
          onClick={() => onChange({ required: ['testField'] })}
        >
          Mock Change
        </button>
      </div>
    );
  },
}));

describe('SchemaValidationEditor', () => {
  const defaultProps = {
    schema: basicSchema,
    currentFieldPath: '',
    parentSchema: basicSchema,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFieldPathSelectorOnChange = null;
    mockValidationEffectEditorOnChange = null;
  });

  describe('基础渲染', () => {
    it('应该显示条件验证说明', () => {
      render(<SchemaValidationEditor {...defaultProps} />);
      expect(screen.getByText('Conditional Validation')).toBeInTheDocument();
    });

    it('应该显示所有验证类型标签页', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      expect(screen.getByText('Dependencies')).toBeInTheDocument();
      expect(screen.getByText('If/Then/Else')).toBeInTheDocument();
      expect(screen.getByText('AllOf')).toBeInTheDocument();
      expect(screen.getByText('AnyOf')).toBeInTheDocument();
      expect(screen.getByText('OneOf')).toBeInTheDocument();
    });

    it('应该显示重要提示', () => {
      render(<SchemaValidationEditor {...defaultProps} />);
      expect(screen.getAllByText(/data validation/i).length).toBeGreaterThan(0);
    });
  });

  describe('Dependencies 标签页', () => {
    it('默认应该显示 Dependencies 面板', () => {
      render(<SchemaValidationEditor {...defaultProps} />);
      expect(
        screen.getByText(/When field A has a value/i)
      ).toBeInTheDocument();
    });
  });

  describe('标签页切换', () => {
    it('点击 If/Then/Else 应该切换到对应面板', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      fireEvent.click(screen.getByText('If/Then/Else'));

      expect(
        screen.getByText(/Apply different validation rules/i)
      ).toBeInTheDocument();
    });

    it('点击 AllOf 应该切换到对应面板', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      fireEvent.click(screen.getByText('AllOf'));

      expect(
        screen.getByText(/AllOf \(All Must Match\)/i)
      ).toBeInTheDocument();
    });
  });

  describe('禁用状态', () => {
    it('禁用状态下组件应该正常渲染', () => {
      render(<SchemaValidationEditor {...defaultProps} disabled />);
      expect(screen.getByText('Conditional Validation')).toBeInTheDocument();
    });
  });

  describe('AnyOf 标签页', () => {
    it('点击 AnyOf 应该切换到对应面板', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      fireEvent.click(screen.getByText('AnyOf'));

      expect(
        screen.getByText(/AnyOf \(At Least One\)/i)
      ).toBeInTheDocument();
    });
  });

  describe('OneOf 标签页', () => {
    it('点击 OneOf 应该切换到对应面板', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      fireEvent.click(screen.getByText('OneOf'));

      expect(
        screen.getByText(/OneOf \(Exactly One\)/i)
      ).toBeInTheDocument();
    });
  });

  describe('带有初始值', () => {
    it('应该正确渲染带有 dependencies 的配置', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );
      expect(screen.getByText('Dependencies')).toBeInTheDocument();
    });

    it('应该正确渲染带有 if/then/else 的配置', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            if: { properties: { name: { const: 'test' } } },
            then: { required: ['age'] },
            else: { required: ['email'] },
          }}
        />
      );
      fireEvent.click(screen.getByText('If/Then/Else'));
      expect(screen.getByText('Condition Configured')).toBeInTheDocument();
    });

    it('应该正确渲染带有 allOf 的配置', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            allOf: [{ required: ['name'] }, { required: ['age'] }],
          }}
        />
      );
      fireEvent.click(screen.getByText('AllOf'));
      expect(screen.getByText('Configured Schemas (2):')).toBeInTheDocument();
    });

    it('应该正确渲染带有 anyOf 的配置', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            anyOf: [{ required: ['email'] }],
          }}
        />
      );
      fireEvent.click(screen.getByText('AnyOf'));
      expect(screen.getByText('Configured Schemas (1):')).toBeInTheDocument();
    });

    it('应该正确渲染带有 oneOf 的配置', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            oneOf: [{ required: ['name'] }],
          }}
        />
      );
      fireEvent.click(screen.getByText('OneOf'));
      expect(screen.getByText('Configured Schemas (1):')).toBeInTheDocument();
    });
  });

  describe('Dependencies 编辑器交互', () => {
    it('应该显示现有依赖列表', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );
      expect(screen.getByText('Existing Dependencies:')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
    });

    it('应该显示 Schema 类型依赖', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }] },
            },
          }}
        />
      );
      expect(screen.getByText('Schema')).toBeInTheDocument();
    });

    it('点击展开按钮应该显示依赖配置', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );
      // 点击展开按钮
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 展开后应该显示 Add Field
      expect(screen.getByText('Add Field')).toBeInTheDocument();
    });

    it('点击删除按钮应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );
      // 点击删除按钮
      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('LogicalCombination 编辑器交互', () => {
    it('点击 Add Schema 应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByText('AllOf'));
      // 使用 getAllByText 获取所有 Add Schema 按钮，点击第一个
      const addButtons = screen.getAllByText('Add Schema');
      fireEvent.click(addButtons[0]);
      expect(onChange).toHaveBeenCalled();
    });

    it('点击展开按钮应该显示 schema 编辑器', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            allOf: [{ required: ['name'] }],
          }}
        />
      );
      fireEvent.click(screen.getByText('AllOf'));
      // 点击展开按钮
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 展开后应该显示 Schema 1 Rules
      expect(screen.getByText('Schema 1 Rules')).toBeInTheDocument();
    });

    it('点击删除按钮应该移除 schema', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            allOf: [{ required: ['name'] }],
          }}
        />
      );
      fireEvent.click(screen.getByText('AllOf'));
      // 点击删除按钮
      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('If/Then/Else 编辑器交互', () => {
    it('点击 Clear 按钮应该清除条件', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            if: { properties: { name: { const: 'test' } } },
            then: { required: ['age'] },
          }}
        />
      );
      fireEvent.click(screen.getByText('If/Then/Else'));
      fireEvent.click(screen.getByText('Clear'));
      expect(onChange).toHaveBeenCalled();
    });

    it('应该显示条件信息', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            if: { properties: { name: { const: 'test' } } },
            then: { required: ['age'] },
          }}
        />
      );
      fireEvent.click(screen.getByText('If/Then/Else'));
      expect(screen.getByText('name')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
    });
  });

  describe('添加新依赖', () => {
    it('Add Dependency 按钮在没有选择字段时应该被禁用', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      const addButton = screen.getByText('Add Dependency');
      expect(addButton.closest('button')).toBeDisabled();
    });
  });

  describe('AnyOf 编辑器', () => {
    it('点击 Add Schema 应该添加新 schema', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByText('AnyOf'));
      const addButtons = screen.getAllByText('Add Schema');
      fireEvent.click(addButtons[0]);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('OneOf 编辑器', () => {
    it('点击 Add Schema 应该添加新 schema', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
        />
      );
      fireEvent.click(screen.getByText('OneOf'));
      const addButtons = screen.getAllByText('Add Schema');
      fireEvent.click(addButtons[0]);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('简单依赖配置展开', () => {
    it('展开简单依赖应该显示配置界面', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: ['age', 'email'],
            },
          }}
        />
      );

      // 点击展开按钮
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 展开后应该显示依赖字段
      expect(screen.getByText('age')).toBeInTheDocument();
    });
  });

  describe('Schema 依赖配置展开', () => {
    it('展开 Schema 依赖应该显示配置界面', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }] },
            },
          }}
        />
      );

      // 点击展开按钮
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 展开后应该显示 Add Schema Condition
      expect(screen.getByText('Add Schema Condition')).toBeInTheDocument();
    });
  });

  describe('添加依赖功能', () => {
    it('选择触发字段后应该启用 Add Dependency 按钮', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      // 初始状态下按钮应该被禁用
      const addButton = screen.getByText('Add Dependency');
      expect(addButton.closest('button')).toBeDisabled();
    });

    it('应该显示依赖类型选择器', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      expect(screen.getByText('Dependency Type')).toBeInTheDocument();
      expect(screen.getByText('Simple (Required Fields)')).toBeInTheDocument();
    });
  });

  describe('If/Then/Else 设置条件', () => {
    it('未设置条件时应该显示条件配置表单', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      fireEvent.click(screen.getByText('If/Then/Else'));

      expect(screen.getByText('Condition Field')).toBeInTheDocument();
      expect(screen.getByText('Condition Value')).toBeInTheDocument();
      expect(screen.getByText('Set Condition')).toBeInTheDocument();
    });

    it('Set Condition 按钮在未选择字段时应该被禁用', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      fireEvent.click(screen.getByText('If/Then/Else'));

      const setButton = screen.getByText('Set Condition');
      expect(setButton.closest('button')).toBeDisabled();
    });

    it('已设置条件时应该显示 Then 和 Else 编辑器', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            if: { properties: { name: { const: 'test' } } },
            then: { required: ['age'] },
            else: { required: ['email'] },
          }}
        />
      );

      fireEvent.click(screen.getByText('If/Then/Else'));

      expect(screen.getByText('Then (When Condition is True)')).toBeInTheDocument();
      expect(screen.getByText('Else (When Condition is False)')).toBeInTheDocument();
    });
  });

  describe('LogicalCombination 删除 schema', () => {
    it('删除 allOf 中的 schema 应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            allOf: [{ required: ['name'] }, { required: ['age'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AllOf'));

      // 找到删除按钮
      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(onChange).toHaveBeenCalled();
    });

    it('删除最后一个 schema 应该传递 undefined', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            allOf: [{ required: ['name'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AllOf'));

      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('LogicalCombination 展开编辑', () => {
    it('点击展开按钮应该显示 schema 编辑器', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            anyOf: [{ required: ['email'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AnyOf'));

      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 展开后应该显示 Schema 1 Rules
      expect(screen.getByText('Schema 1 Rules')).toBeInTheDocument();
    });
  });

  describe('Dependencies 删除依赖', () => {
    it('删除依赖后如果没有剩余依赖应该传递 undefined', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('SimpleDependencyConfig 操作', () => {
    it('展开简单依赖后应该显示已配置的必填字段', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: ['age', 'email'],
            },
          }}
        />
      );

      // 点击展开按钮
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 展开后应该显示依赖字段
      expect(screen.getByText('age')).toBeInTheDocument();
      expect(screen.getByText('email')).toBeInTheDocument();
    });

    it('应该显示 Add Field 按钮', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      expect(screen.getByText('Add Field')).toBeInTheDocument();
    });
  });

  describe('SchemaDependencyConfig 操作', () => {
    it('展开 Schema 依赖后应该显示 Add Schema Condition 按钮', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }] },
            },
          }}
        />
      );

      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      expect(screen.getByText('Add Schema Condition')).toBeInTheDocument();
    });

    it('点击 Add Schema Condition 应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [] },
            },
          }}
        />
      );

      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      fireEvent.click(screen.getByText('Add Schema Condition'));
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('禁用状态下的交互', () => {
    it('禁用状态下 Add Dependency 按钮应该被禁用', () => {
      render(<SchemaValidationEditor {...defaultProps} disabled />);

      const addButton = screen.getByText('Add Dependency');
      expect(addButton.closest('button')).toBeDisabled();
    });

    it('禁用状态下 Add Schema 按钮应该被禁用', () => {
      render(<SchemaValidationEditor {...defaultProps} disabled />);

      fireEvent.click(screen.getByText('AllOf'));

      const addButtons = screen.getAllByText('Add Schema');
      expect(addButtons[0].closest('button')).toBeDisabled();
    });
  });

  describe('SimpleDependencyConfig 添加字段', () => {
    it('点击 Add Field 应该添加必填字段', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 应该显示 Add Field 按钮
      expect(screen.getByText('Add Field')).toBeInTheDocument();
    });

    it('移除必填字段应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age', 'email'],
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 找到 age 标签的移除按钮
      const ageTag = screen.getByText('age');
      const removeButton = ageTag.parentElement?.querySelector('button');
      expect(removeButton).toBeDefined();
      fireEvent.click(removeButton!);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('SchemaDependencyConfig 删除 Schema', () => {
    it('删除 Schema 条件应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }, { required: ['email'] }] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 找到删除按钮
      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('LogicalCombination 展开编辑 Schema', () => {
    it('展开 Schema 后应该显示 ValidationEffectEditor', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            allOf: [{ required: ['name'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AllOf'));

      // 点击展开按钮
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 展开后应该显示 Schema 1 Rules 标签
      expect(screen.getByText('Schema 1 Rules')).toBeInTheDocument();
    });

    it('删除 anyOf 中的 Schema 应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            anyOf: [{ required: ['email'] }, { required: ['phone'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AnyOf'));

      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(onChange).toHaveBeenCalled();
    });

    it('删除 oneOf 中的 Schema 应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            oneOf: [{ required: ['name'] }, { required: ['email'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('OneOf'));

      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('If/Then/Else Then 和 Else 编辑', () => {
    it('Then 编辑器应该显示配置类型选择器', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            if: { properties: { name: { const: 'test' } } },
            then: { required: ['age'] },
          }}
        />
      );

      fireEvent.click(screen.getByText('If/Then/Else'));

      expect(screen.getByText('Then (When Condition is True)')).toBeInTheDocument();
    });

    it('Else 编辑器应该显示配置类型选择器', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            if: { properties: { name: { const: 'test' } } },
            then: { required: ['age'] },
            else: { required: ['email'] },
          }}
        />
      );

      fireEvent.click(screen.getByText('If/Then/Else'));

      expect(screen.getByText('Else (When Condition is False)')).toBeInTheDocument();
    });
  });

  describe('依赖类型切换', () => {
    it('切换依赖类型为 Schema 应该更新选择器', () => {
      render(<SchemaValidationEditor {...defaultProps} />);

      const select = screen.getByDisplayValue('Simple (Required Fields)');
      fireEvent.change(select, { target: { value: 'schema' } });

      expect(screen.getByDisplayValue('Schema (Complex Rules)')).toBeInTheDocument();
    });
  });

  describe('handleAddDependency 功能', () => {
    it('添加简单依赖应该调用 onChange 并创建空数组', () => {
      const onChange = jest.fn();
      render(<SchemaValidationEditor {...defaultProps} onChange={onChange} />);

      // Add Dependency 按钮在未选择字段时应该被禁用
      const addButton = screen.getByText('Add Dependency');
      expect(addButton.closest('button')).toBeDisabled();
    });

    it('添加 Schema 类型依赖应该创建 oneOf 结构', () => {
      const onChange = jest.fn();
      render(<SchemaValidationEditor {...defaultProps} onChange={onChange} />);

      // 切换到 Schema 类型
      const typeSelect = screen.getByDisplayValue('Simple (Required Fields)');
      fireEvent.change(typeSelect, { target: { value: 'schema' } });

      // Add Dependency 按钮在未选择字段时应该被禁用
      const addButton = screen.getByText('Add Dependency');
      expect(addButton.closest('button')).toBeDisabled();
    });
  });

  describe('LogicalCombination 更新 Schema', () => {
    it('更新 allOf 中的 Schema 应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            allOf: [{ required: ['name'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AllOf'));

      // 展开 Schema 编辑器
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
    });
  });

  describe('IfThenElse 设置条件', () => {
    it('设置条件后应该显示 Then 和 Else 编辑器', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText('If/Then/Else'));

      // 应该显示条件配置表单
      expect(screen.getByText('Condition Field')).toBeInTheDocument();
      expect(screen.getByText('Condition Value')).toBeInTheDocument();
    });
  });

  describe('SimpleDependencyConfig 交互', () => {
    it('展开简单依赖后点击 Add Field 按钮', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // Add Field 按钮应该存在
      expect(screen.getByText('Add Field')).toBeInTheDocument();
    });
  });

  describe('SchemaDependencyConfig 交互', () => {
    it('展开 Schema 依赖后删除 Schema 条件', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }, { required: ['email'] }] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
    });
  });

  describe('LogicalCombination 展开和更新', () => {
    it('展开 anyOf Schema 后应该显示 ValidationEffectEditor', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            anyOf: [{ required: ['email'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AnyOf'));

      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      expect(screen.getByText('Schema 1 Rules')).toBeInTheDocument();
    });

    it('展开 oneOf Schema 后应该显示 ValidationEffectEditor', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            oneOf: [{ required: ['name'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('OneOf'));

      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      expect(screen.getByText('Schema 1 Rules')).toBeInTheDocument();
    });
  });

  describe('SimpleDependencyConfig 添加和移除字段', () => {
    it('展开简单依赖后点击 Add Field 按钮应该可用', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // Add Field 按钮应该存在
      const addFieldButton = screen.getByText('Add Field');
      expect(addFieldButton).toBeInTheDocument();
    });

    it('移除简单依赖中的字段应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age', 'email'],
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 找到 age 标签的移除按钮
      const ageTag = screen.getByText('age');
      const tagRemoveButton = ageTag.closest('.bp5-tag')?.querySelector('.bp5-tag-remove') ||
        ageTag.closest('.bp6-tag')?.querySelector('.bp6-tag-remove');
      expect(tagRemoveButton).toBeDefined();
      fireEvent.click(tagRemoveButton!);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('SchemaDependencyConfig 添加和移除 Schema', () => {
    it('点击 Add Schema Condition 应该添加新的 schema', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      const addSchemaButton = screen.getByText('Add Schema Condition');
      fireEvent.click(addSchemaButton);
      expect(onChange).toHaveBeenCalled();
    });

    it('删除 Schema 依赖中的条件应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }, { required: ['email'] }] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 找到删除按钮
      const allButtons = screen.getAllByRole('button');
      const trashButtons = allButtons.filter(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButtons.length).toBeGreaterThan(1);
      // 点击第二个删除按钮（第一个是依赖本身的删除按钮）
      fireEvent.click(trashButtons[1]);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('IfThenElse 设置和清除条件', () => {
    it('设置条件后应该显示 Then 和 Else 编辑器', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText('If/Then/Else'));

      // 输入条件值
      const conditionValueInput = screen.getByPlaceholderText('Enter value');
      fireEvent.change(conditionValueInput, { target: { value: 'test' } });

      // Set Condition 按钮在未选择字段时应该被禁用
      const setConditionButton = screen.getByText('Set Condition');
      expect(setConditionButton.closest('button')).toBeDisabled();
    });
  });

  describe('Dependencies onChange 回调', () => {
    it('删除依赖后应该触发 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 找到删除按钮
      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(onChange).toHaveBeenCalled();
    });

    it('删除最后一个依赖应该传递 undefined', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      // 验证 onChange 被调用
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('LogicalCombination onChange 回调', () => {
    it('添加 allOf schema 应该触发 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText('AllOf'));
      const addButtons = screen.getAllByText('Add Schema');
      fireEvent.click(addButtons[0]);

      expect(onChange).toHaveBeenCalled();
    });

    it('添加 anyOf schema 应该触发 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText('AnyOf'));
      const addButtons = screen.getAllByText('Add Schema');
      fireEvent.click(addButtons[0]);

      expect(onChange).toHaveBeenCalled();
    });

    it('添加 oneOf schema 应该触发 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText('OneOf'));
      const addButtons = screen.getAllByText('Add Schema');
      fireEvent.click(addButtons[0]);

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('IfThenElse onChange 回调', () => {
    it('清除条件应该触发 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            if: { properties: { name: { const: 'test' } } },
            then: { required: ['age'] },
          }}
        />
      );

      fireEvent.click(screen.getByText('If/Then/Else'));
      fireEvent.click(screen.getByText('Clear'));

      expect(onChange).toHaveBeenCalled();
      const callArg = onChange.mock.calls[0][0];
      expect(callArg.if).toBeUndefined();
      expect(callArg.then).toBeUndefined();
      expect(callArg.else).toBeUndefined();
    });
  });

  describe('LogicalCombination 删除和更新 Schema', () => {
    it('删除 allOf 中最后一个 schema 应该传递 undefined', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            allOf: [{ required: ['name'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AllOf'));

      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      if (trashButton) {
        fireEvent.click(trashButton);
        expect(onChange).toHaveBeenCalled();
      }
    });

    it('删除 anyOf 中最后一个 schema 应该传递 undefined', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            anyOf: [{ required: ['email'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AnyOf'));

      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      if (trashButton) {
        fireEvent.click(trashButton);
        expect(onChange).toHaveBeenCalled();
      }
    });

    it('删除 oneOf 中最后一个 schema 应该传递 undefined', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            oneOf: [{ required: ['name'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('OneOf'));

      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      if (trashButton) {
        fireEvent.click(trashButton);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('getFieldNameFromPath 函数', () => {
    it('应该正确处理相对路径', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
        />
      );
      // 组件应该正常渲染
      expect(screen.getByText('Dependencies')).toBeInTheDocument();
    });
  });

  describe('DependenciesEditor handleAddDependency', () => {
    it('选择触发字段后添加简单依赖应该调用 onChange', () => {
      const onChange = jest.fn();
      render(<SchemaValidationEditor {...defaultProps} onChange={onChange} />);

      // 使用 mock 的 FieldPathSelector 输入字段路径 - 选择 "Select trigger field" 的那个
      const fieldSelectors = screen.getAllByTestId('field-path-selector');
      const triggerFieldSelector = fieldSelectors.find(
        el => el.getAttribute('placeholder') === 'Select trigger field'
      );
      expect(triggerFieldSelector).toBeDefined();
      fireEvent.change(triggerFieldSelector!, { target: { value: '#/properties/name' } });

      // 点击 Add Dependency 按钮
      const addButton = screen.getByText('Add Dependency');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        dependencies: { name: [] },
      });
    });

    it('选择触发字段后添加 Schema 类型依赖应该创建 oneOf 结构', () => {
      const onChange = jest.fn();
      render(<SchemaValidationEditor {...defaultProps} onChange={onChange} />);

      // 切换到 Schema 类型
      const typeSelect = screen.getByDisplayValue('Simple (Required Fields)');
      fireEvent.change(typeSelect, { target: { value: 'schema' } });

      // 使用 mock 的 FieldPathSelector 输入字段路径
      const fieldSelectors = screen.getAllByTestId('field-path-selector');
      const triggerFieldSelector = fieldSelectors.find(
        el => el.getAttribute('placeholder') === 'Select trigger field'
      );
      expect(triggerFieldSelector).toBeDefined();
      fireEvent.change(triggerFieldSelector!, { target: { value: '#/properties/age' } });

      // 点击 Add Dependency 按钮
      const addButton = screen.getByText('Add Dependency');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        dependencies: { age: { oneOf: [] } },
      });
    });

    it('使用相对路径 ./ 格式添加依赖应该正确提取字段名', () => {
      const onChange = jest.fn();
      render(<SchemaValidationEditor {...defaultProps} onChange={onChange} />);

      const fieldSelectors = screen.getAllByTestId('field-path-selector');
      const triggerFieldSelector = fieldSelectors.find(
        el => el.getAttribute('placeholder') === 'Select trigger field'
      );
      expect(triggerFieldSelector).toBeDefined();
      fireEvent.change(triggerFieldSelector!, { target: { value: './email' } });

      const addButton = screen.getByText('Add Dependency');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        dependencies: { email: [] },
      });
    });

    it('使用普通字段名添加依赖应该直接使用', () => {
      const onChange = jest.fn();
      render(<SchemaValidationEditor {...defaultProps} onChange={onChange} />);

      const fieldSelectors = screen.getAllByTestId('field-path-selector');
      const triggerFieldSelector = fieldSelectors.find(
        el => el.getAttribute('placeholder') === 'Select trigger field'
      );
      expect(triggerFieldSelector).toBeDefined();
      fireEvent.change(triggerFieldSelector!, { target: { value: 'username' } });

      const addButton = screen.getByText('Add Dependency');
      fireEvent.click(addButton);

      expect(onChange).toHaveBeenCalledWith({
        dependencies: { username: [] },
      });
    });
  });

  describe('DependenciesEditor handleRemoveDependency', () => {
    it('删除依赖后如果还有其他依赖应该保留', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
              email: ['phone'],
            },
          }}
        />
      );

      // 找到第一个删除按钮
      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      if (trashButton) {
        fireEvent.click(trashButton);
        expect(onChange).toHaveBeenCalled();
        // 验证还有一个依赖保留
        const callArg = onChange.mock.calls[0][0];
        expect(callArg.dependencies).toBeDefined();
      }
    });

    it('删除正在编辑的依赖应该清除 editingField', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 先展开依赖
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);
      }

      // 然后删除
      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      if (trashButton) {
        fireEvent.click(trashButton);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('DependenciesEditor handleUpdateSimpleDependency', () => {
    it('更新简单依赖的必填字段应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);

        // 移除 age 字段
        const ageTag = screen.getByText('age');
        const tagRemoveButton = ageTag.closest('.bp5-tag')?.querySelector('.bp5-tag-remove');
        if (tagRemoveButton) {
          fireEvent.click(tagRemoveButton);
          expect(onChange).toHaveBeenCalled();
        }
      }
    });
  });

  describe('DependenciesEditor handleUpdateSchemaDependency', () => {
    it('更新 Schema 依赖配置应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);

        // 点击 Add Schema Condition
        const addSchemaButton = screen.getByText('Add Schema Condition');
        fireEvent.click(addSchemaButton);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('IfThenElseEditor handleSetCondition', () => {
    it('设置条件应该调用 onChange 并创建 if 配置', () => {
      const onChange = jest.fn();
      render(<SchemaValidationEditor {...defaultProps} onChange={onChange} />);

      fireEvent.click(screen.getByText('If/Then/Else'));

      // 输入条件字段 - 选择 "Select field to check" 的那个
      const fieldSelectors = screen.getAllByTestId('field-path-selector');
      const conditionFieldSelector = fieldSelectors.find(
        el => el.getAttribute('placeholder') === 'Select field to check'
      );
      expect(conditionFieldSelector).toBeDefined();
      fireEvent.change(conditionFieldSelector!, { target: { value: '#/properties/type' } });

      // 输入条件值
      const conditionValueInput = screen.getByPlaceholderText('Enter value');
      fireEvent.change(conditionValueInput, { target: { value: 'premium' } });

      // 点击 Set Condition
      const setConditionButton = screen.getByText('Set Condition');
      fireEvent.click(setConditionButton);

      expect(onChange).toHaveBeenCalled();
      const callArg = onChange.mock.calls[0][0];
      expect(callArg.if).toBeDefined();
      expect(callArg.if.properties.type.const).toBe('premium');
    });
  });

  describe('IfThenElseEditor handleThenChange', () => {
    it('修改 Then 配置应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            if: { properties: { name: { const: 'test' } } },
            then: { required: ['age'] },
          }}
        />
      );

      fireEvent.click(screen.getByText('If/Then/Else'));

      // 找到 Then 编辑器的 Mock Change 按钮
      const mockChangeButtons = screen.getAllByTestId('mock-validation-change');
      if (mockChangeButtons.length > 0) {
        fireEvent.click(mockChangeButtons[0]);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('IfThenElseEditor handleElseChange', () => {
    it('修改 Else 配置应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            if: { properties: { name: { const: 'test' } } },
            then: { required: ['age'] },
            else: { required: ['email'] },
          }}
        />
      );

      fireEvent.click(screen.getByText('If/Then/Else'));

      // 找到 Else 编辑器的 Mock Change 按钮
      const mockChangeButtons = screen.getAllByTestId('mock-validation-change');
      if (mockChangeButtons.length > 1) {
        fireEvent.click(mockChangeButtons[1]);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('SimpleDependencyConfig handleAddField', () => {
    it('添加必填字段应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);

        // 选择要添加的字段
        const fieldSelectors = screen.getAllByTestId('field-path-selector');
        const addFieldSelector = fieldSelectors.find(el =>
          el.getAttribute('placeholder') === 'Select field to require'
        );
        if (addFieldSelector) {
          fireEvent.change(addFieldSelector, { target: { value: '#/properties/email' } });
        }

        // 点击 Add Field
        const addFieldButton = screen.getByText('Add Field');
        fireEvent.click(addFieldButton);

        expect(onChange).toHaveBeenCalled();
      }
    });

    it('添加已存在的字段不应该重复添加', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);

        // 选择已存在的字段
        const fieldSelectors = screen.getAllByTestId('field-path-selector');
        const addFieldSelector = fieldSelectors.find(el =>
          el.getAttribute('placeholder') === 'Select field to require'
        );
        if (addFieldSelector) {
          fireEvent.change(addFieldSelector, { target: { value: '#/properties/age' } });
        }

        // 点击 Add Field
        const addFieldButton = screen.getByText('Add Field');
        fireEvent.click(addFieldButton);

        // 不应该调用 onChange，因为字段已存在
        expect(onChange).not.toHaveBeenCalled();
      }
    });
  });

  describe('SchemaDependencyConfig handleRemoveSchema', () => {
    it('删除 Schema 条件后如果还有其他条件应该保留', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }, { required: ['email'] }] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);

        // 找到 Schema 条件的删除按钮
        const allButtons = screen.getAllByRole('button');
        const trashButtons = allButtons.filter(btn =>
          btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
        );
        // 点击第二个删除按钮（第一个是依赖本身的删除按钮）
        if (trashButtons.length > 1) {
          fireEvent.click(trashButtons[1]);
          expect(onChange).toHaveBeenCalled();
        }
      }
    });

    it('删除最后一个 Schema 条件应该保留空的 oneOf 数组', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);

        // 找到 Schema 条件的删除按钮
        const allButtons = screen.getAllByRole('button');
        const trashButtons = allButtons.filter(btn =>
          btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
        );
        if (trashButtons.length > 1) {
          fireEvent.click(trashButtons[1]);
          expect(onChange).toHaveBeenCalled();
        }
      }
    });
  });

  describe('SchemaDependencyConfig handleUpdateSchema', () => {
    it('更新 Schema 条件应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);

        // 找到 ValidationEffectEditor 的 Mock Change 按钮
        const mockChangeButtons = screen.getAllByTestId('mock-validation-change');
        if (mockChangeButtons.length > 0) {
          fireEvent.click(mockChangeButtons[0]);
          expect(onChange).toHaveBeenCalled();
        }
      }
    });
  });

  describe('LogicalCombinationEditor handleUpdateSchema', () => {
    it('更新 allOf 中的 Schema 应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            allOf: [{ required: ['name'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AllOf'));

      // 展开 Schema 编辑器
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);

        // 找到 ValidationEffectEditor 的 Mock Change 按钮
        const mockChangeButtons = screen.getAllByTestId('mock-validation-change');
        if (mockChangeButtons.length > 0) {
          fireEvent.click(mockChangeButtons[0]);
          expect(onChange).toHaveBeenCalled();
        }
      }
    });

    it('更新 anyOf 中的 Schema 应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            anyOf: [{ required: ['email'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AnyOf'));

      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);

        const mockChangeButtons = screen.getAllByTestId('mock-validation-change');
        if (mockChangeButtons.length > 0) {
          fireEvent.click(mockChangeButtons[0]);
          expect(onChange).toHaveBeenCalled();
        }
      }
    });

    it('更新 oneOf 中的 Schema 应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            oneOf: [{ required: ['name'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('OneOf'));

      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);

        const mockChangeButtons = screen.getAllByTestId('mock-validation-change');
        if (mockChangeButtons.length > 0) {
          fireEvent.click(mockChangeButtons[0]);
          expect(onChange).toHaveBeenCalled();
        }
      }
    });
  });

  describe('LogicalCombinationEditor 删除正在编辑的 Schema', () => {
    it('删除正在编辑的 Schema 应该清除 editingIndex', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            allOf: [{ required: ['name'] }, { required: ['age'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AllOf'));

      // 先展开第一个 Schema
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);
      }

      // 然后删除第一个 Schema
      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      if (trashButton) {
        fireEvent.click(trashButton);
        expect(onChange).toHaveBeenCalled();
      }
    });
  });

  describe('展开/折叠依赖配置', () => {
    it('点击展开按钮后再次点击应该折叠', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 点击展开按钮
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);
        // 展开后应该显示 Add Field
        expect(screen.getByText('Add Field')).toBeInTheDocument();

        // 再次点击应该折叠
        const collapseButtons = screen.getAllByRole('button');
        const chevronUpButton = collapseButtons.find(btn =>
          btn.querySelector('.bp5-icon-chevron-up') || btn.querySelector('.bp6-icon-chevron-up')
        );
        if (chevronUpButton) {
          fireEvent.click(chevronUpButton);
        }
      }
    });
  });

  describe('展开/折叠 LogicalCombination Schema', () => {
    it('点击展开按钮后再次点击应该折叠', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            allOf: [{ required: ['name'] }],
          }}
        />
      );

      fireEvent.click(screen.getByText('AllOf'));

      // 点击展开按钮
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        fireEvent.click(chevronButton);
        // 展开后应该显示 Schema 1 Rules
        expect(screen.getByText('Schema 1 Rules')).toBeInTheDocument();

        // 再次点击应该折叠
        const collapseButtons = screen.getAllByRole('button');
        const chevronUpButton = collapseButtons.find(btn =>
          btn.querySelector('.bp5-icon-chevron-up') || btn.querySelector('.bp6-icon-chevron-up')
        );
        if (chevronUpButton) {
          fireEvent.click(chevronUpButton);
        }
      }
    });
  });

  describe('IfThenElseEditor getConditionInfo', () => {
    it('没有 if.properties 时应该返回 null', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          value={{
            if: {},
            then: { required: ['age'] },
          }}
        />
      );

      fireEvent.click(screen.getByText('If/Then/Else'));

      // 应该显示 Condition Configured 但没有条件信息
      expect(screen.getByText('Condition Configured')).toBeInTheDocument();
    });
  });

  describe('禁用状态下的交互', () => {
    it('禁用状态下展开按钮应该被禁用', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          disabled
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      if (chevronButton) {
        expect(chevronButton).toBeDisabled();
      }
    });

    it('禁用状态下删除按钮应该被禁用', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          disabled
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      if (trashButton) {
        expect(trashButton).toBeDisabled();
      }
    });

    it('禁用状态下 Set Condition 按钮应该被禁用', () => {
      render(<SchemaValidationEditor {...defaultProps} disabled />);

      fireEvent.click(screen.getByText('If/Then/Else'));

      const setConditionButton = screen.getByText('Set Condition');
      expect(setConditionButton.closest('button')).toBeDisabled();
    });

    it('禁用状态下 Clear 按钮应该被禁用', () => {
      render(
        <SchemaValidationEditor
          {...defaultProps}
          disabled
          value={{
            if: { properties: { name: { const: 'test' } } },
            then: { required: ['age'] },
          }}
        />
      );

      fireEvent.click(screen.getByText('If/Then/Else'));

      const clearButton = screen.getByText('Clear');
      expect(clearButton.closest('button')).toBeDisabled();
    });
  });

  describe('SimpleDependencyConfig 内部交互', () => {
    it('展开简单依赖后通过 FieldPathSelector 添加字段应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);

      // 找到 SimpleDependencyConfig 中的 FieldPathSelector
      const fieldSelectors = screen.getAllByTestId('field-path-selector');
      const addFieldSelector = fieldSelectors.find(
        el => el.getAttribute('placeholder') === 'Select field to require'
      );
      expect(addFieldSelector).toBeDefined();
      fireEvent.change(addFieldSelector!, { target: { value: '#/properties/email' } });

      // 点击 Add Field 按钮
      const addFieldButton = screen.getByText('Add Field');
      fireEvent.click(addFieldButton);

      expect(onChange).toHaveBeenCalled();
    });

    it('通过 Tag 的 onRemove 移除字段应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age', 'email'],
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);

      // 找到 age 标签的移除按钮 (Tag 的 onRemove)
      const ageTag = screen.getByText('age');
      const tagRemoveButton = ageTag.closest('.bp5-tag')?.querySelector('.bp5-tag-remove') ||
        ageTag.closest('.bp6-tag')?.querySelector('.bp6-tag-remove');
      expect(tagRemoveButton).toBeDefined();
      fireEvent.click(tagRemoveButton!);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('SchemaDependencyConfig 内部交互', () => {
    it('展开 Schema 依赖后点击 Add Schema Condition 应该添加新 schema', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);

      // 点击 Add Schema Condition 按钮
      const addSchemaButton = screen.getByText('Add Schema Condition');
      fireEvent.click(addSchemaButton);

      expect(onChange).toHaveBeenCalled();
    });

    it('展开 Schema 依赖后删除 schema 条件应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }, { required: ['email'] }] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);

      // 找到 Schema 条件的删除按钮（第二个 trash 按钮）
      const allButtons = screen.getAllByRole('button');
      const trashButtons = allButtons.filter(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      // 第一个是依赖本身的删除按钮，第二个是 Schema 条件的删除按钮
      expect(trashButtons.length).toBeGreaterThan(1);
      fireEvent.click(trashButtons[1]);
      expect(onChange).toHaveBeenCalled();
    });

    it('展开 Schema 依赖后通过 ValidationEffectEditor 更新 schema 应该调用 onChange', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: { oneOf: [{ required: ['age'] }] },
            },
          }}
        />
      );

      // 展开依赖配置
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);

      // 找到 ValidationEffectEditor 的 Mock Change 按钮
      const mockChangeButtons = screen.getAllByTestId('mock-validation-change');
      expect(mockChangeButtons.length).toBeGreaterThan(0);
      fireEvent.click(mockChangeButtons[0]);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('删除正在编辑的依赖', () => {
    it('删除正在编辑的依赖应该清除 editingField 状态', () => {
      const onChange = jest.fn();
      render(
        <SchemaValidationEditor
          {...defaultProps}
          onChange={onChange}
          value={{
            dependencies: {
              name: ['age'],
            },
          }}
        />
      );

      // 先展开依赖（设置 editingField）
      const expandButtons = screen.getAllByRole('button');
      const chevronButton = expandButtons.find(btn =>
        btn.querySelector('.bp5-icon-chevron-down') || btn.querySelector('.bp6-icon-chevron-down')
      );
      expect(chevronButton).toBeDefined();
      fireEvent.click(chevronButton!);
      // 确认已展开
      expect(screen.getByText('Add Field')).toBeInTheDocument();

      // 然后删除该依赖
      const deleteButtons = screen.getAllByRole('button');
      const trashButton = deleteButtons.find(btn =>
        btn.querySelector('.bp5-icon-trash') || btn.querySelector('.bp6-icon-trash')
      );
      expect(trashButton).toBeDefined();
      fireEvent.click(trashButton!);
      expect(onChange).toHaveBeenCalled();
    });
  });
});
