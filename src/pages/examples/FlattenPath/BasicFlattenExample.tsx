import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card } from '@blueprintjs/core';

export const BasicFlattenExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      auth: {
        type: 'object',
        title: '认证信息',
        ui: {
          flattenPath: true,
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
                title: 'API Key',
                minLength: 10,
                ui: {
                  placeholder: '请输入至少10个字符的API密钥',
                  errorMessages: {
                    required: 'API Key 不能为空',
                    minLength: 'API Key 至少需要10个字符',
                  },
                },
              },
            },
            required: ['key'],
          },
        },
      },
    },
  };

  const handleSubmit = (data: any) => {
    console.log('基础透明化表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>基础用法：不带前缀的透明化</h3>
      <p>
        后端接口要求的数据结构为 <code>{`{ auth: { content: { key: 'value' } } }`}</code>
        <br />
        但表单只显示一个 "API Key" 输入框，提交时自动构建完整的嵌套结构。
      </p>
      <DynamicForm schema={schema} onSubmit={handleSubmit} />
    </Card>
  );
};
