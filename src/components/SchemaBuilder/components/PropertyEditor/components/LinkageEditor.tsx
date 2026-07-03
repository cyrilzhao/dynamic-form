import React, { useState } from 'react'
import {
  FormGroup,
  HTMLSelect,
  Button,
  Callout,
  Tag,
  Divider,
  Switch,
  Tooltip,
  Icon,
} from '@blueprintjs/core'
import type {
  LinkageConfig,
  LinkageType,
  ConditionExpression,
  LinkageEffect,
} from '../../../../DynamicForm/types/linkage'
import type { ExtendedJSONSchema } from '../../../../DynamicForm/types/schema'
import { ConditionEditor } from './ConditionEditor'
import { EffectEditor } from './EffectEditor'
import { FieldPathSelector } from './FieldPathSelector'
import './LinkageEditor.scss'

interface LinkageEditorProps {
  value: LinkageConfig
  onChange: (value: LinkageConfig) => void
  currentFieldPath: string
  schema: ExtendedJSONSchema
  disabled?: boolean
  onSave: (value: LinkageConfig) => void
  onCancel: () => void
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
  onSave,
  onCancel,
}) => {
  const [errors, setErrors] = useState<{
    dependencies?: string
    fulfill?: string
  }>({})

  // 联动类型选项
  const linkageTypeOptions: Array<{ label: string; value: LinkageType }> = [
    { label: 'Visibility (Show/Hide)', value: 'visibility' },
    { label: 'Disabled (Enable/Disable)', value: 'disabled' },
    { label: 'Readonly', value: 'readonly' },
    { label: 'Value (Auto Calculate)', value: 'value' },
    { label: 'Options (Dynamic Options)', value: 'options' },
    { label: 'Schema (Dynamic Schema)', value: 'schema' },
  ]

  const validateLinkage = (): boolean => {
    const newErrors: { dependencies?: string; fulfill?: string } = {}

    // 校验 dependencies
    const validDeps = value.dependencies.filter((d) => d.trim())
    if (validDeps.length === 0) {
      newErrors.dependencies = 'At least one dependency is required'
    }

    // 校验 fulfill
    if (!value.fulfill) {
      newErrors.fulfill = 'Fulfill effect is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (validateLinkage()) {
      onSave(value)
    }
  }

  const handleTypeChange = (type: LinkageType) => {
    // 切换类型时重置 fulfill 和 otherwise
    onChange({
      ...value,
      type,
      fulfill: undefined,
      otherwise: undefined,
    })
    // 清除 fulfill 错误
    if (errors.fulfill) {
      setErrors({ ...errors, fulfill: undefined })
    }
  }

  const handleAddDependency = () => {
    onChange({
      ...value,
      dependencies: [...value.dependencies, ''],
    })
  }

  const handleDependencyChange = (index: number, newValue: string) => {
    const newDeps = [...value.dependencies]
    newDeps[index] = newValue
    onChange({
      ...value,
      dependencies: newDeps,
    })
    // 清除 dependencies 错误
    if (errors.dependencies && newValue.trim()) {
      setErrors({ ...errors, dependencies: undefined })
    }
  }

  const handleRemoveDependency = (index: number) => {
    const newDeps = value.dependencies.filter((_, i) => i !== index)
    onChange({
      ...value,
      dependencies: newDeps,
    })
  }

  const handleConditionChange = (
    condition: ConditionExpression | undefined
  ) => {
    onChange({
      ...value,
      when: condition,
    })
  }

  const handleFulfillChange = (effect: LinkageEffect | undefined) => {
    onChange({
      ...value,
      fulfill: effect,
    })
    // 清除 fulfill 错误
    if (errors.fulfill && effect) {
      setErrors({ ...errors, fulfill: undefined })
    }
  }

  const handleOtherwiseChange = (effect: LinkageEffect | undefined) => {
    onChange({
      ...value,
      otherwise: effect,
    })
  }

  const handleEnableCacheChange = (enableCache: boolean) => {
    onChange({
      ...value,
      enableCache,
    })
  }

  // 所有联动类型都可以使用 function，因此都可能需要缓存优化
  const showEnableCacheOption = true

  return (
    <div className="linkage-editor">
      {/* 联动类型 */}
      <FormGroup
        label={
          <span style={{ display: 'flex', gap: '4px' }}>
            Linkage Type{' '}
            <Tooltip
              content={
                <div style={{ maxWidth: 300 }}>
                  <p style={{ marginBottom: 8, fontWeight: 'bold' }}>
                    What should this linkage control?
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>
                      <strong>Visibility:</strong> Show or hide the target field
                      based on conditions
                    </li>
                    <li>
                      <strong>Disabled:</strong> Enable or disable the target
                      field
                    </li>
                    <li>
                      <strong>Readonly:</strong> Make the target field readonly
                      or editable
                    </li>
                    <li>
                      <strong>Value:</strong> Automatically calculate and set
                      field value (async function supported)
                    </li>
                    <li>
                      <strong>Options:</strong> Dynamically update
                      dropdown/select options (async function supported)
                    </li>
                    <li>
                      <strong>Schema:</strong> Dynamically change field schema
                      (async function supported)
                    </li>
                  </ul>
                </div>
              }
              placement="right"
            >
              <Icon
                icon="info-sign"
                size={12}
                style={{
                  display: 'block',
                  color: '#5c7080',
                }}
              />
            </Tooltip>
          </span>
        }
      >
        <HTMLSelect
          value={value.type || 'visibility'}
          onChange={(e) => handleTypeChange(e.target.value as LinkageType)}
          disabled={disabled}
          fill
        >
          {linkageTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </HTMLSelect>
      </FormGroup>

      {/* 依赖字段 */}
      <FormGroup
        label={
          <span style={{ display: 'flex', gap: '4px' }}>
            Dependencies <span style={{ color: '#c23030' }}>*</span>{' '}
            <Tooltip
              content={
                <div style={{ maxWidth: 300 }}>
                  <p style={{ marginBottom: 8, fontWeight: 'bold' }}>
                    Fields that this linkage depends on
                  </p>
                  <p style={{ margin: 0 }}>
                    When any of these dependency fields change, the linkage will
                    re-evaluate conditions and apply effects. Select at least
                    one field that this linkage should watch for changes.
                  </p>
                </div>
              }
              placement="right"
            >
              <Icon
                icon="info-sign"
                size={12}
                style={{
                  display: 'block',
                  color: '#5c7080',
                }}
              />
            </Tooltip>
          </span>
        }
        intent={errors.dependencies ? 'danger' : 'none'}
      >
        {value.dependencies.map((dep, index) => (
          <div key={index} className="dependency-item">
            <FieldPathSelector
              schema={schema}
              currentFieldPath={currentFieldPath}
              value={dep}
              onChange={(newValue) => handleDependencyChange(index, newValue)}
              disabled={disabled}
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
        {errors.dependencies && (
          <div style={{ color: '#c23030', fontSize: 12, marginTop: 4 }}>
            {errors.dependencies}
          </div>
        )}
        <Button
          text="Add Dependency"
          icon="add"
          small
          onClick={handleAddDependency}
          disabled={disabled}
        />
      </FormGroup>

      <Divider style={{ margin: '16px 0' }} />

      {/* 条件配置 */}
      <FormGroup
        label={
          <span style={{ display: 'flex', gap: '4px' }}>
            Condition (When){' '}
            <Tooltip
              content={
                <div style={{ maxWidth: 300 }}>
                  <p style={{ marginBottom: 8, fontWeight: 'bold' }}>
                    Define when this linkage should be triggered
                  </p>
                  <p style={{ margin: 0 }}>
                    Set up conditions using dependency field values. When
                    conditions are met, the "Fulfill" effect will be applied.
                    When conditions are not met, the "Otherwise" effect will be
                    applied (if configured).
                  </p>
                  <p
                    style={{
                      marginTop: 8,
                      marginBottom: 0,
                      fontStyle: 'italic',
                    }}
                  >
                    <strong>Default behavior:</strong> If no condition is set,
                    the "Fulfill" effect will always be applied whenever
                    dependency fields change.
                  </p>
                </div>
              }
              placement="right"
            >
              <Icon
                icon="info-sign"
                size={12}
                style={{
                  display: 'block',
                  color: '#5c7080',
                }}
              />
            </Tooltip>
          </span>
        }
      >
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
      <FormGroup
        label={
          <span style={{ display: 'flex', gap: '4px' }}>
            Effect (Fulfill) <span style={{ color: '#c23030' }}>*</span>{' '}
            <Tooltip
              content={
                <div style={{ maxWidth: 300 }}>
                  <p style={{ marginBottom: 8, fontWeight: 'bold' }}>
                    What happens when the condition is met
                  </p>
                  <p style={{ margin: 0 }}>
                    Define the action to take when conditions are satisfied (or
                    immediately if no condition is set). For example: show the
                    field, set a specific value, or load dynamic options.
                  </p>
                </div>
              }
              placement="right"
            >
              <Icon
                icon="info-sign"
                size={12}
                style={{
                  display: 'block',
                  color: '#5c7080',
                }}
              />
            </Tooltip>
          </span>
        }
        intent={errors.fulfill ? 'danger' : 'none'}
      >
        <EffectEditor
          value={value.fulfill}
          onChange={handleFulfillChange}
          linkageType={value.type || 'visibility'}
          disabled={disabled}
          label="Fulfill Effect"
          isFulfill={true}
        />
        {errors.fulfill && (
          <div style={{ color: '#c23030', fontSize: 12, marginTop: 4 }}>
            {errors.fulfill}
          </div>
        )}
      </FormGroup>

      <Divider style={{ margin: '16px 0' }} />

      {/* Otherwise 效果 */}
      <FormGroup
        label={
          <span style={{ display: 'flex', gap: '4px' }}>
            Effect (Otherwise){' '}
            <Tooltip
              content={
                <div style={{ maxWidth: 300 }}>
                  <p style={{ marginBottom: 8, fontWeight: 'bold' }}>
                    What happens when the condition is NOT met
                  </p>
                  <p style={{ margin: 0 }}>
                    Define the alternative action when conditions are not
                    satisfied. For example: hide the field, clear its value, or
                    show different options.
                  </p>
                  <p
                    style={{
                      marginTop: 8,
                      marginBottom: 0,
                      fontStyle: 'italic',
                    }}
                  >
                    <strong>Optional:</strong> If not configured, no action will
                    be taken when conditions fail. The field will maintain its
                    current state.
                  </p>
                </div>
              }
              placement="right"
            >
              <Icon
                icon="info-sign"
                size={12}
                style={{
                  display: 'block',
                  color: '#5c7080',
                }}
              />
            </Tooltip>
          </span>
        }
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
          <FormGroup label="Advanced Options">
            <Switch
              style={{ display: 'flex', alignItems: 'center' }}
              labelElement={
                <span
                  style={{ display: 'flex', gap: '4px', alignItems: 'center' }}
                >
                  Enable Cache{' '}
                  <Tooltip
                    content={
                      <div style={{ maxWidth: 300 }}>
                        <p style={{ marginBottom: 8, fontWeight: 'bold' }}>
                          Configure caching for async linkage operations
                        </p>
                        <p style={{ margin: 0 }}>
                          When enabled, results from async functions (Value,
                          Options, Schema linkage types) will be cached based on
                          input parameters. This avoids redundant requests when
                          the same inputs produce the same outputs.
                        </p>
                        <p
                          style={{
                            marginTop: 8,
                            marginBottom: 0,
                            fontStyle: 'italic',
                          }}
                        >
                          <strong>Recommendation:</strong> Enable this for
                          stable data sources (like configuration APIs). Disable
                          for frequently changing data.
                        </p>
                      </div>
                    }
                    placement="right"
                  >
                    <Icon
                      icon="info-sign"
                      size={12}
                      style={{
                        display: 'block',
                        color: '#5c7080',
                      }}
                    />
                  </Tooltip>
                </span>
              }
              checked={!!value.enableCache}
              onChange={(e) => handleEnableCacheChange(e.currentTarget.checked)}
              disabled={disabled}
            />
          </FormGroup>
        </>
      )}

      {/* Save/Cancel 按钮 */}
      <Divider style={{ margin: '16px 0' }} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button text="Cancel" onClick={onCancel} disabled={disabled} />
        <Button
          text="Save"
          intent="primary"
          onClick={handleSave}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
