import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import type { LinkageFunction, LinkageFunctionContext } from '@/components/DynamicForm/types/linkage';
import { Card, H3 } from '@blueprintjs/core';

/**
 * 场景3：菱形依赖（复杂依赖关系）
 * 业务场景：联系人的工作信息字段依赖两个中间计算字段
 */
export const DiamondDependencyExample: React.FC = () => {
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
            showCompany: {
              type: 'boolean',
              title: '显示公司信息',
              ui: {
                readonly: true,
                linkages: [{
                  type: 'value',
                  dependencies: ['./type'],
                  fulfill: {
                    function: 'calcShowCompany',
                  },
                }],
              },
            },
            showDepartment: {
              type: 'boolean',
              title: '显示部门信息',
              ui: {
                readonly: true,
                linkages: [{
                  type: 'value',
                  dependencies: ['./type'],
                  fulfill: {
                    function: 'calcShowDepartment',
                  },
                }],
              },
            },
            workInfo: {
              type: 'string',
              title: '工作信息',
              ui: {
                linkages: [{
                  type: 'visibility',
                  dependencies: ['./showCompany', './showDepartment'],
                  when: {
                    and: [
                      { field: './showCompany', operator: '==', value: true },
                      { field: './showDepartment', operator: '==', value: true },
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

  // 联动函数
  const linkageFunctions: Record<string, LinkageFunction> = {
    calcShowCompany: (formData: any, context?: LinkageFunctionContext) => {
      // 使用 context 获取当前数组元素的数据
      if (context?.arrayPath && context.arrayIndex !== undefined) {
        const arrayData = formData[context.arrayPath];
        const elementData = arrayData?.[context.arrayIndex];
        return elementData?.type === 'work';
      }
      return formData?.type === 'work';
    },
    calcShowDepartment: (formData: any, context?: LinkageFunctionContext) => {
      // 使用 context 获取当前数组元素的数据
      if (context?.arrayPath && context.arrayIndex !== undefined) {
        const arrayData = formData[context.arrayPath];
        const elementData = arrayData?.[context.arrayIndex];
        return elementData?.type === 'work';
      }
      return formData?.type === 'work';
    },
  };

  const defaultValues = {
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
      <h2>场景3：菱形依赖（复杂依赖关系）</h2>
      <p>
        <strong>业务场景：</strong>联系人的工作信息字段依赖两个中间计算字段
      </p>
      <p>
        <strong>依赖关系图：</strong>
      </p>
      <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
        {`type (A)
    /      \\
   /        \\
  ↓          ↓
showCompany showDepartment
  (B)        (C)
   \\        /
    \\      /
     ↓    ↓
   workInfo (D)`}
      </pre>
      <p>
        <strong>技术要点：</strong>
      </p>
      <ul>
        <li>使用拓扑排序处理依赖关系</li>
        <li>B 和 C 可以并行计算</li>
        <li>D 必须等待 B 和 C 计算完成</li>
      </ul>

      <DynamicForm
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        linkageFunctions={linkageFunctions}
      />

      <Card style={{ marginTop: '20px' }}>
        <H3>Schema 配置</H3>
        <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(schema, null, 2)}
        </pre>
      </Card>
    </div>
  );
};
