import React, { useState } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';

/**
 * labelWidth 优先级示例
 */
export const LabelWidthPriorityExample: React.FC = () => {
  const [formData, setFormData] = useState<any>(null);

  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: 'labelWidth 优先级示例',
    properties: {
      field1: {
        type: 'string',
        title: '字段1（使用全局 120px）',
      },
      field2: {
        type: 'string',
        title: '字段2（覆盖为 180px）',
        ui: {
          labelWidth: 180,
        },
      },
      field3: {
        type: 'string',
        title: '字段3（覆盖为 80px）',
        ui: {
          labelWidth: 80,
        },
      },
      field4: {
        type: 'string',
        title: '字段4（使用全局 120px）',
      },
    },
  };

  const handleSubmit = (data: any) => {
    console.log('提交数据:', data);
    setFormData(data);
  };

  return (
    <div>
      <h3>labelWidth 优先级示例</h3>
      <p>全局配置：120px，部分字段覆盖为不同宽度</p>

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
