/**
 * Tree 组件测试
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Tree } from '../Tree';
import type { TreeNodeInfo } from '../types';

describe('Tree', () => {
  // 创建基础节点数据
  const createNode = <T,>(
    overrides?: Partial<TreeNodeInfo<T>>
  ): TreeNodeInfo<T> =>
    ({
      id: 'node-1',
      label: 'Test Node',
      ...overrides,
    }) as TreeNodeInfo<T>;

  const createContents = <T,>(
    nodes?: Partial<TreeNodeInfo<T>>[]
  ): TreeNodeInfo<T>[] =>
    nodes?.map((n, i) => createNode({ id: `node-${i + 1}`, ...n })) || [
      createNode(),
    ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该渲染树容器', () => {
      const { container } = render(<Tree contents={createContents()} />);

      expect(container.querySelector('.tree')).toBeInTheDocument();
    });

    it('应该渲染 tree-root ul 元素', () => {
      const { container } = render(<Tree contents={createContents()} />);

      const root = container.querySelector('.tree-root');
      expect(root).toBeInTheDocument();
      expect(root?.tagName).toBe('UL');
    });

    it('应该有 tree 角色', () => {
      render(<Tree contents={createContents()} />);

      expect(screen.getByRole('tree')).toBeInTheDocument();
    });

    it('应该渲染所有根节点', () => {
      render(
        <Tree
          contents={createContents([
            { label: 'Node 1' },
            { label: 'Node 2' },
            { label: 'Node 3' },
          ])}
        />
      );

      expect(screen.getByText('Node 1')).toBeInTheDocument();
      expect(screen.getByText('Node 2')).toBeInTheDocument();
      expect(screen.getByText('Node 3')).toBeInTheDocument();
    });

    it('空内容时应该渲染空树', () => {
      const { container } = render(<Tree contents={[]} />);

      const root = container.querySelector('.tree-root');
      expect(root).toBeInTheDocument();
      expect(root?.children).toHaveLength(0);
    });
  });

  describe('自定义类名', () => {
    it('应该应用自定义 className', () => {
      const { container } = render(
        <Tree contents={createContents()} className="my-custom-tree" />
      );

      const tree = container.querySelector('.tree');
      expect(tree).toHaveClass('tree', 'my-custom-tree');
    });

    it('没有自定义 className 时只有 tree 类名', () => {
      const { container } = render(<Tree contents={createContents()} />);

      const tree = container.querySelector('.tree');
      expect(tree?.className).toBe('tree');
    });
  });

  describe('节点事件传递', () => {
    it('应该将 onNodeClick 传递给子节点', () => {
      const onNodeClick = jest.fn();
      render(
        <Tree
          contents={createContents([{ label: 'Click Me' }])}
          onNodeClick={onNodeClick}
        />
      );

      const content = screen.getByText('Click Me').closest('.tree-node-content');
      fireEvent.click(content!);

      expect(onNodeClick).toHaveBeenCalledTimes(1);
      expect(onNodeClick).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Click Me' }),
        [0],
        expect.any(Object)
      );
    });

    it('应该将 onNodeDoubleClick 传递给子节点', () => {
      const onNodeDoubleClick = jest.fn();
      render(
        <Tree
          contents={createContents([{ label: 'Double Click Me' }])}
          onNodeDoubleClick={onNodeDoubleClick}
        />
      );

      const content = screen
        .getByText('Double Click Me')
        .closest('.tree-node-content');
      fireEvent.doubleClick(content!);

      expect(onNodeDoubleClick).toHaveBeenCalledTimes(1);
    });

    it('应该将 onNodeContextMenu 传递给子节点', () => {
      const onNodeContextMenu = jest.fn();
      render(
        <Tree
          contents={createContents([{ label: 'Right Click Me' }])}
          onNodeContextMenu={onNodeContextMenu}
        />
      );

      const content = screen
        .getByText('Right Click Me')
        .closest('.tree-node-content');
      fireEvent.contextMenu(content!);

      expect(onNodeContextMenu).toHaveBeenCalledTimes(1);
    });

    it('应该将 onNodeExpand 传递给子节点', () => {
      const onNodeExpand = jest.fn();
      render(
        <Tree
          contents={createContents([
            {
              label: 'Parent',
              isExpanded: false,
              childNodes: [{ id: 'child-1', label: 'Child' }],
            },
          ])}
          onNodeExpand={onNodeExpand}
        />
      );

      const caret = document.querySelector('.tree-node-caret');
      fireEvent.click(caret!);

      expect(onNodeExpand).toHaveBeenCalledTimes(1);
    });

    it('应该将 onNodeCollapse 传递给子节点', () => {
      const onNodeCollapse = jest.fn();
      render(
        <Tree
          contents={createContents([
            {
              label: 'Parent',
              isExpanded: true,
              childNodes: [{ id: 'child-1', label: 'Child' }],
            },
          ])}
          onNodeCollapse={onNodeCollapse}
        />
      );

      const caret = document.querySelector('.tree-node-caret');
      fireEvent.click(caret!);

      expect(onNodeCollapse).toHaveBeenCalledTimes(1);
    });
  });

  describe('节点路径', () => {
    it('根节点应该有正确的路径', () => {
      const onNodeClick = jest.fn();
      render(
        <Tree
          contents={createContents([
            { label: 'First' },
            { label: 'Second' },
            { label: 'Third' },
          ])}
          onNodeClick={onNodeClick}
        />
      );

      // 点击第二个节点
      const secondContent = screen.getByText('Second').closest('.tree-node-content');
      fireEvent.click(secondContent!);

      expect(onNodeClick).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Second' }),
        [1], // 第二个根节点的路径
        expect.any(Object)
      );
    });

    it('第三个根节点应该有路径 [2]', () => {
      const onNodeClick = jest.fn();
      render(
        <Tree
          contents={createContents([
            { label: 'First' },
            { label: 'Second' },
            { label: 'Third' },
          ])}
          onNodeClick={onNodeClick}
        />
      );

      const thirdContent = screen.getByText('Third').closest('.tree-node-content');
      fireEvent.click(thirdContent!);

      expect(onNodeClick).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Third' }),
        [2],
        expect.any(Object)
      );
    });
  });

  describe('嵌套结构', () => {
    it('应该正确渲染嵌套的子节点', () => {
      render(
        <Tree
          contents={[
            {
              id: 'parent',
              label: 'Parent',
              isExpanded: true,
              childNodes: [
                { id: 'child-1', label: 'Child 1' },
                { id: 'child-2', label: 'Child 2' },
              ],
            },
          ]}
        />
      );

      expect(screen.getByText('Parent')).toBeInTheDocument();
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });

    it('折叠时不应该渲染子节点', () => {
      render(
        <Tree
          contents={[
            {
              id: 'parent',
              label: 'Parent',
              isExpanded: false,
              childNodes: [{ id: 'child-1', label: 'Child 1' }],
            },
          ]}
        />
      );

      expect(screen.getByText('Parent')).toBeInTheDocument();
      expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
    });

    it('子节点事件应该有正确的嵌套路径', () => {
      const onNodeClick = jest.fn();
      render(
        <Tree
          contents={[
            {
              id: 'parent',
              label: 'Parent',
              isExpanded: true,
              childNodes: [
                {
                  id: 'child-1',
                  label: 'Child 1',
                  isExpanded: true,
                  childNodes: [{ id: 'grandchild', label: 'Grandchild' }],
                },
              ],
            },
          ]}
          onNodeClick={onNodeClick}
        />
      );

      const grandchildContent = screen
        .getByText('Grandchild')
        .closest('.tree-node-content');
      fireEvent.click(grandchildContent!);

      expect(onNodeClick).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Grandchild' }),
        [0, 0, 0], // 第一个根节点 -> 第一个子节点 -> 第一个孙节点
        expect.any(Object)
      );
    });
  });

  describe('节点属性', () => {
    it('应该正确渲染选中的节点', () => {
      const { container } = render(
        <Tree
          contents={createContents([
            { label: 'Selected Node', isSelected: true },
          ])}
        />
      );

      const node = container.querySelector('.tree-node');
      expect(node).toHaveClass('tree-node-selected');
    });

    it('应该正确渲染禁用的节点', () => {
      const { container } = render(
        <Tree
          contents={createContents([{ label: 'Disabled Node', disabled: true }])}
        />
      );

      const node = container.querySelector('.tree-node');
      expect(node).toHaveClass('tree-node-disabled');
    });

    it('禁用的节点点击不应该触发事件', () => {
      const onNodeClick = jest.fn();
      render(
        <Tree
          contents={createContents([{ label: 'Disabled', disabled: true }])}
          onNodeClick={onNodeClick}
        />
      );

      const content = screen.getByText('Disabled').closest('.tree-node-content');
      fireEvent.click(content!);

      expect(onNodeClick).not.toHaveBeenCalled();
    });

    it('应该正确渲染节点图标', () => {
      render(
        <Tree
          contents={createContents([
            {
              label: 'Node with Icon',
              icon: <span data-testid="custom-icon">📁</span>,
            },
          ])}
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('应该正确渲染次要标签', () => {
      render(
        <Tree
          contents={createContents([
            {
              label: 'Node',
              secondaryLabel: <span data-testid="secondary">Info</span>,
            },
          ])}
        />
      );

      expect(screen.getByTestId('secondary')).toBeInTheDocument();
    });
  });

  describe('泛型支持', () => {
    interface CustomData {
      value: number;
      name: string;
    }

    it('应该支持自定义 nodeData 类型', () => {
      const onNodeClick = jest.fn();
      const customData: CustomData = { value: 42, name: 'test' };

      render(
        <Tree<CustomData>
          contents={[
            {
              id: 'node-1',
              label: 'Node with Data',
              nodeData: customData,
            },
          ]}
          onNodeClick={onNodeClick}
        />
      );

      const content = screen
        .getByText('Node with Data')
        .closest('.tree-node-content');
      fireEvent.click(content!);

      expect(onNodeClick).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeData: { value: 42, name: 'test' },
        }),
        [0],
        expect.any(Object)
      );
    });
  });

  describe('displayName', () => {
    it('组件应该有正确的 displayName', () => {
      expect(Tree.displayName).toBe('Tree');
    });
  });

  describe('多个根节点', () => {
    it('应该为每个根节点使用 node.id 作为 key', () => {
      // 这个测试主要确保没有 key 警告
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <Tree
          contents={[
            { id: 'unique-1', label: 'Node 1' },
            { id: 'unique-2', label: 'Node 2' },
            { id: 'unique-3', label: 'Node 3' },
          ]}
        />
      );

      // 确保没有关于 key 的警告
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('key'),
        expect.anything(),
        expect.anything()
      );

      consoleSpy.mockRestore();
    });

    it('所有根节点应该是 treeitem', () => {
      render(
        <Tree
          contents={[
            { id: '1', label: 'Node 1' },
            { id: '2', label: 'Node 2' },
          ]}
        />
      );

      const treeItems = screen.getAllByRole('treeitem');
      expect(treeItems).toHaveLength(2);
    });
  });
});
