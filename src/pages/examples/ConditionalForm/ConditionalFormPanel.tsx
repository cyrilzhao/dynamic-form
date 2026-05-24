import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card } from '@blueprintjs/core';

export const ConditionalFormPanel: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      hasAddress: {
        type: 'boolean',
        title: '是否填写地址',
      },
      address: {
        type: 'string',
        title: '详细地址',
        minLength: 5,
        ui: {
          placeholder: '请输入详细地址',
          linkages: [{
            type: 'visibility',
            dependencies: ['hasAddress'],
            when: {
              field: 'hasAddress',
              operator: '==',
              value: true,
            },
            fulfill: {
              state: { visible: true },
            },
            otherwise: {
              state: { visible: false },
            },
          }],
        },
      },
    },
    if: {
      properties: { hasAddress: { const: true } },
    },
    then: {
      required: ['address'],
    },
  };

  const handleSubmit = (data: any) => {
    console.log('条件表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>条件渲染示例</h3>
      <p>当勾选"是否填写地址"时，地址字段会显示并变为必填。</p>
      <DynamicForm schema={schema} onSubmit={handleSubmit} />
    </Card>
  );
};
