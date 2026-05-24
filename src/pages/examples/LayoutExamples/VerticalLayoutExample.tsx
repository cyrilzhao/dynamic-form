import React, { useState } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';

/**
 * 垂直布局示例
 */
export const VerticalLayoutExample: React.FC = () => {
  const [formData, setFormData] = useState<any>(null);

  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: '用户信息表单（垂直布局）',
    properties: {
      username: {
        type: 'string',
        title: '用户名',
        minLength: 3,
        maxLength: 20,
      },
      email: {
        type: 'string',
        title: '邮箱',
        format: 'email',
      },
      age: {
        type: 'integer',
        title: '年龄',
        minimum: 18,
        maximum: 100,
      },
      bio: {
        type: 'string',
        title: '个人简介',
        ui: {
          widget: 'textarea',
        },
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
      <h3>垂直布局示例</h3>
      <p>标签在上，输入框在下（默认布局）</p>

      <DynamicForm
        schema={schema}
        layout="vertical"
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
