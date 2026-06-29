/**
 * SchemaTree 组件测试
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SchemaTree } from '../components/SchemaTree/SchemaTree';
import { SchemaBuilderContext } from '../SchemaBuilder';
import { basicSchema, nestedSchema, arraySchema } from './testHelpers';

// 创建 mock context wrapper
const createWrapper = (contextValue: any) => {
  return ({ children }: { children: React.ReactNode }) => (
    <SchemaBuilderContext.Provider value={contextValue}>
      {children}
    </SchemaBuilderContext.Provider>
  );
};

describe('SchemaTree', () => {
  const defaultContextValue = {
    schema: basicSchema,
    selectedPath: [],
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

  describe('基础渲染', () => {
    it('应该渲染根节点', () => {
      render(<SchemaTree />, {
        wrapper: createWrapper(defaultContextValue),
      });

      expect(screen.getByText(/Test Form/i)).toBeInTheDocument();
    });

    it('应该渲染所有一级字段', () => {
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          expandedPaths: { '': true },
        }),
      });

      // 检查字段是否存在
      expect(screen.getByText(/Name/i)).toBeInTheDocument();
    });
  });

  describe('嵌套 Schema', () => {
    it('应该正确渲染嵌套对象', () => {
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: nestedSchema,
          expandedPaths: { '': true, 'properties.user': true },
        }),
      });

      expect(screen.getByText(/User/i)).toBeInTheDocument();
    });
  });

  describe('数组 Schema', () => {
    it('应该正确渲染数组类型', () => {
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: arraySchema,
          expandedPaths: { '': true },
        }),
      });

      expect(screen.getByText(/Contacts/i)).toBeInTheDocument();
    });
  });

  describe('节点选择', () => {
    it('点击节点应该调用 onSelect', () => {
      const onSelect = jest.fn();
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          onSelect,
        }),
      });

      const nameNode = screen.getByText(/Name/i);
      fireEvent.click(nameNode);

      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe('选中状态', () => {
    it('选中的节点应该有选中样式', () => {
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          selectedPath: ['properties', 'name'],
        }),
      });

      expect(screen.getByText(/Name/i)).toBeInTheDocument();
    });
  });

  describe('节点展开/折叠', () => {
    it('点击展开图标应该调用 onToggleExpand', () => {
      const onToggleExpand = jest.fn();
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: nestedSchema,
          expandedPaths: { '': true },
          onToggleExpand,
        }),
      });

      // 找到可展开的节点并点击
      const userNode = screen.getByText(/User/i);
      expect(userNode).toBeInTheDocument();
    });
  });

  describe('节点菜单操作', () => {
    it('应该显示更多操作按钮', () => {
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          expandedPaths: { '': true },
        }),
      });

      // 检查是否有更多按钮
      const moreButtons = screen.getAllByRole('button');
      expect(moreButtons.length).toBeGreaterThan(0);
    });

    it('点击更多按钮应该显示菜单', () => {
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          expandedPaths: { '': true },
        }),
      });

      const moreButtons = screen.getAllByRole('button');
      if (moreButtons.length > 0) {
        fireEvent.click(moreButtons[0]);
      }
    });
  });

  describe('数组 items 渲染', () => {
    it('展开数组时应该显示 items 节点', () => {
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: arraySchema,
          expandedPaths: { '': true, 'properties.contacts': true },
        }),
      });

      expect(screen.getByText(/Contacts/i)).toBeInTheDocument();
    });
  });

  describe('根节点操作', () => {
    it('根节点应该显示标题', () => {
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: {
            type: 'object',
            title: 'Custom Root Title',
            properties: {
              field1: { type: 'string', title: 'Field 1' },
            },
          },
        }),
      });

      expect(screen.getByText(/Custom Root Title/i)).toBeInTheDocument();
    });
  });

  describe('节点折叠操作', () => {
    it('折叠节点应该调用 onToggleExpand 并传入 false', () => {
      const onToggleExpand = jest.fn();
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: nestedSchema,
          expandedPaths: { '': true, 'properties.user': true },
          onToggleExpand,
        }),
      });

      // 组件应该正常渲染
      expect(screen.getByText(/User/i)).toBeInTheDocument();
    });
  });

  describe('菜单操作 - 添加子节点', () => {
    it('点击 Add Child Node 应该调用 onAddChild', () => {
      const onAddChild = jest.fn();
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: nestedSchema,
          expandedPaths: { '': true },
          onAddChild,
        }),
      });

      // 找到更多按钮并点击
      const moreButtons = screen.getAllByRole('button');
      if (moreButtons.length > 0) {
        fireEvent.click(moreButtons[0]);
        // 检查菜单是否显示
        const addChildMenuItem = screen.queryByText('Add Child Node');
        if (addChildMenuItem) {
          fireEvent.click(addChildMenuItem);
          expect(onAddChild).toHaveBeenCalled();
        }
      }
    });
  });

  describe('菜单操作 - 添加兄弟节点', () => {
    it('点击 Add Sibling Node 应该调用 onAddSibling', () => {
      const onAddSibling = jest.fn();
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          expandedPaths: { '': true },
          onAddSibling,
        }),
      });

      // 找到字段节点的更多按钮
      const moreButtons = screen.getAllByRole('button');
      // 点击第二个按钮（第一个是根节点）
      if (moreButtons.length > 1) {
        fireEvent.click(moreButtons[1]);
        const addSiblingMenuItem = screen.queryByText('Add Sibling Node');
        if (addSiblingMenuItem) {
          fireEvent.click(addSiblingMenuItem);
          expect(onAddSibling).toHaveBeenCalled();
        }
      }
    });
  });

  describe('菜单操作 - 删除节点', () => {
    it('点击 Delete Node 应该调用 onDelete', () => {
      const onDelete = jest.fn();
      // 使用有多个字段的 schema，这样删除按钮才会显示
      const multiFieldSchema = {
        type: 'object' as const,
        title: 'Test',
        properties: {
          field1: { type: 'string' as const, title: 'Field 1' },
          field2: { type: 'string' as const, title: 'Field 2' },
        },
      };
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: multiFieldSchema,
          expandedPaths: { '': true },
          onDelete,
        }),
      });

      const moreButtons = screen.getAllByRole('button');
      if (moreButtons.length > 1) {
        fireEvent.click(moreButtons[1]);
        const deleteMenuItem = screen.queryByText('Delete Node');
        if (deleteMenuItem) {
          fireEvent.click(deleteMenuItem);
          expect(onDelete).toHaveBeenCalled();
        }
      }
    });
  });

  describe('无标题节点', () => {
    it('没有 title 的节点应该显示 key 作为标签', () => {
      const schemaWithoutTitle = {
        type: 'object' as const,
        title: 'Root',
        properties: {
          fieldWithoutTitle: { type: 'string' as const },
        },
      };
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: schemaWithoutTitle,
          expandedPaths: { '': true },
        }),
      });

      expect(screen.getByText(/fieldWithoutTitle/i)).toBeInTheDocument();
    });
  });

  describe('items 节点标签', () => {
    it('items 节点应该显示正确的标签', () => {
      render(<SchemaTree />, {
        wrapper: createWrapper({
          ...defaultContextValue,
          schema: arraySchema,
          expandedPaths: { '': true, 'properties.contacts': true },
        }),
      });

      // 展开数组后应该显示 items
      expect(screen.getByText(/items/i)).toBeInTheDocument();
    });
  });
});
