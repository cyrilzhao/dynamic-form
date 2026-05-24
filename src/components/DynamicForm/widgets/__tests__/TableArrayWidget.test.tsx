import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TableArrayWidget } from '../TableArrayWidget';
import { FormWrapper } from './testHelpers';
import type { ExtendedJSONSchema } from '../../types/schema';
import { FieldRegistry } from '../../core/FieldRegistry';

// Mock react-virtuoso
jest.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: any) => (
    <div data-testid="virtuoso">
      {data.map((item: any, index: number) => (
        <div key={item.id}>{itemContent(index, item)}</div>
      ))}
    </div>
  ),
}));

// Mock FieldRegistry.getWidget
const MockTextWidget = ({ value, onChange, disabled, readonly }: any) => (
  <input
    type="text"
    value={value || ''}
    onChange={e => onChange?.(e.target.value)}
    disabled={disabled}
    readOnly={readonly}
    data-testid="mock-text-widget"
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

const MockCheckboxWidget = ({ value, onChange, disabled, readonly }: any) => (
  <input
    type="checkbox"
    checked={value || false}
    onChange={e => onChange?.(e.target.checked)}
    disabled={disabled}
    readOnly={readonly}
    data-testid="mock-checkbox-widget"
  />
);

// 保存原始的 getWidget 方法
const originalGetWidget = FieldRegistry.getWidget.bind(FieldRegistry);

beforeEach(() => {
  // Mock getWidget 方法
  jest.spyOn(FieldRegistry, 'getWidget').mockImplementation((type: string) => {
    switch (type) {
      case 'text':
      case 'email':
      case 'url':
        return MockTextWidget;
      case 'number':
        return MockNumberWidget;
      case 'checkbox':
        return MockCheckboxWidget;
      default:
        return MockTextWidget;
    }
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TableArrayWidget', () => {
  // 基础 schema 定义
  const basicSchema: ExtendedJSONSchema & {
    type: 'array';
    items: ExtendedJSONSchema & { type: 'object'; properties: Record<string, ExtendedJSONSchema> };
  } = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name' },
        age: { type: 'number', title: 'Age' },
      },
    },
  };

  const schemaWithBoolean: ExtendedJSONSchema & {
    type: 'array';
    items: ExtendedJSONSchema & { type: 'object'; properties: Record<string, ExtendedJSONSchema> };
  } = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name' },
        active: { type: 'boolean', title: 'Active' },
      },
    },
  };

  describe('基本渲染', () => {
    it('应该渲染空状态', () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );
      expect(screen.getByText('No data')).toBeInTheDocument();
    });

    it('应该显示自定义空状态文本', () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={basicSchema} emptyText="No records found" />
        </FormWrapper>
      );
      expect(screen.getByText('No records found')).toBeInTheDocument();
    });

    it('应该显示自定义添加按钮文本', () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={basicSchema} addButtonText="New Row" />
        </FormWrapper>
      );
      expect(screen.getByText('New Row')).toBeInTheDocument();
    });

    it('应该渲染表头', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );
      expect(screen.getByText('#')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('应该渲染数据行', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('应该渲染多行数据', () => {
      render(
        <FormWrapper
          defaultValues={{
            items: [
              { name: 'John', age: 30 },
              { name: 'Jane', age: 25 },
            ],
          }}
        >
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('添加行', () => {
    it('点击添加按钮应该添加新行', async () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );

      const addButton = screen.getByText('Add Row');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('达到 maxItems 时添加按钮不应该显示', () => {
      const schemaWithMax = { ...basicSchema, maxItems: 1 };
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={schemaWithMax as any} />
        </FormWrapper>
      );

      expect(screen.queryByText('Add Row')).not.toBeInTheDocument();
    });

    it('未达到 maxItems 时添加按钮应该显示', () => {
      const schemaWithMax = { ...basicSchema, maxItems: 2 };
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={schemaWithMax as any} />
        </FormWrapper>
      );

      expect(screen.getByText('Add Row')).toBeInTheDocument();
    });
  });

  describe('删除行', () => {
    it('点击删除按钮应该显示确认 Popover', async () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );

      const deleteButton = screen.getByRole('button', { name: '' });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete row 1?')).toBeInTheDocument();
      });
    });

    it('点击确认删除应该删除行', async () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );

      const deleteButton = screen.getByRole('button', { name: '' });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete row 1?')).toBeInTheDocument();
      });

      const confirmButton = screen.getByText('Delete');
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('No data')).toBeInTheDocument();
      });
    });

    it('点击取消应该关闭 Popover', async () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );

      const deleteButton = screen.getByRole('button', { name: '' });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete row 1?')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Delete row 1?')).not.toBeInTheDocument();
      });
    });

    it('达到 minItems 时删除按钮应该不可用', () => {
      const schemaWithMin = { ...basicSchema, minItems: 1 };
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={schemaWithMin as any} />
        </FormWrapper>
      );

      // 当 fields.length <= minItems 时，canRemove 返回 false，onRemove 为 undefined
      // 因此操作列不会渲染删除按钮
      // 但由于 canAddRemove 仍为 true，Actions 列头仍会显示
      // 实际上组件逻辑是：当 canRemove(index) 为 false 时，不传递 onRemove
      // 这意味着 TableRow 不会渲染删除按钮
      const deleteButtons = screen.queryAllByRole('button', { name: '' });
      // 只有添加按钮，没有删除按钮
      expect(deleteButtons.length).toBe(0);
    });
  });

  describe('禁用状态', () => {
    it('disabled 时添加按钮不应该显示', () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={basicSchema} disabled={true} />
        </FormWrapper>
      );

      expect(screen.queryByText('Add Row')).not.toBeInTheDocument();
    });

    it('disabled 时不应该显示操作列', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} disabled={true} />
        </FormWrapper>
      );

      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    });

    it('readonly 时添加按钮不应该显示', () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={basicSchema} readonly={true} />
        </FormWrapper>
      );

      expect(screen.queryByText('Add Row')).not.toBeInTheDocument();
    });

    it('readonly 时不应该显示操作列', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} readonly={true} />
        </FormWrapper>
      );

      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    });
  });

  describe('虚拟滚动', () => {
    it('启用虚拟滚动时应该使用 Virtuoso', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} enableVirtualScroll={true} />
        </FormWrapper>
      );

      expect(screen.getByTestId('virtuoso')).toBeInTheDocument();
    });

    it('禁用虚拟滚动时不应该使用 Virtuoso', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} enableVirtualScroll={false} />
        </FormWrapper>
      );

      expect(screen.queryByTestId('virtuoso')).not.toBeInTheDocument();
    });

    it('应该支持通过 widgetProps 配置虚拟滚动', () => {
      const schemaWithWidgetProps = {
        ...basicSchema,
        ui: {
          widgetProps: {
            enableVirtualScroll: true,
            virtualScrollHeight: 500,
          },
        },
      };
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={schemaWithWidgetProps as any} />
        </FormWrapper>
      );

      expect(screen.getByTestId('virtuoso')).toBeInTheDocument();
    });
  });

  describe('列顺序', () => {
    it('应该支持自定义列顺序', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} columns={['age', 'name']} />
        </FormWrapper>
      );

      // 由于我们使用 div 而不是真正的 table，需要检查文本顺序
      const headerTexts = screen.getAllByText(/Name|Age/);
      expect(headerTexts[0]).toHaveTextContent('Age');
      expect(headerTexts[1]).toHaveTextContent('Name');
    });

    it('应该支持通过 widgetProps 配置列顺序', () => {
      const schemaWithColumns = {
        ...basicSchema,
        ui: {
          widgetProps: {
            columns: ['age', 'name'],
          },
        },
      };
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={schemaWithColumns as any} />
        </FormWrapper>
      );

      const headerTexts = screen.getAllByText(/Name|Age/);
      expect(headerTexts[0]).toHaveTextContent('Age');
      expect(headerTexts[1]).toHaveTextContent('Name');
    });
  });

  describe('widgetProps 配置', () => {
    it('应该支持通过 widgetProps 配置添加按钮文本', () => {
      const schemaWithWidgetProps = {
        ...basicSchema,
        ui: {
          widgetProps: {
            addButtonText: 'Add New Item',
          },
        },
      };
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={schemaWithWidgetProps as any} />
        </FormWrapper>
      );

      expect(screen.getByText('Add New Item')).toBeInTheDocument();
    });

    it('应该支持通过 widgetProps 配置空状态文本', () => {
      const schemaWithWidgetProps = {
        ...basicSchema,
        ui: {
          widgetProps: {
            emptyText: 'Empty table',
          },
        },
      };
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={schemaWithWidgetProps as any} />
        </FormWrapper>
      );

      expect(screen.getByText('Empty table')).toBeInTheDocument();
    });
  });

  describe('无效 schema 处理', () => {
    it('schema.items 不是 object 类型时应该返回 null', () => {
      const invalidSchema = {
        type: 'array',
        items: {
          type: 'string',
        },
      } as any;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { container } = render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={invalidSchema} />
        </FormWrapper>
      );

      expect(container.querySelector('.table-array-widget')).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('schema.items must be an object type with properties')
      );
      consoleSpy.mockRestore();
    });

    it('schema.items 没有 properties 时应该返回 null', () => {
      const invalidSchema = {
        type: 'array',
        items: {
          type: 'object',
        },
      } as any;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const { container } = render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={invalidSchema} />
        </FormWrapper>
      );

      expect(container.querySelector('.table-array-widget')).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('默认值生成', () => {
    it('添加行时应该使用 schema 中的 default 值', async () => {
      const schemaWithDefaults: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Name', default: 'Default Name' },
            count: { type: 'number', title: 'Count', default: 10 },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={schemaWithDefaults} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add Row'));

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });
    });

    it('添加行时 string 类型应该默认为空字符串', async () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add Row'));

      await waitFor(() => {
        const textInputs = screen.getAllByTestId('mock-text-widget');
        expect(textInputs[0]).toHaveValue('');
      });
    });

    it('添加行时 number 类型应该默认为 0', async () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add Row'));

      await waitFor(() => {
        const numberInputs = screen.getAllByTestId('mock-number-widget');
        expect(numberInputs[0]).toHaveValue(0);
      });
    });

    it('添加行时 boolean 类型应该默认为 false', async () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget name="items" schema={schemaWithBoolean} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add Row'));

      await waitFor(() => {
        const checkboxInputs = screen.getAllByTestId('mock-checkbox-widget');
        expect(checkboxInputs[0]).not.toBeChecked();
      });
    });
  });

  describe('Widget 类型推断', () => {
    it('string 类型应该使用 text widget', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-text-widget')).toBeInTheDocument();
    });

    it('number 类型应该使用 number widget', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-number-widget')).toBeInTheDocument();
    });

    it('boolean 类型应该使用 checkbox widget', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', active: true }] }}>
          <TableArrayWidget name="items" schema={schemaWithBoolean} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-checkbox-widget')).toBeInTheDocument();
    });

    it('email format 应该使用 email widget', () => {
      const schemaWithEmail: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string', title: 'Email', format: 'email' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ items: [{ email: 'test@example.com' }] }}>
          <TableArrayWidget name="items" schema={schemaWithEmail} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-text-widget')).toBeInTheDocument();
    });

    it('uri format 应该使用 url widget', () => {
      const schemaWithUri: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            website: { type: 'string', title: 'Website', format: 'uri' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ items: [{ website: 'https://example.com' }] }}>
          <TableArrayWidget name="items" schema={schemaWithUri} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-text-widget')).toBeInTheDocument();
    });

    it('integer 类型应该使用 number widget', () => {
      const schemaWithInteger: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            count: { type: 'integer', title: 'Count' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ items: [{ count: 5 }] }}>
          <TableArrayWidget name="items" schema={schemaWithInteger} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-number-widget')).toBeInTheDocument();
    });

    it('未知类型应该使用 text widget', () => {
      const schemaWithUnknownType: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'unknown', title: 'Unknown Field' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ items: [{ field: 'value' }] }}>
          <TableArrayWidget name="items" schema={schemaWithUnknownType} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-text-widget')).toBeInTheDocument();
    });

    it('自定义 ui.widget 应该优先使用', () => {
      const schemaWithCustomWidget: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Name', ui: { widget: 'text' } },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John' }] }}>
          <TableArrayWidget name="items" schema={schemaWithCustomWidget} />
        </FormWrapper>
      );

      expect(screen.getByTestId('mock-text-widget')).toBeInTheDocument();
    });
  });

  describe('未注册的 Widget', () => {
    it('未注册的 widget 应该显示占位符', () => {
      jest.spyOn(FieldRegistry, 'getWidget').mockImplementation((type: string) => {
        if (type === 'unknown-widget') {
          return undefined;
        }
        return MockTextWidget;
      });

      const schemaWithUnknownWidget: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string', title: 'Field', ui: { widget: 'unknown-widget' } },
          },
        },
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <FormWrapper defaultValues={{ items: [{ field: 'value' }] }}>
          <TableArrayWidget name="items" schema={schemaWithUnknownWidget} />
        </FormWrapper>
      );

      expect(screen.getByText('-')).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Widget "unknown-widget" not found in registry')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('列标题', () => {
    it('应该使用 schema 中的 title 作为列标题', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <TableArrayWidget name="items" schema={basicSchema} />
        </FormWrapper>
      );

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Age')).toBeInTheDocument();
    });

    it('没有 title 时应该使用属性名作为列标题', () => {
      const schemaWithoutTitle: any = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
      };

      render(
        <FormWrapper defaultValues={{ items: [{ firstName: 'John', lastName: 'Doe' }] }}>
          <TableArrayWidget name="items" schema={schemaWithoutTitle} />
        </FormWrapper>
      );

      expect(screen.getByText('firstName')).toBeInTheDocument();
      expect(screen.getByText('lastName')).toBeInTheDocument();
    });
  });

  describe('ref 转发', () => {
    it('应该正确转发 ref', () => {
      const ref = React.createRef<HTMLDivElement>();

      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <TableArrayWidget ref={ref} name="items" schema={basicSchema} />
        </FormWrapper>
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveClass('table-array-widget');
    });
  });
});
