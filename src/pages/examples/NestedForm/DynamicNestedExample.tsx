import React, { useMemo } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card } from '@blueprintjs/core';

export const DynamicNestedExample: React.FC = () => {
  // 定义不同用户类型的 schema
  const userSchemas = useMemo(
    () => ({
      personal: {
        type: 'object' as const,
        properties: {
          firstName: {
            type: 'string' as const,
            title: '名',
            ui: { placeholder: '请输入名' },
          },
          lastName: {
            type: 'string' as const,
            title: '姓',
            ui: { placeholder: '请输入姓' },
          },
          birthDate: {
            type: 'string' as const,
            title: '出生日期',
            ui: { placeholder: '请输入出生日期' },
          },
        },
        required: ['firstName', 'lastName'],
      },
      company: {
        type: 'object' as const,
        properties: {
          companyName: {
            type: 'string' as const,
            title: '公司名称',
            ui: { placeholder: '请输入公司名称' },
          },
          taxId: {
            type: 'string' as const,
            title: '税号',
            ui: { placeholder: '请输入税号' },
          },
          industry: {
            type: 'string' as const,
            title: '行业',
            ui: { placeholder: '请输入行业' },
          },
        },
        required: ['companyName', 'taxId'],
      },
    }),
    []
  );

  // 定义联动函数
  const linkageFunctions = useMemo(
    () => ({
      loadUserSchema: (formData: Record<string, any>) => {
        const userType = formData?.userType;
        if (!userType) {
          return { type: 'object', properties: {} };
        }
        return userSchemas[userType as keyof typeof userSchemas] || { type: 'object', properties: {} };
      },
    }),
    [userSchemas]
  );

  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      userType: {
        type: 'string',
        title: '用户类型',
        enum: ['personal', 'company'],
        enumNames: ['个人用户', '企业用户'],
        ui: {
          widget: 'radio',
        },
      },
      details: {
        type: 'object',
        title: '详细信息',
        properties: {},
        ui: {
          widget: 'nested-form',
          linkages: [{
            type: 'schema',
            dependencies: ['userType'],
            when: {
              field: 'userType',
              operator: 'isNotEmpty',
            },
            fulfill: {
              function: 'loadUserSchema',
            },
          }],
        },
      },
    },
    required: ['userType'],
  };

  const handleSubmit = (data: any) => {
    console.log('动态嵌套表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>动态嵌套表单</h3>
      <p>根据用户类型选择，动态显示不同的详细信息表单。</p>
      <DynamicForm schema={schema} onSubmit={handleSubmit} linkageFunctions={linkageFunctions} />
    </Card>
  );
};
