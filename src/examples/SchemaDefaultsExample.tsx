import React, { useState, useMemo, useRef } from 'react'
import { DynamicForm } from '@/components/DynamicForm'
import type { ExtendedJSONSchema } from '@/components/DynamicForm'
import type { DynamicFormRef } from '@/components/DynamicForm'
import { Card, Callout, Button, Tag, Divider } from '@blueprintjs/core'

/**
 * Schema 默认值与联动集成示例
 *
 * 演示功能：
 * 1. Schema 中的 default 值在表单初始化时自动设置
 * 2. 默认值参与联动计算（控制字段显示/隐藏）
 * 3. 动态 schema 联动时，新 schema 的 default 值也会被应用
 */

// 模拟的动态 schema（包含 default 值和内部联动）
const mockDynamicSchemas: Record<string, ExtendedJSONSchema> = {
  httpRequest: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        title: 'HTTP Method',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'PATCH', // 默认 GET
        ui: { widget: 'select' },
      },
      url: {
        type: 'string',
        title: 'URL',
        format: 'uri',
        ui: { placeholder: 'https://api.example.com/endpoint' },
      },
      // 只有 POST/PUT/PATCH 才显示 body
      body: {
        type: 'string',
        title: 'Request Body',
        default: 'content',
        ui: {
          widget: 'textarea',
          placeholder: 'Enter request body (JSON)',
          linkages: [
            {
              type: 'visibility',
              dependencies: ['content.method'],
              when: {
                or: [
                  { field: 'content.method', operator: '==', value: 'POST' },
                  { field: 'content.method', operator: '==', value: 'PUT' },
                  { field: 'content.method', operator: '==', value: 'PATCH' },
                ],
              },
              fulfill: { state: { visible: true } },
              otherwise: { state: { visible: false } },
            },
            {
              type: 'value',
              dependencies: ['content.method'],
              when: {
                field: 'content.method',
                operator: '==',
                value: 'PATCH',
              },
              fulfill: {
                value: 'Patch Content',
              },
            },
          ],
        },
      },
      timeout: {
        type: 'number',
        title: 'Timeout (ms)',
        default: 30000, // 默认 30 秒
        minimum: 1000,
        maximum: 120000,
      },
      retries: {
        type: 'integer',
        title: 'Retry Count',
        default: 3, // 默认重试 3 次
        minimum: 0,
        maximum: 10,
      },
    },
    required: ['method', 'url'],
  },
  sendEmail: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        title: 'Recipient',
        format: 'email',
        ui: { placeholder: 'recipient@example.com' },
      },
      subject: {
        type: 'string',
        title: 'Subject',
        default: 'No Subject', // 默认标题
      },
      priority: {
        type: 'string',
        title: 'Priority',
        enum: ['low', 'normal', 'high'],
        enumNames: ['Low', 'Normal', 'High'],
        default: 'normal', // 默认优先级
        ui: { widget: 'radio' },
      },
      // 只有高优先级才显示紧急标记
      urgentNote: {
        type: 'string',
        title: 'Urgent Note',
        ui: {
          placeholder: 'Why is this urgent?',
          linkages: [
            {
              type: 'visibility',
              dependencies: ['content.priority'],
              when: {
                field: 'content.priority',
                operator: '==',
                value: 'high',
              },
              fulfill: { state: { visible: true } },
              otherwise: { state: { visible: false } },
            },
          ],
        },
      },
      includeAttachments: {
        type: 'boolean',
        title: 'Include Attachments',
        default: false,
      },
    },
    required: ['to', 'subject'],
  },
  runScript: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        title: 'Script Language',
        enum: ['javascript', 'python', 'shell'],
        enumNames: ['JavaScript', 'Python', 'Shell'],
        default: 'javascript', // 默认 JavaScript
        ui: { widget: 'select' },
      },
      code: {
        type: 'string',
        title: 'Script Code',
        ui: {
          widget: 'textarea',
          placeholder: '// Enter your script here',
        },
      },
      enableDebug: {
        type: 'boolean',
        title: 'Enable Debug Mode',
        default: false,
      },
      // 只有开启调试才显示日志级别
      logLevel: {
        type: 'string',
        title: 'Log Level',
        enum: ['info', 'debug', 'trace'],
        enumNames: ['Info', 'Debug', 'Trace'],
        default: 'info',
        ui: {
          widget: 'select',
          linkages: [
            {
              type: 'visibility',
              dependencies: ['content.enableDebug'],
              when: {
                field: 'content.enableDebug',
                operator: '==',
                value: true,
              },
              fulfill: { state: { visible: true } },
              otherwise: { state: { visible: false } },
            },
          ],
        },
      },
    },
    required: ['language', 'code'],
  },
}

// 模拟异步加载 schema
const fetchActionSchema = async (
  actionId: string
): Promise<ExtendedJSONSchema> => {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 300))
  return mockDynamicSchemas[actionId] || { type: 'object', properties: {} }
}

export const SchemaDefaultsExample: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null)
  const [submittedData, setSubmittedData] = useState<any>(null)
  const [currentFormValues, setCurrentFormValues] = useState<any>(null)

  // 联动函数
  const linkageFunctions = useMemo(
    () => ({
      loadActionSchema: async (formData: Record<string, any>) => {
        const actionType = formData?.actionType
        if (!actionType) {
          return { type: 'object', properties: {} }
        }
        return await fetchActionSchema(actionType)
      },
    }),
    []
  )

  // 主表单 Schema
  const schema: ExtendedJSONSchema = useMemo(
    () => ({
      type: 'object',
      title: 'Workflow Action Configuration',
      properties: {
        // 基础配置区域
        actionName: {
          type: 'string',
          title: 'Action Name',
          default: 'New Action', // 默认名称
          minLength: 1,
          maxLength: 50,
          ui: { placeholder: 'Enter action name' },
        },
        enabled: {
          type: 'boolean',
          title: 'Enable Action',
          default: true, // 默认启用
        },
        // 只有启用时才显示执行选项
        runOnStartup: {
          type: 'boolean',
          title: 'Run on Startup',
          default: false,
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['enabled'],
                when: { field: 'enabled', operator: '==', value: true },
                fulfill: { state: { visible: true } },
                otherwise: { state: { visible: false } },
              },
            ],
          },
        },
        // Action 类型选择
        actionType: {
          type: 'string',
          title: 'Action Type',
          enum: ['httpRequest', 'sendEmail', 'runScript'],
          enumNames: ['HTTP Request', 'Send Email', 'Run Script'],
          ui: {
            widget: 'select',
            placeholder: 'Select an action type',
          },
        },
        // 动态内容区域 - 根据 actionType 加载不同的 schema
        content: {
          type: 'object',
          title: 'Action Configuration',
          properties: {},
          ui: {
            linkages: [
              {
                type: 'schema',
                dependencies: ['actionType'],
                when: { field: 'actionType', operator: 'isNotEmpty' },
                fulfill: { function: 'loadActionSchema' },
              },
            ],
          },
        },
        // 高级设置
        advancedSettings: {
          type: 'object',
          title: 'Advanced Settings',
          properties: {
            maxRetries: {
              type: 'integer',
              title: 'Max Retries',
              default: 3,
              minimum: 0,
              maximum: 10,
            },
            retryDelay: {
              type: 'integer',
              title: 'Retry Delay (ms)',
              default: 1000,
              minimum: 100,
              maximum: 60000,
            },
            enableLogging: {
              type: 'boolean',
              title: 'Enable Logging',
              default: true,
            },
            // 只有启用日志才显示日志详情
            logDetails: {
              type: 'string',
              title: 'Log Details Level',
              enum: ['minimal', 'standard', 'verbose'],
              enumNames: ['Minimal', 'Standard', 'Verbose'],
              default: 'standard',
              ui: {
                widget: 'select',
                linkages: [
                  {
                    type: 'visibility',
                    dependencies: ['advancedSettings.enableLogging'],
                    when: {
                      field: 'advancedSettings.enableLogging',
                      operator: '==',
                      value: true,
                    },
                    fulfill: { state: { visible: true } },
                    otherwise: { state: { visible: false } },
                  },
                ],
              },
            },
          },
        },
      },
      required: ['actionName', 'actionType'],
    }),
    []
  )

  const handleSubmit = (data: any) => {
    console.log('Schema Defaults Example - Submitted data:', data)
    setSubmittedData(data)
  }

  const handleShowValues = () => {
    const values = formRef.current?.getValues()
    setCurrentFormValues(values)
  }

  return (
    <Card style={{ marginTop: '20px', maxWidth: '900px' }}>
      <h3>Schema 默认值与联动集成示例</h3>

      <Callout intent="primary" style={{ marginBottom: '20px' }}>
        <h4>功能演示</h4>
        <p>
          本示例演示 Schema 中的 <code>default</code> 值如何与联动系统协同工作：
        </p>
        <ul style={{ marginBottom: '10px' }}>
          <li>
            <Tag intent="success">静态默认值</Tag> Schema 中的{' '}
            <code>default</code> 值在表单初始化时自动设置
          </li>
          <li>
            <Tag intent="warning">联动计算</Tag>{' '}
            默认值参与联动计算，控制字段的显示/隐藏状态
          </li>
          <li>
            <Tag intent="primary">动态 Schema</Tag> 通过 schema 联动加载的新
            schema，其 default 值也会被自动应用
          </li>
        </ul>
      </Callout>

      <Callout intent="none" icon="info-sign" style={{ marginBottom: '20px' }}>
        <strong>测试步骤：</strong>
        <ol style={{ marginBottom: 0, paddingLeft: '20px' }}>
          <li>
            观察表单初始化时的默认值（Action Name = "New Action"，Enable Action
            = true 等）
          </li>
          <li>注意 "Run on Startup" 字段的可见性随 "Enable Action" 变化</li>
          <li>选择一个 Action Type，观察动态加载的 schema 及其默认值</li>
          <li>
            点击 "Show Current Values" 查看完整的表单数据（包含所有默认值）
          </li>
        </ol>
      </Callout>

      <Divider style={{ margin: '20px 0' }} />

      <DynamicForm
        ref={formRef}
        schema={schema}
        onSubmit={handleSubmit}
        linkageFunctions={linkageFunctions}
      />

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <Button intent="none" onClick={handleShowValues}>
          Show Current Values
        </Button>
      </div>

      {currentFormValues && (
        <Callout intent="none" style={{ marginTop: '20px' }}>
          <h4>Current Form Values:</h4>
          <pre
            style={{ marginBottom: 0, maxHeight: '300px', overflow: 'auto' }}
          >
            {JSON.stringify(currentFormValues, null, 2)}
          </pre>
        </Callout>
      )}

      {submittedData && (
        <Callout intent="success" style={{ marginTop: '20px' }}>
          <h4>Submitted Data:</h4>
          <pre
            style={{ marginBottom: 0, maxHeight: '300px', overflow: 'auto' }}
          >
            {JSON.stringify(submittedData, null, 2)}
          </pre>
        </Callout>
      )}

      <Callout style={{ marginTop: '20px' }}>
        <h4>Schema 配置</h4>
        <pre
          style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}
        >
          {JSON.stringify(schema, null, 2)}
        </pre>
      </Callout>

      <Callout style={{ marginTop: '20px' }}>
        <h4>DynamicSchema 配置</h4>
        <pre
          style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}
        >
          {JSON.stringify(mockDynamicSchemas, null, 2)}
        </pre>
      </Callout>
    </Card>
  )
}
