import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card } from '@blueprintjs/core';

export const StaticNestedExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        title: '姓名',
        ui: {
          placeholder: '请输入姓名',
        },
      },
      address: {
        type: 'object',
        title: '地址信息',
        properties: {
          street: {
            type: 'string',
            title: '街道',
            ui: {
              placeholder: '请输入街道地址',
            },
          },
          city: {
            type: 'string',
            title: '城市',
            ui: {
              placeholder: '请输入城市',
            },
          },
          zipCode: {
            type: 'string',
            title: '邮政编码',
            ui: {
              placeholder: '请输入邮政编码',
            },
          },
        },
        required: ['city'],
        ui: {
          widget: 'nested-form',
        },
      },
    },
    required: ['name'],
  };

  const handleSubmit = (data: any) => {
    console.log('静态嵌套表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>静态嵌套表单</h3>
      <p>地址信息使用嵌套表单组件，包含街道、城市和邮政编码字段。</p>
      <DynamicForm schema={schema} onSubmit={handleSubmit} />
    </Card>
  );
};
