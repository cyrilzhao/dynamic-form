import React, { useCallback } from 'react';
import type { TreeNodeProps, TreeNodeInfo } from './types';

/**
 * 树节点组件
 * 负责渲染单个节点及其子节点
 */
export const TreeNode = <T,>({
  node,
  path,
  depth,
  onNodeClick,
  onNodeCollapse,
  onNodeExpand,
  onNodeDoubleClick,
  onNodeContextMenu,
}: TreeNodeProps<T>): React.ReactElement => {
  const {
    label,
    childNodes,
    isExpanded,
    isSelected,
    hasCaret,
    disabled,
    icon,
    secondaryLabel,
    className,
  } = node;

  // 是否显示展开箭头
  const showCaret = hasCaret ?? (childNodes && childNodes.length > 0);

  // 处理箭头点击
  const handleCaretClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      if (disabled) return;

      if (isExpanded) {
        onNodeCollapse?.(node, path, e);
      } else {
        onNodeExpand?.(node, path, e);
      }
    },
    [node, path, isExpanded, disabled, onNodeCollapse, onNodeExpand]
  );

  // 处理节点点击
  const handleNodeClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      onNodeClick?.(node, path, e);
    },
    [node, path, disabled, onNodeClick]
  );

  // 处理节点双击
  const handleNodeDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      onNodeDoubleClick?.(node, path, e);
    },
    [node, path, disabled, onNodeDoubleClick]
  );

  // 处理右键菜单
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      onNodeContextMenu?.(node, path, e);
    },
    [node, path, disabled, onNodeContextMenu]
  );

  // 构建节点类名
  const nodeClasses = [
    'tree-node',
    isSelected && 'tree-node-selected',
    isExpanded && 'tree-node-expanded',
    disabled && 'tree-node-disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // 渲染子节点
  const renderChildNodes = () => {
    if (!childNodes || childNodes.length === 0 || !isExpanded) {
      return null;
    }

    return (
      <ul className="tree-node-list" role="group">
        {childNodes.map((childNode: TreeNodeInfo<T>, index: number) => (
          <TreeNode
            key={childNode.id}
            node={childNode}
            path={[...path, index]}
            depth={depth + 1}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeCollapse={onNodeCollapse}
            onNodeExpand={onNodeExpand}
            onNodeContextMenu={onNodeContextMenu}
          />
        ))}
      </ul>
    );
  };

  return (
    <li className={nodeClasses} role="treeitem" aria-expanded={showCaret ? isExpanded : undefined}>
      <div
        className="tree-node-content"
        style={{ paddingLeft: `${depth * 20}px` }}
        onClick={handleNodeClick}
        onDoubleClick={handleNodeDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {/* 展开/折叠箭头 */}
        <span
          className={`tree-node-caret ${showCaret ? 'tree-node-caret-visible' : 'tree-node-caret-hidden'}`}
          onClick={handleCaretClick}
        >
          {showCaret && (
            <svg
              className={`tree-node-caret-icon ${isExpanded ? 'tree-node-caret-open' : 'tree-node-caret-closed'}`}
              viewBox="0 0 16 16"
              width="16"
              height="16"
            >
              <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </span>

        {/* 节点图标 */}
        {icon && <span className="tree-node-icon">{icon}</span>}

        {/* 节点标签 */}
        <span className="tree-node-label">{label}</span>

        {/* 次要标签 */}
        {secondaryLabel && <span className="tree-node-secondary-label">{secondaryLabel}</span>}
      </div>

      {/* 子节点 */}
      {renderChildNodes()}
    </li>
  );
};

TreeNode.displayName = 'TreeNode';
