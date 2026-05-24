import React, { useState } from 'react';
import {
  FormGroup,
  Button,
  Card,
  Tag,
  Divider,
  Callout,
  HTMLSelect,
  InputGroup,
  NumericInput,
} from '@blueprintjs/core';
import { FieldPathSelector } from './FieldPathSelector';
import type { ExtendedJSONSchema } from '../DynamicForm/types/schema';

interface ValidationEffectEditorProps {
  value?: {
    required?: string[];
    properties?: Record<string, any>;
  };
  onChange: (value: { required?: string[]; properties?: Record<string, any> } | undefined) => void;
  schema: ExtendedJSONSchema;
  currentFieldPath: string;
  disabled?: boolean;
  label: string;
}

/**
 * 验证效果编辑器
 * 用于配置 if/then/else 中的 then 和 else 效果
 * 支持配置:
 * 1. required: 必填字段列表
 * 2. properties: 字段的验证规则
 */
export const ValidationEffectEditor: React.FC<ValidationEffectEditorProps> = ({
  value = {},
  onChange,
  schema,
  currentFieldPath,
  disabled,
  label,
}) => {
  const [selectedField, setSelectedField] = useState('');
  const [validationType, setValidationType] = useState<
    'required' | 'pattern' | 'minLength' | 'maxLength' | 'minimum' | 'maximum'
  >('required');
  const [validationValue, setValidationValue] = useState('');

  const requiredFields = value.required || [];
  const properties = value.properties || {};

  // 添加必填字段
  const handleAddRequired = () => {
    if (!selectedField) return;

    const fieldName = getFieldNameFromPath(selectedField);
    if (requiredFields.includes(fieldName)) return;

    onChange({
      ...value,
      required: [...requiredFields, fieldName],
    });
    setSelectedField('');
  };

  // 移除必填字段
  const handleRemoveRequired = (fieldName: string) => {
    const newRequired = requiredFields.filter(f => f !== fieldName);
    onChange({
      ...value,
      required: newRequired.length > 0 ? newRequired : undefined,
      properties: value.properties,
    });
  };

  // 添加字段验证规则
  const handleAddValidation = () => {
    if (!selectedField || !validationValue) return;

    const fieldName = getFieldNameFromPath(selectedField);
    const newProperties = { ...properties };

    if (!newProperties[fieldName]) {
      newProperties[fieldName] = {};
    }

    // 根据验证类型设置值
    if (validationType === 'pattern') {
      newProperties[fieldName].pattern = validationValue;
    } else if (validationType === 'minLength' || validationType === 'maxLength') {
      newProperties[fieldName][validationType] = parseInt(validationValue, 10);
    } else if (validationType === 'minimum' || validationType === 'maximum') {
      newProperties[fieldName][validationType] = parseFloat(validationValue);
    }

    onChange({
      ...value,
      properties: newProperties,
    });
    setSelectedField('');
    setValidationValue('');
  };

  // 移除字段验证规则
  const handleRemoveValidation = (fieldName: string, ruleType: string) => {
    const newProperties = { ...properties };
    if (newProperties[fieldName]) {
      delete newProperties[fieldName][ruleType];

      // 如果字段没有任何规则了,删除整个字段
      if (Object.keys(newProperties[fieldName]).length === 0) {
        delete newProperties[fieldName];
      }
    }

    onChange({
      ...value,
      properties: Object.keys(newProperties).length > 0 ? newProperties : undefined,
    });
  };

  // 清空所有配置
  const handleClear = () => {
    onChange(undefined);
  };

  const hasConfig = requiredFields.length > 0 || Object.keys(properties).length > 0;

  return (
    <Card style={{ padding: 12, marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Tag intent="primary" minimal>
          {label}
        </Tag>
        {hasConfig && (
          <Button
            icon="trash"
            minimal
            small
            intent="danger"
            onClick={handleClear}
            disabled={disabled}
          />
        )}
      </div>

      {/* 必填字段列表 */}
      {requiredFields.length > 0 && (
        <>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Required Fields:</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {requiredFields.map(fieldName => (
              <Tag
                key={fieldName}
                onRemove={() => handleRemoveRequired(fieldName)}
                intent="warning"
              >
                {fieldName}
              </Tag>
            ))}
          </div>
        </>
      )}

      {/* 字段验证规则列表 */}
      {Object.keys(properties).length > 0 && (
        <>
          <div style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>Field Validation Rules:</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            {Object.entries(properties).map(([fieldName, rules]) => (
              <div
                key={fieldName}
                style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}
              >
                <Tag minimal>{fieldName}:</Tag>
                {Object.entries(rules as Record<string, any>).map(([ruleType, ruleValue]) => (
                  <Tag
                    key={`${fieldName}-${ruleType}`}
                    onRemove={() => handleRemoveValidation(fieldName, ruleType)}
                    intent="success"
                  >
                    {ruleType}: {String(ruleValue)}
                  </Tag>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <Divider />

      {/* 添加配置 */}
      <div style={{ marginTop: 12 }}>
        <FormGroup label="Select Field" style={{ marginBottom: 8 }}>
          <FieldPathSelector
            schema={schema}
            currentFieldPath={currentFieldPath}
            value={selectedField}
            onChange={setSelectedField}
            disabled={disabled}
            placeholder="Select field to configure"
          />
        </FormGroup>

        <FormGroup label="Configuration Type" style={{ marginBottom: 8 }}>
          <HTMLSelect
            value={validationType}
            onChange={e => setValidationType(e.target.value as any)}
            disabled={disabled || !selectedField}
            fill
          >
            <option value="required">Required (Must Fill)</option>
            <option value="pattern">Pattern (Regex)</option>
            <option value="minLength">Min Length</option>
            <option value="maxLength">Max Length</option>
            <option value="minimum">Minimum Value</option>
            <option value="maximum">Maximum Value</option>
          </HTMLSelect>
        </FormGroup>

        {validationType !== 'required' && (
          <FormGroup label="Validation Value" style={{ marginBottom: 8 }}>
            {validationType === 'pattern' ? (
              <InputGroup
                value={validationValue}
                onChange={e => setValidationValue(e.target.value)}
                placeholder="Enter regex pattern"
                disabled={disabled || !selectedField}
              />
            ) : (
              <NumericInput
                value={validationValue}
                onValueChange={(_, valueAsString) => setValidationValue(valueAsString)}
                placeholder="Enter value"
                disabled={disabled || !selectedField}
                fill
              />
            )}
          </FormGroup>
        )}

        <Button
          icon="add"
          text={validationType === 'required' ? 'Add Required Field' : 'Add Validation Rule'}
          intent="primary"
          small
          onClick={validationType === 'required' ? handleAddRequired : handleAddValidation}
          disabled={
            disabled || !selectedField || (validationType !== 'required' && !validationValue)
          }
        />
      </div>

      {!hasConfig && (
        <Callout intent="none" style={{ marginTop: 12, fontSize: 12 }}>
          No configuration yet. Add required fields or validation rules above.
        </Callout>
      )}
    </Card>
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
