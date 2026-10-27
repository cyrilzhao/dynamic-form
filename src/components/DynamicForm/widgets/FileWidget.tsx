import React, { forwardRef, useRef, useState } from 'react'
import { Button, FileInput } from '@blueprintjs/core'
import type { FieldWidgetProps } from '../types'

/** 文件选择 Widget 的配置。 */
export interface FileWidgetProps extends FieldWidgetProps {
  accept?: string
  maxSize?: number
  showFileList?: boolean
  clearable?: boolean
  capture?: string
}

function formatFileSize(size: number): string {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/** 选择单个 File，并通过 onChange 输出 File 或 null。 */
export const FileWidget = forwardRef<HTMLInputElement, FileWidgetProps>(
  (
    {
      name,
      value,
      onChange,
      disabled,
      readonly,
      error,
      accept,
      maxSize,
      showFileList = true,
      clearable = true,
      capture,
      ...rest
    },
    forwardedRef,
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [localError, setLocalError] = useState<string | null>(null)
    const file =
      value && typeof value === 'object' && 'name' in value
        ? (value as File)
        : null

    const setRefs = (element: HTMLInputElement | null) => {
      inputRef.current = element
      if (typeof forwardedRef === 'function') {
        forwardedRef(element)
      } else if (forwardedRef) {
        forwardedRef.current = element
      }
    }

    return (
      <div {...rest}>
        <FileInput
          inputProps={{
            name,
            accept,
            capture,
            disabled: disabled || readonly,
            ref: setRefs,
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
              const nextFile = event.target.files?.[0] ?? null
              if (
                nextFile &&
                maxSize !== undefined &&
                nextFile.size > maxSize
              ) {
                setLocalError(
                  `${nextFile.name} exceeds the maximum size of ${formatFileSize(maxSize)}`,
                )
                event.target.value = ''
                return
              }
              setLocalError(null)
              onChange?.(nextFile)
            },
          }}
          text={file?.name ?? 'Choose file...'}
          buttonText="Browse"
          disabled={disabled || readonly}
        />
        {showFileList && file && (
          <div aria-label="Selected file">
            {file.name} ({formatFileSize(file.size)})
          </div>
        )}
        {clearable && file && !disabled && !readonly && (
          <Button
            minimal
            type="button"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = ''
              }
              setLocalError(null)
              onChange?.(null)
            }}
          >
            Clear
          </Button>
        )}
        {(localError || error) && <div role="alert">{localError || error}</div>}
      </div>
    )
  },
)

FileWidget.displayName = 'FileWidget'
