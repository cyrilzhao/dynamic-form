import React, { useState, useEffect } from 'react';
import {
  FormGroup,
  InputGroup,
  Switch,
  Card,
  Elevation,
  Button,
  Tag,
  HTMLSelect,
  Callout,
} from '@blueprintjs/core';
import type { LinkageEffect, LinkageType } from '../../../../DynamicForm/types/linkage';
import { ObjectEditor } from '../../../../ObjectEditor';
import { CodeEditor } from '../../../../CodeEditor';

interface EffectEditorProps {
  value?: LinkageEffect;
  onChange: (value: LinkageEffect | undefined) => void;
  linkageType: LinkageType;
  disabled?: boolean;
  label: string;
  isFulfill?: boolean;
}

type ConfigMode = 'dynamic' | 'static';
type FunctionMode = 'function-name' | 'inline-script';

// 默认的内联脚本模板
const getDefaultScriptTemplate = (linkageType: LinkageType): string => {
  const examples: Record<LinkageType, string> = {
    visibility: `/**
 * Calculate visibility dynamically
 * @param {object} formData - Current form values
 * @param {object} context - Linkage context (fieldPath, arrayIndex, etc.)
 * @returns {boolean} - true to show, false to hide
 */
function(formData, context) {
  // Example: show field if another field has value
  return !!formData.someField;
}`,
    disabled: `/**
 * Calculate disabled state dynamically
 * @param {object} formData - Current form values
 * @param {object} context - Linkage context
 * @returns {boolean} - true to disable, false to enable
 */
function(formData, context) {
  return false;
}`,
    readonly: `/**
 * Calculate readonly state dynamically
 * @param {object} formData - Current form values
 * @param {object} context - Linkage context
 * @returns {boolean} - true for readonly, false for editable
 */
function(formData, context) {
  return false;
}`,
    value: `/**
 * Calculate field value dynamically
 * @param {object} formData - Current form values
 * @param {object} context - Linkage context
 * @returns {any} - The calculated value
 */
async function(formData, context) {
  // Example: calculate sum
  return (formData.price || 0) * (formData.quantity || 1);
}`,
    options: `/**
 * Generate dynamic options
 * @param {object} formData - Current form values
 * @param {object} context - Linkage context
 * @returns {Array<{label: string, value: any}>} - Options array
 */
async function(formData, context) {
  // Example: fetch from API or calculate based on other fields
  return [
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
  ];
}`,
    schema: `/**
 * Generate dynamic schema
 * @param {object} formData - Current form values
 * @param {object} context - Linkage context
 * @returns {object} - JSON Schema object
 */
async function(formData, context) {
  return {
    type: 'string',
    title: 'Dynamic Field',
  };
}`,
  };
  return examples[linkageType];
};

/**
 * 联动效果编辑器（重构版）
 * 先选择配置模式，再进行具体配置，避免歧义
 */
export const EffectEditor: React.FC<EffectEditorProps> = ({
  value,
  onChange,
  linkageType,
  disabled,
  label,
  isFulfill = true,
}) => {
  // 确定当前的配置模式
  const getCurrentMode = (): ConfigMode => {
    if (!value) return 'static';
    // 如果有 function 字段（即使是空字符串），则为 dynamic 模式
    if ('function' in value) return 'dynamic';
    // 否则为 static 模式
    return 'static';
  };

  const [configMode, setConfigMode] = useState<ConfigMode>(getCurrentMode);
  const [functionMode, setFunctionMode] = useState<FunctionMode>('function-name');
  const [functionName, setFunctionName] = useState('');
  const [scriptCode, setScriptCode] = useState(getDefaultScriptTemplate(linkageType));

  // 当 linkageType 变化时更新模板（仅在 inline-script 模式且使用默认模板时）
  useEffect(() => {
    const newTemplate = getDefaultScriptTemplate(linkageType);
    // 如果当前代码为空或者是旧的默认模板格式，则更新为新模板
    if (!scriptCode.trim() || scriptCode.includes('function(')) {
      setScriptCode(newTemplate);
      // 如果当前正在使用 inline-script 模式，同步更新 value
      if (configMode === 'dynamic' && functionMode === 'inline-script' && value) {
        onChange({ ...value, function: { type: 'script', code: newTemplate } });
      }
    }
  }, [linkageType]);

  // 当 value 变化时同步状态
  useEffect(() => {
    setConfigMode(getCurrentMode());
    if (value?.function) {
      if (typeof value.function === 'string') {
        setFunctionMode('function-name');
        setFunctionName(value.function);
      } else {
        setFunctionMode('inline-script');
        setScriptCode(value.function.code);
      }
    }
  }, [value]);

  const handleClear = () => {
    onChange(undefined);
  };

  const handleAdd = () => {
    // 默认添加为 static 模式
    if (['visibility', 'disabled', 'readonly'].includes(linkageType)) {
      const stateKey = linkageType === 'visibility' ? 'visible' : linkageType;
      onChange({
        state: {
          [stateKey]: isFulfill,
        },
      });
    } else if (linkageType === 'value') {
      onChange({ value: '' });
    } else if (linkageType === 'options') {
      onChange({ options: [] });
    } else if (linkageType === 'schema') {
      onChange({ schema: {} });
    }
  };

  const handleModeChange = (newMode: ConfigMode) => {
    setConfigMode(newMode);

    if (newMode === 'dynamic') {
      // 切换到 dynamic 模式：保留现有值，添加 function 字段
      const newValue: LinkageEffect = { ...value };

      // 移除与 function 互斥的静态字段
      delete newValue.state;
      delete newValue.value;
      delete newValue.options;
      delete newValue.schema;

      // 设置 function
      if (functionMode === 'function-name') {
        newValue.function = functionName || '';
      } else {
        newValue.function = { type: 'script', code: scriptCode };
      }
      onChange(newValue);
    } else {
      // 切换到 static 模式：移除 function，设置默认静态值
      const newValue: LinkageEffect = {};

      if (['visibility', 'disabled', 'readonly'].includes(linkageType)) {
        const stateKey = linkageType === 'visibility' ? 'visible' : linkageType;
        newValue.state = {
          [stateKey]: isFulfill,
        };
      } else if (linkageType === 'value') {
        newValue.value = '';
      } else if (linkageType === 'options') {
        newValue.options = [];
      } else if (linkageType === 'schema') {
        newValue.schema = {};
      }
      onChange(newValue);
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

      {/* 配置模式选择 */}
      <FormGroup label="Configuration Mode">
        <HTMLSelect
          value={configMode}
          onChange={(e) => handleModeChange(e.target.value as ConfigMode)}
          disabled={disabled}
          fill
        >
          <option value="dynamic">Dynamic (Use Function)</option>
          <option value="static">Static (Fixed Value)</option>
        </HTMLSelect>
      </FormGroup>

      {/* Dynamic 模式配置 */}
      {configMode === 'dynamic' && (
        <DynamicModeConfig
          linkageType={linkageType}
          value={value}
          onChange={onChange}
          disabled={disabled}
          functionMode={functionMode}
          setFunctionMode={setFunctionMode}
          functionName={functionName}
          setFunctionName={setFunctionName}
          scriptCode={scriptCode}
          setScriptCode={setScriptCode}
        />
      )}

      {/* Static 模式配置 */}
      {configMode === 'static' && (
        <StaticModeConfig
          linkageType={linkageType}
          value={value}
          onChange={onChange}
          disabled={disabled}
          isFulfill={isFulfill}
        />
      )}
    </Card>
  );
};

// Dynamic 模式配置组件
interface DynamicModeConfigProps {
  linkageType: LinkageType;
  value: LinkageEffect;
  onChange: (value: LinkageEffect) => void;
  disabled?: boolean;
  functionMode: FunctionMode;
  setFunctionMode: (mode: FunctionMode) => void;
  functionName: string;
  setFunctionName: (name: string) => void;
  scriptCode: string;
  setScriptCode: (code: string) => void;
}

const DynamicModeConfig: React.FC<DynamicModeConfigProps> = ({
  linkageType,
  value,
  onChange,
  disabled,
  functionMode,
  setFunctionMode,
  functionName,
  setFunctionName,
  scriptCode,
  setScriptCode,
}) => {
  const handleFunctionModeChange = (newMode: FunctionMode) => {
    setFunctionMode(newMode);
    // 更新 value
    if (newMode === 'function-name') {
      onChange({ ...value, function: functionName || '' });
    } else {
      onChange({ ...value, function: { type: 'script', code: scriptCode } });
    }
  };

  const handleFunctionNameChange = (name: string) => {
    setFunctionName(name);
    onChange({ ...value, function: name });
  };

  const handleScriptCodeChange = (code: string) => {
    setScriptCode(code);
    onChange({ ...value, function: { type: 'script', code } });
  };

  return (
    <>
      <FormGroup label="Function Type">
        <HTMLSelect
          value={functionMode}
          onChange={(e) => handleFunctionModeChange(e.target.value as FunctionMode)}
          disabled={disabled}
          fill
        >
          <option value="function-name">Function Name (from callbacks registry)</option>
          <option value="inline-script">Inline Script</option>
        </HTMLSelect>
      </FormGroup>

      {functionMode === 'function-name' && (
        <FormGroup
          label="Function Name"
          helperText="Function from DynamicForm linkageFunctions prop"
        >
          <InputGroup
            value={functionName}
            onChange={(e) => handleFunctionNameChange(e.target.value)}
            placeholder="e.g., calculateDynamic"
            disabled={disabled}
          />
        </FormGroup>
      )}

      {functionMode === 'inline-script' && (
        <>
          <Callout intent="warning" icon="warning-sign" style={{ fontSize: 12, marginBottom: 12 }}>
            Only use in trusted internal environments. The code runs in the browser.
          </Callout>
          <FormGroup
            label="Function Code"
            helperText="Complete function receiving (formData, context). Return the calculated result."
          >
            <CodeEditor
              value={scriptCode}
              language="javascript"
              config={{ initialMode: 'preview', previewLines: 6 }}
              onChange={handleScriptCodeChange}
              disabled={disabled}
            />
          </FormGroup>
        </>
      )}
    </>
  );
};

// Static 模式配置组件
interface StaticModeConfigProps {
  linkageType: LinkageType;
  value: LinkageEffect;
  onChange: (value: LinkageEffect) => void;
  disabled?: boolean;
  isFulfill: boolean;
}

const StaticModeConfig: React.FC<StaticModeConfigProps> = ({
  linkageType,
  value,
  onChange,
  disabled,
  isFulfill,
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

  // visibility/disabled/readonly 类型
  if (['visibility', 'disabled', 'readonly'].includes(linkageType)) {
    const stateKey = linkageType === 'visibility' ? 'visible' : linkageType;
    return (
      <FormGroup label="Static State">
        <Switch
          label={`Set ${linkageType === 'visibility' ? 'visible' : linkageType}`}
          checked={
            value.state?.[
              linkageType === 'visibility'
                ? 'visible'
                : (linkageType as keyof NonNullable<LinkageEffect['state']>)
            ] ?? true
          }
          onChange={(e) =>
            handleStateChange(
              linkageType === 'visibility' ? 'visible' : linkageType,
              e.currentTarget.checked
            )
          }
          disabled={disabled}
        />
      </FormGroup>
    );
  }

  // value 类型
  if (linkageType === 'value') {
    return (
      <FormGroup label="Fixed Value" helperText="Enter the fixed value">
        <InputGroup
          value={value.value ?? ''}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder="Enter fixed value"
          disabled={disabled}
        />
      </FormGroup>
    );
  }

  // options 类型
  if (linkageType === 'options') {
    return (
      <FormGroup
        label="Static Options"
        helperText='Define options as JSON array: [{"label": "...", "value": "..."}]'
      >
        <ObjectEditor
          value={value.options || []}
          onChange={handleOptionsChange}
          disabled={disabled}
          config={{ previewMaxHeight: 120 }}
        />
      </FormGroup>
    );
  }

  // schema 类型
  if (linkageType === 'schema') {
    return (
      <FormGroup
        label="Static Schema"
        helperText="Define a static schema object in JSON format"
      >
        <ObjectEditor
          value={value.schema || {}}
          onChange={handleSchemaChange}
          disabled={disabled}
          config={{ previewMaxHeight: 150 }}
        />
      </FormGroup>
    );
  }

  return null;
};
