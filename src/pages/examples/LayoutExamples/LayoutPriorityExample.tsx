import React, { useState } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';

/**
 * 布局优先级示例
 * 展示全局 layout 和 schema 中 ui.layout 的优先级关系
 */
export const LayoutPriorityExample: React.FC = () => {
  const [formData, setFormData] = useState<any>(null);

  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: '布局优先级示例',
    properties: {
      section1: {
        type: 'object',
        title: '第一部分（使用全局 vertical 布局, field2 覆盖为 horizontal 布局）',
        properties: {
          field1: {
            type: 'string',
            title: '字段1',
          },
          field2: {
            type: 'string',
            title: '字段2',
            ui: {
              layout: 'horizontal',
            },
          },
        },
      },
      section2: {
        type: 'object',
        title: '第二部分（覆盖为 horizontal 布局, 字段3又覆盖为 vertical 布局）',
        ui: {
          layout: 'horizontal',
        },
        properties: {
          field3: {
            type: 'string',
            title: '字段3',
            ui: {
              layout: 'vertical',
            },
          },
          field4: {
            type: 'string',
            title: '字段4',
          },
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
      <h3>布局优先级示例</h3>
      <p>全局配置：vertical，第二部分覆盖为 horizontal</p>

      <DynamicForm schema={schema} layout="vertical" onSubmit={handleSubmit} />

      {formData && (
        <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5' }}>
          <h4>提交的数据：</h4>
          <pre>{JSON.stringify(formData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
