import React from 'react';
import { TreeNode } from './TreeNode';
import type { TreeProps, TreeNodeInfo } from './types';
import './Tree.scss';

/**
 * Tree 组件
 * 用于展示层级数据结构的通用树形组件
 * 参考 Blueprint.js Tree 组件设计
 */
export const Tree = <T,>({
  contents,
  onNodeClick,
  onNodeDoubleClick,
  onNodeCollapse,
  onNodeExpand,
  onNodeContextMenu,
  className,
}: TreeProps<T>): React.ReactElement => {
  const treeClasses = ['tree', className].filter(Boolean).join(' ');

  return (
    <div className={treeClasses}>
      <ul className="tree-root" role="tree">
        {contents.map((node: TreeNodeInfo<T>, index: number) => (
          <TreeNode
            key={node.id}
            node={node}
            path={[index]}
            depth={0}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeCollapse={onNodeCollapse}
            onNodeExpand={onNodeExpand}
            onNodeContextMenu={onNodeContextMenu}
          />
        ))}
      </ul>
    </div>
  );
};

Tree.displayName = 'Tree';
