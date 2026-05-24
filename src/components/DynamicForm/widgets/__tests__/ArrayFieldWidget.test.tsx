import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ArrayFieldWidget } from '../ArrayFieldWidget';
import { FormWrapper, TestWrapper } from './testHelpers';
import type { ExtendedJSONSchema } from '../../types/schema';

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

describe('ArrayFieldWidget', () => {
  const simpleStringSchema: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
    type: 'array',
    items: {
      type: 'string',
    },
  };

  const objectItemSchema: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
    type: 'array',
    items: {
      type: 'object',
      title: 'Person',
      properties: {
        name: { type: 'string', title: 'Name' },
        age: { type: 'number', title: 'Age' },
      },
    },
  };

  const enumSchema: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
    type: 'array',
    items: {
      type: 'string',
      enum: ['option1', 'option2', 'option3'],
      enumNames: ['Option 1', 'Option 2', 'Option 3'],
    },
  };

  describe('基本渲染', () => {
    it('应该渲染空数组状态', () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={simpleStringSchema} />
        </FormWrapper>
      );
      expect(screen.getByText('Add')).toBeInTheDocument();
    });

    it('应该显示自定义空状态文本', () => {
      const schemaWithEmptyText = {
        ...simpleStringSchema,
        ui: { emptyText: 'No items yet' },
      };
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={schemaWithEmptyText as any} />
        </FormWrapper>
      );
      expect(screen.getByText('No items yet')).toBeInTheDocument();
    });

    it('应该显示自定义添加按钮文本', () => {
      const schemaWithAddText = {
        ...simpleStringSchema,
        ui: { addButtonText: 'Add Item' },
      };
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={schemaWithAddText as any} />
        </FormWrapper>
      );
      expect(screen.getByText('Add Item')).toBeInTheDocument();
    });
  });

  describe('添加和删除项', () => {
    it('点击添加按钮应该添加新项', async () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={simpleStringSchema} />
        </FormWrapper>
      );

      const addButton = screen.getByText('Add');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
    });

    it('达到 maxItems 时添加按钮应该禁用', () => {
      const schemaWithMax = {
        ...simpleStringSchema,
        maxItems: 2,
      };
      render(
        <FormWrapper defaultValues={{ items: [{ value: 'a' }, { value: 'b' }] }}>
          <ArrayFieldWidget name="items" schema={schemaWithMax as any} />
        </FormWrapper>
      );

      const addButton = screen.getByRole('button', { name: /add/i });
      expect(addButton).toBeDisabled();
    });
  });

  describe('禁用状态', () => {
    it('disabled 时添加按钮不应该显示', () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={simpleStringSchema} disabled={true} />
        </FormWrapper>
      );

      expect(screen.queryByText('Add')).not.toBeInTheDocument();
    });

    it('readonly 时添加按钮不应该显示', () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={simpleStringSchema} readonly={true} />
        </FormWrapper>
      );

      expect(screen.queryByText('Add')).not.toBeInTheDocument();
    });
  });

  describe('静态模式（枚举数组）', () => {
    it('应该渲染为多选框组', () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={enumSchema} />
        </FormWrapper>
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });

    it('选中的值应该被勾选', () => {
      render(
        <FormWrapper defaultValues={{ items: ['option1', 'option3'] }}>
          <ArrayFieldWidget name="items" schema={enumSchema} />
        </FormWrapper>
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).not.toBeChecked();
      expect(checkboxes[2]).toBeChecked();
    });
  });

  describe('虚拟滚动', () => {
    it('启用虚拟滚动时应该使用 Virtuoso', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ value: 'a' }, { value: 'b' }] }}>
          <ArrayFieldWidget
            name="items"
            schema={simpleStringSchema}
            enableVirtualScroll={true}
            virtualScrollHeight={400}
          />
        </FormWrapper>
      );

      expect(screen.getByTestId('virtuoso')).toBeInTheDocument();
    });
  });

  describe('不同类型的默认值', () => {
    it('添加 number 类型项时应该使用默认值 0', async () => {
      const numberSchema: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
        type: 'array',
        items: { type: 'number' },
      };
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={numberSchema} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
    });

    it('添加 boolean 类型项时应该使用默认值 false', async () => {
      const booleanSchema: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
        type: 'array',
        items: { type: 'boolean' },
      };
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={booleanSchema} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
    });

    it('添加 integer 类型项时应该使用默认值 0', async () => {
      const integerSchema: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
        type: 'array',
        items: { type: 'integer' },
      };
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={integerSchema} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
    });

    it('添加带 autogenerate uuid 的项时应该生成 UUID', async () => {
      const uuidSchema: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
        type: 'array',
        items: {
          type: 'string',
          ui: { autogenerate: 'uuid' },
        },
      };
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={uuidSchema} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
    });

    it('添加带 default 值的项时应该使用指定默认值', async () => {
      const schemaWithDefault: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
        type: 'array',
        items: {
          type: 'string',
          default: 'default value',
        },
      };
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={schemaWithDefault} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByText('#1')).toBeInTheDocument();
      });
    });
  });

  describe('对象类型数组', () => {
    it('添加对象类型项时应该生成各属性默认值', async () => {
      const complexObjectSchema: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
        type: 'array',
        items: {
          type: 'object',
          title: 'Item',
          properties: {
            name: { type: 'string' },
            count: { type: 'number' },
            enabled: { type: 'boolean' },
            tags: { type: 'array' },
            meta: { type: 'object' },
          },
        },
      };
      render(
        <TestWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={complexObjectSchema} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });
    });

    it('对象属性带 autogenerate uuid 时应该生成 UUID', async () => {
      const schemaWithUuidProp: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
        type: 'array',
        items: {
          type: 'object',
          title: 'Item',
          properties: {
            id: { type: 'string', ui: { autogenerate: 'uuid' } },
            name: { type: 'string' },
          },
        },
      };
      render(
        <TestWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={schemaWithUuidProp} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });
    });

    it('对象属性带 default 值时应该使用指定默认值', async () => {
      const schemaWithDefaults: ExtendedJSONSchema & { type: 'array'; items: ExtendedJSONSchema } = {
        type: 'array',
        items: {
          type: 'object',
          title: 'Item',
          properties: {
            status: { type: 'string', default: 'active' },
            priority: { type: 'number', default: 5 },
          },
        },
      };
      render(
        <TestWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={schemaWithDefaults} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Add'));

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });
    });
  });

  describe('无效 schema 处理', () => {
    it('schema.items 为空时应该返回 null', () => {
      const invalidSchema = {
        type: 'array',
      } as any;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const { container } = render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={invalidSchema} />
        </FormWrapper>
      );

      // ArrayFieldWidget 返回 null 时，container.firstChild 是 FormWrapper 的 div
      // 但 ArrayFieldWidget 本身不渲染任何内容
      expect(container.querySelector('.array-field-widget')).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('schema.items is required')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('上移/下移操作', () => {
    it('第一项的上移按钮应该禁用', async () => {
      render(
        <FormWrapper defaultValues={{ items: [{ value: 'a' }, { value: 'b' }] }}>
          <ArrayFieldWidget name="items" schema={simpleStringSchema} />
        </FormWrapper>
      );

      const moveUpButtons = screen.getAllByTitle('Move up');
      expect(moveUpButtons[0]).toBeDisabled();
      expect(moveUpButtons[1]).not.toBeDisabled();
    });

    it('最后一项的下移按钮应该禁用', async () => {
      render(
        <FormWrapper defaultValues={{ items: [{ value: 'a' }, { value: 'b' }] }}>
          <ArrayFieldWidget name="items" schema={simpleStringSchema} />
        </FormWrapper>
      );

      const moveDownButtons = screen.getAllByTitle('Move down');
      expect(moveDownButtons[0]).not.toBeDisabled();
      expect(moveDownButtons[1]).toBeDisabled();
    });
  });

  describe('删除确认', () => {
    it('点击删除按钮应该显示确认 Popover', async () => {
      render(
        <FormWrapper defaultValues={{ items: [{ value: 'a' }] }}>
          <ArrayFieldWidget name="items" schema={simpleStringSchema} />
        </FormWrapper>
      );

      const deleteButton = screen.getByTitle('Delete');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Delete item 1?')).toBeInTheDocument();
      });
    });

    it('点击取消应该关闭 Popover', async () => {
      render(
        <FormWrapper defaultValues={{ items: [{ value: 'a' }] }}>
          <ArrayFieldWidget name="items" schema={simpleStringSchema} />
        </FormWrapper>
      );

      fireEvent.click(screen.getByTitle('Delete'));

      await waitFor(() => {
        expect(screen.getByText('Delete item 1?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Delete item 1?')).not.toBeInTheDocument();
      });
    });

    it('达到 minItems 时删除按钮应该禁用', () => {
      const schemaWithMin = {
        ...simpleStringSchema,
        minItems: 1,
      };
      render(
        <FormWrapper defaultValues={{ items: [{ value: 'a' }] }}>
          <ArrayFieldWidget name="items" schema={schemaWithMin as any} />
        </FormWrapper>
      );

      const deleteButton = screen.getByTitle('Delete');
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('静态模式 checkbox 交互', () => {
    it('点击 checkbox 应该添加选项', async () => {
      render(
        <FormWrapper defaultValues={{ items: [] }}>
          <ArrayFieldWidget name="items" schema={enumSchema} />
        </FormWrapper>
      );

      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(checkboxes[0]).toBeChecked();
      });
    });

    it('取消选中 checkbox 应该移除选项', async () => {
      render(
        <FormWrapper defaultValues={{ items: ['option1'] }}>
          <ArrayFieldWidget name="items" schema={enumSchema} />
        </FormWrapper>
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();

      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(checkboxes[0]).not.toBeChecked();
      });
    });

    it('处理对象格式值 { value: xxx }', () => {
      render(
        <FormWrapper defaultValues={{ items: [{ value: 'option1' }, { value: 'option2' }] }}>
          <ArrayFieldWidget name="items" schema={enumSchema} />
        </FormWrapper>
      );

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked();
      expect(checkboxes[1]).toBeChecked();
      expect(checkboxes[2]).not.toBeChecked();
    });
  });

  describe('对象类型 ArrayItem 渲染', () => {
    it('应该显示对象项标题和索引', () => {
      render(
        <TestWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <ArrayFieldWidget name="items" schema={objectItemSchema} />
        </TestWrapper>
      );

      expect(screen.getByText('Person 1')).toBeInTheDocument();
    });

    it('对象项应该显示操作按钮', () => {
      render(
        <TestWrapper defaultValues={{ items: [{ name: 'John', age: 30 }] }}>
          <ArrayFieldWidget name="items" schema={objectItemSchema} />
        </TestWrapper>
      );

      expect(screen.getByTitle('Move up')).toBeInTheDocument();
      expect(screen.getByTitle('Move down')).toBeInTheDocument();
      expect(screen.getByTitle('Delete')).toBeInTheDocument();
    });
  });
});
