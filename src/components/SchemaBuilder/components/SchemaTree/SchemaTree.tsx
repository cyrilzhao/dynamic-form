import React, { useMemo, useCallback } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  Popover,
  Position,
  MenuDivider,
  Tooltip,
} from '@blueprintjs/core'
import { Tree } from '../../../Tree'
import type { TreeNodeInfo } from '../../../Tree'
import { useSchemaBuilder } from '../../SchemaBuilder'
import type { ExtendedJSONSchema } from '../../../DynamicForm/types/schema'

const canAddChildToNode = (schema: ExtendedJSONSchema): boolean =>
  schema.type === 'object'

export const SchemaTree: React.FC = () => {
  const {
    schema,
    selectedPath,
    expandedPaths,
    onSelect,
    onAddChild,
    onAddSibling,
    onDelete,
    onToggleExpand,
    onMoveUp,
    onMoveDown,
    options,
  } = useSchemaBuilder()
  const readonly = options?.readonly ?? {}
  const hideTreeActions = readonly.all || readonly.schema || readonly.tree
  const hideAdd = hideTreeActions || readonly.addFieldActions
  const hideDelete = hideTreeActions || readonly.deleteFieldActions
  const hideReorder = hideTreeActions || readonly.reorderFieldActions

  const handleNodeClick = (node: TreeNodeInfo<string[]>) => {
    const path = node.nodeData as string[]
    onSelect(path)
  }

  const handleNodeCollapse = (node: TreeNodeInfo<string[]>) => {
    const path = node.nodeData as string[]
    onToggleExpand(path, false)
  }

  const handleNodeExpand = (node: TreeNodeInfo<string[]>) => {
    const path = node.nodeData as string[]
    onToggleExpand(path, true)
  }

  const renderNodeMenu = useCallback(
    (path: string[], currentSchema: ExtendedJSONSchema) => {
      // Logic for allowed actions
      const isRoot = path.length === 0
      const key = path.length > 0 ? path[path.length - 1] : ''
      const parentKey = path.length > 1 ? path[path.length - 2] : ''

      const canAddChild = canAddChildToNode(currentSchema)

      // Can add sibling if parent is 'properties' (standard object field)
      const canAddSibling = !isRoot && parentKey === 'properties'

      // Can move if parent is 'properties'
      const canMove = !isRoot && parentKey === 'properties'

      // 检查是否是一级节点（path 为 ['properties', 'fieldName']）
      const isFirstLevelNode = path.length === 2 && path[0] === 'properties'

      // 如果是一级节点，检查是否是最后一个节点
      let isLastFirstLevelNode = false
      if (isFirstLevelNode && schema.properties) {
        const firstLevelNodeCount = Object.keys(schema.properties).length
        isLastFirstLevelNode = firstLevelNodeCount === 1
      }

      // Can delete if not root and not 'items' of an array (enforcing read-only structure for items)
      // 如果是最后一个一级节点，则不能删除
      const canDelete = !isRoot && key !== 'items' && !isLastFirstLevelNode

      return (
        <Menu>
          {canAddChild && !hideAdd && (
            <MenuItem
              text="Add Child Node"
              icon="plus"
              onClick={() => onAddChild(path, 'string')}
            />
          )}
          {canAddSibling && !hideAdd && (
            <MenuItem
              text="Add Sibling Node"
              icon="new-object"
              onClick={() => onAddSibling(path, 'string')}
            />
          )}

          {(canAddChild || canAddSibling || canMove) && <MenuDivider />}

          {canMove && !hideReorder && (
            <>
              <MenuItem
                text="Move Up"
                icon="arrow-up"
                onClick={() => onMoveUp(path)}
              />
              <MenuItem
                text="Move Down"
                icon="arrow-down"
                onClick={() => onMoveDown(path)}
              />
            </>
          )}

          {canMove && canDelete && <MenuDivider />}

          {canDelete && !hideDelete && (
            <MenuItem
              text="Delete Node"
              icon="trash"
              intent="danger"
              onClick={() => onDelete(path)}
            />
          )}
        </Menu>
      )
    },
    [
      schema,
      onAddChild,
      onAddSibling,
      onMoveUp,
      onMoveDown,
      onDelete,
      hideAdd,
      hideDelete,
      hideReorder,
    ]
  )

  const buildTreeNodes = useCallback(
    (
      currentSchema: ExtendedJSONSchema,
      path: string[] = []
    ): TreeNodeInfo<string[]>[] => {
      const pathStr = path.join('.')
      const isSelected = path.join('.') === selectedPath.join('.')
      const isExpanded = !!expandedPaths[pathStr]

      // Determine label
      let label =
        currentSchema.title ||
        (path.length > 0 ? path[path.length - 1] : 'Root')

      // Formatting label
      if (path.length > 0) {
        const key = path[path.length - 1]
        if (path[path.length - 2] === 'properties') {
          label = currentSchema.title ? `${currentSchema.title} (${key})` : key
        } else if (key === 'items') {
          label = currentSchema.title
            ? `${currentSchema.title} (items)`
            : 'items'
        }
      }

      const canAddChild = canAddChildToNode(currentSchema)
      const canAddSibling =
        path.length > 0 && path[path.length - 2] === 'properties'
      const isItemsNode = path[path.length - 1] === 'items'
      const hasNodeManagementActions = path.length > 0 && !isItemsNode
      const showActions =
        canAddChild || canAddSibling || hasNodeManagementActions

      const node: TreeNodeInfo<string[]> = {
        id: pathStr || 'root',
        label: (
          <div className="schema-tree-node-label">
            <Tooltip
              content={label}
              hoverOpenDelay={500}
              position={Position.TOP_LEFT}
            >
              <span className="node-text">{label}</span>
            </Tooltip>
            {showActions && (
              <div className="node-actions">
                <Popover
                  content={renderNodeMenu(path, currentSchema)}
                  position={Position.BOTTOM_LEFT}
                  interactionKind="click"
                >
                  <Button icon="more" minimal small />
                </Popover>
              </div>
            )}
          </div>
        ),
        isSelected: isSelected,
        isExpanded: isExpanded,
        nodeData: path,
        hasCaret:
          currentSchema.type === 'object' || currentSchema.type === 'array',
      }

      const children: TreeNodeInfo<string[]>[] = []

      // Handle Object Properties
      if (currentSchema.type === 'object' && currentSchema.properties) {
        Object.entries(currentSchema.properties).forEach(
          ([key, propSchema]) => {
            children.push(
              ...buildTreeNodes(propSchema as ExtendedJSONSchema, [
                ...path,
                'properties',
                key,
              ])
            )
          }
        )
      }

      // Handle Array Items
      if (currentSchema.type === 'array' && currentSchema.items) {
        const itemsSchema = currentSchema.items
        if (!Array.isArray(itemsSchema)) {
          children.push(
            ...buildTreeNodes(itemsSchema as ExtendedJSONSchema, [
              ...path,
              'items',
            ])
          )
        }
      }

      if (children.length > 0) {
        node.childNodes = children
      }

      return [node]
    },
    [selectedPath, expandedPaths, renderNodeMenu]
  )

  const nodes = useMemo(() => buildTreeNodes(schema), [schema, buildTreeNodes])

  // 显示根节点
  const displayNodes = nodes

  return (
    <Tree<string[]>
      contents={displayNodes}
      onNodeClick={handleNodeClick}
      onNodeCollapse={handleNodeCollapse}
      onNodeExpand={handleNodeExpand}
      className="schema-tree"
    />
  )
}
