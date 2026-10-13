import React, { forwardRef, useState } from 'react'
import { FileInput, Spinner } from '@blueprintjs/core'
import type { FieldWidgetProps } from '../types'

export interface UploadValue {
  fileId: string
  fileName: string
}

export interface UploadInputWidgetProps extends FieldWidgetProps {
  value?: UploadValue | null
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

/**
 * 上传输入 Widget。
 * 组件只负责选择文件和调用上传回调，字段值始终是上传结果对象。
 */
export const UploadInputWidget = forwardRef<
  HTMLInputElement,
  UploadInputWidgetProps
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
    const uploadedValue = isUploadValue(value) ? value : null

    const handleFileChange = async (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }
      if (!onUpload) {
        setLocalError('Upload handler is not configured.')
        return
      }

      setLocalError(null)
      setIsUploading(true)
      try {
        const result = await onUpload(file)
        if (!isUploadValue(result)) {
          throw new Error('Upload response must contain fileId and fileName.')
        }
        onChange?.(result)
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
            disabled: disabled || readonly || isUploading,
            ref: forwardedRef,
            onChange: handleFileChange,
          }}
          text={uploadedValue?.fileName ?? 'Choose file...'}
          buttonText="Browse"
          disabled={disabled || readonly || isUploading}
        />
        {isUploading && <Spinner size={16} aria-label="Uploading" />}
        {uploadedValue && (
          <div aria-label="Uploaded file">{uploadedValue.fileName}</div>
        )}
        {(localError || error) && <div role="alert">{localError || error}</div>}
      </div>
    )
  },
)

UploadInputWidget.displayName = 'UploadInputWidget'
