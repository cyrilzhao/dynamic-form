import React, { useState } from 'react'
import {
  Button,
  FormGroup,
  InputGroup,
  Callout,
  HTMLSelect,
} from '@blueprintjs/core'
import { CodeEditor } from '../../../../CodeEditor'
import type { UIConfig } from '../../../../DynamicForm/types/schema'

type TransformRef = string | { type: 'script'; code: string }

interface TransformEditorProps {
  value?: UIConfig['transform']
  onChange: (value: UIConfig['transform']) => void
  disabled?: boolean
}

function TransformFnEditor({
  label,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string
  value: TransformRef | undefined
  onChange: (v: TransformRef | undefined) => void
  disabled?: boolean
  placeholder: string
}) {
  const isScript = value != null && typeof value !== 'string'
  const [mode, setMode] = useState<'callback' | 'script'>(
    isScript ? 'script' : 'callback'
  )

  const handleModeChange = (newMode: 'callback' | 'script') => {
    setMode(newMode)
    onChange(undefined)
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <FormGroup label={label} style={{ marginBottom: 4 }}>
        <HTMLSelect
          value={mode}
          onChange={(e) =>
            handleModeChange(e.target.value as 'callback' | 'script')
          }
          disabled={disabled}
          style={{ marginBottom: 6 }}
        >
          <option value="callback">
            Callback name (from callbacks registry)
          </option>
          <option value="script">Inline JS script</option>
        </HTMLSelect>

        {mode === 'callback' ? (
          <InputGroup
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            placeholder={placeholder}
            disabled={disabled}
          />
        ) : (
          <>
            <Callout
              intent="warning"
              icon="warning-sign"
              style={{ fontSize: 12, marginBottom: 4 }}
            >
              Only use in trusted internal environments. Code runs in the
              browser.
            </Callout>
            <CodeEditor
              value={
                isScript ? (value as { type: 'script'; code: string }).code : ''
              }
              language="javascript"
              config={{ initialMode: 'preview', previewLines: 4 }}
              onChange={(code) =>
                onChange(code ? { type: 'script', code } : undefined)
              }
              disabled={disabled}
            />
          </>
        )}
      </FormGroup>
    </div>
  )
}

export const TransformEditor: React.FC<TransformEditorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const enabled = value != null

  const handleEnable = () => onChange({ callback: '' })

  const handleDisable = () => onChange(undefined)

  if (!enabled) {
    return (
      <Button icon="add" onClick={handleEnable} disabled={disabled}>
        Add Transform
      </Button>
    )
  }

  return (
    <div>
      <TransformFnEditor
        label="callback (input domain → stored domain)"
        value={value.callback}
        onChange={(cb) => onChange({ ...value, callback: cb ?? '' })}
        disabled={disabled}
        placeholder="e.g. percentToDecimal"
      />
      <TransformFnEditor
        label="reverseCallback (stored domain → input domain, optional)"
        value={value.reverseCallback}
        onChange={(rc) => onChange({ ...value, reverseCallback: rc })}
        disabled={disabled}
        placeholder="e.g. decimalToPercent"
      />
      <Button
        small
        icon="trash"
        intent="danger"
        onClick={handleDisable}
        disabled={disabled}
      >
        Remove Transform
      </Button>
    </div>
  )
}
