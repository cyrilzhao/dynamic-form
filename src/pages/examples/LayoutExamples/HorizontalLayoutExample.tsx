import React, { useState } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';

/**
 * 水平布局示例
 */
export const HorizontalLayoutExample: React.FC = () => {
  const [formData, setFormData] = useState<any>(null);

  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: '用户信息表单（水平布局）',
    properties: {
      username: {
        type: 'string',
        title: '用户名',
        minLength: 3,
      },
      email: {
        type: 'string',
        title: '邮箱',
        format: 'email',
      },
      phone: {
        type: 'string',
        title: '手机号',
      },
      address: {
        type: 'string',
        title: '地址',
      },
    },
    required: ['username', 'email'],
  };

  const handleSubmit = (data: any) => {
    console.log('提交数据:', data);
    setFormData(data);
  };

  return (
    <div>
      <h3>水平布局示例</h3>
      <p>标签在左，输入框在右</p>

      <DynamicForm
        schema={schema}
        layout="horizontal"
        labelWidth={120}
        onSubmit={handleSubmit}
      />

      {formData && (
        <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5' }}>
          <h4>提交的数据：</h4>
          <pre>{JSON.stringify(formData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
