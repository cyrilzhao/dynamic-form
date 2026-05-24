import React, { useState } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';

/**
 * 综合示例：layout 和 labelWidth 的层级继承
 */
export const ComprehensiveExample: React.FC = () => {
  const [formData, setFormData] = useState<any>(null);

  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: '综合示例：布局和标签宽度的层级继承',
    properties: {
      basicInfo: {
        type: 'object',
        title: '基本信息（horizontal + 200px）',
        ui: {
          layout: 'horizontal',
          labelWidth: 200,
        },
        properties: {
          name: {
            type: 'string',
            title: '姓名',
          },
          age: {
            type: 'integer',
            title: '年龄',
          },
        },
      },
      contactInfo: {
        type: 'object',
        title: '联系信息（horizontal + 350px）',
        ui: {
          layout: 'horizontal',
          labelWidth: 350,
        },
        properties: {
          email: {
            type: 'string',
            title: '电子邮箱',
            format: 'email',
          },
          phone: {
            type: 'string',
            title: '手机号码',
            ui: {
              labelWidth: 80, // 覆盖父级的 150px
            },
          },
        },
      },
      address: {
        type: 'object',
        title: '地址信息（horizontal）',
        ui: {
          layout: 'horizontal',
          flattenPath: true,
          flattenPrefix: true,
        },
        properties: {
          province: {
            type: 'string',
            title: '省份（inherit）',
            ui: {
              labelWidth: 300,
            },
          },
          city: {
            type: 'string',
            title: '城市（vertical）',
            ui: {
              layout: 'vertical',
            },
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
      <h3>综合示例</h3>
      <p>展示 layout 和 labelWidth 在不同层级的继承和覆盖</p>

      <DynamicForm schema={schema} layout="vertical" labelWidth={120} onSubmit={handleSubmit} />

      {formData && (
        <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5' }}>
          <h4>提交的数据：</h4>
          <pre>{JSON.stringify(formData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};
