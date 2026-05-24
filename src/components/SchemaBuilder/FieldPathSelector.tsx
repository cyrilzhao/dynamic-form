import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Button,
  Dialog,
  Tree,
  type TreeNodeInfo,
  InputGroup,
  FormGroup,
  Callout,
  Tag,
  Classes,
  Tooltip,
} from '@blueprintjs/core';
import type { ExtendedJSONSchema } from '../DynamicForm/types/schema';

interface FieldPathSelectorProps {
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
  placeholder?: string;
  // 字段过滤控制
  visibleFields?: string[]; // 可见字段列表(fieldPath 数组),如果指定则只显示这些字段
  selectableFields?: string[]; // 可选字段列表(fieldPath 数组),如果指定则只有这些字段可选
  excludeCurrentField?: boolean; // 是否排除当前字段(默认 true)
}

/**
 * 字段路径选择器
 * 支持通过 Tree 组件可视化选择字段路径
 */
export const FieldPathSelector: React.FC<FieldPathSelectorProps> = ({
  schema,
  currentFieldPath,
  value,
  onChange,
  disabled,
  placeholder = '#/properties/fieldName or ./fieldName',
  visibleFields,
  selectableFields,
  excludeCurrentField = true,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>(value);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [pathType, setPathType] = useState<'absolute' | 'relative'>('absolute');
  const treeContainerRef = useRef<HTMLDivElement>(null);

  // 获取路径的所有父级路径（不包含自己）
  const getParentPaths = (path: string): string[] => {
    const parents: string[] = [];

    // 将路径按 / 分割成段
    const segments = path.split('/').filter(s => s);

    // 从第一个段开始，逐步构建父级路径
    for (let i = 1; i < segments.length; i++) {
      const parentPath = '#/' + segments.slice(1, i + 1).join('/');
      parents.push(parentPath);
    }

    // 移除最后一个（自己）
    parents.pop();

    return parents;
  };

  // 构建 Tree 节点（带选中状态）
  const treeNodes = useMemo(() => {
    return schemaToTreeNodes(
      schema,
      '',
      currentFieldPath,
      selectedPath,
      expandedNodes,
      visibleFields,
      selectableFields,
      excludeCurrentField
    );
  }, [
    schema,
    currentFieldPath,
    selectedPath,
    expandedNodes,
    visibleFields,
    selectableFields,
    excludeCurrentField,
  ]);

  // 滚动到选中的节点
  useEffect(() => {
    if (isDialogOpen && selectedPath && treeContainerRef.current && pathType === 'absolute') {
      // 使用轮询检查 Tree 是否渲染完成
      let attempts = 0;
      const maxAttempts = 20; // 最多尝试 20 次
      const checkInterval = 50; // 每 50ms 检查一次

      const checkAndScroll = () => {
        attempts++;

        const selectedNode = treeContainerRef.current?.querySelector(
          '.field-path-tree-node-selected'
        );

        if (selectedNode) {
          selectedNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (attempts < maxAttempts) {
          // 继续尝试
          setTimeout(checkAndScroll, checkInterval);
        }
      };

      // 初始延迟 100ms 后开始检查
      setTimeout(checkAndScroll, 100);
    }
  }, [isDialogOpen, selectedPath, expandedNodes, pathType, treeNodes]);

  // 获取相对路径选项（同级字段）
  const relativePathOptions = useMemo(() => {
    const options: Array<{ path: string; label: string; schema: ExtendedJSONSchema }> = [];

    // 检查 schema 是否存在
    if (!schema) {
      return options;
    }

    // 相对路径只用于数组元素内部的同级字段
    // 检查 currentFieldPath 是否包含 /items/，如果不包含则不显示相对路径选项
    if (!currentFieldPath.includes('/items/')) {
      return options;
    }

    // 解析路径，找到最后一个 /properties/ 之前的部分作为父路径
    // 例如: #/properties/users/items/properties/name
    // 父路径: #/properties/users/items/properties
    // 当前字段名: name
    const lastPropertiesIndex = currentFieldPath.lastIndexOf('/properties/');
    if (lastPropertiesIndex === -1) {
      return options;
    }

    const parentPath = currentFieldPath.substring(0, lastPropertiesIndex);
    const currentFieldName = currentFieldPath.substring(
      lastPropertiesIndex + '/properties/'.length
    );

    // 从 schema 根节点开始，逐步导航到父级 schema
    let parentSchema: ExtendedJSONSchema = schema;
    const pathSegments = parentPath.replace(/^#\//, '').split('/');

    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];

      if (segment === 'properties') {
        // 下一个段是字段名
        const fieldName = pathSegments[i + 1];
        if (!fieldName || !parentSchema.properties) break;

        const fieldSchema = parentSchema.properties[fieldName];
        if (!fieldSchema || typeof fieldSchema === 'boolean') break;

        parentSchema = fieldSchema as ExtendedJSONSchema;
        i++; // 跳过字段名
      } else if (segment === 'items') {
        // 进入数组的 items
        if (!parentSchema.items || typeof parentSchema.items === 'boolean') break;
        parentSchema = parentSchema.items as ExtendedJSONSchema;
      }
    }

    // 获取同级字段
    if (parentSchema.properties) {
      Object.entries(parentSchema.properties).forEach(([fieldName, fieldSchema]) => {
        if (fieldName !== currentFieldName && typeof fieldSchema !== 'boolean') {
          const typedSchema = fieldSchema as ExtendedJSONSchema;
          options.push({
            path: `./${fieldName}`,
            label: typedSchema.title || fieldName,
            schema: typedSchema,
          });
        }
      });
    }

    return options;
  }, [schema, currentFieldPath]);

  const handleOpenDialog = () => {
    setSelectedPath(value);
    // 判断当前路径类型
    if (value.startsWith('./')) {
      setPathType('relative');
    } else {
      setPathType('absolute');
      // 如果是绝对路径且有值，自动展开所有父级节点
      if (value && value.startsWith('#/properties/')) {
        const parentPaths = getParentPaths(value);
        setExpandedNodes(new Set(parentPaths));
      }
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleConfirm = () => {
    onChange(selectedPath);
    setIsDialogOpen(false);
  };

  // 处理 Tree 节点点击
  const handleNodeClick = (node: TreeNodeInfo) => {
    if (node.disabled) return;
    setSelectedPath((node.nodeData as any)?.path || '');
  };

  // 处理 Tree 节点展开/收起
  const handleNodeCollapse = (node: TreeNodeInfo) => {
    const newExpanded = new Set(expandedNodes);
    newExpanded.delete(node.id as string);
    setExpandedNodes(newExpanded);
  };

  const handleNodeExpand = (node: TreeNodeInfo) => {
    const newExpanded = new Set(expandedNodes);
    newExpanded.add(node.id as string);
    setExpandedNodes(newExpanded);
  };

  // 处理相对路径选择
  const handleRelativePathSelect = (path: string) => {
    setSelectedPath(path);
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
        <InputGroup
          value={value}
          readOnly
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          fill
        />
        <Button icon="search" text="" onClick={handleOpenDialog} disabled={disabled} />
      </div>

      <Dialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        title="Select Field Path"
        style={{ width: 700, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div
          className={Classes.DIALOG_BODY}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <Callout intent="primary" icon="info-sign" style={{ marginBottom: 16, flexShrink: 0 }}>
            Select a field from the schema tree or choose a relative path for same-level fields.
          </Callout>

          {/* 路径类型切换 */}
          <FormGroup label="Path Type" style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                text="Absolute Path (JSON Pointer)"
                active={pathType === 'absolute'}
                onClick={() => setPathType('absolute')}
              />
              <Tooltip
                content={
                  relativePathOptions.length === 0
                    ? 'Relative paths are only available for fields within array elements'
                    : ''
                }
                disabled={relativePathOptions.length > 0}
                placement="top"
              >
                <Button
                  text="Relative Path (Same Level)"
                  active={pathType === 'relative'}
                  onClick={() => setPathType('relative')}
                  disabled={relativePathOptions.length === 0}
                />
              </Tooltip>
            </div>
          </FormGroup>

          {/* 当前选择的路径 */}
          <FormGroup label="Selected Path" style={{ flexShrink: 0 }}>
            <InputGroup
              value={selectedPath}
              onChange={e => setSelectedPath(e.target.value)}
              placeholder="No path selected"
              readOnly
            />
          </FormGroup>

          {/* 绝对路径：Tree 视图 */}
          {pathType === 'absolute' && (
            <div
              ref={treeContainerRef}
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                border: '1px solid #d3dce6',
                borderRadius: 4,
                padding: 8,
              }}
            >
              <Tree
                contents={treeNodes}
                onNodeClick={handleNodeClick}
                onNodeCollapse={handleNodeCollapse}
                onNodeExpand={handleNodeExpand}
              />
            </div>
          )}

          {/* 相对路径：列表视图 */}
          {pathType === 'relative' && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {relativePathOptions.length === 0 ? (
                <Callout intent="warning">
                  No same-level fields available for relative path selection.
                </Callout>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {relativePathOptions.map(option => (
                    <Button
                      key={option.path}
                      text={
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            justifyContent: 'space-between',
                            width: '100%',
                          }}
                        >
                          <span>{option.label}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <Tag minimal>{option.schema.type || 'any'}</Tag>
                            <Tag minimal intent="primary">
                              {option.path}
                            </Tag>
                          </div>
                        </div>
                      }
                      fill
                      alignText="left"
                      active={selectedPath === option.path}
                      onClick={() => handleRelativePathSelect(option.path)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button intent="primary" onClick={handleConfirm} disabled={!selectedPath}>
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};

/**
 * 将 Schema 转换为 Tree 节点
 */
function schemaToTreeNodes(
  schema: ExtendedJSONSchema | undefined,
  parentPath: string = '',
  currentFieldPath: string,
  selectedPath?: string,
  expandedNodes?: Set<string>,
  visibleFields?: string[],
  selectableFields?: string[],
  excludeCurrentField?: boolean
): TreeNodeInfo[] {
  const nodes: TreeNodeInfo[] = [];

  // 检查 schema 是否存在
  if (!schema || !schema.properties) {
    return nodes;
  }

  Object.entries(schema.properties).forEach(([fieldName, fieldSchema]) => {
    if (typeof fieldSchema === 'boolean') return;

    const typedSchema = fieldSchema as ExtendedJSONSchema;
    const jsonPointerPath = parentPath
      ? `${parentPath}/properties/${fieldName}`
      : `#/properties/${fieldName}`;
    const displayPath = parentPath
      ? `${parentPath.replace('#/properties/', '').replace(/\/properties\//g, '.')}.${fieldName}`
      : fieldName;

    // 判断是否是当前字段
    const isCurrentField = jsonPointerPath === currentFieldPath;
    // 判断是否是选中的字段
    const isSelectedField = jsonPointerPath === selectedPath;

    // 判断是否可见
    const isVisible = !visibleFields || visibleFields.includes(jsonPointerPath);
    // 如果不可见,跳过此节点
    if (!isVisible) return;

    // 判断是否可选
    const isSelectable = selectableFields ? selectableFields.includes(jsonPointerPath) : true;
    // 判断是否应该禁用
    const isDisabled =
      (excludeCurrentField && isCurrentField) || // 排除当前字段
      !isSelectable; // 不在可选列表中

    // 创建节点
    const node: TreeNodeInfo = {
      id: jsonPointerPath,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{typedSchema.title || fieldName}</span>
          <Tag minimal>{typedSchema.type || 'any'}</Tag>
          {isCurrentField && (
            <Tag intent="warning" minimal>
              Current Field
            </Tag>
          )}
        </div>
      ),
      icon: null,
      isSelected: isSelectedField,
      disabled: isDisabled,
      isExpanded: expandedNodes?.has(jsonPointerPath),
      className: isSelectedField
        ? 'field-path-tree-node field-path-tree-node-selected'
        : 'field-path-tree-node',
      nodeData: {
        path: jsonPointerPath,
        displayPath,
        schema: typedSchema,
      },
    };

    // 处理对象类型（嵌套属性）
    if (typedSchema.type === 'object' && typedSchema.properties) {
      node.childNodes = schemaToTreeNodes(
        typedSchema,
        jsonPointerPath,
        currentFieldPath,
        selectedPath,
        expandedNodes,
        visibleFields,
        selectableFields,
        excludeCurrentField
      );
      node.hasCaret = true;
    }

    // 处理数组类型
    if (typedSchema.type === 'array' && typedSchema.items) {
      const itemsSchema = typedSchema.items as ExtendedJSONSchema;
      if (itemsSchema.type === 'object' && itemsSchema.properties) {
        const itemsPath = `${jsonPointerPath}/items`;
        node.childNodes = schemaToTreeNodes(
          itemsSchema,
          itemsPath,
          currentFieldPath,
          selectedPath,
          expandedNodes,
          visibleFields,
          selectableFields,
          excludeCurrentField
        );
        node.hasCaret = true;
      }
    }

    nodes.push(node);
  });

  return nodes;
}

/**
 * 根据字段类型获取图标
 */
// function getFieldIcon(type?: string): string {
//   switch (type) {
//     case 'string':
//       return 'font';
//     case 'number':
//     case 'integer':
//       return 'numerical';
//     case 'boolean':
//       return 'tick-circle';
//     case 'array':
//       return 'array';
//     case 'object':
//       return 'folder-close';
//     default:
//       return 'dot';
//   }
// }
