import React, { useState } from 'react'
import {
  Button,
  FormGroup,
  InputGroup,
  Card,
  Tag,
  Callout,
  Divider,
} from '@blueprintjs/core'
import { CodeEditor } from '../../../../CodeEditor'
import { Select } from '../../../../Select'
import type { ValidatorRule } from '../../../../DynamicForm/types/schema'

interface FieldValidatorsEditorProps {
  value?: ValidatorRule[]
  onChange: (value: ValidatorRule[]) => void
  disabled?: boolean
}

const DEFAULT_SCRIPT_TEMPLATE = `/**
 * Custom field validator
 * @param {any} value - Current field value
 * @param {object} formValues - Entire form data object
 * @returns {string|null} - null if valid, error message string if invalid
 */
function(value, formValues) {
  if (!value) {
    return 'This field is required';
  }

  return null;
}`

type CallbackMode = 'function-name' | 'inline-script'

export const FieldValidatorsEditor: React.FC<FieldValidatorsEditorProps> = ({
  value = [],
  onChange,
  disabled,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [editingValidator, setEditingValidator] =
    useState<ValidatorRule | null>(null)
  const [isNewValidator, setIsNewValidator] = useState(false)

  // 编辑状态
  const [callbackMode, setCallbackMode] = useState<CallbackMode>('inline-script')
  const [functionName, setFunctionName] = useState('')
  const [scriptCode, setScriptCode] = useState(DEFAULT_SCRIPT_TEMPLATE)

  const resetEditingState = () => {
    setFunctionName('')
    setScriptCode(DEFAULT_SCRIPT_TEMPLATE)
    setCallbackMode('inline-script')
  }

  const loadValidatorToEdit = (validator: ValidatorRule) => {
    if (typeof validator.callback === 'string') {
      setCallbackMode('function-name')
      setFunctionName(validator.callback)
    } else {
      setCallbackMode('inline-script')
      setScriptCode(validator.callback.code)
    }
  }

  const handleAdd = () => {
    const newIndex = value.length
    const newValidator: ValidatorRule = {
      type: 'script',
      callback: { type: 'script', code: DEFAULT_SCRIPT_TEMPLATE },
    }
    setEditingValidator(newValidator)
    setIsNewValidator(true)
    setExpandedIndex(newIndex)
    resetEditingState()
  }

  const handleEdit = (index: number) => {
    const validator = value[index]
    setEditingValidator({ ...validator })
    setIsNewValidator(false)
    setExpandedIndex(index)
    loadValidatorToEdit(validator)
  }

  const handleSave = () => {
    if (!editingValidator) return

    let validatorToSave: ValidatorRule

    if (callbackMode === 'function-name') {
      if (!functionName.trim()) return
      validatorToSave = {
        type: 'script',
        callback: functionName.trim(),
      }
    } else {
      if (!scriptCode.trim()) return
      validatorToSave = {
        type: 'script',
        callback: { type: 'script', code: scriptCode.trim() },
      }
    }

    if (isNewValidator) {
      onChange([...value, validatorToSave])
    } else {
      const newValue = [...value]
      newValue[expandedIndex!] = validatorToSave
      onChange(newValue)
    }

    setEditingValidator(null)
    setIsNewValidator(false)
    setExpandedIndex(null)
    resetEditingState()
  }

  const handleCancel = () => {
    setEditingValidator(null)
    setIsNewValidator(false)
    setExpandedIndex(null)
    resetEditingState()
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
    if (expandedIndex === index) {
      setEditingValidator(null)
      setIsNewValidator(false)
      setExpandedIndex(null)
      resetEditingState()
    }
  }

  const handleModeChange = (newMode: CallbackMode) => {
    setCallbackMode(newMode)
  }

  const renderValidatorSummary = (validator: ValidatorRule) => {
    if (typeof validator.callback === 'string') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag minimal intent="success">
            function
          </Tag>
          <code style={{ fontSize: 12 }}>{validator.callback}</code>
        </div>
      )
    } else {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Tag minimal intent="warning">
            inline script
          </Tag>
          <pre
            style={{
              margin: 0,
              fontSize: 11,
              maxHeight: 60,
              overflow: 'hidden',
              color: '#5c7080',
            }}
          >
            {validator.callback.code.slice(0, 120)}
            {validator.callback.code.length > 120 ? '…' : ''}
          </pre>
        </div>
      )
    }
  }

  const renderEditForm = () => {
    if (!editingValidator) return null

    return (
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <FormGroup label="Callback Mode">
          <Select
            value={callbackMode}
            onChange={(value) => handleModeChange(value as CallbackMode)}
            disabled={disabled}
            options={[
              { label: 'Function Name (from callbacks registry)', value: 'function-name' },
              { label: 'Inline Script', value: 'inline-script' },
            ]}
          />
        </FormGroup>

        {callbackMode === 'function-name' && (
          <FormGroup
            label="Function Name"
            helperText="Function from DynamicForm callbacks prop. Signature: (value, formValues) => string | null"
          >
            <InputGroup
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value)}
              placeholder="validateUsername"
              disabled={disabled}
            />
          </FormGroup>
        )}

        {callbackMode === 'inline-script' && (
          <>
            <Callout
              intent="warning"
              icon="warning-sign"
              style={{ fontSize: 12 }}
            >
              Only use in trusted internal environments. The code runs in the
              browser.
            </Callout>
            <FormGroup
              label="Validation Code"
              helperText="Complete function receiving (value, formValues). Return null (valid) or error message string (invalid)."
            >
              <CodeEditor
                value={scriptCode}
                language="javascript"
                config={{ initialMode: 'preview', previewLines: 6 }}
                onChange={(code) => setScriptCode(code)}
                disabled={disabled}
              />
            </FormGroup>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button text="Cancel" onClick={handleCancel} disabled={disabled} />
          <Button
            text="Save"
            intent="primary"
            onClick={handleSave}
            disabled={
              disabled ||
              (callbackMode === 'function-name'
                ? !functionName.trim()
                : !scriptCode.trim())
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Callout intent="primary" icon="info-sign">
        <strong>Custom Field Validators</strong>
        <p style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
          Add custom validation rules for this field. Validators can be reusable functions or inline scripts.
        </p>
      </Callout>

      {value.map((validator, index) => (
        <Card key={index} style={{ padding: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: expandedIndex === index ? 12 : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag intent="primary" minimal>
                #{index + 1}
              </Tag>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button
                icon={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
                minimal
                small
                onClick={() => {
                  if (expandedIndex === index) {
                    handleCancel()
                  } else {
                    handleEdit(index)
                  }
                }}
                disabled={disabled}
              />
              <Button
                icon="trash"
                minimal
                small
                intent="danger"
                onClick={() => handleRemove(index)}
                disabled={disabled}
              />
            </div>
          </div>

          {expandedIndex !== index && (
            <div style={{ marginTop: 8 }}>{renderValidatorSummary(validator)}</div>
          )}

          {expandedIndex === index && !isNewValidator && renderEditForm()}
        </Card>
      ))}

      {isNewValidator && expandedIndex === value.length && (
        <Card style={{ padding: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag intent="primary" minimal>
                #{value.length + 1}
              </Tag>
            </div>
            <Button
              icon="cross"
              minimal
              small
              onClick={handleCancel}
              disabled={disabled}
            />
          </div>

          {renderEditForm()}
        </Card>
      )}

      <Divider />

      <Button
        icon="add"
        text="Add Custom Validator"
        intent="primary"
        onClick={handleAdd}
        disabled={disabled || isNewValidator}
      />
    </div>
  )
}
