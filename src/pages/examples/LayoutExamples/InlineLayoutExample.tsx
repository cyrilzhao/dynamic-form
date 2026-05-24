import React, { useState } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';

/**
 * 内联布局示例
 */
export const InlineLayoutExample: React.FC = () => {
  const [formData, setFormData] = useState<any>(null);

  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: '搜索表单（内联布局）',
    properties: {
      keyword: {
        type: 'string',
        title: '关键词',
      },
      category: {
        type: 'string',
        title: '分类',
        enum: ['all', 'tech', 'life', 'work'],
        enumNames: ['全部', '技术', '生活', '工作'],
        ui: {
          widget: 'select',
        },
      },
      status: {
        type: 'string',
        title: '状态',
        enum: ['active', 'inactive'],
        enumNames: ['启用', '禁用'],
        ui: {
          widget: 'select',
        },
      },
    },
  };

  const handleSubmit = (data: any) => {
    console.log('提交数据:', data);
    setFormData(data);
  };

  return (
    <div>
      <h3>内联布局示例</h3>
      <p>所有字段在同一行显示</p>

      <DynamicForm
        schema={schema}
        layout="inline"
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
