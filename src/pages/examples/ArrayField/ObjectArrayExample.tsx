import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

export const ObjectArrayExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      contacts: {
        type: 'array',
        title: '联系人',
        items: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              title: '姓名',
              minLength: 3,
            },
            phone: {
              type: 'string',
              title: '电话',
              pattern: '^1[3-9]\\d{9}$',
            },
            email: {
              type: 'string',
              title: '邮箱',
              format: 'email',
            },
            type: {
              type: 'string',
              title: '类型',
              enum: ['personal', 'work'],
              enumNames: ['个人', '工作'],
            },
          },
          required: ['name', 'phone'],
        },
        minItems: 1,
        ui: {
          arrayMode: 'dynamic',
          addButtonText: '添加联系人',
          emptyText: '暂无联系人',
        },
      },
    },
  };

  const defaultValues = {
    contacts: [
      {
        name: '张三',
        phone: '13800138000',
        email: 'zhang@example.com',
        type: 'personal',
      },
    ],
  };

  const handleSubmit = (data: any) => {
    console.log('对象数组数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    // <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
    //   <h3>对象数组</h3>
    //   <p>数组的每一项都是一个对象，自动使用 NestedFormWidget 渲染。</p>
    //   <ul style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
    //     <li>每个数组项渲染为嵌套表单</li>
    //     <li>支持复杂的对象结构</li>
    //     <li>支持独立的验证规则</li>
    //     <li>支持动态增删</li>
    //   </ul>
    //   <DynamicForm schema={schema} defaultValues={defaultValues} onSubmit={handleSubmit} />
    // </Card>

    <div>
      <H3>对象数组</H3>
      <p>数组的每一项都是一个对象，自动使用 NestedFormWidget 渲染。</p>

      <Card style={{ marginTop: '20px' }}>
        <DynamicForm schema={schema} defaultValues={defaultValues} onSubmit={handleSubmit} />
      </Card>

      <Card style={{ marginTop: '20px' }}>
        <H3>说明</H3>
        <ul style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
          <li>每个数组项渲染为嵌套表单</li>
          <li>支持复杂的对象结构</li>
          <li>支持独立的验证规则</li>
          <li>支持动态增删</li>
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
