import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card } from '@blueprintjs/core';

export const ArrayNestedExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        title: '项目名称',
        ui: {
          placeholder: '请输入项目名称',
        },
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
              ui: {
                placeholder: '请输入姓名',
              },
            },
            phone: {
              type: 'string',
              title: '电话',
              format: 'phone',
              ui: {
                placeholder: '请输入电话号码',
              },
            },
            email: {
              type: 'string',
              title: '邮箱',
              format: 'email',
              ui: {
                placeholder: '请输入邮箱地址',
              },
            },
            address: {
              type: 'object',
              title: '地址',
              properties: {
                city: {
                  type: 'string',
                  title: '城市',
                  ui: {
                    placeholder: '请输入城市',
                  },
                },
                street: {
                  type: 'string',
                  title: '街道',
                  ui: {
                    placeholder: '请输入街道地址',
                  },
                },
              },
              required: ['city'],
            },
          },
          required: ['name', 'phone'],
          ui: {
            widget: 'nested-form',
          },
        },
        minItems: 1,
        ui: {
          addButtonText: '添加联系人',
        },
      },
    },
    required: ['projectName'],
  };

  const defaultValues = {
    projectName: '',
    contacts: [
      {
        name: '',
        phone: '',
        email: '',
        address: {
          city: '',
          street: '',
        },
      },
    ],
  };

  const handleSubmit = (data: any) => {
    console.log('数组嵌套表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>数组中的嵌套表单</h3>
      <p>联系人列表中的每一项都是一个嵌套表单，包含姓名、电话、邮箱和地址信息。</p>
      <ul style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
        <li>每个联系人都是一个独立的嵌套表单</li>
        <li>可以动态添加或删除联系人</li>
        <li>每个联系人的地址信息也是嵌套对象</li>
        <li>支持独立的验证规则（姓名和电话为必填项）</li>
      </ul>
      <DynamicForm schema={schema} defaultValues={defaultValues} onSubmit={handleSubmit} />
    </Card>
  );
};
