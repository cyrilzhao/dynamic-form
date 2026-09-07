import React, { useMemo, useRef, useState } from 'react'
import { Button, Card, Callout, Intent } from '@blueprintjs/core'
import { DynamicForm } from '@/components/DynamicForm'
import type { DynamicFormRef } from '@/components/DynamicForm/types'
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema'

/**
 * Variants 专项示例：同一个字段根据输入内容切换 schema、widget、校验和转换规则。
 */
export const VariantsExample: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  const schema = useMemo<ExtendedJSONSchema>(
    () => ({
      type: 'object',
      properties: {
        identifier: {
          type: 'string',
          title: '联系人标识',
          ui: {
            widget: 'variant',
            placeholder: '输入邮箱或 11 位手机号',
            defaultVariant: 'email',
            variants: [
              {
                name: 'email',
                type: 'string',
                widget: 'email',
                detect: { callback: 'detectEmail' },
                schema: {
                  title: '邮箱地址',
                  ui: {
                    placeholder: '请输入邮箱',
                    validators: [{ type: 'script', callback: 'validateEmail' }],
                    transform: {
                      callback: 'normalizeEmail',
                      reverseCallback: 'restoreEmail',
                    },
                  },
                },
              },
              {
                name: 'phone',
                type: 'string',
                widget: 'text',
                detect: {
                  callback: {
                    type: 'script',
                    code: '({ value, helpers }) => helpers.isPhone(value)',
                  },
                },
                schema: {
                  title: '手机号码',
                  ui: {
                    placeholder: '请输入11位手机号码',
                    validators: [{ type: 'script', callback: 'validatePhone' }],
                    transform: {
                      callback: 'normalizePhone',
                      reverseCallback: 'restorePhone',
                    },
                  },
                },
              },
              {
                name: 'object',
                type: 'object',
                widget: 'object-editor',
                detect: {
                  callback: {
                    type: 'script',
                    code: "({ value }) => value !== null && typeof value === 'object' && !Array.isArray(value)",
                  },
                },
                schema: {
                  type: 'object',
                  properties: {
                    objName: {
                      type: 'string',
                      title: 'Obj Name',
                    },
                  },
                },
              },
            ],
          },
        },
        note: {
          type: 'string',
          title: '备注',
          maxLength: 120,
          ui: {
            widget: 'textarea',
            validators: [{ type: 'script', callback: 'validateNote' }],
          },
        },
      },
      required: ['identifier'],
    }),
    [],
  )

  const callbacks = useMemo(
    () => ({
      normalizeEmail: ({ value }: { value: string }) =>
        value.trim().toLowerCase(),
      restoreEmail: ({ value }: { value: string }) => value,
      normalizePhone: ({ value }: { value: string }) =>
        value.replace(/\s/g, ''),
      restorePhone: ({ value }: { value: string }) => value,
      validateNote: ({ value }: { value: string }) =>
        value.includes('password') ? '备注中不能包含 password' : null,
      validateEmail: ({ value }: { value: string }) =>
        /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? null : '请输入有效邮箱',
      validatePhone: ({ value }: { value: string }) =>
        /^1[3-9]\d{9}$/.test(value) ? null : '请输入 11 位手机号',
      detectEmail: ({ value }: { value: unknown }) =>
        typeof value === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
    }),
    [],
  )

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <h1>Variants 类型字段</h1>
      <p>
        输入邮箱或手机号，字段会自动切换编辑模式、标题、转换逻辑和校验规则。
      </p>

      <Card style={{ marginTop: 20 }}>
        <DynamicForm
          ref={formRef}
          schema={schema}
          callbacks={callbacks}
          helpers={{
            isPhone: (value: unknown) =>
              typeof value === 'string' && /^1[3-9]\d*$/.test(value),
          }}
          defaultValues={{ identifier: 'Demo@Example.com', note: '' }}
          onChange={setFormData}
          onSubmit={setFormData}
        />
        <Button
          intent={Intent.PRIMARY}
          style={{ marginTop: 12 }}
          onClick={() => formRef.current?.validate()}
        >
          验证当前值
        </Button>
      </Card>

      <Callout
        intent={Intent.NONE}
        title="对外数据（存储域）"
        style={{ marginTop: 20 }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(formData, null, 2)}
        </pre>
      </Callout>
    </div>
  )
}

export default VariantsExample
