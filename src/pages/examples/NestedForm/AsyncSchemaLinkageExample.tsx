import React, { useState, useMemo } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, Callout, Tag } from '@blueprintjs/core';

/**
 * 模拟不同 Action 对应的 content schema
 * 实际场景中这些数据会从服务器获取
 */
const mockActionSchemas: Record<string, ExtendedJSONSchema> = {
  agentA: {
    type: 'object',
    properties: {
      body: {
        type: 'object',
        title: 'Body',
        properties: {
          input: {
            title: 'PromptA',
            type: 'string',
            ui: {
              widget: 'textarea',
            },
          },
        },
        ui: {
          flattenPath: true,
        },
      },
    },
  },
  agentB: {
    type: 'object',
    properties: {
      body: {
        type: 'object',
        title: 'Body',
        properties: {
          input: {
            title: 'PromptB',
            type: 'string',
            ui: {
              widget: 'textarea',
            },
          },
        },
        ui: {
          flattenPath: true,
        },
      },
    },
  },
  sendEmail: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        title: 'Recipient',
        format: 'email',
        ui: { placeholder: 'Enter email address' },
      },
      subject: {
        type: 'string',
        title: 'Subject',
        minLength: 1,
        ui: { placeholder: 'Enter email subject' },
      },
      body: {
        type: 'string',
        title: 'Body',
        ui: {
          widget: 'textarea',
          placeholder: 'Enter email content',
        },
      },
      attachments: {
        type: 'boolean',
        title: 'Include Attachments',
        default: false,
      },
    },
    required: ['to', 'subject', 'body'],
  },
  httpRequest: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        title: 'HTTP Method',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'GET',
        ui: { widget: 'select' },
      },
      url: {
        type: 'string',
        title: 'URL',
        format: 'uri',
        ui: { placeholder: 'https://api.example.com/endpoint' },
      },
      headers: {
        type: 'string',
        title: 'Headers (JSON)',
        ui: {
          widget: 'textarea',
          placeholder: '{"Content-Type": "application/json"}',
        },
      },
      body: {
        type: 'string',
        title: 'Request Body',
        ui: {
          widget: 'textarea',
          placeholder: 'Enter request body (JSON)',
        },
      },
      timeout: {
        type: 'number',
        title: 'Timeout (ms)',
        default: 30000,
        minimum: 1000,
        maximum: 120000,
      },
    },
    required: ['method', 'url'],
  },
  runScript: {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        title: 'Script Language',
        enum: ['javascript', 'python', 'shell'],
        enumNames: ['JavaScript', 'Python', 'Shell'],
        default: 'javascript',
        ui: { widget: 'radio' },
      },
      code: {
        type: 'string',
        title: 'Script Code',
        ui: {
          widget: 'textarea',
          placeholder: '// Enter your script here',
        },
      },
      environment: {
        type: 'object',
        title: 'Environment Variables',
        properties: {
          NODE_ENV: {
            type: 'string',
            title: 'NODE_ENV',
            enum: ['development', 'production', 'test'],
            default: 'development',
          },
        },
      },
    },
    required: ['language', 'code'],
  },
  delay: {
    type: 'object',
    properties: {
      duration: {
        type: 'number',
        title: 'Delay Duration (seconds)',
        minimum: 1,
        maximum: 3600,
        default: 5,
      },
      unit: {
        type: 'string',
        title: 'Time Unit',
        enum: ['seconds', 'minutes', 'hours'],
        enumNames: ['Seconds', 'Minutes', 'Hours'],
        default: 'seconds',
        ui: { widget: 'select' },
      },
    },
    required: ['duration', 'unit'],
  },
};

// 用于追踪 API 调用次数，演示缓存效果
let apiCallCount = 0;

/**
 * 模拟异步 API 调用
 * 实际场景中会从服务器获取 schema
 */
const fetchActionSchema = async (actionId: string): Promise<ExtendedJSONSchema> => {
  apiCallCount++;
  const callNumber = apiCallCount;

  console.log(`[API Call #${callNumber}] Fetching schema for action: ${actionId}`);

  // 模拟网络延迟（不同 action 有不同的延迟时间，用于演示竞态条件处理）
  const delays: Record<string, number> = {
    sendEmail: 800,
    httpRequest: 1200,
    runScript: 600,
    delay: 400,
  };

  await new Promise(resolve => setTimeout(resolve, delays[actionId] || 500));

  const schema = mockActionSchemas[actionId];
  if (!schema) {
    throw new Error(`Schema not found for action: ${actionId}`);
  }

  console.log(`[API Call #${callNumber}] Schema loaded for ${actionId}`);
  return schema;
};

export const AsyncSchemaLinkageExample: React.FC = () => {
  const [submittedData, setSubmittedData] = useState<any>(null);
  const [currentApiCalls, setCurrentApiCalls] = useState(0);

  // 定义联动函数
  const linkageFunctions = useMemo(
    () => ({
      /**
       * 异步加载 action 对应的 content schema
       * 演示：
       * 1. 异步联动 - 函数返回 Promise
       * 2. 竞态条件处理 - 快速切换时只应用最新结果
       * 3. 缓存机制 - 通过 enableCache 启用
       */
      loadActionContentSchema: async (formData: Record<string, any>) => {
        const actionId = formData?.actionId;

        if (!actionId) {
          return { type: 'object', properties: {} };
        }

        // 更新 API 调用计数（用于 UI 展示）
        setCurrentApiCalls(prev => prev + 1);

        try {
          const schema = await fetchActionSchema(actionId);
          return schema;
        } catch (error) {
          console.error('Failed to load action schema:', error);
          return { type: 'object', properties: {} };
        }
      },
    }),
    []
  );

  // 表单 Schema 定义
  const schema: ExtendedJSONSchema = useMemo(
    () => ({
      type: 'object',
      title: 'Workflow Action Configuration',
      properties: {
        // Action 选择器（下拉菜单）
        actionId: {
          type: 'string',
          title: 'Action Type',
          enum: ['sendEmail', 'httpRequest', 'runScript', 'delay', 'agentA', 'agentB'],
          enumNames: ['Send Email', 'HTTP Request', 'Run Script', 'Delay', 'AgentA', 'AgentB'],
          ui: {
            widget: 'select',
            placeholder: 'Select an action type',
          },
        },
        // Action 名称
        actionName: {
          type: 'string',
          title: 'Action Name',
          minLength: 1,
          maxLength: 50,
          ui: {
            placeholder: 'Enter a name for this action',
          },
        },
        // 动态 content 字段 - 根据 actionId 变化
        content: {
          type: 'object',
          title: 'Action Configuration',
          properties: {},
          ui: {
            // 使用 schema 类型联动，根据 actionId 动态加载 schema
            linkages: [{
              type: 'schema',
              dependencies: ['#/properties/actionId'],
              // 启用缓存，避免重复的 API 调用
              // enableCache: true,
              when: {
                field: '#/properties/actionId',
                operator: 'isNotEmpty',
              },
              fulfill: {
                function: 'loadActionContentSchema',
              },
            }],
          },
        },
        // 其他配置
        enabled: {
          type: 'boolean',
          title: 'Enable Action',
          default: true,
        },
        description: {
          type: 'string',
          title: 'Description',
          ui: {
            widget: 'textarea',
            placeholder: 'Optional description for this action',
          },
        },
      },
      required: ['actionId', 'actionName'],
    }),
    []
  );

  const handleSubmit = (data: any) => {
    console.log('Async Schema Linkage Example - Submitted data:', data);
    setSubmittedData(data);
  };

  const resetApiCounter = () => {
    apiCallCount = 0;
    setCurrentApiCalls(0);
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '900px' }}>
      <h3>Async Schema Linkage Example</h3>

      <Callout intent="primary" style={{ marginBottom: '20px' }}>
        <h4>场景：工作流 Action 配置</h4>
        <p>
          本示例演示了异步联动和结果缓存功能。当切换 <code>actionId</code> 下拉菜单时，
          <code>content</code> 字段的 schema 会动态变化。
        </p>
        <ul style={{ marginBottom: '10px' }}>
          <li>
            <strong>异步联动</strong>：schema 从服务器异步加载（模拟 400-1200ms 延迟）
          </li>
          <li>
            <strong>竞态条件处理</strong>：快速切换时，只应用最新的请求结果
          </li>
          <li>
            <strong>结果缓存</strong>：启用 <code>enableCache: true</code>，相同 actionId
            不会重复请求
          </li>
        </ul>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Tag intent="warning" large>
            API Calls: {currentApiCalls}
          </Tag>
          <button onClick={resetApiCounter} style={{ cursor: 'pointer' }}>
            Reset Counter
          </button>
        </div>
      </Callout>

      <Callout intent="none" icon="info-sign" style={{ marginBottom: '20px' }}>
        <strong>测试步骤：</strong>
        <ol style={{ marginBottom: 0, paddingLeft: '20px' }}>
          <li>选择一个 Action Type，观察 content 区域动态加载</li>
          <li>快速连续切换不同的 Action Type，观察控制台日志（竞态条件处理）</li>
          <li>切换回之前选过的 Action Type，观察 API Calls 计数（缓存生效时不会增加）</li>
          <li>填写表单并提交，查看完整的数据结构</li>
        </ol>
      </Callout>

      <DynamicForm schema={schema} onSubmit={handleSubmit} linkageFunctions={linkageFunctions} />

      {submittedData && (
        <Callout intent="success" style={{ marginTop: '20px' }}>
          <h4>Submitted Data:</h4>
          <pre style={{ marginBottom: 0, maxHeight: '300px', overflow: 'auto' }}>
            {JSON.stringify(submittedData, null, 2)}
          </pre>
        </Callout>
      )}
    </Card>
  );
};
