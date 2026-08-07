import React, { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import {
  Tabs,
  Tab,
  FormGroup,
  InputGroup,
  TextArea,
  NumericInput,
  Switch,
  Callout,
  Divider,
  Button,
  Tag,
  Tooltip,
  Icon,
} from '@blueprintjs/core'
import { Select } from '../../../Select'
import { get } from 'lodash'
import { useSchemaBuilder } from '../../SchemaBuilder'
import type { SchemaNodeType } from '../../types'
import { SchemaValidationEditor } from './components/SchemaValidationEditor'
import { FieldValidatorsEditor } from './components/FieldValidatorsEditor'
import { LinkagesEditor } from './components/LinkagesEditor'
import { TransformEditor } from './components/TransformEditor'
import { CallbackPropsEditor } from './components/CallbackPropsEditor'
import { ObjectEditor } from '../../../ObjectEditor'

// Helper to get node from path
const getNode = (schema: any, path: string[]) => {
  if (path.length === 0) return schema
  return get(schema, path)
}

interface FieldHelpLabelParams {
  label: string
  title: string
  description: string
  reasons?: string[]
}

const renderLabelWithTooltip = ({
  label,
  title,
  description,
  reasons,
}: FieldHelpLabelParams) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    {label}{' '}
    <Tooltip
      content={
        <div style={{ maxWidth: 340 }}>
          <p style={{ marginBottom: 8, fontWeight: 'bold' }}>{title}</p>
          <p style={{ marginBottom: reasons?.length ? 8 : 0 }}>{description}</p>
          {reasons?.length ? (
            <>
              <p style={{ marginBottom: 6, fontWeight: 'bold' }}>
                Why configure it?
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : null}
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
)

const renderSwitchLabelWithTooltip = ({
  label,
  title,
  description,
  reasons,
}: FieldHelpLabelParams) => (
  <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
    {label}{' '}
    <Tooltip
      content={
        <div style={{ maxWidth: 340 }}>
          <p style={{ marginBottom: 8, fontWeight: 'bold' }}>{title}</p>
          <p style={{ marginBottom: reasons?.length ? 8 : 0 }}>{description}</p>
          {reasons?.length ? (
            <>
              <p style={{ marginBottom: 6, fontWeight: 'bold' }}>
                Why configure it?
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          ) : null}
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
)

const createEditorFormDefaults = ({
  currentKey,
  currentNode,
}: {
  currentKey?: string
  currentNode: any
}) => ({
  key: currentKey,
  ...currentNode,
  ui: {
    widget: '',
    widgetProps: undefined,
    callbackProps: undefined,
    placeholder: '',
    hidden: false,
    disabled: false,
    readonly: false,
    layout: '',
    labelWidth: '',
    colSpan: 1,
    columnsCount: 1,
    flattenPath: false,
    flattenPrefix: false,
    arrayMode: 'dynamic',
    addButtonText: '',
    transform: undefined,
    validators: undefined,
    linkages: undefined,
    ...currentNode?.ui,
    validation: currentNode?.ui?.validation || {},
    errorMessages: currentNode?.ui?.errorMessages || {},
  },
})

const ConfigSection = ({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) => (
  <section className="ui-config-section">
    <div className="ui-config-section-header">
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
    <div className="ui-config-section-content">{children}</div>
  </section>
)

const getDefaultWidget = (schema: any): string => {
  if (schema?.type === 'string') {
    if (schema.format === 'email') return 'email'
    if (schema.format === 'date') return 'date'
    if (schema.format === 'date-time') return 'datetime'
    if (schema.format === 'time') return 'time'
    if (schema.enum) return 'select'
    if (schema.maxLength && schema.maxLength > 100) return 'textarea'
    return 'text'
  }

  if (schema?.type === 'number' || schema?.type === 'integer') {
    return 'number'
  }

  if (schema?.type === 'boolean') {
    return 'checkbox'
  }

  if (schema?.type === 'array') {
    return 'array'
  }

  if (schema?.type === 'object') {
    return 'nested-form'
  }

  return 'text'
}

export const PropertyEditor: React.FC = () => {
  const { schema, selectedPath, onUpdate } = useSchemaBuilder()
  const currentNode = getNode(schema, selectedPath)

  // 将 selectedPath 数组转换为 JSON Pointer 格式
  // ['properties', 'field1', 'properties', 'field2'] -> '#/properties/field1/properties/field2'
  const currentFieldPath =
    selectedPath.length > 0 ? `#/${selectedPath.join('/')}` : ''

  // Determine if it's a root node
  const isRoot = selectedPath.length === 0

  // Determine if it's an object property (to allow renaming key)
  // path: ['properties', 'field1'] -> yes
  // path: ['items'] -> no
  const isObjectProperty =
    selectedPath.length > 0 &&
    selectedPath[selectedPath.length - 2] === 'properties'
  const currentKey = isObjectProperty
    ? selectedPath[selectedPath.length - 1]
    : undefined

  // Determine if it's an array items node
  const parentPath = selectedPath.slice(0, -1)
  const parentNode = getNode(schema, parentPath)
  const isArrayItems =
    selectedPath.length > 0 &&
    selectedPath[selectedPath.length - 1] === 'items' &&
    parentNode?.type === 'array'

  // Determine if it's a schema-level node (only root)
  // 只有根节点应该只显示条件验证配置
  // 其他节点（包括 object 类型）都应该显示完整的字段配置
  const isSchemaLevelNode = isRoot

  const [selectedTabId, setSelectedTabId] = useState(
    isSchemaLevelNode ? 'validation' : 'basic'
  )
  const [keyInput, setKeyInput] = useState(currentKey || '')
  const [keyError, setKeyError] = useState('')

  const { control, reset, watch, setValue } = useForm({
    defaultValues: createEditorFormDefaults({ currentKey, currentNode }),
    mode: 'onBlur',
  })

  // Watch for changes to update schema
  useEffect(() => {
    if (currentNode) {
      reset(createEditorFormDefaults({ currentKey, currentNode }))
      setKeyInput(currentKey || '')
      setKeyError('')
    }
  }, [currentNode, currentKey, reset])

  useEffect(() => {
    // 根据节点类型设置默认 tab
    setSelectedTabId(isSchemaLevelNode ? 'validation' : 'basic')
  }, [currentKey, isSchemaLevelNode])

  if (!currentNode) {
    return (
      <div className="property-editor-empty">
        <Callout intent="primary">
          Select a node from the tree to edit properties.
        </Callout>
      </div>
    )
  }

  const handleFieldChange = (field: string, value: any) => {
    onUpdate(selectedPath, { [field]: value })
  }

  const handleUIChange = (field: string, value: any) => {
    onUpdate(selectedPath, { ui: { ...currentNode.ui, [field]: value } })
  }

  const handleKeyChange = (e: React.FocusEvent<HTMLInputElement>) => {
    const newKey = e.target.value.trim()

    // 验证：不能为空
    if (!newKey) {
      setKeyError('Field name cannot be empty')
      setKeyInput(currentKey || '')
      return
    }

    // 验证：不能与其他字段重复
    if (newKey !== currentKey) {
      const propertiesPath = selectedPath.slice(0, -1)
      const propertiesNode = get(schema, propertiesPath)
      if (propertiesNode && propertiesNode[newKey]) {
        setKeyError(`Field name "${newKey}" already exists`)
        setKeyInput(currentKey || '')
        return
      }

      setKeyError('')
      onUpdate(selectedPath, {}, newKey)
    }
  }

  const renderDefaultValueInput = (field: any) => {
    if (currentType === 'boolean') {
      return (
        <Switch
          checked={!!field.value}
          disabled={isArrayItems}
          onChange={(e) => {
            field.onChange(e.currentTarget.checked)
            handleFieldChange('default', e.currentTarget.checked)
          }}
        />
      )
    }
    if (currentType === 'integer') {
      return (
        <input
          key="default-integer"
          type="text"
          className="bp6-input"
          style={{ width: '100%' }}
          defaultValue={field.value ?? ''}
          disabled={isArrayItems}
          onKeyDown={(e) => {
            if (
              ![
                '-',
                'Backspace',
                'Delete',
                'ArrowLeft',
                'ArrowRight',
                'Tab',
              ].includes(e.key) &&
              !/^\d$/.test(e.key)
            ) {
              e.preventDefault()
            }
          }}
          onBlur={(e) => {
            const v =
              e.target.value === '' ? undefined : parseInt(e.target.value, 10)
            field.onChange(v)
            handleFieldChange('default', v)
          }}
        />
      )
    }
    if (currentType === 'number') {
      return (
        <input
          key="default-number"
          type="text"
          className="bp6-input"
          style={{ width: '100%' }}
          defaultValue={field.value ?? ''}
          disabled={isArrayItems}
          onKeyDown={(e) => {
            if (e.key === '.' && e.currentTarget.value.includes('.')) {
              e.preventDefault()
              return
            }
            if (
              ![
                '-',
                '.',
                'Backspace',
                'Delete',
                'ArrowLeft',
                'ArrowRight',
                'Tab',
              ].includes(e.key) &&
              !/^\d$/.test(e.key)
            ) {
              e.preventDefault()
            }
          }}
          onBlur={(e) => {
            const v =
              e.target.value === '' ? undefined : parseFloat(e.target.value)
            field.onChange(v)
            handleFieldChange('default', v)
          }}
        />
      )
    }
    return (
      <InputGroup
        {...field}
        value={field.value || ''}
        disabled={isArrayItems}
        onChange={(e) => {
          field.onChange(e)
          handleFieldChange('default', e.target.value)
        }}
      />
    )
  }

  const typeOptions = [
    { label: 'String', value: 'string' },
    { label: 'Number', value: 'number' },
    { label: 'Integer', value: 'integer' },
    { label: 'Boolean', value: 'boolean' },
    { label: 'Object', value: 'object' },
    { label: 'Array', value: 'array' },
  ]

  const widgetOptions = {
    string: [
      'textarea',
      'password',
      'email',
      'url',
      'select',
      'radio',
      'checkbox',
    ],
    number: [],
    integer: [],
    boolean: ['checkbox', 'radio'],
    array: ['key-value-array', 'table-array', 'select', 'radio'],
    object: [],
  }

  const currentType = watch('type') as SchemaNodeType
  const currentWidgetOptions = (widgetOptions[currentType] || []).map(
    (widget) => ({
      label:
        widget.charAt(0).toUpperCase() + widget.slice(1).replace(/-/g, ' '),
      value: widget,
    })
  )
  const showWidgetConfig = currentWidgetOptions.length > 0
  const defaultWidget = getDefaultWidget(currentNode)

  return (
    <div className="property-editor">
      {isSchemaLevelNode ? (
        // Schema 层级节点:只显示条件验证配置
        <div className="editor-panel">
          <Callout
            intent="primary"
            icon="info-sign"
            style={{ marginBottom: 16 }}
          >
            <strong>Schema-Level Configuration</strong>
            <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
              Configure conditional validation rules for this schema level.
              These rules apply to the fields within this object.
            </p>
          </Callout>

          <FormGroup
            label={renderLabelWithTooltip({
              label: 'Columns Count',
              title: 'Form layout column count',
              description:
                'Controls how many columns this schema level uses when laying out child fields.',
              reasons: [
                'Use it to make long forms easier to scan by grouping fields across columns.',
                'It defines the grid that field-level Column Span values can use.',
              ],
            })}
            helperText="Number of columns for the form layout (default: 1)"
            style={{ marginBottom: 16 }}
          >
            <Controller
              name="ui.columnsCount"
              control={control}
              render={({ field }) => (
                <NumericInput
                  {...field}
                  value={field.value ?? 1}
                  onValueChange={(value) =>
                    handleUIChange('columnsCount', value)
                  }
                  min={1}
                  max={12}
                  fill
                />
              )}
            />
          </FormGroup>

          <Divider style={{ marginBottom: 16 }} />

          <SchemaValidationEditor
            schema={schema}
            currentFieldPath={currentFieldPath}
            parentSchema={schema}
            value={{
              dependencies: currentNode.dependencies,
              if: currentNode.if,
              then: currentNode.then,
              else: currentNode.else,
              allOf: currentNode.allOf,
              anyOf: currentNode.anyOf,
              oneOf: currentNode.oneOf,
            }}
            onChange={(validationConfig) => {
              // 更新条件验证配置
              const updates: any = {}

              // dependencies - 使用 'in' 操作符检查键是否存在
              if ('dependencies' in validationConfig) {
                updates.dependencies = validationConfig.dependencies
              }

              // if/then/else - 需要检查是否存在于 validationConfig 中
              if ('if' in validationConfig) {
                updates.if = validationConfig.if
                updates.then = validationConfig.then
                updates.else = validationConfig.else
              }

              // allOf
              if ('allOf' in validationConfig) {
                updates.allOf = validationConfig.allOf
              }

              // anyOf
              if ('anyOf' in validationConfig) {
                updates.anyOf = validationConfig.anyOf
              }

              // oneOf
              if ('oneOf' in validationConfig) {
                updates.oneOf = validationConfig.oneOf
              }

              onUpdate(selectedPath, updates)
            }}
            disabled={false}
          />
        </div>
      ) : (
        // 字段级别节点:显示完整的配置标签页
        <Tabs
          selectedTabId={selectedTabId}
          id="property-editor-tabs"
          onChange={(newTabId) => setSelectedTabId(newTabId.toString())}
        >
          <Tab
            id="basic"
            title="Basic"
            panel={
              <div className="editor-panel">
                {isObjectProperty && (
                  <FormGroup
                    label="Name"
                    helperText={keyError || 'Unique identifier for this field'}
                    intent={keyError ? 'danger' : 'none'}
                  >
                    <InputGroup
                      value={keyInput}
                      intent={keyError ? 'danger' : 'none'}
                      onChange={(e) => setKeyInput(e.target.value)}
                      onBlur={handleKeyChange}
                    />
                  </FormGroup>
                )}

                <FormGroup label="Label">
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <InputGroup
                        {...field}
                        // disabled={isArrayItems}
                        onChange={(e) => {
                          field.onChange(e)
                          handleFieldChange('title', e.target.value)
                        }}
                      />
                    )}
                  />
                </FormGroup>

                <FormGroup label="Description">
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => {
                      return (
                        <TextArea
                          {...field}
                          fill
                          disabled={isArrayItems}
                          onChange={(e) => {
                            field.onChange(e)
                            handleFieldChange('description', e.target.value)
                          }}
                        />
                      )
                    }}
                  />
                </FormGroup>

                <FormGroup label="Type">
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ''}
                        onChange={(value) => {
                          field.onChange(value)
                          handleFieldChange('type', value)
                          setValue('default', undefined)
                          handleFieldChange('default', undefined)
                        }}
                        options={typeOptions}
                        disabled={isRoot || isArrayItems}
                      />
                    )}
                  />
                </FormGroup>

                <Controller
                  name="default"
                  control={control}
                  render={({ field }) => (
                    <FormGroup label="Default Value">
                      {renderDefaultValueInput(field)}
                    </FormGroup>
                  )}
                />

                {isObjectProperty && (
                  <Switch
                    style={{ marginBottom: '16px' }}
                    label="Required"
                    checked={(() => {
                      const parentPath = selectedPath.slice(0, -2)
                      const parentNode =
                        parentPath.length === 0
                          ? schema
                          : get(schema, parentPath)
                      return parentNode?.required?.includes(currentKey) || false
                    })()}
                    disabled={isArrayItems}
                    onChange={(e) => {
                      const isRequired = e.currentTarget.checked
                      const parentPath = selectedPath.slice(0, -2)
                      const parentNode =
                        parentPath.length === 0
                          ? schema
                          : get(schema, parentPath)

                      if (parentNode) {
                        const currentRequired = parentNode.required || []
                        const newRequired = isRequired
                          ? [...currentRequired, currentKey]
                          : currentRequired.filter((k) => k !== currentKey)

                        onUpdate(parentPath, {
                          required:
                            newRequired.length > 0 ? newRequired : undefined,
                        })
                      }
                    }}
                  />
                )}

                {currentType === 'string' && (
                  <>
                    <FormGroup
                      label="Options (enum)"
                      helperText="Define allowed values. Used by radio, select, checkbox-group widgets."
                    >
                      {(() => {
                        const enumValues: any[] = currentNode.enum || []
                        const enumNames: string[] = currentNode.enumNames || []

                        const handleAddOption = () => {
                          onUpdate(selectedPath, {
                            enum: [...enumValues, ''],
                            enumNames: [...enumNames, ''],
                          })
                        }

                        const handleRemoveOption = (index: number) => {
                          const newEnum = enumValues.filter(
                            (_: any, i: number) => i !== index
                          )
                          const newEnumNames = enumNames.filter(
                            (_: any, i: number) => i !== index
                          )
                          onUpdate(selectedPath, {
                            enum: newEnum.length > 0 ? newEnum : undefined,
                            enumNames:
                              newEnumNames.length > 0
                                ? newEnumNames
                                : undefined,
                          })
                        }

                        const handleUpdateValue = (
                          index: number,
                          value: string
                        ) => {
                          const newEnum = [...enumValues]
                          newEnum[index] = value
                          onUpdate(selectedPath, { enum: newEnum })
                        }

                        const handleUpdateLabel = (
                          index: number,
                          label: string
                        ) => {
                          const newEnumNames = [...enumNames]
                          newEnumNames[index] = label
                          onUpdate(selectedPath, { enumNames: newEnumNames })
                        }

                        return (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}
                          >
                            {enumValues.length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                <span
                                  style={{
                                    flex: 1,
                                    fontSize: '12px',
                                    color: '#5c7080',
                                    fontWeight: 500,
                                  }}
                                >
                                  Value
                                </span>
                                <span
                                  style={{
                                    flex: 1,
                                    fontSize: '12px',
                                    color: '#5c7080',
                                    fontWeight: 500,
                                  }}
                                >
                                  Label
                                </span>
                                <span style={{ width: 24 }} />
                              </div>
                            )}
                            {enumValues.map((value: any, index: number) => (
                              <div
                                key={index}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <InputGroup
                                    value={String(value)}
                                    onChange={(e) =>
                                      handleUpdateValue(index, e.target.value)
                                    }
                                    fill
                                  />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <InputGroup
                                    placeholder="Display text"
                                    value={enumNames[index] || ''}
                                    onChange={(e) =>
                                      handleUpdateLabel(index, e.target.value)
                                    }
                                    fill
                                  />
                                </div>
                                <Button
                                  icon="cross"
                                  minimal
                                  small
                                  onClick={() => handleRemoveOption(index)}
                                />
                              </div>
                            ))}
                            <Button
                              icon="add"
                              text="Add Option"
                              minimal
                              onClick={handleAddOption}
                            />
                          </div>
                        )
                      })()}
                    </FormGroup>
                  </>
                )}
              </div>
            }
          />

          <Tab
            id="validation"
            title="Validation"
            panel={
              <div className="editor-panel validation-panel">
                <div className="ui-config-sections">
                  {currentType === 'string' && (
                    <ConfigSection
                      title="String Constraints"
                      description="Configure text length, format, and pattern rules."
                    >
                      <FormGroup label="Min Length">
                        <Controller
                          name="minLength"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('minLength', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Min Length Error Message">
                        <Controller
                          name="ui.errorMessages.minLength"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for minLength"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  minLength: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Max Length">
                        <Controller
                          name="maxLength"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('maxLength', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Max Length Error Message">
                        <Controller
                          name="ui.errorMessages.maxLength"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for maxLength"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  maxLength: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Pattern (Regex)">
                        <Controller
                          name="pattern"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                handleFieldChange('pattern', e.target.value)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Pattern Error Message">
                        <Controller
                          name="ui.errorMessages.pattern"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for pattern"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  pattern: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Format">
                        <Controller
                          name="format"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value ?? ''}
                              onChange={(value) => {
                                field.onChange(value)
                                handleFieldChange('format', value)
                              }}
                              options={[
                                { label: '(none)', value: '' },
                                { label: 'email', value: 'email' },
                                { label: 'uri', value: 'uri' },
                                { label: 'date', value: 'date' },
                                { label: 'date-time', value: 'date-time' },
                                { label: 'time', value: 'time' },
                              ]}
                            />
                          )}
                        />
                      </FormGroup>
                    </ConfigSection>
                  )}

                  {(currentType === 'number' || currentType === 'integer') && (
                    <ConfigSection
                      title="Number Constraints"
                      description="Configure numeric range and step validation."
                    >
                      <FormGroup label="Minimum">
                        <Controller
                          name="minimum"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('minimum', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Minimum Error Message">
                        <Controller
                          name="ui.errorMessages.min"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for minimum"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  min: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Maximum">
                        <Controller
                          name="maximum"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('maximum', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Maximum Error Message">
                        <Controller
                          name="ui.errorMessages.max"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="Custom error message for maximum"
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  max: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Multiple Of">
                        <Controller
                          name="multipleOf"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('multipleOf', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                    </ConfigSection>
                  )}

                  {currentType === 'array' && (
                    <ConfigSection
                      title="Array Constraints"
                      description="Control how many items the array can contain and whether values must be unique."
                    >
                      <FormGroup label="Min Items">
                        <Controller
                          name="minItems"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('minItems', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Max Items">
                        <Controller
                          name="maxItems"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('maxItems', v)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                      <Controller
                        name="uniqueItems"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            style={{ display: 'flex', alignItems: 'center' }}
                            labelElement={renderSwitchLabelWithTooltip({
                              label: 'Unique Items',
                              title: 'Prevent duplicate array items',
                              description:
                                'When enabled, the form checks whether the array contains repeated items. If two items have the same content, the user will be asked to remove or change one of them before submitting.',
                              reasons: [
                                'Use it when each item should appear only once, such as tags, permissions, selected products, supported channels, email addresses, or member IDs.',
                                'Keep it off when repeated items are meaningful, such as event logs, order lines, repeated quantities, or any list where the same value can intentionally appear more than once.',
                              ],
                            })}
                            checked={!!field.value}
                            onChange={(e) =>
                              handleFieldChange(
                                'uniqueItems',
                                e.currentTarget.checked
                              )
                            }
                          />
                        )}
                      />
                    </ConfigSection>
                  )}

                  {currentType === 'object' && (
                    <ConfigSection
                      title="Object Constraints"
                      description="Control how many properties an object value can contain."
                    >
                      <FormGroup label="Min Properties">
                        <Controller
                          name="minProperties"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('minProperties', v)
                              }
                              disabled={isArrayItems}
                            />
                          )}
                        />
                      </FormGroup>
                      <FormGroup label="Max Properties">
                        <Controller
                          name="maxProperties"
                          control={control}
                          render={({ field }) => (
                            <NumericInput
                              {...field}
                              value={field.value ?? ''}
                              onValueChange={(v) =>
                                handleFieldChange('maxProperties', v)
                              }
                              disabled={isArrayItems}
                            />
                          )}
                        />
                      </FormGroup>
                    </ConfigSection>
                  )}

                  {/* 以下配置只对叶子节点（非 object 和 array）显示 */}
                  {currentType !== 'object' && currentType !== 'array' && (
                    <ConfigSection
                      title="Required Message"
                      description="Customize the validation message shown when required field input is missing."
                    >
                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Required Error Message',
                          title: 'Required validation message',
                          description:
                            'Custom error message shown when this field is required but the user leaves it empty.',
                          reasons: [
                            'Use business-specific wording so users understand exactly what value is missing.',
                            'A clear required message reduces form submission failures in operational workflows.',
                          ],
                        })}
                      >
                        <Controller
                          name="ui.errorMessages.required"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              placeholder="This field is required"
                              disabled={isArrayItems}
                              onChange={(e) => {
                                field.onChange(e)
                                handleUIChange('errorMessages', {
                                  ...currentNode.ui?.errorMessages,
                                  required: e.target.value,
                                })
                              }}
                            />
                          )}
                        />
                      </FormGroup>
                    </ConfigSection>
                  )}
                  <ConfigSection
                    title="Custom Validators"
                    description="Add field-level business validation that cannot be expressed with basic JSON Schema constraints."
                  >
                    <FieldValidatorsEditor
                      value={currentNode.ui?.validators}
                      onChange={(validators) =>
                        handleUIChange('validators', validators)
                      }
                      disabled={isArrayItems}
                    />
                  </ConfigSection>
                </div>
              </div>
            }
          />

          <Tab
            id="ui"
            title="UI Config"
            panel={
              <div className="editor-panel ui-config-panel">
                <div className="ui-config-sections">
                  <ConfigSection
                    title="Input Guidance"
                    description="Configure how users enter and understand values for this field."
                  >
                    {showWidgetConfig && (
                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Widget',
                          title: 'Field rendering component',
                          description:
                            'Overrides the default widget that DynamicForm would choose from the field type.',
                          reasons: [
                            'Choose a widget that matches the business input pattern, such as textarea for long text or radio for a small fixed choice set.',
                            'This keeps stored schema data stable while changing how users interact with the field.',
                          ],
                        })}
                      >
                        <Controller
                          name="ui.widget"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value ?? ''}
                              onChange={(value) => {
                                field.onChange(value)
                                handleUIChange('widget', value)
                              }}
                              options={[
                                {
                                  label: `Default (${defaultWidget})`,
                                  value: '',
                                },
                                ...currentWidgetOptions,
                              ]}
                              disabled={isArrayItems}
                            />
                          )}
                        />
                      </FormGroup>
                    )}

                    {showWidgetConfig && watch('ui.widget') && (
                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Widget Props',
                          title: 'Widget-specific configuration',
                          description:
                            'Passes plain JSON props directly to the selected widget component.',
                          reasons: [
                            'Use it when a widget needs extra static options, such as accepted file types, editor language, labels, or display limits.',
                            'Keeping these values in schema lets the same widget serve multiple business scenarios without custom code per field.',
                          ],
                        })}
                        helperText="Additional props passed directly to the widget (JSON object)"
                      >
                        <ObjectEditor
                          value={currentNode.ui?.widgetProps}
                          onChange={(val) => handleUIChange('widgetProps', val)}
                          disabled={isArrayItems}
                        />
                      </FormGroup>
                    )}

                    {showWidgetConfig && watch('ui.widget') && (
                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Widget Callback Props',
                          title: 'Widget function props',
                          description:
                            'Passes function props to the selected widget through callback references or trusted inline scripts.',
                          reasons: [
                            'Use it when a widget needs dynamic behavior such as upload handlers, option filtering, or label formatting.',
                            'Keeping function props separate from widgetProps preserves widgetProps as plain JSON configuration.',
                          ],
                        })}
                        helperText="Function props resolved at render time. These override same-named widgetProps."
                      >
                        <Callout
                          intent="primary"
                          icon="info-sign"
                          style={{ marginBottom: 12 }}
                        >
                          Callback props are resolved as functions and override
                          same-named widgetProps.
                        </Callout>
                        <CallbackPropsEditor
                          value={currentNode.ui?.callbackProps}
                          onChange={(val) =>
                            handleUIChange('callbackProps', val)
                          }
                          disabled={isArrayItems}
                        />
                      </FormGroup>
                    )}

                    <FormGroup
                      label={renderLabelWithTooltip({
                        label: 'Placeholder',
                        title: 'Input hint text',
                        description:
                          'Shows short guidance inside an empty input before the user enters a value.',
                        reasons: [
                          'Use it to clarify expected format or examples without changing validation rules.',
                          'Good placeholders reduce support cost for fields with business-specific formats like IDs, emails, or percentages.',
                        ],
                      })}
                    >
                      <Controller
                        name="ui.placeholder"
                        control={control}
                        render={({ field }) => (
                          <InputGroup
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              handleUIChange('placeholder', e.target.value)
                            }
                            disabled={isArrayItems}
                          />
                        )}
                      />
                    </FormGroup>

                    {/* Options 配置 - 仅用于 boolean 类型 */}
                    {currentType === 'boolean' && (
                      <>
                        <FormGroup
                          label={renderLabelWithTooltip({
                            label: 'Boolean Display Labels',
                            title: 'Human-readable true/false labels',
                            description:
                              'Configures the display text for boolean values when rendered as radio or checkbox-style choices.',
                            reasons: [
                              'Use business language such as Approved/Rejected or Enabled/Disabled instead of raw true/false.',
                              'The stored value remains boolean, so downstream logic can stay simple and predictable.',
                            ],
                          })}
                          helperText="Configure display labels for boolean values (used with radio/checkbox widget)"
                        >
                          {(() => {
                            const enumValues = currentNode.enum || []
                            const enumNames = currentNode.enumNames || []
                            const displayEnum = [true, false]

                            const handleUpdateLabel = (
                              index: number,
                              label: string
                            ) => {
                              const newEnumNames = [...enumNames]
                              newEnumNames[index] = label

                              // 同时设置 enum 为 [true, false]
                              onUpdate(selectedPath, {
                                enum: [true, false],
                                enumNames: newEnumNames,
                              })
                            }

                            return (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 12,
                                }}
                              >
                                {displayEnum.map(
                                  (value: any, index: number) => (
                                    <div
                                      key={index}
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 8,
                                        padding: '8px',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px',
                                        backgroundColor: '#f9f9f9',
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontWeight: 500,
                                            minWidth: '50px',
                                            fontSize: '12px',
                                            color: '#5c7080',
                                          }}
                                        >
                                          Value:
                                        </span>
                                        <Tag
                                          intent={value ? 'success' : 'none'}
                                        >
                                          {String(value)}
                                        </Tag>
                                      </div>
                                      <div
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontWeight: 500,
                                            minWidth: '50px',
                                            fontSize: '12px',
                                            color: '#5c7080',
                                          }}
                                        >
                                          Label:
                                        </span>
                                        <InputGroup
                                          placeholder={value ? 'Yes' : 'No'}
                                          value={enumNames[index] || ''}
                                          disabled={isArrayItems}
                                          onChange={(e) =>
                                            handleUpdateLabel(
                                              index,
                                              e.target.value
                                            )
                                          }
                                          style={{ flex: 1 }}
                                        />
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            )
                          })()}
                        </FormGroup>
                      </>
                    )}
                  </ConfigSection>

                  <ConfigSection
                    title="Visibility and State"
                    description="Control whether the field is shown, editable, or review-only by default."
                  >
                    <Controller
                      name="ui.hidden"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          style={{ display: 'flex', alignItems: 'center' }}
                          labelElement={renderSwitchLabelWithTooltip({
                            label: 'Hidden',
                            title: 'Hide this field from the form',
                            description:
                              'Removes the field from the visible UI when it should not be shown by default.',
                            reasons: [
                              'Use it for fields controlled by business rules, internal data, or progressive disclosure.',
                              'Hidden fields are skipped by static validation, which prevents users from being blocked by fields they cannot see.',
                            ],
                          })}
                          checked={!!field.value}
                          onChange={(e) =>
                            handleUIChange('hidden', e.currentTarget.checked)
                          }
                          disabled={isArrayItems}
                        />
                      )}
                    />

                    <Controller
                      name="ui.disabled"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          style={{ display: 'flex', alignItems: 'center' }}
                          labelElement={renderSwitchLabelWithTooltip({
                            label: 'Disabled',
                            title: 'Prevent user input',
                            description:
                              'Shows the field in a disabled state so users can see it but cannot edit it.',
                            reasons: [
                              'Use it for system-managed values, locked workflow states, or fields awaiting another prerequisite.',
                              'Disabled fields communicate context without allowing accidental changes to protected business data.',
                            ],
                          })}
                          checked={!!field.value}
                          onChange={(e) =>
                            handleUIChange('disabled', e.currentTarget.checked)
                          }
                          disabled={isArrayItems}
                        />
                      )}
                    />

                    <Controller
                      name="ui.readonly"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          style={{ display: 'flex', alignItems: 'center' }}
                          labelElement={renderSwitchLabelWithTooltip({
                            label: 'Readonly',
                            title: 'Display value as read-only',
                            description:
                              'Keeps the field visible while making its current value non-editable.',
                            reasons: [
                              'Use it when users need to review calculated, imported, or approved values.',
                              'Readonly is useful when the value should still be part of the form context but edits must happen elsewhere.',
                            ],
                          })}
                          checked={!!field.value}
                          onChange={(e) =>
                            handleUIChange('readonly', e.currentTarget.checked)
                          }
                          disabled={isArrayItems}
                        />
                      )}
                    />
                  </ConfigSection>

                  <ConfigSection
                    title="Layout Rules"
                    description="Tune how this field occupies space in dense or multi-column forms."
                  >
                    <FormGroup
                      label={renderLabelWithTooltip({
                        label: 'Layout',
                        title: 'Field-level layout override',
                        description:
                          'Overrides the global form layout for this field: vertical, horizontal, or inline.',
                        reasons: [
                          'Use vertical layout for longer inputs, horizontal layout for dense enterprise forms, and inline layout for compact controls.',
                          'Field-level overrides let important exceptions fit the business workflow without changing the whole form.',
                        ],
                      })}
                    >
                      <Controller
                        name="ui.layout"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value ?? ''}
                            onChange={(value) => {
                              field.onChange(value)
                              handleUIChange('layout', value)
                            }}
                            options={[
                              { label: '(none)', value: '' },
                              { label: 'vertical', value: 'vertical' },
                              { label: 'horizontal', value: 'horizontal' },
                              { label: 'inline', value: 'inline' },
                            ]}
                            disabled={isArrayItems}
                          />
                        )}
                      />
                    </FormGroup>

                    <FormGroup
                      label={renderLabelWithTooltip({
                        label: 'Label Width',
                        title: 'Label width for horizontal layout',
                        description:
                          'Controls the label area width when this field uses horizontal layout.',
                        reasons: [
                          'Use it to align fields with long business labels and keep inputs starting at a consistent position.',
                          'Consistent label width improves scanability in operational forms with many parameters.',
                        ],
                      })}
                    >
                      <Controller
                        name="ui.labelWidth"
                        control={control}
                        render={({ field }) => (
                          <InputGroup
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              handleUIChange('labelWidth', e.target.value)
                            }
                            disabled={isArrayItems}
                          />
                        )}
                      />
                    </FormGroup>

                    <FormGroup
                      label={renderLabelWithTooltip({
                        label: 'Column Span',
                        title: 'Grid width for this field',
                        description:
                          'Controls how many layout columns this field occupies inside a multi-column form.',
                        reasons: [
                          'Use it to give wide fields like textareas, code editors, or nested objects more room.',
                          'It lets high-priority or complex business fields remain readable in dense layouts.',
                        ],
                      })}
                      helperText="Number of columns this field spans in multi-column layout"
                    >
                      <Controller
                        name="ui.colSpan"
                        control={control}
                        render={({ field }) => (
                          <NumericInput
                            {...field}
                            value={field.value ?? 1}
                            onValueChange={(value) =>
                              handleUIChange('colSpan', value)
                            }
                            min={1}
                            max={12}
                            disabled={isArrayItems}
                            fill
                          />
                        )}
                      />
                    </FormGroup>
                  </ConfigSection>

                  {currentType === 'object' && (
                    <ConfigSection
                      title="Object Flattening"
                      description="Flatten nested object fields when backend structure and user workflow should differ."
                    >
                      <Controller
                        name="ui.flattenPath"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            style={{ display: 'flex', alignItems: 'center' }}
                            labelElement={renderSwitchLabelWithTooltip({
                              label: 'Flatten Path (Transparent)',
                              title: 'Flatten nested fields in the UI',
                              description:
                                'Displays child fields from this object at the parent level while preserving the nested submitted data structure.',
                              reasons: [
                                'Use it to simplify deeply nested configuration forms without losing the API contract.',
                                'It is helpful when nesting exists for backend structure but would make the user workflow harder to read.',
                              ],
                            })}
                            checked={!!field.value}
                            onChange={(e) =>
                              handleUIChange(
                                'flattenPath',
                                e.currentTarget.checked
                              )
                            }
                            disabled={isArrayItems}
                          />
                        )}
                      />

                      <Controller
                        name="ui.flattenPrefix"
                        control={control}
                        render={({ field }) => (
                          <Switch
                            style={{ display: 'flex', alignItems: 'center' }}
                            labelElement={renderSwitchLabelWithTooltip({
                              label: 'Flatten Prefix',
                              title: 'Prefix flattened field labels',
                              description:
                                'Adds the parent title as a label prefix when flattened child fields are displayed.',
                              reasons: [
                                'Use it to preserve business context after flattening removes visible nesting.',
                                'Prefixes prevent similarly named fields from different object groups from becoming ambiguous.',
                              ],
                            })}
                            checked={!!field.value}
                            onChange={(e) =>
                              handleUIChange(
                                'flattenPrefix',
                                e.currentTarget.checked
                              )
                            }
                            disabled={isArrayItems}
                          />
                        )}
                      />
                    </ConfigSection>
                  )}

                  {currentType === 'array' && (
                    <ConfigSection
                      title="Array Behavior"
                      description="Choose how repeated values are edited and how add actions are labeled."
                    >
                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Array Mode',
                          title: 'How users edit array values',
                          description:
                            'Chooses between dynamic item editing and static option selection for array fields.',
                          reasons: [
                            'Use dynamic mode when users create arbitrary repeated records or values.',
                            'Use static mode when the business domain is a fixed multi-select list, such as permissions, tags, or supported channels.',
                          ],
                        })}
                      >
                        <Controller
                          name="ui.arrayMode"
                          control={control}
                          render={({ field }) => (
                            <Select
                              value={field.value ?? ''}
                              onChange={(value) => {
                                field.onChange(value)
                                handleUIChange('arrayMode', value)
                              }}
                              options={[
                                { label: 'dynamic', value: 'dynamic' },
                                { label: 'static', value: 'static' },
                              ]}
                            />
                          )}
                        />
                      </FormGroup>

                      {/* Static 模式下的选项配置 */}
                      {watch('ui.arrayMode') === 'static' && (
                        <FormGroup
                          label={renderLabelWithTooltip({
                            label: 'Array Items Options',
                            title: 'Static choices for array values',
                            description:
                              'Configures the available values and display labels for static array mode.',
                            reasons: [
                              'Use it to make multi-select arrays consistent with an approved business vocabulary.',
                              'Separating stored value from display label keeps integrations stable while showing user-friendly text.',
                            ],
                          })}
                          helperText="Configure available options for static array (multi-select checkboxes)"
                        >
                          {(() => {
                            const items = currentNode.items || {}
                            const enumValues = items.enum || []
                            const enumNames = items.enumNames || []

                            const handleAddOption = () => {
                              const newEnum = [...enumValues, '']
                              const newEnumNames = [...enumNames, '']
                              onUpdate(selectedPath, {
                                items: {
                                  ...items,
                                  enum: newEnum,
                                  enumNames: newEnumNames,
                                },
                              })
                            }

                            const handleRemoveOption = (index: number) => {
                              const newEnum = enumValues.filter(
                                (_: any, i: number) => i !== index
                              )
                              const newEnumNames = enumNames.filter(
                                (_: any, i: number) => i !== index
                              )
                              onUpdate(selectedPath, {
                                items: {
                                  ...items,
                                  enum:
                                    newEnum.length > 0 ? newEnum : undefined,
                                  enumNames:
                                    newEnumNames.length > 0
                                      ? newEnumNames
                                      : undefined,
                                },
                              })
                            }

                            const handleUpdateValue = (
                              index: number,
                              value: string
                            ) => {
                              const newEnum = [...enumValues]
                              newEnum[index] = value
                              onUpdate(selectedPath, {
                                items: { ...items, enum: newEnum },
                              })
                            }

                            const handleUpdateLabel = (
                              index: number,
                              label: string
                            ) => {
                              const newEnumNames = [...enumNames]
                              newEnumNames[index] = label
                              onUpdate(selectedPath, {
                                items: { ...items, enumNames: newEnumNames },
                              })
                            }

                            return (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 12,
                                }}
                              >
                                {enumValues.length > 0 ? (
                                  enumValues.map(
                                    (value: any, index: number) => (
                                      <div
                                        key={index}
                                        style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 8,
                                          padding: '8px',
                                          border: '1px solid #ddd',
                                          borderRadius: '4px',
                                          backgroundColor: '#f9f9f9',
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontWeight: 500,
                                              minWidth: '50px',
                                              fontSize: '12px',
                                              color: '#5c7080',
                                            }}
                                          >
                                            Value:
                                          </span>
                                          <InputGroup
                                            value={String(value)}
                                            onChange={(e) =>
                                              handleUpdateValue(
                                                index,
                                                e.target.value
                                              )
                                            }
                                            style={{ flex: 1 }}
                                          />
                                          <Button
                                            icon="cross"
                                            minimal
                                            small
                                            onClick={() =>
                                              handleRemoveOption(index)
                                            }
                                          />
                                        </div>
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontWeight: 500,
                                              minWidth: '50px',
                                              fontSize: '12px',
                                              color: '#5c7080',
                                            }}
                                          >
                                            Label:
                                          </span>
                                          <InputGroup
                                            placeholder="Display text"
                                            value={enumNames[index] || ''}
                                            onChange={(e) =>
                                              handleUpdateLabel(
                                                index,
                                                e.target.value
                                              )
                                            }
                                            style={{ flex: 1 }}
                                          />
                                        </div>
                                      </div>
                                    )
                                  )
                                ) : (
                                  <Callout intent="warning" icon="info-sign">
                                    No options configured. Add options to enable
                                    static array mode.
                                  </Callout>
                                )}
                                <Button
                                  icon="add"
                                  text="Add Option"
                                  minimal
                                  onClick={handleAddOption}
                                />
                              </div>
                            )
                          })()}
                        </FormGroup>
                      )}

                      <FormGroup
                        label={renderLabelWithTooltip({
                          label: 'Add Button Text',
                          title: 'Array add action label',
                          description:
                            'Customizes the button text users click to add another array item.',
                          reasons: [
                            'Use domain-specific language like Add Contact, Add Mapping, or Add Header to make the action clear.',
                            'Clear action text reduces mistakes in repeatable sections where users may add many records.',
                          ],
                        })}
                      >
                        <Controller
                          name="ui.addButtonText"
                          control={control}
                          render={({ field }) => (
                            <InputGroup
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                handleUIChange('addButtonText', e.target.value)
                              }
                            />
                          )}
                        />
                      </FormGroup>
                    </ConfigSection>
                  )}

                  <ConfigSection
                    title="Data Handling"
                    description="Configure value conversion when the displayed input differs from stored form data."
                  >
                    <FormGroup
                      label={renderLabelWithTooltip({
                        label: 'Field Transform',
                        title: 'Convert between input and stored values',
                        description:
                          'Configures transformation functions for cases where the displayed input domain differs from the value stored in form data.',
                        reasons: [
                          'Use it for business-friendly inputs such as percentages shown as 96 while storing 0.96.',
                          'Transforms keep external API payloads correct without forcing users to enter backend-oriented values.',
                        ],
                      })}
                    >
                      <Callout
                        intent="primary"
                        icon="info-sign"
                        style={{ marginBottom: 12 }}
                      >
                        Transform functions convert between the value users
                        type and the value stored in form data.
                      </Callout>
                      <TransformEditor
                        value={currentNode.ui?.transform}
                        onChange={(transform) =>
                          handleUIChange('transform', transform)
                        }
                        disabled={isArrayItems}
                      />
                    </FormGroup>
                  </ConfigSection>
                </div>
              </div>
            }
          />

          <Tab
            id="linkage"
            title="Linkage"
            panel={
              <div className="editor-panel">
                <LinkagesEditor
                  key={selectedPath.join('.')}
                  value={currentNode.ui?.linkages}
                  onChange={(linkages) => handleUIChange('linkages', linkages)}
                  currentFieldPath={currentFieldPath}
                  schema={schema}
                  disabled={isArrayItems}
                />
              </div>
            }
          />
        </Tabs>
      )}
    </div>
  )
}
