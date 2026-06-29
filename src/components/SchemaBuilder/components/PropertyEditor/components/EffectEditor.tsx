import React from 'react';
import {
  FormGroup,
  InputGroup,
  Switch,
  Card,
  Elevation,
  Button,
  Tag,
} from '@blueprintjs/core';
import type { LinkageEffect, LinkageType } from '../../../../DynamicForm/types/linkage';
import { ObjectEditor } from '../../../../ObjectEditor';

interface EffectEditorProps {
  value?: LinkageEffect;
  onChange: (value: LinkageEffect | undefined) => void;
  linkageType: LinkageType;
  disabled?: boolean;
  label: string;
  isFulfill?: boolean; // 是否是 Fulfill 效果（true）还是 Otherwise 效果（false）
}

/**
 * 联动效果编辑器
 * 根据联动类型显示不同的配置选项
 */
export const EffectEditor: React.FC<EffectEditorProps> = ({
  value,
  onChange,
  linkageType,
  disabled,
  label,
  isFulfill = true,
}) => {
  const handleStateChange = (key: string, val: boolean) => {
    onChange({
      ...value,
      state: {
        ...value?.state,
        [key]: val,
      },
    });
  };

  const handleValueChange = (val: string) => {
    onChange({
      ...value,
      value: val,
    });
  };

  const handleFunctionChange = (val: string) => {
    onChange({
      ...value,
      function: val,
    });
  };

  const handleOptionsChange = (options: unknown) => {
    onChange({
      ...value,
      options: options as Array<{ label: string; value: any }>,
    });
  };

  const handleSchemaChange = (schema: unknown) => {
    onChange({
      ...value,
      schema,
    });
  };

  const handleClear = () => {
    onChange(undefined);
  };

  const handleAdd = () => {
    // 根据 linkageType 生成默认值
    if (['visibility', 'disabled', 'readonly'].includes(linkageType)) {
      const stateKey = linkageType === 'visibility' ? 'visible' : linkageType;
      // Fulfill 默认为 true，Otherwise 默认为 false
      onChange({
        state: {
          [stateKey]: isFulfill,
        },
      });
    } else if (linkageType === 'value') {
      onChange({
        function: '',
        value: '',
      });
    } else if (linkageType === 'options') {
      onChange({
        function: '',
        options: [],
      });
    } else if (linkageType === 'schema') {
      onChange({
        function: '',
        schema: {},
      });
    } else {
      onChange({});
    }
  };

  if (!value) {
    return (
      <div className="effect-editor">
        <Button
          text={`Add ${label}`}
          icon="add"
          intent="primary"
          onClick={handleAdd}
          disabled={disabled}
          small
        />
      </div>
    );
  }

  return (
    <Card elevation={Elevation.ONE} className="effect-editor" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Tag intent="success" minimal>
          {label}
        </Tag>
        <Button
          icon="cross"
          minimal
          small
          intent="danger"
          onClick={handleClear}
          disabled={disabled}
        />
      </div>

      {/* visibility/disabled/readonly 类型：配置 state */}
      {['visibility', 'disabled', 'readonly'].includes(linkageType) && (
        <FormGroup label="State">
          <Switch
            label={`Set ${linkageType === 'visibility' ? 'visible' : linkageType}`}
            checked={
              value.state?.[
                linkageType === 'visibility'
                  ? 'visible'
                  : (linkageType as keyof NonNullable<LinkageEffect['state']>)
              ] ?? true
            }
            onChange={e =>
              handleStateChange(
                linkageType === 'visibility' ? 'visible' : linkageType,
                e.currentTarget.checked
              )
            }
            disabled={disabled}
          />
        </FormGroup>
      )}

      {/* value 类型：配置固定值或函数 */}
      {linkageType === 'value' && (
        <>
          <FormGroup label="Function Name" helperText="Function to calculate the value">
            <InputGroup
              value={value.function || ''}
              onChange={e => handleFunctionChange(e.target.value)}
              placeholder="e.g., calculateTotal"
              disabled={disabled}
            />
          </FormGroup>
          <FormGroup label="Or Fixed Value" helperText="Use fixed value instead of function">
            <InputGroup
              value={value.value ?? ''}
              onChange={e => handleValueChange(e.target.value)}
              placeholder="Enter fixed value"
              disabled={disabled}
            />
          </FormGroup>
        </>
      )}

      {/* options 类型：配置函数或静态选项 */}
      {linkageType === 'options' && (
        <>
          <FormGroup
            label="Function Name"
            helperText="Function to generate dynamic options (optional)"
          >
            <InputGroup
              value={value.function || ''}
              onChange={e => handleFunctionChange(e.target.value)}
              placeholder="e.g., getProvinceOptions"
              disabled={disabled}
            />
          </FormGroup>
          <FormGroup
            label="Or Static Options"
            helperText='Define static options as JSON array: [{"label": "...", "value": "..."}]'
          >
            <ObjectEditor
              value={value.options || []}
              onChange={handleOptionsChange}
              disabled={disabled}
              config={{ previewMaxHeight: 120 }}
            />
          </FormGroup>
        </>
      )}

      {/* schema 类型：配置动态 Schema */}
      {linkageType === 'schema' && (
        <>
          <FormGroup
            label="Function Name"
            helperText="Function to generate dynamic schema (optional)"
          >
            <InputGroup
              value={value.function || ''}
              onChange={e => handleFunctionChange(e.target.value)}
              placeholder="e.g., getDynamicSchema"
              disabled={disabled}
            />
          </FormGroup>
          <FormGroup
            label="Or Static Schema"
            helperText="Define a static schema object in JSON format"
          >
            <ObjectEditor
              value={value.schema || {}}
              onChange={handleSchemaChange}
              disabled={disabled}
              config={{ previewMaxHeight: 150 }}
            />
          </FormGroup>
        </>
      )}
    </Card>
  );
};
