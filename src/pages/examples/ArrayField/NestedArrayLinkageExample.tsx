import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

/**
 * 场景6：嵌套数组联动
 * 业务场景：部门列表中，员工的某些字段依赖部门类型
 */
export const NestedArrayLinkageExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      departments: {
        type: 'array',
        title: '部门列表',
        items: {
          title: '部门',
          type: 'object',
          properties: {
            name: {
              type: 'string',
              title: '部门名称',
            },
            type: {
              type: 'string',
              title: '部门类型',
              enum: ['tech', 'sales', 'hr'],
              enumNames: ['技术部', '销售部', '人力资源部'],
              ui: {
                placeholder: '请选择部门类型',
              },
            },
            employees: {
              type: 'array',
              title: '员工列表',
              items: {
                type: 'object',
                title: '员工',
                properties: {
                  name: {
                    type: 'string',
                    title: '姓名',
                  },
                  techStack: {
                    type: 'string',
                    title: '技术栈',
                    ui: {
                      linkages: [{
                        type: 'visibility',
                        dependencies: ['#/properties/departments/items/properties/type'],
                        when: {
                          field: '#/properties/departments/items/properties/type',
                          operator: '==',
                          value: 'tech',
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
                required: ['name'],
              },
              ui: {
                arrayMode: 'dynamic',
                addButtonText: '添加员工',
              },
            },
          },
          required: ['name', 'type'],
        },
        minItems: 1,
        ui: {
          arrayMode: 'dynamic',
          addButtonText: '添加部门',
        },
      },
    },
  };

  const defaultValues = {
    departments: [
      {
        name: '技术部',
        type: 'tech',
        employees: [{ name: '张三' }],
      },
    ],
  };

  const handleSubmit = (data: any) => {
    console.log('提交的数据:', data);
    alert('数据已提交，请查看控制台');
  };

  return (
    <div>
      <h2>场景6：嵌套数组联动</h2>
      <p>
        <strong>业务场景：</strong>部门列表中，员工的某些字段依赖部门类型
      </p>
      <p>
        <strong>技术要点：</strong>
      </p>
      <ul>
        <li>子数组元素依赖父数组元素字段</li>
        <li>系统自动匹配正确的父数组索引</li>
        <li>
          路径解析：<code>departments.0.employees.1.techStack</code> →{' '}
          <code>departments.0.type</code>
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
