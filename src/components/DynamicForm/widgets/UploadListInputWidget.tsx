import React, { forwardRef, useState } from 'react'
import { FileInput, Spinner } from '@blueprintjs/core'
import type { FieldWidgetProps } from '../types'
import type { UploadValue } from './UploadInputWidget'

export interface UploadListInputWidgetProps extends FieldWidgetProps {
  value?: UploadValue[] | null
  accept?: string
  onUpload?: (file: File) => Promise<UploadValue> | UploadValue
}

const isUploadValue = (value: unknown): value is UploadValue => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const candidate = value as Partial<UploadValue>
  return (
    typeof candidate.fileId === 'string' &&
    typeof candidate.fileName === 'string'
  )
}

/** 上传多个文件并输出固定结构的 UploadValue 数组。 */
export const UploadListInputWidget = forwardRef<
  HTMLInputElement,
  UploadListInputWidgetProps
>(
  (
    {
      name,
      value,
      onChange,
      onUpload,
      accept,
      disabled,
      readonly,
      error,
      ...rest
    },
    forwardedRef,
  ) => {
    const [isUploading, setIsUploading] = useState(false)
    const [localError, setLocalError] = useState<string | null>(null)
    const uploadedValues = Array.isArray(value)
      ? value.filter(isUploadValue)
      : []

    const handleFileChange = async (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const files = Array.from(event.target.files ?? [])
      if (files.length === 0) {
        return
      }
      if (!onUpload) {
        setLocalError('Upload handler is not configured.')
        return
      }

      setLocalError(null)
      setIsUploading(true)
      try {
        const uploadedFiles = await Promise.all(
          files.map((file) => onUpload(file)),
        )
        if (!uploadedFiles.every(isUploadValue)) {
          throw new Error('Upload response must contain fileId and fileName.')
        }
        onChange?.([...uploadedValues, ...uploadedFiles])
      } catch (uploadError) {
        setLocalError(
          uploadError instanceof Error ? uploadError.message : 'Upload failed.',
        )
      } finally {
        setIsUploading(false)
        event.target.value = ''
      }
    }

    return (
      <div {...rest} aria-busy={isUploading}>
        <FileInput
          inputProps={{
            name,
            accept,
            multiple: true,
            disabled: disabled || readonly || isUploading,
            ref: forwardedRef,
            onChange: handleFileChange,
          }}
          text="Choose files..."
          buttonText="Browse"
          disabled={disabled || readonly || isUploading}
        />
        {isUploading && <Spinner size={16} aria-label="Uploading" />}
        {uploadedValues.length > 0 && (
          <div aria-label="Uploaded files">
            {uploadedValues.map((uploadedValue) => (
              <div key={uploadedValue.fileId}>{uploadedValue.fileName}</div>
            ))}
          </div>
        )}
        {(localError || error) && <div role="alert">{localError || error}</div>}
      </div>
    )
  },
)

UploadListInputWidget.displayName = 'UploadListInputWidget'
