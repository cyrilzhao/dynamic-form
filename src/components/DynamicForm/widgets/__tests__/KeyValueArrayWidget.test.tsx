import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KeyValueArrayWidget } from '../KeyValueArrayWidget';
import { FormWrapper } from './testHelpers';
import type { ExtendedJSONSchema } from '../../types/schema';
import { FieldRegistry } from '../../core/FieldRegistry';

// Mock widgets
const MockTextWidget = ({ value, onChange, disabled, readonly, options, placeholder }: any) => (
  <input
    type="text"
    value={value || ''}
    onChange={e => onChange?.(e.target.value)}
    disabled={disabled}
    readOnly={readonly}
    placeholder={placeholder}
    data-testid="mock-text-widget"
    data-options={options ? JSON.stringify(options) : undefined}
  />
);

const MockNumberWidget = ({ value, onChange, disabled, readonly }: any) => (
  <input
    type="number"
    value={value ?? 0}
    onChange={e => onChange?.(Number(e.target.value))}
    disabled={disabled}
    readOnly={readonly}
    data-testid="mock-number-widget"
  />
);

const MockSwitchWidget = ({ value, onChange, disabled, readonly }: any) => (
  <input
    type="checkbox"
    checked={value || false}
    onChange={e => onChange?.(e.target.checked)}
    disabled={disabled}
    readOnly={readonly}
    data-testid="mock-switch-widget"
  />
);

const MockSelectWidget = ({ value, onChange, disabled, readonly, options }: any) => (
  <select
    value={value || ''}
    onChange={e => onChange?.(e.target.value)}
    disabled={disabled}
    data-testid="mock-select-widget"
    data-options={options ? JSON.stringify(options) : undefined}
  >
    {options?.map((opt: any) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

// Mock FieldRegistry.getWidget
beforeEach(() => {
  jest.spyOn(FieldRegistry, 'getWidget').mockImplementation((type: string) => {
    switch (type) {
      case 'text':
      case 'email':
      case 'url':
        return MockTextWidget;
      case 'number':
        return MockNumberWidget;
      case 'switch':
        return MockSwitchWidget;
      case 'select':
        return MockSelectWidget;
      default:
        return undefined;
    }
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('KeyValueArrayWidget', () => {
  const defaultSchema: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' },
      },
    },
  };

  describe('基本渲染', () => {
    it('应该渲染空状态', () => {
      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget name="mappings" schema={defaultSchema} />
        </FormWrapper>
      );
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    it('应该显示自定义空状态文本', () => {
      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget
            name="mappings"
            schema={defaultSchema}
            emptyText="No mappings configured"
          />
        </FormWrapper>
      );
      expect(screen.getByText('No mappings configured')).toBeInTheDocument();
    });

    it('应该显示表头', () => {
      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={defaultSchema} />
        </FormWrapper>
      );
      expect(screen.getByText('Key')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
    });
  });

  describe('自定义标签', () => {
    it('应该显示自定义键值标签', () => {
      render(
        <FormWrapper defaultValues={{ mappings: [{ source: 'a', target: 'b' }] }}>
          <KeyValueArrayWidget
            name="mappings"
            schema={defaultSchema}
            keyField="source"
            valueField="target"
            keyLabel="Source"
            valueLabel="Target"
          />
        </FormWrapper>
      );
      expect(screen.getByText('Source')).toBeInTheDocument();
      expect(screen.getByText('Target')).toBeInTheDocument();
    });
  });

  describe('添加和删除项', () => {
    it('点击添加按钮应该添加新项', async () => {
      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget name="mappings" schema={defaultSchema} />
        </FormWrapper>
      );

      const addButton = screen.getByText('Add');
      fireEvent.click(addButton);

      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.length).toBe(2); // key + value
      });
    });

    it('达到 maxItems 时添加按钮不应该显示', () => {
      const schemaWithMax = { ...defaultSchema, maxItems: 1 };
      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithMax as any} />
        </FormWrapper>
      );

      expect(screen.queryByText('Add')).not.toBeInTheDocument();
    });
  });

  describe('禁用状态', () => {
    it('disabled 时输入框应该禁用', () => {
      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={defaultSchema} disabled={true} />
        </FormWrapper>
      );

      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toBeDisabled();
      });
    });

    it('readonly 时输入框应该只读', () => {
      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={defaultSchema} readonly={true} />
        </FormWrapper>
      );

      const inputs = screen.getAllByRole('textbox');
      inputs.forEach(input => {
        expect(input).toHaveAttribute('readonly');
      });
    });
  });

  describe('删除项', () => {
    it('点击删除按钮应该删除项', async () => {
      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={defaultSchema} />
        </FormWrapper>
      );

      const deleteButton = screen.getByTitle('Remove');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.queryByDisplayValue('a')).not.toBeInTheDocument();
      });
    });

    it('达到 minItems 时删除按钮应该禁用', () => {
      const schemaWithMin = { ...defaultSchema, minItems: 1 };
      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithMin as any} />
        </FormWrapper>
      );

      const deleteButton = screen.getByTitle('Remove');
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('Widget 类型推断', () => {
    it('自定义 ui.widget 应该优先使用', () => {
      const schemaWithCustomWidget: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', ui: { widget: 'text' } },
            value: { type: 'string', ui: { widget: 'text' } },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithCustomWidget} />
        </FormWrapper>
      );

      expect(screen.getAllByTestId('mock-text-widget').length).toBe(2);
    });

    it('number 类型应该使用 number widget', () => {
      const schemaWithNumber: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'number' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 10 }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithNumber} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-number-widget')).toBeInTheDocument();
    });

    it('integer 类型应该使用 number widget', () => {
      const schemaWithInteger: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'integer' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 5 }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithInteger} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-number-widget')).toBeInTheDocument();
    });

    it('boolean 类型应该使用 switch widget', () => {
      const schemaWithBoolean: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'boolean' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: true }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithBoolean} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-switch-widget')).toBeInTheDocument();
    });

    it('email format 应该使用 email widget', () => {
      const schemaWithEmail: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string', format: 'email' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'test@example.com' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithEmail} />
        </FormWrapper>
      );

      expect(screen.getAllByTestId('mock-text-widget').length).toBe(2);
    });

    it('uri format 应该使用 url widget', () => {
      const schemaWithUri: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string', format: 'uri' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'https://example.com' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithUri} />
        </FormWrapper>
      );

      expect(screen.getAllByTestId('mock-text-widget').length).toBe(2);
    });

    it('enum 类型应该使用 select widget', () => {
      const schemaWithEnum: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string', enum: ['option1', 'option2'], enumNames: ['Option 1', 'Option 2'] },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'option1' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithEnum} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-select-widget')).toBeInTheDocument();
    });

    it('key 字段也应该支持 enum 类型', () => {
      const schemaWithKeyEnum: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', enum: ['key1', 'key2'], enumNames: ['Key 1', 'Key 2'] },
            value: { type: 'string' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'key1', value: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithKeyEnum} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-select-widget')).toBeInTheDocument();
    });

    it('未知类型应该使用 text widget', () => {
      const schemaWithUnknownType: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'unknown' },
          },
        },
      };

      // 由于 unknown 类型会返回 'text'，而 FieldRegistry 返回 MockTextWidget
      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithUnknownType} />
        </FormWrapper>
      );

      expect(screen.getAllByTestId('mock-text-widget').length).toBe(2);
    });
  });

  describe('默认值生成', () => {
    it('添加行时应该使用 schema 中的 default 值', async () => {
      const schemaWithDefaults: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', default: 'defaultKey' },
            value: { type: 'string', default: 'defaultValue' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithDefaults} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('defaultKey')).toBeInTheDocument();
        expect(screen.getByDisplayValue('defaultValue')).toBeInTheDocument();
      });
    });

    it('添加行时 number 类型应该默认为 0', async () => {
      const schemaWithNumber: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'number' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithNumber} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByTestId('mock-number-widget')).toHaveValue(0);
      });
    });

    it('添加行时 integer 类型应该默认为 0', async () => {
      const schemaWithInteger: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'integer' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithInteger} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByTestId('mock-number-widget')).toHaveValue(0);
      });
    });

    it('添加行时 boolean 类型应该默认为 false', async () => {
      const schemaWithBoolean: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'boolean' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithBoolean} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByTestId('mock-switch-widget')).not.toBeChecked();
      });
    });

    it('添加行时未知类型应该默认为空字符串', async () => {
      const schemaWithUnknown: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'unknown' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithUnknown} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        const textWidgets = screen.getAllByTestId('mock-text-widget');
        expect(textWidgets.length).toBe(2);
      });
    });
  });

  describe('widgetProps 配置', () => {
    it('应该支持通过 widgetProps 配置字段名', () => {
      const schemaWithWidgetProps: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            val: { type: 'string' },
          },
        },
        ui: {
          widgetProps: {
            keyField: 'name',
            valueField: 'val',
            keyLabel: 'Name',
            valueLabel: 'Val',
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ name: 'a', val: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithWidgetProps} />
        </FormWrapper>
      );

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Val')).toBeInTheDocument();
    });

    it('应该支持通过 widgetProps 配置 placeholder', () => {
      const schemaWithWidgetProps: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string' },
          },
        },
        ui: {
          widgetProps: {
            keyPlaceholder: 'Enter key',
            valuePlaceholder: 'Enter value',
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: '', value: '' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithWidgetProps} />
        </FormWrapper>
      );

      expect(screen.getByPlaceholderText('Enter key')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
    });

    it('应该支持通过 widgetProps 配置添加按钮文本', () => {
      const schemaWithWidgetProps: any = {
        ...defaultSchema,
        ui: {
          widgetProps: {
            addButtonText: 'Add New',
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithWidgetProps} />
        </FormWrapper>
      );

      expect(screen.getByText('Add New')).toBeInTheDocument();
    });

    it('应该支持通过 widgetProps 配置空状态文本', () => {
      const schemaWithWidgetProps: any = {
        ...defaultSchema,
        ui: {
          widgetProps: {
            emptyText: 'No items',
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithWidgetProps} />
        </FormWrapper>
      );

      expect(screen.getByText('No items')).toBeInTheDocument();
    });

    it('应该支持通过 widgetProps 配置必填状态', () => {
      const schemaWithWidgetProps: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string' },
          },
        },
        ui: {
          widgetProps: {
            keyRequired: true,
            valueRequired: true,
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: '', value: '' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithWidgetProps} />
        </FormWrapper>
      );

      // 组件应该正常渲染
      expect(screen.getAllByTestId('mock-text-widget').length).toBe(2);
    });
  });

  describe('从 schema.items.required 推断必填', () => {
    it('应该从 schema.items.required 推断字段必填状态', () => {
      const schemaWithRequired: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string' },
          },
          required: ['key', 'value'],
        },
      };

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: '', value: '' }] }}>
          <KeyValueArrayWidget name="mappings" schema={schemaWithRequired} />
        </FormWrapper>
      );

      // 组件应该正常渲染
      expect(screen.getAllByTestId('mock-text-widget').length).toBe(2);
    });
  });

  describe('未注册的 Widget 回退', () => {
    it('未注册的 widget 应该回退到 InputGroup', () => {
      jest.spyOn(FieldRegistry, 'getWidget').mockImplementation(() => undefined);

      render(
        <FormWrapper defaultValues={{ mappings: [{ key: 'a', value: 'b' }] }}>
          <KeyValueArrayWidget name="mappings" schema={defaultSchema} />
        </FormWrapper>
      );

      // 应该回退到 Blueprint InputGroup
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBe(2);
    });
  });

  describe('ref 转发', () => {
    it('应该正确转发 ref', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <FormWrapper defaultValues={{ mappings: [] }}>
          <KeyValueArrayWidget ref={ref} name="mappings" schema={defaultSchema} />
        </FormWrapper>
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveClass('key-value-array-widget');
    });
  });
});
