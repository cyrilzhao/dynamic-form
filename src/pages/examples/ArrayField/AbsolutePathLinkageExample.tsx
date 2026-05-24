import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

/**
 * 场景2：绝对路径依赖（数组内依赖外部）
 * 业务场景：全局开关控制所有联系人的 VIP 等级字段显示
 */
export const AbsolutePathLinkageExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      enableVip: {
        type: 'boolean',
        title: '启用 VIP 功能',
        default: false,
      },
      contacts: {
        type: 'array',
        title: '联系人列表',
        items: {
          type: 'object',
          title: '联系人',
          properties: {
            name: {
              type: 'string',
              title: '姓名',
              minLength: 1,
            },
            phone: {
              type: 'string',
              title: '电话',
            },
            vipLevel: {
              type: 'string',
              title: 'VIP 等级',
              enum: ['bronze', 'silver', 'gold', 'platinum'],
              enumNames: ['青铜', '白银', '黄金', '铂金'],
              ui: {
                placeholder: '请选择 VIP 等级',
                linkages: [{
                  type: 'visibility',
                  dependencies: ['#/properties/enableVip'], // JSON Pointer 绝对路径
                  when: {
                    field: '#/properties/enableVip',
                    operator: '==',
                    value: true,
                  },
                  fulfill: {
                    state: { visible: true },
                  },
                  otherwise: {
                    state: { visible: false },
                    value: '',
                  },
                }],
              },
            },
          },
          required: ['name'],
        },
        minItems: 1,
        ui: {
          arrayMode: 'dynamic',
          addButtonText: '添加联系人',
        },
      },
    },
  };

  const defaultValues = {
    enableVip: false,
    contacts: [
      {
        name: '张三',
        phone: '13800138000',
      },
    ],
  };

  const handleSubmit = (data: any) => {
    console.log('提交的数据:', data);
    alert('数据已提交，请查看控制台');
  };

  return (
    <div>
      <h2>场景2：绝对路径依赖（数组内依赖外部）</h2>
      <p>
        <strong>业务场景：</strong>全局开关控制所有联系人的 VIP 等级字段显示
      </p>
      <p>
        <strong>技术要点：</strong>
      </p>
      <ul>
        <li>
          使用 JSON Pointer <code>#/properties/enableVip</code> 引用外部字段
        </li>
        <li>外部字段变化影响所有数组元素</li>
        <li>一对多依赖关系</li>
      </ul>

      <DynamicForm schema={schema} defaultValues={defaultValues} onSubmit={handleSubmit} />

      <Card style={{ marginTop: '20px' }}>
        <H3>Schema 配置</H3>
        <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(schema, null, 2)}
        </pre>
      </Card>
    </div>
  );
};
