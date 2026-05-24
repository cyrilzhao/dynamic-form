import React, { useMemo } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card } from '@blueprintjs/core';

export const JsonPointerNestedExample: React.FC = () => {
  // 定义不同公司类型的 schema
  const companySchemas = useMemo(
    () => ({
      startup: {
        type: 'object' as const,
        properties: {
          foundedYear: {
            type: 'number' as const,
            title: '成立年份',
            minimum: 2000,
            maximum: 2025,
            ui: { placeholder: '请输入成立年份' },
          },
          funding: {
            type: 'string' as const,
            title: '融资阶段',
            enum: ['seed', 'seriesA', 'seriesB', 'seriesC'],
            enumNames: ['种子轮', 'A轮', 'B轮', 'C轮'],
            ui: { widget: 'select', placeholder: '请选择融资阶段' },
          },
          teamSize: {
            type: 'integer' as const,
            title: '团队规模',
            minimum: 1,
            maximum: 500,
            ui: { placeholder: '请输入团队人数' },
          },
        },
        required: ['foundedYear', 'funding'],
      },
      enterprise: {
        type: 'object' as const,
        properties: {
          employeeCount: {
            type: 'number' as const,
            title: '员工数量',
            minimum: 500,
            ui: { placeholder: '请输入员工数量' },
          },
          revenue: {
            type: 'number' as const,
            title: '年营收（万元）',
            minimum: 0,
            ui: { placeholder: '请输入年营收' },
          },
          stockCode: {
            type: 'string' as const,
            title: '股票代码',
            ui: { placeholder: '如已上市，请输入股票代码' },
          },
          branches: {
            type: 'integer' as const,
            title: '分支机构数量',
            minimum: 0,
            ui: { placeholder: '请输入分支机构数量' },
          },
        },
        required: ['employeeCount', 'revenue'],
      },
    }),
    []
  );

  // 定义联动函数
  const linkageFunctions = useMemo(
    () => ({
      loadCompanySchema: (formData: Record<string, any>) => {
        const companyType = formData?.company?.type;
        if (!companyType) {
          return { type: 'object', properties: {} };
        }
        return companySchemas[companyType as keyof typeof companySchemas] || { type: 'object', properties: {} };
      },
    }),
    [companySchemas]
  );

  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      company: {
        type: 'object',
        title: '公司信息',
        properties: {
          type: {
            type: 'string',
            title: '公司类型',
            enum: ['startup', 'enterprise'],
            enumNames: ['初创公司', '大型企业'],
            ui: {
              widget: 'radio',
            },
          },
          name: {
            type: 'string',
            title: '公司名称',
            ui: {
              placeholder: '请输入公司名称',
            },
          },
          details: {
            type: 'object',
            title: '公司详情',
            properties: {},
            ui: {
              widget: 'nested-form',
              linkages: [{
                type: 'schema',
                dependencies: ['#/properties/company/properties/type'],
                when: {
                  field: '#/properties/company/properties/type',
                  operator: 'isNotEmpty',
                },
                fulfill: {
                  function: 'loadCompanySchema',
                },
              }],
            },
          },
        },
        required: ['type', 'name'],
      },
    },
    required: ['company'],
  };

  const handleSubmit = (data: any) => {
    console.log('JSON Pointer 跨层级表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>JSON Pointer 跨层级依赖</h3>
      <p>
        使用 JSON Pointer 格式 <code>#/properties/company/type</code> 依赖嵌套字段。
        <br />
        公司详情表单根据公司类型（初创公司/大型企业）动态显示不同的字段。
      </p>
      <ul style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
        <li>初创公司：显示成立年份、融资阶段、团队规模</li>
        <li>大型企业：显示员工数量、年营收、股票代码、分支机构数量</li>
        <li>切换类型时数据会保留，提交时自动过滤无效字段</li>
      </ul>
      <DynamicForm schema={schema} onSubmit={handleSubmit} linkageFunctions={linkageFunctions} />
    </Card>
  );
};
