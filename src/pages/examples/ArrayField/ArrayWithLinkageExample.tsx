import React from 'react';
import { DynamicForm } from '@/components/DynamicForm/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

/**
 * 数组字段 + 字段联动示例
 *
 * 展示如何在数组字段和数组元素内部使用字段联动特性
 */
export const ArrayWithLinkageExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      showContacts: {
        type: 'boolean',
        title: '显示联系人列表',
        default: true,
      },
      contacts: {
        type: 'array',
        title: '联系人列表',
        items: {
          type: 'object',
          title: '联系人',
          properties: {
            type: {
              type: 'string',
              title: '类型',
              enum: ['personal', 'work'],
              enumNames: ['个人', '工作'],
              default: 'personal',
            },
            name: {
              type: 'string',
              title: '姓名',
              minLength: 1,
            },
            phone: {
              type: 'string',
              title: '电话',
              pattern: '^1[3-9]\\d{9}$',
            },
            companyName: {
              type: 'string',
              title: '公司名称',
              ui: {
                linkages: [{
                  type: 'visibility',
                  dependencies: ['./type'],
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
            department: {
              type: 'string',
              title: '部门',
              ui: {
                linkages: [{
                  type: 'visibility',
                  dependencies: ['./type'],
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
          },
          required: ['type', 'name', 'phone'],
        },
        minItems: 1,
        ui: {
          arrayMode: 'dynamic',
          addButtonText: '添加联系人',
          linkages: [{
            type: 'visibility',
            dependencies: ['showContacts'],
            when: {
              field: 'showContacts',
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
  };

  const defaultValues = {
    showContacts: true,
    contacts: [
      {
        type: 'personal',
        name: '张三',
        phone: '13800138000',
      },
    ],
  };

  const handleSubmit = (data: any) => {
    console.log('提交的数据:', data);
    alert('提交成功！请查看控制台输出。');
  };

  return (
    <div>
      <H3>数组字段 + 字段联动</H3>
      <p>
        这个示例展示了如何在数组字段和数组元素内部使用字段联动特性。包括数组字段的显示/隐藏联动，
        以及数组元素内部字段的联动（使用相对路径）。
      </p>

      <Card style={{ marginTop: '20px' }}>
        <DynamicForm schema={schema} defaultValues={defaultValues} onSubmit={handleSubmit} />
      </Card>

      <Card style={{ marginTop: '20px' }}>
        <H3>说明</H3>
        <ul>
          <li>
            <strong>数组字段联动</strong>：<code>contacts</code> 数组的显示/隐藏由{' '}
            <code>showContacts</code> 字段控制
          </li>
          <li>
            <strong>数组元素内部联动</strong>：当 <code>type</code> 为"工作"时，显示{' '}
            <code>companyName</code> 和 <code>department</code> 字段
          </li>
          <li>
            <strong>相对路径</strong>：使用 <code>./type</code> 引用同一数组元素内的{' '}
            <code>type</code> 字段
          </li>
          <li>
            <strong>操作步骤</strong>：
            <ol>
              <li>取消勾选"显示联系人列表"，联系人数组会隐藏</li>
              <li>将联系人类型改为"工作"，会显示公司名称和部门字段</li>
            </ol>
          </li>
        </ul>
      </Card>

      <Card style={{ marginTop: '20px' }}>
        <H3>Schema 配置</H3>
        <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(schema, null, 2)}
        </pre>
      </Card>
    </div>
  );
};
