import React, { forwardRef, useState } from 'react'
import { Button, Checkbox, InputGroup } from '@blueprintjs/core'
import type { FieldWidgetProps } from '../types'
import type { FieldOption } from '../types/schema'

type OptionValueType = 'string' | 'number' | 'boolean' | 'null' | 'json'

interface WidgetOptionsEditorProps extends FieldWidgetProps {
  value?: FieldOption[]
  defaultValueType?: OptionValueType
}

const getValueType = (value: unknown): OptionValueType => {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'number') {
    return 'number'
  }
  if (typeof value === 'boolean') {
    return 'boolean'
  }
  if (typeof value === 'object') {
    return 'json'
  }
  return 'string'
}

const getInitialValue = (type: OptionValueType): unknown => {
  if (type === 'number') {
    return 0
  }
  if (type === 'boolean') {
    return false
  }
  if (type === 'null') {
    return null
  }
  if (type === 'json') {
    return {}
  }
  return ''
}

/** 在 Widget Props 表单中编辑带有类型信息的选项列表。 */
export const WidgetOptionsEditor = forwardRef<
  HTMLDivElement,
  WidgetOptionsEditorProps
>(
  (
    { value, onChange, disabled, readonly, defaultValueType = 'string' },
    ref,
  ) => {
    const [jsonDrafts, setJsonDrafts] = useState<Record<number, string>>({})
    const options = Array.isArray(value) ? value : []
    const isDisabled = disabled || readonly

    const updateOption = (index: number, update: Partial<FieldOption>) => {
      onChange?.(
        options.map((option, optionIndex) =>
          optionIndex === index ? { ...option, ...update } : option,
        ),
      )
    }

    const updateValue = (index: number, rawValue: string) => {
      const option = options[index]
      const valueType = getValueType(option.value)
      let nextValue: unknown = rawValue

      if (valueType === 'number') {
        const parsed = Number(rawValue)
        if (!Number.isNaN(parsed)) {
          nextValue = parsed
        }
      } else if (valueType === 'boolean') {
        nextValue = rawValue === 'true'
      } else if (valueType === 'json') {
        setJsonDrafts((previous) => ({ ...previous, [index]: rawValue }))
        try {
          nextValue = JSON.parse(rawValue)
        } catch {
          return
        }
      }

      updateOption(index, { value: nextValue })
    }

    const updateValueType = (index: number, valueType: OptionValueType) => {
      setJsonDrafts((previous) => {
        if (!(index in previous)) {
          return previous
        }
        const next = { ...previous }
        delete next[index]
        return next
      })
      updateOption(index, {
        value: getInitialValue(valueType) as FieldOption['value'],
      })
    }

    return (
      <div
        ref={ref}
        aria-label="Widget options"
        style={{ display: 'grid', gap: 8 }}
      >
        {options.length > 0 && (
          <div
            aria-hidden="true"
            style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 1fr auto auto',
              gap: 8,
              fontSize: 12,
              color: '#5c7080',
            }}
          >
            <span>Type</span>
            <span>Value</span>
            <span>Label</span>
            <span>Disabled</span>
            <span />
          </div>
        )}
        {options.map((option, index) => {
          const valueType = getValueType(option.value)
          return (
            <div
              key={`${typeof option.value}:${String(option.value)}:${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 1fr 1fr auto auto',
                gap: 8,
              }}
            >
              <select
                aria-label={`Option ${index + 1} value type`}
                value={valueType}
                disabled={isDisabled}
                onChange={(event) =>
                  updateValueType(index, event.target.value as OptionValueType)
                }
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="null">Null</option>
                <option value="json">JSON</option>
              </select>
              {valueType === 'null' ? (
                <InputGroup
                  aria-label={`Option ${index + 1} value`}
                  value="null"
                  disabled
                />
              ) : valueType === 'boolean' ? (
                <select
                  aria-label={`Option ${index + 1} value`}
                  value={String(option.value)}
                  disabled={isDisabled}
                  onChange={(event) => updateValue(index, event.target.value)}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <InputGroup
                  aria-label={`Option ${index + 1} value`}
                  type={valueType === 'number' ? 'number' : 'text'}
                  value={
                    valueType === 'json'
                      ? (jsonDrafts[index] ?? JSON.stringify(option.value))
                      : String(option.value)
                  }
                  disabled={isDisabled}
                  onChange={(event) => updateValue(index, event.target.value)}
                />
              )}
              <InputGroup
                aria-label={`Option ${index + 1} label`}
                value={option.label}
                disabled={isDisabled}
                onChange={(event) =>
                  updateOption(index, { label: event.target.value })
                }
              />
              <Checkbox
                aria-label={`Option ${index + 1} disabled`}
                checked={option.disabled ?? false}
                disabled={isDisabled}
                onChange={(event) =>
                  updateOption(index, { disabled: event.currentTarget.checked })
                }
              />
              <Button
                aria-label={`Remove option ${index + 1}`}
                icon="cross"
                minimal
                disabled={isDisabled}
                onClick={() => {
                  setJsonDrafts((previous) => {
                    const next: Record<number, string> = {}
                    Object.entries(previous).forEach(([draftIndex, draft]) => {
                      const numericIndex = Number(draftIndex)
                      if (numericIndex < index) {
                        next[numericIndex] = draft
                      } else if (numericIndex > index) {
                        next[numericIndex - 1] = draft
                      }
                    })
                    return next
                  })
                  onChange?.(
                    options.filter((_item, itemIndex) => itemIndex !== index),
                  )
                }}
              />
            </div>
          )
        })}
        <Button
          icon="add"
          text="Add Option"
          minimal
          disabled={isDisabled}
          onClick={() => {
            const nextValue = getInitialValue(defaultValueType)
            onChange?.([
              ...options,
              { value: nextValue, label: String(nextValue), disabled: false },
            ])
          }}
        />
      </div>
    )
  },
)

WidgetOptionsEditor.displayName = 'WidgetOptionsEditor'
