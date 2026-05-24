import React, { useState } from 'react';
import {
  Button,
  FormGroup,
  HTMLSelect,
  Callout,
  Card,
  Tag,
  Divider,
  InputGroup,
  Switch,
  Tabs,
  Tab,
} from '@blueprintjs/core';
import { FieldPathSelector } from './FieldPathSelector';
import { ValidationEffectEditor } from './ValidationEffectEditor';
import type { ExtendedJSONSchema } from '../DynamicForm/types/schema';

interface SchemaValidationEditorProps {
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  parentSchema: ExtendedJSONSchema;
  value?: {
    dependencies?: Record<string, any>;
    if?: any;
    then?: any;
    else?: any;
    allOf?: any[];
    anyOf?: any[];
    oneOf?: any[];
  };
  onChange: (value: any) => void;
  disabled?: boolean;
}

type ValidationType = 'dependencies' | 'if-then-else' | 'allOf' | 'anyOf' | 'oneOf';

/**
 * Schema 条件验证编辑器
 * 支持 dependencies、if/then/else、allOf、anyOf、oneOf 等 JSON Schema 标准验证机制
 */
export const SchemaValidationEditor: React.FC<SchemaValidationEditorProps> = ({
  schema,
  currentFieldPath,
  parentSchema,
  value = {},
  onChange,
  disabled,
}) => {
  const [selectedTab, setSelectedTab] = useState<ValidationType>('dependencies');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Callout intent="primary" icon="info-sign">
        <strong>Conditional Validation</strong>
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
          Define validation rules that apply based on other field values. This is for{' '}
          <strong>data validation</strong> (checked on submit), not UI behavior.
        </p>
      </Callout>

      <Tabs
        id="validation-type-tabs"
        selectedTabId={selectedTab}
        onChange={newTabId => setSelectedTab(newTabId as ValidationType)}
      >
        <Tab
          id="dependencies"
          title="Dependencies"
          panel={
            <DependenciesEditor
              value={value.dependencies}
              onChange={deps => {
                const newValue = { ...value, dependencies: deps };
                onChange(newValue);
              }}
              schema={parentSchema}
              currentFieldPath={currentFieldPath}
              disabled={disabled}
            />
          }
        />
        <Tab
          id="if-then-else"
          title="If/Then/Else"
          panel={
            <IfThenElseEditor
              value={{ if: value.if, then: value.then, else: value.else }}
              onChange={config =>
                onChange({
                  ...value,
                  if: config.if,
                  then: config.then,
                  else: config.else,
                })
              }
              schema={parentSchema}
              currentFieldPath={currentFieldPath}
              disabled={disabled}
            />
          }
        />
        <Tab
          id="allOf"
          title="AllOf"
          panel={
            <LogicalCombinationEditor
              type="allOf"
              value={value.allOf}
              onChange={allOf => onChange({ ...value, allOf })}
              schema={parentSchema}
              currentFieldPath={currentFieldPath}
              disabled={disabled}
            />
          }
        />
        <Tab
          id="anyOf"
          title="AnyOf"
          panel={
            <LogicalCombinationEditor
              type="anyOf"
              value={value.anyOf}
              onChange={anyOf => onChange({ ...value, anyOf })}
              schema={parentSchema}
              currentFieldPath={currentFieldPath}
              disabled={disabled}
            />
          }
        />
        <Tab
          id="oneOf"
          title="OneOf"
          panel={
            <LogicalCombinationEditor
              type="oneOf"
              value={value.oneOf}
              onChange={oneOf => onChange({ ...value, oneOf })}
              schema={parentSchema}
              currentFieldPath={currentFieldPath}
              disabled={disabled}
            />
          }
        />
      </Tabs>

      <Callout intent="warning" icon="warning-sign">
        <strong>Important:</strong> Conditional validation is for <strong>data validation</strong>{' '}
        only. For UI behavior (show/hide, enable/disable), use the <strong>Linkage</strong> tab.
      </Callout>
    </div>
  );
};

/**
 * Dependencies 编辑器
 */
interface DependenciesEditorProps {
  value?: Record<string, any>;
  onChange: (value: Record<string, any> | undefined) => void;
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  disabled?: boolean;
}

const DependenciesEditor: React.FC<DependenciesEditorProps> = ({
  value,
  onChange,
  schema,
  currentFieldPath,
  disabled,
}) => {
  const [triggerField, setTriggerField] = useState('');
  const [dependencyType, setDependencyType] = useState<'simple' | 'schema'>('simple');
  const [editingField, setEditingField] = useState<string | null>(null);

  const dependencies = Object.entries(value || {});

  const handleAddDependency = () => {
    if (!triggerField) return;

    const fieldName = getFieldNameFromPath(triggerField);
    const newValue = { ...(value || {}) };
    if (dependencyType === 'simple') {
      newValue[fieldName] = [];
    } else {
      newValue[fieldName] = { oneOf: [] };
    }
    onChange(newValue);
    setTriggerField('');
    setEditingField(fieldName);
  };

  const handleRemoveDependency = (field: string) => {
    const newValue = { ...(value || {}) };
    delete newValue[field];

    onChange(Object.keys(newValue).length > 0 ? newValue : undefined);
    if (editingField === field) {
      setEditingField(null);
    }
  };

  const handleUpdateSimpleDependency = (field: string, requiredFields: string[]) => {
    const newValue = { ...(value || {}) };
    newValue[field] = requiredFields;
    onChange(newValue);
  };

  const handleUpdateSchemaDependency = (field: string, schemaConfig: any) => {
    const newValue = { ...(value || {}) };
    newValue[field] = schemaConfig;
    onChange(newValue);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
      <Callout intent="none" icon="info-sign">
        <strong>Dependencies:</strong> When field A has a value, field B becomes required or must
        meet certain validation rules.
        <br />
        <em style={{ fontSize: 12 }}>
          Example: When "creditCard" is filled, "billingAddress" becomes required.
        </em>
      </Callout>

      {/* 现有依赖列表 */}
      {dependencies.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 600 }}>Existing Dependencies:</div>
          {dependencies.map(([field, config]) => (
            <Card key={field} style={{ padding: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag intent="primary">{field}</Tag>
                  <Tag minimal>{Array.isArray(config) ? 'Simple' : 'Schema'}</Tag>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button
                    icon={editingField === field ? 'chevron-up' : 'chevron-down'}
                    minimal
                    small
                    onClick={() => setEditingField(editingField === field ? null : field)}
                    disabled={disabled}
                  />
                  <Button
                    icon="trash"
                    minimal
                    small
                    intent="danger"
                    onClick={() => handleRemoveDependency(field)}
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* 简单依赖配置 */}
              {editingField === field && Array.isArray(config) && (
                <SimpleDependencyConfig
                  triggerField={field}
                  requiredFields={config}
                  onChange={fields => handleUpdateSimpleDependency(field, fields)}
                  schema={schema}
                  currentFieldPath={currentFieldPath}
                  disabled={disabled}
                />
              )}

              {/* Schema 依赖配置 */}
              {editingField === field && !Array.isArray(config) && (
                <SchemaDependencyConfig
                  triggerField={field}
                  schemaConfig={config}
                  onChange={schemaConfig => handleUpdateSchemaDependency(field, schemaConfig)}
                  schema={schema}
                  currentFieldPath={currentFieldPath}
                  disabled={disabled}
                />
              )}
            </Card>
          ))}
        </div>
      )}

      <Divider />

      {/* 添加新依赖 */}
      <FormGroup label="Trigger Field" helperText="Field that triggers the dependency">
        <FieldPathSelector
          schema={schema}
          currentFieldPath={currentFieldPath}
          value={triggerField}
          onChange={setTriggerField}
          disabled={disabled}
          placeholder="Select trigger field"
        />
      </FormGroup>

      <FormGroup label="Dependency Type">
        <HTMLSelect
          value={dependencyType}
          onChange={e => setDependencyType(e.target.value as 'simple' | 'schema')}
          disabled={disabled}
          fill
        >
          <option value="simple">Simple (Required Fields)</option>
          <option value="schema">Schema (Complex Rules)</option>
        </HTMLSelect>
      </FormGroup>

      <Button
        icon="add"
        text="Add Dependency"
        intent="primary"
        onClick={handleAddDependency}
        disabled={disabled || !triggerField}
      />
    </div>
  );
};

/**
 * If/Then/Else 编辑器
 */
interface IfThenElseEditorProps {
  value: { if?: any; then?: any; else?: any };
  onChange: (value: { if?: any; then?: any; else?: any }) => void;
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  disabled?: boolean;
}

const IfThenElseEditor: React.FC<IfThenElseEditorProps> = ({
  value,
  onChange,
  schema,
  currentFieldPath,
  disabled,
}) => {
  const [conditionField, setConditionField] = useState('');
  const [conditionValue, setConditionValue] = useState('');

  const hasCondition = !!value.if;

  // 从 if 配置中提取条件信息
  const getConditionInfo = () => {
    if (!value.if?.properties) return null;
    const fieldName = Object.keys(value.if.properties)[0];
    const fieldValue = value.if.properties[fieldName]?.const;
    return { fieldName, fieldValue };
  };

  const conditionInfo = getConditionInfo();

  const handleSetCondition = () => {
    if (!conditionField) return;

    onChange({
      ...value,
      if: {
        properties: {
          [getFieldNameFromPath(conditionField)]: { const: conditionValue },
        },
      },
    });
  };

  const handleClearCondition = () => {
    onChange({ if: undefined, then: undefined, else: undefined });
    setConditionField('');
    setConditionValue('');
  };

  const handleThenChange = (thenValue: any) => {
    onChange({
      ...value,
      then: thenValue,
    });
  };

  const handleElseChange = (elseValue: any) => {
    onChange({
      ...value,
      else: elseValue,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
      <Callout intent="none" icon="info-sign">
        <strong>If/Then/Else:</strong> Apply different validation rules based on a condition.
        <br />
        <em style={{ fontSize: 12 }}>
          Example: If country is "China", require "idCard"; else require "passport".
        </em>
      </Callout>

      {/* Condition 配置 */}
      {hasCondition ? (
        <Card style={{ padding: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Tag intent="primary" large>
              Condition Configured
            </Tag>
            <Button
              icon="trash"
              text="Clear"
              intent="danger"
              small
              onClick={handleClearCondition}
              disabled={disabled}
            />
          </div>
          {conditionInfo && (
            <div style={{ padding: 12, backgroundColor: '#f5f8fa', borderRadius: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>If:</strong>
                <Tag intent="primary">{conditionInfo.fieldName}</Tag>
                <span style={{ fontSize: 13 }}>=</span>
                <Tag intent="success">{String(conditionInfo.fieldValue)}</Tag>
              </div>
              <div style={{ fontSize: 12, color: '#5c7080', marginTop: 8 }}>
                When this condition is true, apply "then" rules; otherwise apply "else" rules.
              </div>
            </div>
          )}
        </Card>
      ) : (
        <>
          <FormGroup label="Condition Field" helperText="Field to check">
            <FieldPathSelector
              schema={schema}
              currentFieldPath={currentFieldPath}
              value={conditionField}
              onChange={setConditionField}
              disabled={disabled}
              placeholder="Select field to check"
            />
          </FormGroup>

          <FormGroup label="Condition Value" helperText="Value to match">
            <InputGroup
              value={conditionValue}
              onChange={e => setConditionValue(e.target.value)}
              placeholder="Enter value"
              disabled={disabled}
            />
          </FormGroup>

          <Button
            icon="add"
            text="Set Condition"
            intent="primary"
            onClick={handleSetCondition}
            disabled={disabled || !conditionField}
          />
        </>
      )}

      {/* Then 效果配置 */}
      {hasCondition && (
        <>
          <Divider />
          <ValidationEffectEditor
            value={value.then}
            onChange={handleThenChange}
            schema={schema}
            currentFieldPath={currentFieldPath}
            disabled={disabled}
            label="Then (When Condition is True)"
          />
        </>
      )}

      {/* Else 效果配置 */}
      {hasCondition && (
        <>
          <ValidationEffectEditor
            value={value.else}
            onChange={handleElseChange}
            schema={schema}
            currentFieldPath={currentFieldPath}
            disabled={disabled}
            label="Else (When Condition is False)"
          />
        </>
      )}
    </div>
  );
};

/**
 * 从路径中提取字段名
 */
function getFieldNameFromPath(path: string): string {
  if (path.startsWith('./')) {
    return path.substring(2);
  }
  if (path.startsWith('#/properties/')) {
    const segments = path.split('/');
    return segments[segments.length - 1];
  }
  return path;
}

/**
 * 简单依赖配置组件
 */
interface SimpleDependencyConfigProps {
  triggerField: string;
  requiredFields: string[];
  onChange: (fields: string[]) => void;
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  disabled?: boolean;
}

const SimpleDependencyConfig: React.FC<SimpleDependencyConfigProps> = ({
  triggerField,
  requiredFields,
  onChange,
  schema,
  currentFieldPath,
  disabled,
}) => {
  const [selectedField, setSelectedField] = useState('');

  const handleAddField = () => {
    if (!selectedField) return;
    const fieldName = getFieldNameFromPath(selectedField);
    if (requiredFields.includes(fieldName)) return;
    onChange([...requiredFields, fieldName]);
    setSelectedField('');
  };

  const handleRemoveField = (fieldName: string) => {
    onChange(requiredFields.filter(f => f !== fieldName));
  };

  return (
    <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f5f8fa', borderRadius: 4 }}>
      <Callout intent="none" style={{ marginBottom: 12, fontSize: 12 }}>
        When <strong>{triggerField}</strong> has a value, the following fields become required:
      </Callout>

      {requiredFields.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {requiredFields.map(fieldName => (
            <Tag key={fieldName} onRemove={() => handleRemoveField(fieldName)} intent="warning">
              {fieldName}
            </Tag>
          ))}
        </div>
      )}

      <FormGroup label="Add Required Field" style={{ marginBottom: 8 }}>
        <FieldPathSelector
          schema={schema}
          currentFieldPath={currentFieldPath}
          value={selectedField}
          onChange={setSelectedField}
          disabled={disabled}
          placeholder="Select field to require"
        />
      </FormGroup>

      <Button
        icon="add"
        text="Add Field"
        intent="primary"
        small
        onClick={handleAddField}
        disabled={disabled || !selectedField}
      />
    </div>
  );
};

/**
 * Schema 依赖配置组件
 */
interface SchemaDependencyConfigProps {
  triggerField: string;
  schemaConfig: any;
  onChange: (config: any) => void;
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  disabled?: boolean;
}

const SchemaDependencyConfig: React.FC<SchemaDependencyConfigProps> = ({
  triggerField,
  schemaConfig,
  onChange,
  schema,
  currentFieldPath,
  disabled,
}) => {
  const oneOfSchemas = schemaConfig?.oneOf || [];

  const handleAddSchema = () => {
    const newOneOf = [...oneOfSchemas, { properties: {}, required: [] }];
    onChange({ oneOf: newOneOf });
  };

  const handleRemoveSchema = (index: number) => {
    const newOneOf = oneOfSchemas.filter((_: any, i: number) => i !== index);
    onChange(newOneOf.length > 0 ? { oneOf: newOneOf } : { oneOf: [] });
  };

  const handleUpdateSchema = (index: number, updatedSchema: any) => {
    const newOneOf = [...oneOfSchemas];
    newOneOf[index] = updatedSchema;
    onChange({ oneOf: newOneOf });
  };

  return (
    <div style={{ marginTop: 12, padding: 12, backgroundColor: '#f5f8fa', borderRadius: 4 }}>
      <Callout intent="none" style={{ marginBottom: 12, fontSize: 12 }}>
        When <strong>{triggerField}</strong> has a specific value, apply corresponding validation
        rules. Each schema below represents a different condition.
      </Callout>

      {oneOfSchemas.map((schemaItem: any, index: number) => (
        <Card key={index} style={{ padding: 12, marginBottom: 8 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Tag intent="primary" minimal>
              Schema {index + 1}
            </Tag>
            <Button
              icon="trash"
              minimal
              small
              intent="danger"
              onClick={() => handleRemoveSchema(index)}
              disabled={disabled}
            />
          </div>
          <ValidationEffectEditor
            value={schemaItem}
            onChange={updated => handleUpdateSchema(index, updated)}
            schema={schema}
            currentFieldPath={currentFieldPath}
            disabled={disabled}
            label={`Condition ${index + 1}`}
          />
        </Card>
      ))}

      <Button
        icon="add"
        text="Add Schema Condition"
        intent="primary"
        small
        onClick={handleAddSchema}
        disabled={disabled}
      />
    </div>
  );
};

/**
 * Logical Combination 编辑器 (allOf/anyOf/oneOf)
 */
interface LogicalCombinationEditorProps {
  type: 'allOf' | 'anyOf' | 'oneOf';
  value?: any[];
  onChange: (value: any[] | undefined) => void;
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  disabled?: boolean;
}

const LogicalCombinationEditor: React.FC<LogicalCombinationEditorProps> = ({
  type,
  value = [],
  onChange,
  schema,
  currentFieldPath,
  disabled,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const descriptions = {
    allOf: {
      title: 'AllOf (All Must Match)',
      description: 'Data must satisfy ALL of the specified schemas (AND logic).',
      example: 'If student, require "studentId"; if under 18, require "guardianPhone".',
    },
    anyOf: {
      title: 'AnyOf (At Least One)',
      description: 'Data must satisfy AT LEAST ONE of the specified schemas (OR logic).',
      example: 'Must provide at least one of: email, phone, or wechat.',
    },
    oneOf: {
      title: 'OneOf (Exactly One)',
      description: 'Data must satisfy EXACTLY ONE of the specified schemas (XOR logic).',
      example: 'Account type must be either "personal" or "business", not both.',
    },
  };

  const info = descriptions[type];

  const handleAddSchema = () => {
    const newSchema = { properties: {}, required: [] };
    onChange([...value, newSchema]);
    setEditingIndex(value.length);
  };

  const handleRemoveSchema = (index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue.length > 0 ? newValue : undefined);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleUpdateSchema = (index: number, updatedSchema: any) => {
    const newValue = [...value];
    newValue[index] = updatedSchema;
    onChange(newValue);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
      <Callout intent="none" icon="info-sign">
        <strong>{info.title}:</strong> {info.description}
        <br />
        <em style={{ fontSize: 12 }}>Example: {info.example}</em>
      </Callout>

      {value.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 600 }}>Configured Schemas ({value.length}):</div>
          {value.map((schemaItem, index) => (
            <Card key={index} style={{ padding: 12 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag intent="primary">Schema {index + 1}</Tag>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button
                    icon={editingIndex === index ? 'chevron-up' : 'chevron-down'}
                    minimal
                    small
                    onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                    disabled={disabled}
                  />
                  <Button
                    icon="trash"
                    minimal
                    small
                    intent="danger"
                    onClick={() => handleRemoveSchema(index)}
                    disabled={disabled}
                  />
                </div>
              </div>

              {editingIndex === index && (
                <ValidationEffectEditor
                  value={schemaItem}
                  onChange={updated => handleUpdateSchema(index, updated)}
                  schema={schema}
                  currentFieldPath={currentFieldPath}
                  disabled={disabled}
                  label={`Schema ${index + 1} Rules`}
                />
              )}
            </Card>
          ))}
        </div>
      )}

      <Button
        icon="add"
        text="Add Schema"
        intent="primary"
        onClick={handleAddSchema}
        disabled={disabled}
      />
    </div>
  );
};
