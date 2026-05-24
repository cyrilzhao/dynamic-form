/**
 * TreeNode 组件测试
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TreeNode } from '../TreeNode';
import type { TreeNodeInfo, NodePath } from '../types';

describe('TreeNode', () => {
  // 基础节点数据
  const createBasicNode = (overrides?: Partial<TreeNodeInfo>): TreeNodeInfo => ({
    id: 'node-1',
    label: 'Test Node',
    ...overrides,
  });

  const defaultPath: NodePath = [0];
  const defaultDepth = 0;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该正确渲染节点标签', () => {
      const node = createBasicNode({ label: 'My Node Label' });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      expect(screen.getByText('My Node Label')).toBeInTheDocument();
    });

    it('应该渲染为 li 元素并具有 treeitem 角色', () => {
      const node = createBasicNode();
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      const listItem = screen.getByRole('treeitem');
      expect(listItem).toBeInTheDocument();
      expect(listItem.tagName).toBe('LI');
    });

    it('应该应用正确的基础类名', () => {
      const node = createBasicNode();
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      const listItem = screen.getByRole('treeitem');
      expect(listItem).toHaveClass('tree-node');
    });

    it('应该根据深度设置正确的缩进', () => {
      const node = createBasicNode();
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={2} />
      );

      const content = container.querySelector('.tree-node-content');
      expect(content).toHaveStyle({ paddingLeft: '40px' });
    });

    it('应该支持 ReactNode 类型的标签', () => {
      const node = createBasicNode({
        label: <span data-testid="custom-label">Custom Label</span>,
      });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      expect(screen.getByTestId('custom-label')).toBeInTheDocument();
    });
  });

  describe('自定义类名', () => {
    it('应该应用自定义 className', () => {
      const node = createBasicNode({ className: 'custom-class' });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      const listItem = screen.getByRole('treeitem');
      expect(listItem).toHaveClass('tree-node', 'custom-class');
    });
  });

  describe('选中状态', () => {
    it('选中时应该添加 tree-node-selected 类名', () => {
      const node = createBasicNode({ isSelected: true });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      const listItem = screen.getByRole('treeitem');
      expect(listItem).toHaveClass('tree-node-selected');
    });

    it('未选中时不应该有 tree-node-selected 类名', () => {
      const node = createBasicNode({ isSelected: false });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      const listItem = screen.getByRole('treeitem');
      expect(listItem).not.toHaveClass('tree-node-selected');
    });
  });

  describe('展开状态', () => {
    it('展开时应该添加 tree-node-expanded 类名', () => {
      const node = createBasicNode({ isExpanded: true });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      const listItem = screen.getByRole('treeitem');
      expect(listItem).toHaveClass('tree-node-expanded');
    });

    it('展开时 aria-expanded 应该为 true（有子节点时）', () => {
      const node = createBasicNode({
        isExpanded: true,
        childNodes: [{ id: 'child-1', label: 'Child' }],
      });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      // 展开时会渲染子节点，所以有多个 treeitem，取第一个（父节点）
      const listItems = screen.getAllByRole('treeitem');
      expect(listItems[0]).toHaveAttribute('aria-expanded', 'true');
    });

    it('折叠时 aria-expanded 应该为 false（有子节点时）', () => {
      const node = createBasicNode({
        isExpanded: false,
        childNodes: [{ id: 'child-1', label: 'Child' }],
      });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      const listItem = screen.getByRole('treeitem');
      expect(listItem).toHaveAttribute('aria-expanded', 'false');
    });

    it('没有子节点时不应该设置 aria-expanded', () => {
      const node = createBasicNode({ isExpanded: false });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      const listItem = screen.getByRole('treeitem');
      expect(listItem).not.toHaveAttribute('aria-expanded');
    });
  });

  describe('禁用状态', () => {
    it('禁用时应该添加 tree-node-disabled 类名', () => {
      const node = createBasicNode({ disabled: true });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      const listItem = screen.getByRole('treeitem');
      expect(listItem).toHaveClass('tree-node-disabled');
    });

    it('禁用时点击不应该触发 onNodeClick', () => {
      const onNodeClick = jest.fn();
      const node = createBasicNode({ disabled: true });
      render(
        <TreeNode
          node={node}
          path={defaultPath}
          depth={defaultDepth}
          onNodeClick={onNodeClick}
        />
      );

      const content = screen.getByText('Test Node').closest('.tree-node-content');
      fireEvent.click(content!);

      expect(onNodeClick).not.toHaveBeenCalled();
    });

    it('禁用时双击不应该触发 onNodeDoubleClick', () => {
      const onNodeDoubleClick = jest.fn();
      const node = createBasicNode({ disabled: true });
      render(
        <TreeNode
          node={node}
          path={defaultPath}
          depth={defaultDepth}
          onNodeDoubleClick={onNodeDoubleClick}
        />
      );

      const content = screen.getByText('Test Node').closest('.tree-node-content');
      fireEvent.doubleClick(content!);

      expect(onNodeDoubleClick).not.toHaveBeenCalled();
    });

    it('禁用时右键不应该触发 onNodeContextMenu', () => {
      const onNodeContextMenu = jest.fn();
      const node = createBasicNode({ disabled: true });
      render(
        <TreeNode
          node={node}
          path={defaultPath}
          depth={defaultDepth}
          onNodeContextMenu={onNodeContextMenu}
        />
      );

      const content = screen.getByText('Test Node').closest('.tree-node-content');
      fireEvent.contextMenu(content!);

      expect(onNodeContextMenu).not.toHaveBeenCalled();
    });

    it('禁用时点击箭头不应该触发展开/折叠', () => {
      const onNodeExpand = jest.fn();
      const onNodeCollapse = jest.fn();
      const node = createBasicNode({
        disabled: true,
        childNodes: [{ id: 'child-1', label: 'Child' }],
      });
      const { container } = render(
        <TreeNode
          node={node}
          path={defaultPath}
          depth={defaultDepth}
          onNodeExpand={onNodeExpand}
          onNodeCollapse={onNodeCollapse}
        />
      );

      const caret = container.querySelector('.tree-node-caret');
      fireEvent.click(caret!);

      expect(onNodeExpand).not.toHaveBeenCalled();
      expect(onNodeCollapse).not.toHaveBeenCalled();
    });
  });

  describe('节点点击事件', () => {
    it('点击节点应该触发 onNodeClick', () => {
      const onNodeClick = jest.fn();
      const node = createBasicNode();
      render(
        <TreeNode
          node={node}
          path={defaultPath}
          depth={defaultDepth}
          onNodeClick={onNodeClick}
        />
      );

      const content = screen.getByText('Test Node').closest('.tree-node-content');
      fireEvent.click(content!);

      expect(onNodeClick).toHaveBeenCalledTimes(1);
      expect(onNodeClick).toHaveBeenCalledWith(node, defaultPath, expect.any(Object));
    });

    it('没有提供 onNodeClick 时点击不应该报错', () => {
      const node = createBasicNode();
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      const content = screen.getByText('Test Node').closest('.tree-node-content');
      expect(() => fireEvent.click(content!)).not.toThrow();
    });
  });

  describe('节点双击事件', () => {
    it('双击节点应该触发 onNodeDoubleClick', () => {
      const onNodeDoubleClick = jest.fn();
      const node = createBasicNode();
      render(
        <TreeNode
          node={node}
          path={defaultPath}
          depth={defaultDepth}
          onNodeDoubleClick={onNodeDoubleClick}
        />
      );

      const content = screen.getByText('Test Node').closest('.tree-node-content');
      fireEvent.doubleClick(content!);

      expect(onNodeDoubleClick).toHaveBeenCalledTimes(1);
      expect(onNodeDoubleClick).toHaveBeenCalledWith(node, defaultPath, expect.any(Object));
    });
  });

  describe('右键菜单事件', () => {
    it('右键点击应该触发 onNodeContextMenu', () => {
      const onNodeContextMenu = jest.fn();
      const node = createBasicNode();
      render(
        <TreeNode
          node={node}
          path={defaultPath}
          depth={defaultDepth}
          onNodeContextMenu={onNodeContextMenu}
        />
      );

      const content = screen.getByText('Test Node').closest('.tree-node-content');
      fireEvent.contextMenu(content!);

      expect(onNodeContextMenu).toHaveBeenCalledTimes(1);
      expect(onNodeContextMenu).toHaveBeenCalledWith(node, defaultPath, expect.any(Object));
    });
  });

  describe('展开/折叠箭头', () => {
    it('有子节点时应该显示箭头', () => {
      const node = createBasicNode({
        childNodes: [{ id: 'child-1', label: 'Child' }],
      });
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={defaultDepth} />
      );

      const caret = container.querySelector('.tree-node-caret-visible');
      expect(caret).toBeInTheDocument();
    });

    it('没有子节点时不应该显示箭头', () => {
      const node = createBasicNode();
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={defaultDepth} />
      );

      const caret = container.querySelector('.tree-node-caret-hidden');
      expect(caret).toBeInTheDocument();
    });

    it('hasCaret 为 true 时强制显示箭头', () => {
      const node = createBasicNode({ hasCaret: true });
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={defaultDepth} />
      );

      const caret = container.querySelector('.tree-node-caret-visible');
      expect(caret).toBeInTheDocument();
    });

    it('hasCaret 为 false 时强制隐藏箭头', () => {
      const node = createBasicNode({
        hasCaret: false,
        childNodes: [{ id: 'child-1', label: 'Child' }],
      });
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={defaultDepth} />
      );

      const caret = container.querySelector('.tree-node-caret-hidden');
      expect(caret).toBeInTheDocument();
    });

    it('点击箭头展开节点应该触发 onNodeExpand', () => {
      const onNodeExpand = jest.fn();
      const node = createBasicNode({
        isExpanded: false,
        childNodes: [{ id: 'child-1', label: 'Child' }],
      });
      const { container } = render(
        <TreeNode
          node={node}
          path={defaultPath}
          depth={defaultDepth}
          onNodeExpand={onNodeExpand}
        />
      );

      const caret = container.querySelector('.tree-node-caret');
      fireEvent.click(caret!);

      expect(onNodeExpand).toHaveBeenCalledTimes(1);
      expect(onNodeExpand).toHaveBeenCalledWith(node, defaultPath, expect.any(Object));
    });

    it('点击箭头折叠节点应该触发 onNodeCollapse', () => {
      const onNodeCollapse = jest.fn();
      const node = createBasicNode({
        isExpanded: true,
        childNodes: [{ id: 'child-1', label: 'Child' }],
      });
      const { container } = render(
        <TreeNode
          node={node}
          path={defaultPath}
          depth={defaultDepth}
          onNodeCollapse={onNodeCollapse}
        />
      );

      const caret = container.querySelector('.tree-node-caret');
      fireEvent.click(caret!);

      expect(onNodeCollapse).toHaveBeenCalledTimes(1);
      expect(onNodeCollapse).toHaveBeenCalledWith(node, defaultPath, expect.any(Object));
    });

    it('点击箭头应该阻止事件冒泡', () => {
      const onNodeClick = jest.fn();
      const onNodeExpand = jest.fn();
      const node = createBasicNode({
        isExpanded: false,
        childNodes: [{ id: 'child-1', label: 'Child' }],
      });
      const { container } = render(
        <TreeNode
          node={node}
          path={defaultPath}
          depth={defaultDepth}
          onNodeClick={onNodeClick}
          onNodeExpand={onNodeExpand}
        />
      );

      const caret = container.querySelector('.tree-node-caret');
      fireEvent.click(caret!);

      expect(onNodeExpand).toHaveBeenCalledTimes(1);
      // onNodeClick 不应该被触发，因为事件被阻止冒泡
      expect(onNodeClick).not.toHaveBeenCalled();
    });

    it('展开时箭头应该有 open 类名', () => {
      const node = createBasicNode({
        isExpanded: true,
        childNodes: [{ id: 'child-1', label: 'Child' }],
      });
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={defaultDepth} />
      );

      const caretIcon = container.querySelector('.tree-node-caret-open');
      expect(caretIcon).toBeInTheDocument();
    });

    it('折叠时箭头应该有 closed 类名', () => {
      const node = createBasicNode({
        isExpanded: false,
        childNodes: [{ id: 'child-1', label: 'Child' }],
      });
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={defaultDepth} />
      );

      const caretIcon = container.querySelector('.tree-node-caret-closed');
      expect(caretIcon).toBeInTheDocument();
    });
  });

  describe('子节点渲染', () => {
    it('展开时应该渲染子节点', () => {
      const node = createBasicNode({
        isExpanded: true,
        childNodes: [
          { id: 'child-1', label: 'Child 1' },
          { id: 'child-2', label: 'Child 2' },
        ],
      });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
    });

    it('折叠时不应该渲染子节点', () => {
      const node = createBasicNode({
        isExpanded: false,
        childNodes: [{ id: 'child-1', label: 'Child 1' }],
      });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
    });

    it('子节点应该有正确的路径', () => {
      const onNodeClick = jest.fn();
      const node = createBasicNode({
        isExpanded: true,
        childNodes: [{ id: 'child-1', label: 'Child 1' }],
      });
      render(
        <TreeNode
          node={node}
          path={[0]}
          depth={defaultDepth}
          onNodeClick={onNodeClick}
        />
      );

      const childContent = screen.getByText('Child 1').closest('.tree-node-content');
      fireEvent.click(childContent!);

      // 子节点路径应该是 [0, 0]
      expect(onNodeClick).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'child-1' }),
        [0, 0],
        expect.any(Object)
      );
    });

    it('子节点应该有正确的深度', () => {
      const node = createBasicNode({
        isExpanded: true,
        childNodes: [{ id: 'child-1', label: 'Child 1' }],
      });
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={1} />
      );

      // 子节点深度为 2，缩进应该是 40px
      const childContent = container.querySelectorAll('.tree-node-content')[1];
      expect(childContent).toHaveStyle({ paddingLeft: '40px' });
    });

    it('子节点列表应该有 group 角色', () => {
      const node = createBasicNode({
        isExpanded: true,
        childNodes: [{ id: 'child-1', label: 'Child 1' }],
      });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      expect(screen.getByRole('group')).toBeInTheDocument();
    });

    it('空子节点数组不应该渲染子节点列表', () => {
      const node = createBasicNode({
        isExpanded: true,
        childNodes: [],
      });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      expect(screen.queryByRole('group')).not.toBeInTheDocument();
    });
  });

  describe('图标渲染', () => {
    it('应该渲染节点图标', () => {
      const node = createBasicNode({
        icon: <span data-testid="node-icon">📁</span>,
      });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      expect(screen.getByTestId('node-icon')).toBeInTheDocument();
    });

    it('没有图标时不应该渲染图标容器', () => {
      const node = createBasicNode();
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={defaultDepth} />
      );

      expect(container.querySelector('.tree-node-icon')).not.toBeInTheDocument();
    });

    it('图标应该在标签之前', () => {
      const node = createBasicNode({
        icon: <span data-testid="node-icon">📁</span>,
        label: 'Test Label',
      });
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={defaultDepth} />
      );

      const content = container.querySelector('.tree-node-content');
      const icon = content?.querySelector('.tree-node-icon');
      const label = content?.querySelector('.tree-node-label');

      expect(icon).toBeInTheDocument();
      expect(label).toBeInTheDocument();
      // 验证图标在标签之前
      expect(icon?.compareDocumentPosition(label!)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
  });

  describe('次要标签渲染', () => {
    it('应该渲染次要标签', () => {
      const node = createBasicNode({
        secondaryLabel: <span data-testid="secondary">Info</span>,
      });
      render(<TreeNode node={node} path={defaultPath} depth={defaultDepth} />);

      expect(screen.getByTestId('secondary')).toBeInTheDocument();
    });

    it('没有次要标签时不应该渲染次要标签容器', () => {
      const node = createBasicNode();
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={defaultDepth} />
      );

      expect(
        container.querySelector('.tree-node-secondary-label')
      ).not.toBeInTheDocument();
    });

    it('次要标签应该在主标签之后', () => {
      const node = createBasicNode({
        label: 'Main Label',
        secondaryLabel: 'Secondary',
      });
      const { container } = render(
        <TreeNode node={node} path={defaultPath} depth={defaultDepth} />
      );

      const label = container.querySelector('.tree-node-label');
      const secondary = container.querySelector('.tree-node-secondary-label');

      expect(label).toBeInTheDocument();
      expect(secondary).toBeInTheDocument();
      // 验证次要标签在主标签之后
      expect(label?.compareDocumentPosition(secondary!)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
  });
});
