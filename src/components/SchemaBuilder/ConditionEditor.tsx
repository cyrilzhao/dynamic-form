import React from 'react';
import {
  FormGroup,
  HTMLSelect,
  Button,
  InputGroup,
  Card,
  Elevation,
  Tag,
  Callout,
  Menu,
  MenuItem,
  Popover,
} from '@blueprintjs/core';
import type { ConditionExpression, ConditionOperator } from '../DynamicForm/types/linkage';
import type { ExtendedJSONSchema } from '../DynamicForm/types/schema';
import { FieldPathSelector } from './FieldPathSelector';

// 单条件表达式类型
interface SingleCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

// 逻辑组合表达式类型
interface LogicalCondition {
  and?: ConditionExpression[];
  or?: ConditionExpression[];
}

// 递归条件编辑器的 Props
interface RecursiveConditionEditorProps {
  value: ConditionExpression;
  onChange: (value: ConditionExpression) => void;
  onRemove?: () => void;
  disabled?: boolean;
  depth?: number;
  canRemove?: boolean;
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  dependencies: string[];
}

interface ConditionEditorProps {
  value?: ConditionExpression;
  onChange: (value: ConditionExpression | undefined) => void;
  disabled?: boolean;
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  dependencies: string[];
}

// 最大嵌套深度
const MAX_DEPTH = 5;

/**
 * 根据 dependencies 过滤 schema，只保留依赖字段
 */
function filterSchemaByDependencies(
  schema: ExtendedJSONSchema,
  dependencies: string[]
): ExtendedJSONSchema {
  if (dependencies.length === 0) {
    return { type: 'object', properties: {} };
  }

  const filteredSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {},
  };

  dependencies.forEach(dep => {
    // 解析路径，支持绝对路径和相对路径
    let path = dep;
    if (path.startsWith('./')) {
      // 相对路径暂时不处理，因为需要知道当前字段的父级
      return;
    }

    if (!path.startsWith('#/properties/')) {
      return;
    }

    // 移除 #/ 前缀
    path = path.substring(2);

    // 按 / 分割路径
    const segments = path.split('/');

    // 遍历路径，构建过滤后的 schema
    let currentSchema = schema;
    let currentFiltered = filteredSchema;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (segment === 'properties') {
        // 下一个段是字段名
        const fieldName = segments[i + 1];
        if (!fieldName) break;

        const fieldSchema = currentSchema.properties?.[fieldName];
        if (!fieldSchema || typeof fieldSchema === 'boolean') break;

        // 确保 properties 存在
        if (!currentFiltered.properties) {
          currentFiltered.properties = {};
        }

        // 如果是最后一个字段，直接复制
        if (i + 2 >= segments.length) {
          currentFiltered.properties[fieldName] = fieldSchema;
          break;
        }

        // 否则，创建嵌套结构
        if (!currentFiltered.properties[fieldName]) {
          currentFiltered.properties[fieldName] = {
            type: (fieldSchema as ExtendedJSONSchema).type,
            title: (fieldSchema as ExtendedJSONSchema).title,
            properties: {},
          };
        }

        currentSchema = fieldSchema as ExtendedJSONSchema;
        currentFiltered = currentFiltered.properties[fieldName] as ExtendedJSONSchema;
        i++; // 跳过字段名
      } else if (segment === 'items') {
        // 处理数组的 items
        const itemsSchema = currentSchema.items;
        if (!itemsSchema || typeof itemsSchema === 'boolean') break;

        if (!currentFiltered.items) {
          currentFiltered.items = {
            type: (itemsSchema as ExtendedJSONSchema).type,
            properties: {},
          };
        }

        currentSchema = itemsSchema as ExtendedJSONSchema;
        currentFiltered = currentFiltered.items as ExtendedJSONSchema;
      }
    }
  });

  return filteredSchema;
}

// 条件操作符选项
const operatorOptions: Array<{ label: string; value: ConditionOperator }> = [
  { label: 'Equals (==)', value: '==' },
  { label: 'Not Equals (!=)', value: '!=' },
  { label: 'Greater Than (>)', value: '>' },
  { label: 'Less Than (<)', value: '<' },
  { label: 'Greater or Equal (>=)', value: '>=' },
  { label: 'Less or Equal (<=)', value: '<=' },
  { label: 'In Array', value: 'in' },
  { label: 'Not In Array', value: 'notIn' },
  { label: 'Includes', value: 'includes' },
  { label: 'Not Includes', value: 'notIncludes' },
  { label: 'Is Empty', value: 'isEmpty' },
  { label: 'Is Not Empty', value: 'isNotEmpty' },
];

// 类型守卫函数
const isSingleCondition = (condition: any): condition is SingleCondition => {
  return condition && 'field' in condition && 'operator' in condition;
};

const isLogicalCondition = (condition: any): condition is LogicalCondition => {
  return condition && ('and' in condition || 'or' in condition);
};
/**
 * 递归条件编辑器组件
 * 支持嵌套的逻辑组合
 */
const RecursiveConditionEditor: React.FC<RecursiveConditionEditorProps> = ({
  value,
  onChange,
  onRemove,
  disabled,
  depth = 0,
  canRemove = true,
  schema,
  currentFieldPath,
  dependencies,
}) => {
  // 过滤 schema，只保留 dependencies 中的字段
  const filteredSchema = React.useMemo(() => {
    return filterSchemaByDependencies(schema, dependencies);
  }, [schema, dependencies]);
  // 渲染单条件编辑器
  const renderSingleCondition = (condition: SingleCondition) => {
    const needsValue = !['isEmpty', 'isNotEmpty'].includes(condition.operator);

    return (
      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        <FormGroup label="Field Path" labelInfo="(required)" style={{ marginBottom: 8 }}>
          <FieldPathSelector
            schema={filteredSchema}
            currentFieldPath={currentFieldPath}
            value={condition.field || ''}
            onChange={newValue => onChange({ ...condition, field: newValue })}
            placeholder="#/properties/fieldName or ./fieldName"
            disabled={disabled}
          />
        </FormGroup>

        <FormGroup label="Operator" labelInfo="(required)" style={{ marginBottom: 8 }}>
          <HTMLSelect
            value={condition.operator}
            onChange={e =>
              onChange({ ...condition, operator: e.target.value as ConditionOperator })
            }
            disabled={disabled}
            fill
          >
            {operatorOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </HTMLSelect>
        </FormGroup>

        {needsValue && (
          <FormGroup label="Compare Value" style={{ marginBottom: 0 }}>
            <InputGroup
              value={condition.value ?? ''}
              onChange={e => onChange({ ...condition, value: e.target.value })}
              placeholder="Enter value to compare"
              disabled={disabled}
              small
            />
          </FormGroup>
        )}
      </div>
    );
  };

  // 渲染逻辑组合编辑器
  const renderLogicalCondition = (condition: LogicalCondition) => {
    const logicType = 'and' in condition ? 'and' : 'or';
    const conditions = condition[logicType] || [];

    const handleAddCondition = (type: 'single' | 'and' | 'or') => {
      const newCondition: ConditionExpression =
        type === 'single'
          ? { field: '', operator: '==', value: '' }
          : { [type]: [{ field: '', operator: '==', value: '' }] };

      onChange({
        [logicType]: [...conditions, newCondition],
      });
    };

    const handleUpdateCondition = (index: number, updated: ConditionExpression) => {
      const newConditions = [...conditions];
      newConditions[index] = updated;
      onChange({ [logicType]: newConditions });
    };

    const handleRemoveCondition = (index: number) => {
      const newConditions = conditions.filter((_, i) => i !== index);
      if (newConditions.length === 0) {
        // 如果删除后没有条件了，转换为单条件
        onChange({ field: '', operator: '==', value: '' });
      } else {
        onChange({ [logicType]: newConditions });
      }
    };

    return (
      <div>
        <Callout
          intent={logicType === 'and' ? 'primary' : 'success'}
          icon="info-sign"
          style={{ marginBottom: 10, fontSize: 12 }}
        >
          {logicType === 'and'
            ? 'All conditions must be satisfied (AND logic)'
            : 'Any condition can be satisfied (OR logic)'}
        </Callout>

        {conditions.map((subCondition, index) => (
          <RecursiveConditionEditor
            key={index}
            value={subCondition}
            onChange={updated => handleUpdateCondition(index, updated)}
            onRemove={() => handleRemoveCondition(index)}
            disabled={disabled}
            depth={depth + 1}
            canRemove={conditions.length > 1}
            schema={schema}
            currentFieldPath={currentFieldPath}
            dependencies={dependencies}
          />
        ))}

        {depth < MAX_DEPTH && (
          <Popover
            content={
              <Menu>
                <MenuItem
                  icon="add"
                  text="Add Single Condition"
                  onClick={() => handleAddCondition('single')}
                />
                <MenuItem
                  icon="add"
                  text="Add AND Group"
                  onClick={() => handleAddCondition('and')}
                />
                <MenuItem icon="add" text="Add OR Group" onClick={() => handleAddCondition('or')} />
              </Menu>
            }
            placement="bottom-start"
          >
            <Button text="Add Condition" icon="add" small disabled={disabled} />
          </Popover>
        )}
      </div>
    );
  };

  // 转换条件类型
  const handleConvertToLogical = (type: 'and' | 'or') => {
    if (isSingleCondition(value)) {
      onChange({ [type]: [value] });
    }
  };

  const handleConvertToSingle = () => {
    onChange({ field: '', operator: '==', value: '' });
  };

  // 获取缩进样式
  const getIndentStyle = () => {
    const baseIndent = 8;
    const indentPerLevel = 16;
    return {
      marginLeft: depth * indentPerLevel,
      paddingLeft: baseIndent,
      borderLeft: depth > 0 ? '2px solid #d3dce6' : 'none',
    };
  };

  // 获取条件类型标签
  const getConditionTypeTag = () => {
    if (isSingleCondition(value)) {
      return (
        <Tag intent="none" minimal>
          Single
        </Tag>
      );
    }
    if (isLogicalCondition(value)) {
      const type = 'and' in value ? 'AND' : 'OR';
      return (
        <Tag intent={type === 'AND' ? 'primary' : 'success'} minimal>
          {type}
        </Tag>
      );
    }
    return null;
  };

  return (
    <Card
      elevation={depth === 0 ? Elevation.ONE : Elevation.ZERO}
      style={{
        padding: 12,
        marginBottom: 10,
        ...getIndentStyle(),
        backgroundColor: depth % 2 === 0 ? '#ffffff' : '#f5f8fa',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {getConditionTypeTag()}
          {depth > 0 && <Tag minimal>Level {depth}</Tag>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {isSingleCondition(value) && depth < MAX_DEPTH && (
            <Popover
              content={
                <Menu>
                  <MenuItem
                    icon="diagram-tree"
                    text="Convert to AND"
                    onClick={() => handleConvertToLogical('and')}
                  />
                  <MenuItem
                    icon="diagram-tree"
                    text="Convert to OR"
                    onClick={() => handleConvertToLogical('or')}
                  />
                </Menu>
              }
              placement="bottom-end"
            >
              <Button icon="more" minimal small disabled={disabled} />
            </Popover>
          )}
          {canRemove && onRemove && (
            <Button
              icon="trash"
              intent="danger"
              minimal
              small
              onClick={onRemove}
              disabled={disabled}
            />
          )}
        </div>
      </div>

      {isSingleCondition(value) && renderSingleCondition(value)}
      {isLogicalCondition(value) && renderLogicalCondition(value)}
    </Card>
  );
};

/**
 * 条件表达式编辑器（主组件）
 * 支持单条件和嵌套的逻辑组合（and/or）
 */
export const ConditionEditor: React.FC<ConditionEditorProps> = ({
  value,
  onChange,
  disabled,
  schema,
  currentFieldPath,
  dependencies,
}) => {
  const handleClear = () => {
    onChange(undefined);
  };

  const handleCreate = (type: 'single' | 'and' | 'or') => {
    if (type === 'single') {
      onChange({ field: '', operator: '==', value: '' });
    } else {
      onChange({ [type]: [{ field: '', operator: '==', value: '' }] });
    }
  };

  // 如果没有配置 dependencies，显示提示
  if (dependencies.length === 0) {
    return (
      <Callout intent="warning" icon="warning-sign">
        <p>Please add at least one dependency field before configuring conditions.</p>
        <p style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Conditions can only reference fields that are listed in the Dependencies section above.
        </p>
      </Callout>
    );
  }

  if (!value) {
    return (
      <Callout intent="none">
        <p>No condition configured. Choose a condition type to create one.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button
            text="Single Condition"
            icon="add"
            intent="primary"
            onClick={() => handleCreate('single')}
            disabled={disabled}
            small
          />
          <Button
            text="AND Group"
            icon="diagram-tree"
            onClick={() => handleCreate('and')}
            disabled={disabled}
            small
          />
          <Button
            text="OR Group"
            icon="diagram-tree"
            onClick={() => handleCreate('or')}
            disabled={disabled}
            small
          />
        </div>
      </Callout>
    );
  }

  return (
    <div className="condition-editor">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Tag intent="primary" minimal>
          Condition Configuration
        </Tag>
        <Button
          text="Clear All"
          icon="cross"
          intent="danger"
          minimal
          small
          onClick={handleClear}
          disabled={disabled}
        />
      </div>
      <RecursiveConditionEditor
        value={value}
        onChange={onChange}
        disabled={disabled}
        depth={0}
        canRemove={false}
        schema={schema}
        currentFieldPath={currentFieldPath}
        dependencies={dependencies}
      />
    </div>
  );
};
