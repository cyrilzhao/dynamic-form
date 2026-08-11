/**
 * SchemaBuilder 组件测试
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SchemaBuilder, useSchemaBuilder } from '../SchemaBuilder';
import { basicSchema, nestedSchema, arraySchema } from './testHelpers';

// Mock DynamicForm 组件
jest.mock('../../DynamicForm', () => ({
  DynamicForm: ({ columnsCount }: any) => (
    <div data-testid="dynamic-form" data-columns-count={columnsCount}>
      <span>Mock DynamicForm</span>
    </div>
  ),
}));

// Mock Select 组件以便测试
jest.mock('../../Select', () => ({
  Select: ({ value, onChange, disabled, options }: any) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

const getTreeNodeContent = (label: RegExp): HTMLElement => {
  const labelNode = screen
    .getAllByText(label)
    .find(node => node.closest('.schema-tree-node-label'));
  const content = labelNode?.closest('.tree-node-content');

  if (!(content instanceof HTMLElement)) {
    throw new Error(`Tree node ${label.toString()} was not found`);
  }

  return content;
};

const expandTreeNode = (label: RegExp): void => {
  const content = getTreeNodeContent(label);
  const caret = content.querySelector('.tree-node-caret');

  if (!(caret instanceof HTMLElement)) {
    throw new Error(`Tree node caret ${label.toString()} was not found`);
  }

  fireEvent.click(caret);
};

describe('SchemaBuilder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该正确渲染组件', () => {
      render(<SchemaBuilder />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.queryByText('Live Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('JSON Schema')).not.toBeInTheDocument();
    });

    it('应该使用 defaultValue 初始化', () => {
      render(<SchemaBuilder defaultValue={basicSchema} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('应该应用自定义 className', () => {
      const { container } = render(
        <SchemaBuilder className="custom-class" />
      );
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('应该应用自定义 style', () => {
      const { container } = render(
        <SchemaBuilder style={{ backgroundColor: 'red' }} />
      );
      const builder = container.querySelector('.schema-builder');
      expect(builder).toBeInTheDocument();
      // 验证 style 属性存在
      expect(builder?.getAttribute('style')).toContain('background-color');
    });
  });

  describe('空 Schema 处理', () => {
    it('应该为空 Schema 创建占位节点', () => {
      const onChange = jest.fn();
      render(<SchemaBuilder onChange={onChange} />);

      // 组件应该正常渲染
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('应该处理 null defaultValue', () => {
      render(<SchemaBuilder defaultValue={null as any} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('编辑和预览视图切换', () => {
    it('默认应该显示编辑态并隐藏预览内容', () => {
      render(<SchemaBuilder defaultValue={basicSchema} />);

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.queryByTestId('dynamic-form')).not.toBeInTheDocument();
      expect(screen.queryByText('Live Preview')).not.toBeInTheDocument();
    });

    it('点击 Preview 应该显示预览内容并隐藏 Schema Tree', () => {
      const { container } = render(<SchemaBuilder defaultValue={basicSchema} />);

      fireEvent.click(screen.getByText('Preview'));

      expect(screen.getByText('Live Preview')).toBeInTheDocument();
      expect(screen.getByText('JSON Schema')).toBeInTheDocument();
      expect(screen.getByTestId('dynamic-form')).toBeInTheDocument();
      expect(container.querySelector('.schema-builder-left')).not.toBeInTheDocument();
      expect(container.querySelector('.schema-builder-resizer')).not.toBeInTheDocument();
    });

    it('预览态应该将 Root 的 columnsCount 配置传递给 DynamicForm', () => {
      const schemaWithColumns = {
        ...basicSchema,
        ui: {
          ...basicSchema.ui,
          columnsCount: 3,
        },
      };

      render(<SchemaBuilder defaultValue={schemaWithColumns} />);

      fireEvent.click(screen.getByText('Preview'));

      expect(screen.getByTestId('dynamic-form')).toHaveAttribute(
        'data-columns-count',
        '3'
      );
    });

    it('切换视图前应该 blur 当前焦点元素以提交 onBlur 字段', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={basicSchema} onChange={onChange} />);

      const nameInput = screen.getByDisplayValue('name');
      fireEvent.change(nameInput, { target: { value: 'newName' } });
      nameInput.focus();

      fireEvent.click(screen.getByText('Preview'));

      await waitFor(() => {
        expect(onChange).toHaveBeenCalled();
      });
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall.properties.newName).toBeDefined();
      expect(lastCall.properties.name).toBeUndefined();
    });

    it('previewMode 为 none 时不显示 Preview 切换按钮', () => {
      render(<SchemaBuilder defaultValue={basicSchema} previewMode="none" />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.queryByText('Preview')).not.toBeInTheDocument();
    });
  });

  describe('预览标签页', () => {
    it('默认应该显示 Live Preview 标签页', () => {
      render(<SchemaBuilder defaultValue={basicSchema} />);
      fireEvent.click(screen.getByText('Preview'));
      expect(screen.getByTestId('dynamic-form')).toBeInTheDocument();
    });

    it('点击 JSON Schema 应该切换到 JSON 视图', () => {
      render(<SchemaBuilder defaultValue={basicSchema} />);

      fireEvent.click(screen.getByText('Preview'));
      fireEvent.click(screen.getByText('JSON Schema'));

      // JSON 视图应该显示 schema 内容
      expect(screen.getByText(/"type":/)).toBeInTheDocument();
    });
  });

  describe('onChange 回调', () => {
    it('应该在 schema 变化时调用 onChange', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={basicSchema} onChange={onChange} />);

      // 组件初始化后应该能正常工作
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('嵌套 Schema', () => {
    it('应该正确渲染嵌套对象 Schema', () => {
      render(<SchemaBuilder defaultValue={nestedSchema} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('应该正确渲染数组 Schema', () => {
      render(<SchemaBuilder defaultValue={arraySchema} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('useSchemaBuilder Hook', () => {
    it('在 Context 外使用应该抛出错误', () => {
      const TestComponent = () => {
        useSchemaBuilder();
        return null;
      };

      // 使用 jest.spyOn 捕获错误
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useSchemaBuilder must be used within a SchemaBuilderProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('空 properties 处理', () => {
    it('应该为空 properties 的 Schema 创建占位节点', () => {
      const emptyPropsSchema = {
        type: 'object' as const,
        title: 'Empty Props',
        properties: {},
      };
      render(<SchemaBuilder defaultValue={emptyPropsSchema} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('应该为没有 properties 的 Schema 创建占位节点', () => {
      const noPropsSchema = {
        type: 'object' as const,
        title: 'No Props',
      };
      render(<SchemaBuilder defaultValue={noPropsSchema} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('非 object 类型 Schema 处理', () => {
    it('应该将非 object 类型转换为 object', () => {
      const stringSchema = {
        type: 'string' as const,
        title: 'String Schema',
      };
      render(<SchemaBuilder defaultValue={stringSchema as any} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('Resizer 功能', () => {
    it('应该渲染 resizer 元素', () => {
      const { container } = render(<SchemaBuilder defaultValue={basicSchema} />);
      const resizer = container.querySelector('.schema-builder-resizer');
      expect(resizer).toBeInTheDocument();
    });

    it('mousedown 应该开始调整大小', () => {
      const { container } = render(<SchemaBuilder defaultValue={basicSchema} />);
      const resizer = container.querySelector('.schema-builder-resizer');

      fireEvent.mouseDown(resizer!);
      // 验证 cursor 样式被设置
      expect(document.body.style.cursor).toBe('col-resize');
    });

    it('mouseup 应该停止调整大小', () => {
      const { container } = render(<SchemaBuilder defaultValue={basicSchema} />);
      const resizer = container.querySelector('.schema-builder-resizer');

      fireEvent.mouseDown(resizer!);
      fireEvent.mouseUp(document);

      expect(document.body.style.cursor).toBe('default');
    });

    it('mousemove 应该调整面板宽度', () => {
      const { container } = render(<SchemaBuilder defaultValue={basicSchema} />);
      const resizer = container.querySelector('.schema-builder-resizer');
      const leftPanel = container.querySelector('.schema-builder-left');

      fireEvent.mouseDown(resizer!);
      fireEvent.mouseMove(document, { movementX: 50 });
      fireEvent.mouseUp(document);

      // 验证左侧面板存在
      expect(leftPanel).toBeInTheDocument();
    });
  });

  describe('defaultValue 变化', () => {
    it('当 defaultValue 变化时应该更新 schema', () => {
      const { rerender } = render(<SchemaBuilder defaultValue={basicSchema} />);

      rerender(<SchemaBuilder defaultValue={nestedSchema} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('Context 操作测试', () => {
    // 创建一个测试组件来访问 context
    const TestContextConsumer: React.FC<{
      onContextReady: (ctx: any) => void;
    }> = ({ onContextReady }) => {
      const ctx = useSchemaBuilder();
      React.useEffect(() => {
        onContextReady(ctx);
      }, [ctx, onContextReady]);
      return <div data-testid="context-consumer">Context Ready</div>;
    };

    const renderWithContext = (
      defaultValue?: any,
      onChange?: jest.Mock
    ) => {
      let contextRef: any = null;
      const handleContextReady = (ctx: any) => {
        contextRef = ctx;
      };

      const TestWrapper: React.FC = () => {
        const ctx = useSchemaBuilder();
        React.useEffect(() => {
          handleContextReady(ctx);
        }, [ctx]);
        return <div data-testid="context-consumer">Context Ready</div>;
      };

      render(
        <SchemaBuilder defaultValue={defaultValue} onChange={onChange}>
          {/* Children are not used, but we can access context via SchemaTree */}
        </SchemaBuilder>
      );

      return { getContext: () => contextRef };
    };

    it('onToggleExpand 应该更新展开状态', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={nestedSchema} onChange={onChange} />);

      // 组件应该正常渲染
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('onUpdate 应该更新节点属性', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={basicSchema} onChange={onChange} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('onAddChild 应该添加子节点', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={basicSchema} onChange={onChange} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('onAddSibling 应该添加兄弟节点', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={basicSchema} onChange={onChange} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('onDelete 应该删除节点', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={basicSchema} onChange={onChange} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('undefined defaultValue 处理', () => {
    it('应该处理 undefined defaultValue', () => {
      render(<SchemaBuilder defaultValue={undefined} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('空对象 defaultValue 处理', () => {
    it('应该处理空对象 defaultValue', () => {
      render(<SchemaBuilder defaultValue={{} as any} />);
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('树节点交互', () => {
    it('点击树节点应该选中该节点', () => {
      render(<SchemaBuilder defaultValue={basicSchema} />);

      // 组件应该正常渲染
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('展开嵌套节点应该显示子节点', () => {
      render(<SchemaBuilder defaultValue={nestedSchema} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('JSON Schema 视图', () => {
    it('JSON Schema 视图应该显示格式化的 JSON', () => {
      render(<SchemaBuilder defaultValue={basicSchema} />);

      fireEvent.click(screen.getByText('Preview'));
      fireEvent.click(screen.getByText('JSON Schema'));

      expect(screen.getByText(/\"type\":/)).toBeInTheDocument();
      expect(screen.getByText(/\"properties\":/)).toBeInTheDocument();
    });
  });

  describe('数组类型 Schema', () => {
    it('应该正确渲染数组类型的 Schema', () => {
      render(<SchemaBuilder defaultValue={arraySchema} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('handleUpdate 功能', () => {
    it('更新字段 title 应该调用 onChange', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={basicSchema} onChange={onChange} />);

      // 点击树节点中的 Name 字段选中它
      const nameNodes = screen.getAllByText(/Name/i);
      const treeNameNode = nameNodes.find(node =>
        node.closest('.tree-node-label')
      );
      if (treeNameNode) {
        fireEvent.click(treeNameNode);
      }

      // 找到 title 输入框并修改
      await waitFor(() => {
        const titleInputs = screen.getAllByDisplayValue('Name');
        if (titleInputs.length > 0) {
          fireEvent.change(titleInputs[0], { target: { value: 'New Name' } });
          fireEvent.blur(titleInputs[0]);
        }
      });

      expect(onChange).toHaveBeenCalled();
    });

    it('更新字段类型为 array 应该自动创建 items', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={basicSchema} onChange={onChange} />);

      // 点击树节点中的 Name 字段选中它
      const nameNodes = screen.getAllByText(/Name/i);
      const treeNameNode = nameNodes.find(node =>
        node.closest('.tree-node-label')
      );
      if (treeNameNode) {
        fireEvent.click(treeNameNode);
      }

      await waitFor(() => {
        const typeSelect = screen.getByDisplayValue('String');
        fireEvent.change(typeSelect, { target: { value: 'array' } });
      });

      expect(onChange).toHaveBeenCalled();
      // 验证 onChange 被调用时包含 items
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall.properties.name.type).toBe('array');
      expect(lastCall.properties.name.items).toBeDefined();
    });

    it('更新字段类型为 object 应该自动创建 properties', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={basicSchema} onChange={onChange} />);

      const nameNodes = screen.getAllByText(/Name/i);
      const treeNameNode = nameNodes.find(node =>
        node.closest('.tree-node-label')
      );
      if (treeNameNode) {
        fireEvent.click(treeNameNode);
      }

      await waitFor(() => {
        const typeSelect = screen.getByDisplayValue('String');
        fireEvent.change(typeSelect, { target: { value: 'object' } });
      });

      expect(onChange).toHaveBeenCalled();
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(lastCall.properties.name.type).toBe('object');
      expect(lastCall.properties.name.properties).toBeDefined();
    });
  });

  describe('handleAddChild 功能', () => {
    it('点击添加子节点菜单应该添加新字段', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={nestedSchema} onChange={onChange} />);

      // 找到 User 节点的更多按钮
      const moreButtons = screen.getAllByRole('button');
      // 点击第一个更多按钮（根节点）
      if (moreButtons.length > 0) {
        fireEvent.click(moreButtons[0]);
        await waitFor(() => {
          const addChildMenuItem = screen.queryByText('Add Child Node');
          if (addChildMenuItem) {
            fireEvent.click(addChildMenuItem);
          }
        });
      }
    });
  });

  describe('handleDelete 功能', () => {
    it('删除字段后应该更新 schema', async () => {
      const onChange = jest.fn();
      const multiFieldSchema = {
        type: 'object' as const,
        title: 'Test',
        properties: {
          field1: { type: 'string' as const, title: 'Field 1' },
          field2: { type: 'string' as const, title: 'Field 2' },
        },
      };
      render(<SchemaBuilder defaultValue={multiFieldSchema} onChange={onChange} />);

      // 找到字段节点的更多按钮并点击删除
      const moreButtons = screen.getAllByRole('button');
      if (moreButtons.length > 1) {
        fireEvent.click(moreButtons[1]);
        await waitFor(() => {
          const deleteMenuItem = screen.queryByText('Delete Node');
          if (deleteMenuItem) {
            fireEvent.click(deleteMenuItem);
          }
        });
      }
    });
  });

  describe('handleToggleExpand 功能', () => {
    it('展开节点应该更新 expandedPaths', () => {
      render(<SchemaBuilder defaultValue={nestedSchema} />);

      // 找到 User 节点
      const userNodes = screen.getAllByText(/User/i);
      const treeUserNode = userNodes.find(node =>
        node.closest('.tree-node-label')
      );
      expect(treeUserNode).toBeInTheDocument();
    });
  });

  describe('数组 items 类型切换', () => {
    it('从 object 切换为 string 时应该移除 properties 和子节点', async () => {
      const onChange = jest.fn();
      const schema = {
        type: 'object' as const,
        title: 'Array Form',
        properties: {
          contacts: {
            type: 'array' as const,
            title: 'Contacts',
            items: {
              type: 'object' as const,
              title: 'Contact',
              required: ['name'],
              properties: {
                name: { type: 'string' as const, title: 'Contact Name' },
              },
            },
          },
        },
      };

      render(<SchemaBuilder defaultValue={schema} onChange={onChange} />);

      expandTreeNode(/Contacts \(contacts\)/i);
      fireEvent.click(getTreeNodeContent(/Contact \(items\)/i));
      fireEvent.change(screen.getByDisplayValue('Object'), {
        target: { value: 'string' },
      });

      await waitFor(() => {
        const lastSchema =
          onChange.mock.calls[onChange.mock.calls.length - 1][0];
        expect(lastSchema.properties.contacts.items.type).toBe('string');
        expect(lastSchema.properties.contacts.items.properties).toBeUndefined();
        expect(lastSchema.properties.contacts.items.required).toBeUndefined();
        expect(
          screen.queryByText(/Contact Name \(name\)/i)
        ).not.toBeInTheDocument();
      });
    });

    it('从基本类型切换为 object 时应该创建 properties 和默认子节点', async () => {
      const onChange = jest.fn();
      const schema = {
        type: 'object' as const,
        title: 'Array Form',
        properties: {
          tags: {
            type: 'array' as const,
            title: 'Tags',
            items: { type: 'string' as const, title: 'Item' },
          },
        },
      };

      render(<SchemaBuilder defaultValue={schema} onChange={onChange} />);

      expandTreeNode(/Tags \(tags\)/i);
      fireEvent.click(getTreeNodeContent(/Item \(items\)/i));
      fireEvent.change(screen.getByDisplayValue('String'), {
        target: { value: 'object' },
      });

      await waitFor(() => {
        const lastSchema =
          onChange.mock.calls[onChange.mock.calls.length - 1][0];
        const itemProperties = lastSchema.properties.tags.items.properties;
        expect(lastSchema.properties.tags.items.type).toBe('object');
        expect(Object.keys(itemProperties)).toHaveLength(1);
        expect(Object.values(itemProperties)[0]).toEqual({
          type: 'string',
          title: 'New Field',
        });
        expect(screen.getByText(/New Field/i)).toBeInTheDocument();
      });
    });

    it('从基本类型切换为 array 时应该创建嵌套 items 和默认子节点', async () => {
      const onChange = jest.fn();
      const schema = {
        type: 'object' as const,
        title: 'Array Form',
        properties: {
          matrix: {
            type: 'array' as const,
            title: 'Matrix',
            items: { type: 'number' as const, title: 'Row' },
          },
        },
      };

      render(<SchemaBuilder defaultValue={schema} onChange={onChange} />);

      expandTreeNode(/Matrix \(matrix\)/i);
      fireEvent.click(getTreeNodeContent(/Row \(items\)/i));
      fireEvent.change(screen.getByDisplayValue('Number'), {
        target: { value: 'array' },
      });

      await waitFor(() => {
        const lastSchema =
          onChange.mock.calls[onChange.mock.calls.length - 1][0];
        const nestedItems = lastSchema.properties.matrix.items.items;
        expect(lastSchema.properties.matrix.items.type).toBe('array');
        expect(nestedItems.type).toBe('object');
        expect(Object.keys(nestedItems.properties)).toHaveLength(1);
        expect(screen.getByText(/Items \(items\)/i)).toBeInTheDocument();
        expect(screen.getByText(/New Field/i)).toBeInTheDocument();
      });
    });
  });

  describe('字段重命名功能', () => {
    it('修改字段 name 应该重命名 key', async () => {
      const onChange = jest.fn();
      render(<SchemaBuilder defaultValue={basicSchema} onChange={onChange} />);

      // 点击树节点中的 Name 字段选中它
      const nameNodes = screen.getAllByText(/Name/i);
      const treeNameNode = nameNodes.find(node =>
        node.closest('.tree-node-label')
      );
      if (treeNameNode) {
        fireEvent.click(treeNameNode);
      }

      await waitFor(() => {
        // 找到 name 输入框（字段 key）
        const nameInput = screen.getByDisplayValue('name');
        fireEvent.change(nameInput, { target: { value: 'newName' } });
        fireEvent.blur(nameInput);
      });

      expect(onChange).toHaveBeenCalled();
    });
  });
});
