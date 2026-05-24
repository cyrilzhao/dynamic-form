import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

/**
 * 场景4：混合依赖（外部 + 内部相对路径）
 * 业务场景：高级工作信息字段同时依赖全局开关和联系人类型
 */
export const MixedDependencyExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      enableAdvanced: {
        type: 'boolean',
        title: '启用高级功能',
        default: false,
      },
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
            advancedWorkInfo: {
              type: 'string',
              title: '高级工作信息',
              ui: {
                linkages: [{
                  type: 'visibility',
                  dependencies: [
                    '#/properties/enableAdvanced', // JSON Pointer：外部字段
                    './type', // 相对路径：内部字段
                  ],
                  when: {
                    and: [
                      { field: '#/properties/enableAdvanced', operator: '==', value: true },
                      { field: './type', operator: '==', value: 'work' },
                    ],
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
    enableAdvanced: false,
    contacts: [
      {
        name: '张三',
        type: 'personal',
      },
    ],
  };

  const handleSubmit = (data: any) => {
    console.log('提交的数据:', data);
    alert('数据已提交，请查看控制台');
  };

  return (
    <div>
      <h2>场景4：混合依赖（外部 + 内部相对路径）</h2>
      <p>
        <strong>业务场景：</strong>高级工作信息字段同时依赖全局开关和联系人类型
      </p>
      <p>
        <strong>依赖关系图：</strong>
      </p>
      <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        {`enableAdvanced (外部)
        \\
         \\
          ↓
    advancedWorkInfo
          ↑
         /
        /
  type (内部)`}
      </pre>
      <p>
        <strong>技术要点：</strong>
      </p>
      <ul>
        <li>同时使用 JSON Pointer 和相对路径</li>
        <li>外部字段变化影响所有数组元素</li>
        <li>内部字段变化只影响当前元素</li>
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
