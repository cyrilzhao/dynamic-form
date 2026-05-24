import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3, H4 } from '@blueprintjs/core';

export const KeyValueArrayExample: React.FC = () => {
  // 示例 1: 环境变量
  const envSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      envVars: {
        type: 'array',
        title: 'Environment Variables',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', title: 'Key' },
            value: { type: 'string', title: 'Value' },
          },
        },
        ui: {
          widget: 'key-value-array',
          widgetProps: {
            keyField: 'key',
            valueField: 'value',
            keyLabel: 'Variable Name',
            valueLabel: 'Variable Value',
            keyPlaceholder: 'e.g., API_KEY',
            valuePlaceholder: 'e.g., your-api-key',
            addButtonText: 'Add Variable',
          },
        },
      },
    },
  };

  const envDefaultValues = {
    envVars: [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'API_URL', value: 'https://api.example.com' },
      { key: 'DEBUG', value: 'false' },
    ],
  };

  // 示例 2: HTTP 请求头
  const headersSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      headers: {
        type: 'array',
        title: 'HTTP Headers',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Header Name' },
            value: { type: 'string', title: 'Header Value' },
          },
        },
        ui: {
          widget: 'key-value-array',
          widgetProps: {
            keyField: 'name',
            valueField: 'value',
            keyLabel: 'Header',
            valueLabel: 'Value',
            keyPlaceholder: 'e.g., Content-Type',
            valuePlaceholder: 'e.g., application/json',
            addButtonText: 'Add Header',
          },
        },
      },
    },
  };

  const headersDefaultValues = {
    headers: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Authorization', value: 'Bearer token123' },
    ],
  };

  // 示例 3: 输出变量映射
  const outputMappingSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      outputMappings: {
        type: 'array',
        title: 'Output Variable Mapping',
        items: {
          type: 'object',
          properties: {
            target: { type: 'string', title: 'Target' },
            source: { type: 'string', title: 'Source' },
          },
        },
        minItems: 1,
        ui: {
          widget: 'key-value-array',
          widgetProps: {
            keyField: 'target',
            valueField: 'source',
            keyLabel: 'Variable Name',
            valueLabel: 'Expression',
            keyPlaceholder: 'e.g., userId',
            valuePlaceholder: 'e.g., $.user.id',
            addButtonText: 'Add Mapping',
          },
        },
      },
    },
  };

  const outputMappingDefaultValues = {
    outputMappings: [
      { target: 'userId', source: '$.user.id' },
      { target: 'userName', source: '$.user.name' },
    ],
  };

  const handleSubmit = (data: any, title: string) => {
    console.log(`${title} 数据:`, data);
    alert(`提交成功！请查看控制台输出`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <H3>KeyValueArrayWidget 示例</H3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        KeyValueArrayWidget 专门用于渲染键值对数组，提供简洁的表格式布局，适用于环境变量、HTTP 头、输出映射等场景。
      </p>

      {/* 示例 1: 环境变量 */}
      <Card style={{ marginBottom: '30px' }}>
        <H4>示例 1: 环境变量配置</H4>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          使用 KeyValueArrayWidget 管理应用的环境变量配置。
        </p>
        <DynamicForm
          schema={envSchema}
          defaultValues={envDefaultValues}
          onSubmit={(data) => handleSubmit(data, '环境变量')}
        />
      </Card>

      {/* 示例 2: HTTP 请求头 */}
      <Card style={{ marginBottom: '30px' }}>
        <H4>示例 2: HTTP 请求头配置</H4>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          配置 HTTP 请求的自定义请求头。
        </p>
        <DynamicForm
          schema={headersSchema}
          defaultValues={headersDefaultValues}
          onSubmit={(data) => handleSubmit(data, 'HTTP 请求头')}
        />
      </Card>

      {/* 示例 3: 输出变量映射 */}
      <Card style={{ marginBottom: '30px' }}>
        <H4>示例 3: 输出变量映射</H4>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          配置工作流节点的输出变量映射关系（至少需要一个映射）。
        </p>
        <DynamicForm
          schema={outputMappingSchema}
          defaultValues={outputMappingDefaultValues}
          onSubmit={(data) => handleSubmit(data, '输出变量映射')}
        />
      </Card>

      {/* 特性说明 */}
      <Card>
        <H4>特性说明</H4>
        <ul style={{ fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
          <li>✅ 表格式布局，固定两列（键和值）</li>
          <li>✅ 支持自定义字段名（keyField、valueField）</li>
          <li>✅ 支持自定义列标题和占位符</li>
          <li>✅ 支持动态添加和删除</li>
          <li>✅ 支持最小/最大项数限制</li>
          <li>✅ 删除操作带确认弹窗</li>
          <li>✅ 简洁的 UI，适合键值对场景</li>
        </ul>
      </Card>

      {/* Schema 配置示例 */}
      <Card style={{ marginTop: '20px' }}>
        <H4>Schema 配置示例</H4>
        <pre style={{ background: '#f5f5f5', padding: '15px', overflow: 'auto', fontSize: '13px' }}>
          {JSON.stringify(envSchema, null, 2)}
        </pre>
      </Card>
    </div>
  );
};
