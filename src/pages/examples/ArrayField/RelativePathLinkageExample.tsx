import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

/**
 * 场景1：相对路径依赖
 * 业务场景：联系人类型为"工作"时显示公司名称字段
 */
export const RelativePathLinkageExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      contacts: {
        type: 'array',
        title: '联系人列表',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              title: '姓名',
              minLength: 1,
            },
            type: {
              type: 'string',
              title: '联系人类型',
              enum: ['personal', 'work'],
              enumNames: ['个人', '工作'],
              ui: {
                placeholder: '请选择联系人类型',
              },
            },
            companyName: {
              type: 'string',
              title: '公司名称',
              ui: {
                linkages: [{
                  type: 'visibility',
                  dependencies: ['./type'], // 相对路径：引用同级字段
                  when: {
                    field: './type',
                    operator: '==',
                    value: 'work',
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
            phone: {
              type: 'string',
              title: '电话',
            },
          },
          required: ['name', 'type'],
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
    contacts: [
      {
        name: '张三',
        type: 'work',
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
      <h2>场景1：相对路径依赖</h2>
      <p>
        <strong>业务场景：</strong>联系人类型为"工作"时显示公司名称字段
      </p>
      <p>
        <strong>技术要点：</strong>
      </p>
      <ul>
        <li>
          使用相对路径 <code>./type</code> 引用同级字段
        </li>
        <li>每个数组元素独立联动，互不影响</li>
        <li>
          路径自动解析：<code>contacts.0.companyName</code> → <code>contacts.0.type</code>
        </li>
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
