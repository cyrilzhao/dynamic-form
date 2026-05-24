import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';

export const DynamicFormExample: React.FC = () => {
  // 基础表单示例
  const basicSchema: ExtendedJSONSchema = {
    type: 'object',
    title: '用户注册表单',
    properties: {
      username: {
        type: 'string',
        title: '用户名',
        minLength: 3,
        maxLength: 20,
        ui: {
          placeholder: '请输入用户名',
        },
      },
      email: {
        type: 'string',
        title: '邮箱',
        format: 'email',
        ui: {
          placeholder: 'example@email.com',
        },
      },
      age: {
        type: 'integer',
        title: '年龄',
        minimum: 18,
        maximum: 100,
      },
      gender: {
        type: 'string',
        title: '性别',
        enum: ['male', 'female', 'other'],
        enumNames: ['男', '女', '其他'],
        ui: {
          widget: 'radio',
        },
      },
    },
    required: ['username', 'email'],
  };

  const handleSubmit = (data: any) => {
    console.log('表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>基础表单示例</h2>
      <DynamicForm schema={basicSchema} onSubmit={handleSubmit} />
    </div>
  );
};
