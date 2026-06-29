import React, { useState, useEffect } from 'react';
import {
  FormGroup,
  HTMLSelect,
  Button,
  Card,
  Elevation,
  Callout,
  Tag,
  Divider,
  Switch,
} from '@blueprintjs/core';
import type {
  LinkageConfig,
  LinkageType,
  ConditionExpression,
  LinkageEffect,
} from '../../../../DynamicForm/types/linkage';
import type { ExtendedJSONSchema } from '../../../../DynamicForm/types/schema';
import { ConditionEditor } from './ConditionEditor';
import { EffectEditor } from './EffectEditor';
import { FieldPathSelector } from './FieldPathSelector';
import './LinkageEditor.scss';

interface LinkageEditorProps {
  value?: LinkageConfig;
  onChange: (value: LinkageConfig | undefined) => void;
  currentFieldPath: string;
  schema: ExtendedJSONSchema;
  disabled?: boolean;
}

/**
 * 联动配置编辑器
 * 支持配置字段的联动规则
 */
export const LinkageEditor: React.FC<LinkageEditorProps> = ({
  value,
  onChange,
  currentFieldPath,
  schema,
  disabled,
}) => {
  const [isEnabled, setIsEnabled] = useState(!!value);

  // 同步 value 变化到 isEnabled 状态
  useEffect(() => {
    setIsEnabled(!!value);
  }, [value]);

  // 联动类型选项
  const linkageTypeOptions: Array<{ label: string; value: LinkageType }> = [
    { label: 'Visibility (Show/Hide)', value: 'visibility' },
    { label: 'Disabled (Enable/Disable)', value: 'disabled' },
    { label: 'Readonly', value: 'readonly' },
    { label: 'Value (Auto Calculate)', value: 'value' },
    { label: 'Options (Dynamic Options)', value: 'options' },
    { label: 'Schema (Dynamic Schema)', value: 'schema' },
  ];

  const handleEnableToggle = () => {
    if (isEnabled) {
      // 禁用联动
      setIsEnabled(false);
      onChange(undefined);
    } else {
      // 启用联动，创建默认配置
      setIsEnabled(true);
      onChange({
        type: 'visibility',
        dependencies: [],
      });
    }
  };

  const handleTypeChange = (type: LinkageType) => {
    if (!value) return;
    // 切换类型时重置 fulfill 和 otherwise
    onChange({
      ...value,
      type,
      fulfill: undefined,
      otherwise: undefined,
    });
  };

  const handleAddDependency = () => {
    if (!value) return;
    onChange({
      ...value,
      dependencies: [...value.dependencies, ''],
    });
  };

  const handleDependencyChange = (index: number, newValue: string) => {
    if (!value) return;
    const newDeps = [...value.dependencies];
    newDeps[index] = newValue;
    onChange({
      ...value,
      dependencies: newDeps,
    });
  };

  const handleRemoveDependency = (index: number) => {
    if (!value) return;
    const newDeps = value.dependencies.filter((_, i) => i !== index);
    onChange({
      ...value,
      dependencies: newDeps,
    });
  };

  const handleConditionChange = (condition: ConditionExpression | undefined) => {
    if (!value) return;
    onChange({
      ...value,
      when: condition,
    });
  };

  const handleFulfillChange = (effect: LinkageEffect | undefined) => {
    if (!value) return;
    onChange({
      ...value,
      fulfill: effect,
    });
  };

  const handleOtherwiseChange = (effect: LinkageEffect | undefined) => {
    if (!value) return;
    onChange({
      ...value,
      otherwise: effect,
    });
  };

  const handleEnableCacheChange = (enableCache: boolean) => {
    if (!value) return;
    onChange({
      ...value,
      enableCache,
    });
  };

  // 判断是否显示 enableCache 选项（仅对异步联动类型有效）
  const showEnableCacheOption = ['value', 'options', 'schema'].includes(value?.type || '');

  if (!isEnabled) {
    return (
      <div className="linkage-editor">
        <Callout intent="none">
          <p>No linkage configured for this field.</p>
          <Button
            text="Enable Linkage"
            icon="add"
            intent="primary"
            onClick={handleEnableToggle}
            disabled={disabled}
          />
        </Callout>
      </div>
    );
  }

  return (
    <div className="linkage-editor">
      <Card elevation={Elevation.ONE} style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Linkage Configuration</h4>
          <Button
            text="Disable Linkage"
            icon="cross"
            intent="danger"
            minimal
            small
            onClick={handleEnableToggle}
            disabled={disabled}
          />
        </div>
      </Card>

      {/* 联动类型 */}
      <FormGroup label="Linkage Type" helperText="What should this linkage control?">
        <HTMLSelect
          value={value?.type || 'visibility'}
          onChange={e => handleTypeChange(e.target.value as LinkageType)}
          disabled={disabled}
          fill
        >
          {linkageTypeOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>

      {/* 依赖字段 */}
      <FormGroup
        label="Dependencies"
        helperText="Fields that this linkage depends on. Use JSON Pointer format (e.g., #/properties/fieldName) or relative path (e.g., ./fieldName)"
      >
        {value?.dependencies.map((dep, index) => (
          <div key={index} className="dependency-item">
            <FieldPathSelector
              schema={schema}
              currentFieldPath={currentFieldPath}
              value={dep}
              onChange={newValue => handleDependencyChange(index, newValue)}
              disabled={disabled}
              placeholder="#/properties/fieldName or ./fieldName"
            />
            <Button
              icon="trash"
              intent="danger"
              minimal
              onClick={() => handleRemoveDependency(index)}
              disabled={disabled}
            />
          </div>
        ))}
        <Button
          text="Add Dependency"
          icon="add"
          small
          onClick={handleAddDependency}
          disabled={disabled}
        />
      </FormGroup>

      {/* 提示信息 */}
      <Callout intent="primary" icon="info-sign" style={{ marginTop: 10 }}>
        <h5>Path Format Guide</h5>
        <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
          <li>
            <strong>Same level field:</strong> <Tag minimal>./fieldName</Tag>
          </li>
          <li>
            <strong>Top level field:</strong> <Tag minimal>#/properties/fieldName</Tag>
          </li>
          <li>
            <strong>Array element field:</strong>{' '}
            <Tag minimal>#/properties/arrayName/items/properties/fieldName</Tag>
          </li>
        </ul>
      </Callout>

      <Divider style={{ margin: '16px 0' }} />

      {/* 条件配置 */}
      <FormGroup label="Condition (When)" helperText="Define when this linkage should be triggered">
        <ConditionEditor
          value={typeof value?.when === 'object' ? value.when : undefined}
          onChange={handleConditionChange}
          disabled={disabled}
          schema={schema}
          currentFieldPath={currentFieldPath}
          dependencies={value?.dependencies || []}
        />
      </FormGroup>

      <Divider style={{ margin: '16px 0' }} />

      {/* Fulfill 效果 */}
      <FormGroup label="Effect (Fulfill)" helperText="What happens when the condition is met">
        <EffectEditor
          value={value?.fulfill}
          onChange={handleFulfillChange}
          linkageType={value?.type || 'visibility'}
          disabled={disabled}
          label="Fulfill Effect"
          isFulfill={true}
        />
      </FormGroup>

      <Divider style={{ margin: '16px 0' }} />

      {/* Otherwise 效果 */}
      <FormGroup
        label="Effect (Otherwise)"
        helperText="What happens when the condition is NOT met (optional)"
      >
        <EffectEditor
          value={value?.otherwise}
          onChange={handleOtherwiseChange}
          linkageType={value?.type || 'visibility'}
          disabled={disabled}
          label="Otherwise Effect"
          isFulfill={false}
        />
      </FormGroup>

      {/* 高级选项：enableCache */}
      {showEnableCacheOption && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <FormGroup
            label="Advanced Options"
            helperText="Configure caching for async linkage operations"
          >
            <Switch
              label="Enable Cache"
              checked={!!value?.enableCache}
              onChange={e => handleEnableCacheChange(e.currentTarget.checked)}
              disabled={disabled}
            />
            <p style={{ fontSize: 12, color: '#5c7080', marginTop: 4 }}>
              When enabled, async results will be cached to avoid redundant requests with the same
              parameters.
            </p>
          </FormGroup>
        </>
      )}
    </div>
  );
};
