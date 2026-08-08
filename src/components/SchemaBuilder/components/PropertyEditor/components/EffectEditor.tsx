import React, { useState, useEffect } from 'react'
import {
  Switch,
  Card,
  Elevation,
  Button,
  FormGroup,
  Tag,
} from '@blueprintjs/core'
import { Select } from '../../../../Select'
import type {
  LinkageEffect,
  LinkageType,
} from '../../../../DynamicForm/types/linkage'
import { ObjectEditor } from '../../../../ObjectEditor'
import { FunctionRefEditor } from './FunctionRefEditor'

interface EffectEditorProps {
  value?: LinkageEffect
  onChange: (value: LinkageEffect | undefined) => void
  linkageType: LinkageType
  disabled?: boolean
  label: string
  isFulfill?: boolean
}

type ConfigMode = 'dynamic' | 'static'

// 默认的内联脚本模板
const getDefaultScriptTemplate = (linkageType: LinkageType): string => {
  const examples: Record<LinkageType, string> = {
    visibility: `/**
 * Calculate visibility dynamically
 * @param {object} params - Parameters object
 * @param {object} params.formData - Current form values
 * @param {object} params.context - Linkage context (fieldPath, arrayIndex, externalData, etc.)
 * @param {object} params.helpers - Helper utilities (ofetch, lodash, zod, etc.)
 * @returns {boolean} - true to show, false to hide
 */
function({ formData, context, helpers }) {
  // Example: show field if another field has value
  return !!formData.someField;
}`,
    disabled: `/**
 * Calculate disabled state dynamically
 * @param {object} params - Parameters object
 * @param {object} params.formData - Current form values
 * @param {object} params.context - Linkage context
 * @param {object} params.helpers - Helper utilities (ofetch, lodash, zod, etc.)
 * @returns {boolean} - true to disable, false to enable
 */
function({ formData, context, helpers }) {
  return false;
}`,
    readonly: `/**
 * Calculate readonly state dynamically
 * @param {object} params - Parameters object
 * @param {object} params.formData - Current form values
 * @param {object} params.context - Linkage context
 * @param {object} params.helpers - Helper utilities (ofetch, lodash, zod, etc.)
 * @returns {boolean} - true for readonly, false for editable
 */
function({ formData, context, helpers }) {
  return false;
}`,
    value: `/**
 * Calculate field value dynamically
 * @param {object} params - Parameters object
 * @param {object} params.formData - Current form values
 * @param {object} params.context - Linkage context
 * @param {object} params.helpers - Helper utilities (ofetch, lodash, zod, etc.)
 * @returns {any} - The calculated value
 */
async function({ formData, context, helpers }) {
  // Example: calculate sum
  return (formData.price || 0) * (formData.quantity || 1);
}`,
    options: `/**
 * Generate dynamic options
 * @param {object} params - Parameters object
 * @param {object} params.formData - Current form values
 * @param {object} params.context - Linkage context
 * @param {object} params.helpers - Helper utilities (ofetch, lodash, zod, etc.)
 * @returns {Array<{label: string, value: any}>} - Options array
 */
async function({ formData, context, helpers }) {
  // Example: fetch from API or calculate based on other fields
  return [
    { label: 'Option 1', value: 'opt1' },
    { label: 'Option 2', value: 'opt2' },
  ];
}`,
    schema: `/**
 * Generate dynamic schema
 * @param {object} params - Parameters object
 * @param {object} params.formData - Current form values
 * @param {object} params.context - Linkage context
 * @param {object} params.helpers - Helper utilities (ofetch, lodash, zod, etc.)
 * @returns {object} - JSON Schema object
 */
async function({ formData, context, helpers }) {
  return {
    type: 'string',
    title: 'Dynamic Field',
  };
}`,
  }
  return examples[linkageType]
}

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
    if (!value) return 'static'
    // 如果有 function 字段（即使是空字符串），则为 dynamic 模式
    if ('function' in value) return 'dynamic'
    // 否则为 static 模式
    return 'static'
  }

  const [configMode, setConfigMode] = useState<ConfigMode>(getCurrentMode)

  // 当 value 变化时同步状态
  useEffect(() => {
    setConfigMode(getCurrentMode())
  }, [value])

  const handleClear = () => {
    onChange(undefined)
  }

  const handleAdd = () => {
    // 默认添加为 static 模式
    if (['visibility', 'disabled', 'readonly'].includes(linkageType)) {
      const stateKey = linkageType === 'visibility' ? 'visible' : linkageType
      onChange({
        state: {
          [stateKey]: isFulfill,
        },
      })
    } else if (linkageType === 'value') {
      onChange({ value: '' })
    } else if (linkageType === 'options') {
      onChange({ options: [] })
    } else if (linkageType === 'schema') {
      onChange({ schema: {} })
    }
  }

  const handleModeChange = (newMode: ConfigMode) => {
    setConfigMode(newMode)

    if (newMode === 'dynamic') {
      // 切换到 dynamic 模式：移除静态字段，添加空的 function
      const newValue: LinkageEffect = { function: '' }
      onChange(newValue)
    } else {
      // 切换到 static 模式：移除 function，设置默认静态值
      const newValue: LinkageEffect = {}

      if (['visibility', 'disabled', 'readonly'].includes(linkageType)) {
        const stateKey = linkageType === 'visibility' ? 'visible' : linkageType
        newValue.state = {
          [stateKey]: isFulfill,
        }
      } else if (linkageType === 'value') {
        newValue.value = ''
      } else if (linkageType === 'options') {
        newValue.options = []
      } else if (linkageType === 'schema') {
        newValue.schema = {}
      }
      onChange(newValue)
    }
  }

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
    )
  }

  return (
    <Card
      elevation={Elevation.ONE}
      className="effect-editor"
      style={{ padding: 12 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
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
        <Select
          value={configMode}
          onChange={(value) => handleModeChange(value as ConfigMode)}
          disabled={disabled}
          options={[
            { label: 'Dynamic (Use Function)', value: 'dynamic' },
            { label: 'Static (Fixed Value)', value: 'static' },
          ]}
        />
      </FormGroup>

      {/* Dynamic 模式配置 */}
      {configMode === 'dynamic' && (
        <DynamicModeConfig
          linkageType={linkageType}
          value={value}
          onChange={onChange}
          disabled={disabled}
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
  )
}

// Dynamic 模式配置组件
interface DynamicModeConfigProps {
  linkageType: LinkageType
  value: LinkageEffect
  onChange: (value: LinkageEffect) => void
  disabled?: boolean
}

const DynamicModeConfig: React.FC<DynamicModeConfigProps> = ({
  linkageType,
  value,
  onChange,
  disabled,
}) => {
  const handleFunctionRefChange = (
    functionRef: string | { type: 'script'; code: string } | undefined
  ) => {
    if (!functionRef) {
      onChange({ ...value, function: '' })
      return
    }
    onChange({ ...value, function: functionRef })
  }

  return (
    <FunctionRefEditor
      value={value.function}
      onChange={handleFunctionRefChange}
      disabled={disabled}
      modeLabel="Function Type"
      functionNameLabel="Function Name"
      functionNameHelperText="Function from DynamicForm linkageFunctions prop. Signature: ({ formData, context, helpers }) => result."
      functionNamePlaceholder="e.g., calculateDynamic"
      scriptLabel="Linkage Function Script"
      scriptHelperText="Complete JavaScript function receiving { formData, context, helpers }. Return the calculated result."
      scriptTemplate={getDefaultScriptTemplate(linkageType)}
      previewLines={6}
    />
  )
}

// Static 模式配置组件
interface StaticModeConfigProps {
  linkageType: LinkageType
  value: LinkageEffect
  onChange: (value: LinkageEffect) => void
  disabled?: boolean
  isFulfill: boolean
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
    })
  }

  const handleValueChange = (val: string) => {
    onChange({
      ...value,
      value: val,
    })
  }

  const handleOptionsChange = (options: unknown) => {
    onChange({
      ...value,
      options: options as Array<{ label: string; value: any }>,
    })
  }

  const handleSchemaChange = (schema: unknown) => {
    onChange({
      ...value,
      schema,
    })
  }

  // visibility/disabled/readonly 类型
  if (['visibility', 'disabled', 'readonly'].includes(linkageType)) {
    const stateKey = linkageType === 'visibility' ? 'visible' : linkageType
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
    )
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
    )
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
    )
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
    )
  }

  return null
}
