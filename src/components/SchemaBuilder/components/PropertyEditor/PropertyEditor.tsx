import React, { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import {
  Tabs,
  Tab,
  FormGroup,
  InputGroup,
  TextArea,
  HTMLSelect,
  NumericInput,
  Switch,
  Callout,
  ControlGroup,
  Divider,
  Button,
  Tag,
} from '@blueprintjs/core'
import { get } from 'lodash'
import { useSchemaBuilder } from '../../SchemaBuilder'
import type { SchemaNodeType } from '../../types'
import { SchemaValidationEditor } from './components/SchemaValidationEditor'
import { FieldValidatorsEditor } from './components/FieldValidatorsEditor'
import { LinkagesEditor } from './components/LinkagesEditor'
import { TransformEditor } from './components/TransformEditor'
import { ObjectEditor } from '../../../ObjectEditor'

// Helper to get node from path
const getNode = (schema: any, path: string[]) => {
  if (path.length === 0) return schema
  return get(schema, path)
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

  const { control, register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      key: currentKey,
      ...currentNode,
      ui: {
        ...currentNode?.ui,
        errorMessages: currentNode?.ui?.errorMessages || {},
      },
    },
    mode: 'onBlur',
  })

  // Watch for changes to update schema
  useEffect(() => {
    if (currentNode) {
      reset({
        key: currentKey,
        ...currentNode,
        ui: {
          ...currentNode?.ui,
          validation: currentNode?.ui?.validation || {},
          errorMessages: currentNode?.ui?.errorMessages || {},
        },
      })
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
                      <HTMLSelect
                        {...field}
                        value={field.value ?? ''}
                        options={typeOptions}
                        disabled={isRoot || isArrayItems} // Root type usually shouldn't change easily or needs warning
                        onChange={(e) => {
                          field.onChange(e)
                          handleFieldChange('type', e.target.value)
                          setValue('default', undefined)
                          handleFieldChange('default', undefined)
                        }}
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
              <div className="editor-panel">
                {currentType === 'string' && (
                  <>
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
                          <HTMLSelect
                            {...field}
                            value={field.value ?? ''}
                            options={[
                              '',
                              'email',
                              'uri',
                              'date',
                              'date-time',
                              'time',
                            ]}
                            onChange={(e) =>
                              handleFieldChange('format', e.target.value)
                            }
                          />
                        )}
                      />
                    </FormGroup>
                  </>
                )}

                {(currentType === 'number' || currentType === 'integer') && (
                  <>
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
                  </>
                )}

                {currentType === 'array' && (
                  <>
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
                          label="Unique Items"
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
                  </>
                )}

                {currentType === 'object' && (
                  <>
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
                  </>
                )}

                {/* 以下配置只对叶子节点（非 object 和 array）显示 */}
                {currentType !== 'object' && currentType !== 'array' && (
                  <>
                    <FormGroup
                      label="Required Error Message"
                      helperText="Custom error message when field is required but empty"
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
                  </>
                )}
                <Divider style={{ margin: '16px 0' }} />
                <FieldValidatorsEditor
                  value={currentNode.ui?.validators}
                  onChange={(validators) =>
                    handleUIChange('validators', validators)
                  }
                  disabled={isArrayItems}
                />
              </div>
            }
          />

          <Tab
            id="ui"
            title="UI Config"
            panel={
              <div className="editor-panel">
                <FormGroup label="Widget">
                  <Controller
                    name="ui.widget"
                    control={control}
                    render={({ field }) => (
                      <HTMLSelect
                        {...field}
                        value={field.value ?? ''}
                        options={['', ...(widgetOptions[currentType] || [])]}
                        onChange={(e) =>
                          handleUIChange('widget', e.target.value)
                        }
                        disabled={isArrayItems}
                      />
                    )}
                  />
                </FormGroup>

                {watch('ui.widget') && (
                  <FormGroup
                    label="Widget Props"
                    helperText="Additional props passed directly to the widget (JSON object)"
                  >
                    <ObjectEditor
                      value={currentNode.ui?.widgetProps}
                      onChange={(val) => handleUIChange('widgetProps', val)}
                      disabled={isArrayItems}
                    />
                  </FormGroup>
                )}

                <FormGroup label="Placeholder">
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
                    <Divider />
                    <FormGroup
                      label="Boolean Display Labels"
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
                            {displayEnum.map((value: any, index: number) => (
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
                                  <Tag intent={value ? 'success' : 'none'}>
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
                                      handleUpdateLabel(index, e.target.value)
                                    }
                                    style={{ flex: 1 }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </FormGroup>
                  </>
                )}

                <Divider />

                <Controller
                  name="ui.hidden"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      label="Hidden"
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
                      label="Disabled"
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
                      label="Readonly"
                      checked={!!field.value}
                      onChange={(e) =>
                        handleUIChange('readonly', e.currentTarget.checked)
                      }
                      disabled={isArrayItems}
                    />
                  )}
                />

                <Divider />

                <FormGroup label="Layout">
                  <Controller
                    name="ui.layout"
                    control={control}
                    render={({ field }) => (
                      <HTMLSelect
                        {...field}
                        value={field.value ?? ''}
                        options={['', 'vertical', 'horizontal', 'inline']}
                        onChange={(e) =>
                          handleUIChange('layout', e.target.value)
                        }
                        disabled={isArrayItems}
                      />
                    )}
                  />
                </FormGroup>

                <FormGroup label="Label Width">
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

                {currentType === 'object' && (
                  <>
                    <Divider />

                    <Controller
                      name="ui.flattenPath"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          label="Flatten Path (Transparent)"
                          checked={!!field.value}
                          onChange={(e) =>
                            handleUIChange('flattenPath', e.currentTarget.checked)
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
                          label="Flatten Prefix"
                          checked={!!field.value}
                          onChange={(e) =>
                            handleUIChange('flattenPrefix', e.currentTarget.checked)
                          }
                          disabled={isArrayItems}
                        />
                      )}
                    />
                  </>
                )}

                {currentType === 'array' && (
                  <>
                    <Divider />
                    <FormGroup label="Array Mode">
                      <Controller
                        name="ui.arrayMode"
                        control={control}
                        render={({ field }) => (
                          <HTMLSelect
                            {...field}
                            value={field.value ?? ''}
                            options={['dynamic', 'static']}
                            onChange={(e) =>
                              handleUIChange('arrayMode', e.target.value)
                            }
                          />
                        )}
                      />
                    </FormGroup>

                    {/* Static 模式下的选项配置 */}
                    {watch('ui.arrayMode') === 'static' && (
                      <FormGroup
                        label="Array Items Options"
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
                                enum: newEnum.length > 0 ? newEnum : undefined,
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
                                enumValues.map((value: any, index: number) => (
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
                                ))
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

                    <FormGroup label="Add Button Text">
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
                  </>
                )}

                <Divider />

                <FormGroup
                  label="Field Transform"
                  helperText="Configure data transformation functions for this field"
                >
                  <TransformEditor
                    value={currentNode.ui?.transform}
                    onChange={(transform) => handleUIChange('transform', transform)}
                    disabled={isArrayItems}
                  />
                </FormGroup>
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
