import React, { useMemo, useRef, useState } from 'react'
import { Button, Card, Callout, Divider, H3 } from '@blueprintjs/core'
import {
  DynamicForm,
  createMultipartFormData,
  type DynamicFormRef,
  type ExtendedJSONSchema,
} from '@/components/DynamicForm'

const fileUploadSchema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      title: 'Document title',
      ui: { placeholder: 'Quarterly report' },
    },
    avatar: {
      type: 'string',
      title: 'Profile image',
      ui: {
        widget: 'file',
        widgetProps: {
          accept: 'image/png,image/jpeg',
          maxSize: 5 * 1024 * 1024,
        },
      },
    },
    attachments: {
      type: 'array',
      title: 'Attachments',
      items: {
        type: 'string',
        title: 'Attachment',
        ui: {
          widget: 'file',
          widgetProps: {
            accept: '.pdf,.docx,.txt',
            maxSize: 20 * 1024 * 1024,
          },
        },
      },
    },
  },
  required: ['title'],
}

function describeValue(value: unknown): unknown {
  if (value instanceof File) {
    return {
      name: value.name,
      size: value.size,
      type: value.type || 'application/octet-stream',
    }
  }
  if (value instanceof Blob) {
    return { size: value.size, type: value.type || 'application/octet-stream' }
  }
  if (Array.isArray(value)) {
    return value.map(describeValue)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        describeValue(item),
      ]),
    )
  }
  return value
}

export const FileUploadExample: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [multipartParts, setMultipartParts] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)

  const valuePreview = useMemo(
    () => JSON.stringify(describeValue(values), null, 2),
    [values],
  )

  const handleSubmit = (data: Record<string, unknown>) => {
    const body = createMultipartFormData(data)
    setValues(data)
    setMultipartParts(Array.from(body.keys()))
    setSubmitted(true)
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <Card>
        <H3>文件上传与 Multipart</H3>
        <p>
          文件字段保留浏览器的真实 File 对象；提交时由调用方显式转换为
          FormData。 文件内容不会被转换为 base64。
        </p>
        <DynamicForm
          ref={formRef}
          schema={fileUploadSchema}
          onChange={(data) => setValues(data)}
          onSubmit={handleSubmit}
        />
        <Divider />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon="reset"
            onClick={() => {
              formRef.current?.reset({})
              setSubmitted(false)
              setMultipartParts([])
            }}
          >
            Reset
          </Button>
          <Button
            intent="primary"
            icon="upload"
            onClick={() => {
              void formRef.current?.validate()
              formRef.current?.getValues()
            }}
          >
            Validate values
          </Button>
        </div>
      </Card>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginTop: 16,
        }}
      >
        <Card>
          <H3>Current form values</H3>
          <pre style={{ margin: 0, overflow: 'auto', fontSize: 12 }}>
            {valuePreview}
          </pre>
        </Card>
        <Card>
          <H3>Multipart parts</H3>
          {submitted ? (
            <>
              <Callout intent="success" title="FormData created">
                The payload part contains the full JSON structure. Each file is
                uploaded through its own files.* part.
              </Callout>
              <pre
                style={{ margin: '12px 0 0', overflow: 'auto', fontSize: 12 }}
              >
                {multipartParts.join('\n')}
              </pre>
            </>
          ) : (
            <Callout title="Not submitted yet">
              Choose files and submit the form to inspect the generated part
              names.
            </Callout>
          )}
        </Card>
      </div>
    </div>
  )
}
