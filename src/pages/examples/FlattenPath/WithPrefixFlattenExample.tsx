import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card } from '@blueprintjs/core';

export const WithPrefixFlattenExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      auth: {
        type: 'object',
        title: '认证配置',
        ui: {
          flattenPath: true,
          flattenPrefix: true,
        },
        properties: {
          content: {
            type: 'object',
            ui: {
              flattenPath: true,
            },
            properties: {
              key: {
                type: 'string',
                title: '密钥',
                minLength: 10,
                ui: {
                  placeholder: '请输入密钥',
                },
              },
              secret: {
                type: 'string',
                title: '密文',
                ui: {
                  widget: 'password',
                  placeholder: '请输入密文',
                },
              },
            },
            required: ['key', 'secret'],
          },
        },
      },
    },
  };

  const handleSubmit = (data: any) => {
    console.log('带前缀透明化表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>带前缀的透明化</h3>
      <p>
        使用 <code>flattenPrefix: true</code> 后，字段标签会自动添加父级标题作为前缀。
        <br />
        表单显示：
      </p>
      <ul style={{ fontSize: '14px', color: '#666' }}>
        <li>认证配置 - 密钥</li>
        <li>认证配置 - 密文</li>
      </ul>
      <p>提交数据结构：<code>{`{ auth: { content: { key: '...', secret: '...' } } }`}</code></p>
      <DynamicForm schema={schema} onSubmit={handleSubmit} />
    </Card>
  );
};
