import type { ReactNode, MouseEvent } from 'react';

/**
 * 树节点的唯一标识符类型
 */
export type TreeNodeId = string | number;

/**
 * 树节点信息接口
 * 参考 Blueprint.js TreeNodeInfo 设计
 */
export interface TreeNodeInfo<T = unknown> {
  /** 节点唯一标识符 */
  id: TreeNodeId;
  /** 节点显示的标签，可以是字符串或 React 节点 */
  label: ReactNode;
  /** 子节点列表 */
  childNodes?: TreeNodeInfo<T>[];
  /** 节点是否展开 */
  isExpanded?: boolean;
  /** 节点是否被选中 */
  isSelected?: boolean;
  /** 是否显示展开/折叠箭头，默认有子节点时显示 */
  hasCaret?: boolean;
  /** 是否禁用节点 */
  disabled?: boolean;
  /** 节点图标，可以是图标名称或 React 节点 */
  icon?: ReactNode;
  /** 节点右侧的次要标签 */
  secondaryLabel?: ReactNode;
  /** 节点的自定义 CSS 类名 */
  className?: string;
  /** 附加到节点的任意数据 */
  nodeData?: T;
}

/**
 * 节点路径类型，表示节点在树中的位置
 * 例如 [0, 2, 1] 表示第一个根节点的第三个子节点的第二个子节点
 */
export type NodePath = number[];

/**
 * 树节点事件处理器类型
 */
export type TreeNodeEventHandler<T = unknown> = (
  node: TreeNodeInfo<T>,
  nodePath: NodePath,
  event: MouseEvent<HTMLElement>
) => void;

/**
 * Tree 组件的 Props 接口
 */
export interface TreeProps<T = unknown> {
  /** 树的内容，即根节点列表 */
  contents: TreeNodeInfo<T>[];
  /** 节点点击事件 */
  onNodeClick?: TreeNodeEventHandler<T>;
  /** 节点双击事件 */
  onNodeDoubleClick?: TreeNodeEventHandler<T>;
  /** 节点折叠事件 */
  onNodeCollapse?: TreeNodeEventHandler<T>;
  /** 节点展开事件 */
  onNodeExpand?: TreeNodeEventHandler<T>;
  /** 节点右键菜单事件 */
  onNodeContextMenu?: TreeNodeEventHandler<T>;
  /** 自定义 CSS 类名 */
  className?: string;
}

/**
 * TreeNode 组件的 Props 接口
 */
export interface TreeNodeProps<T = unknown> {
  /** 节点信息 */
  node: TreeNodeInfo<T>;
  /** 节点在树中的路径 */
  path: NodePath;
  /** 节点深度，用于计算缩进 */
  depth: number;
  /** 节点点击事件 */
  onNodeClick?: TreeNodeEventHandler<T>;
  /** 节点双击事件 */
  onNodeDoubleClick?: TreeNodeEventHandler<T>;
  /** 节点折叠事件 */
  onNodeCollapse?: TreeNodeEventHandler<T>;
  /** 节点展开事件 */
  onNodeExpand?: TreeNodeEventHandler<T>;
  /** 节点右键菜单事件 */
  onNodeContextMenu?: TreeNodeEventHandler<T>;
}
