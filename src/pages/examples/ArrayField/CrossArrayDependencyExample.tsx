import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import type { LinkageFunction } from '@/components/DynamicForm/types/linkage';
import { Card, H3 } from '@blueprintjs/core';

/**
 * 场景5：跨数组依赖
 * 业务场景：当权限列表中存在管理员权限时，功能列表中的所有功能都自动启用
 */
export const CrossArrayDependencyExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      permissions: {
        type: 'array',
        title: '权限列表',
        items: {
          type: 'object',
          title: '权限',
          properties: {
            name: {
              type: 'string',
              title: '权限名称',
            },
            isAdmin: {
              type: 'boolean',
              title: '是否管理员权限',
              default: false,
            },
          },
          required: ['name'],
        },
        minItems: 1,
        ui: {
          arrayMode: 'dynamic',
          addButtonText: '添加权限',
        },
      },
      features: {
        type: 'array',
        title: '功能列表',
        items: {
          type: 'object',
          title: '功能',
          properties: {
            name: {
              type: 'string',
              title: '功能名称',
            },
            enabled: {
              type: 'boolean',
              title: '是否启用',
              ui: {
                readonly: true,
                linkages: [{
                  type: 'value',
                  dependencies: ['#/properties/permissions'],
                  fulfill: {
                    function: 'checkAdminPermission',
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
          addButtonText: '添加功能',
        },
      },
    },
  };

  // 联动函数
  const linkageFunctions: Record<string, LinkageFunction> = {
    checkAdminPermission: (formData: any) => {
      const permissions = formData.permissions || [];
      // 检查是否存在管理员权限
      const hasAdminPermission = permissions.some((p: any) => p.isAdmin === true);
      return hasAdminPermission;
    },
  };

  const defaultValues = {
    permissions: [{ name: '查看权限', isAdmin: false }],
    features: [
      { name: '数据导出', enabled: false },
      { name: '批量操作', enabled: false },
    ],
  };

  const handleSubmit = (data: any) => {
    console.log('提交的数据:', data);
    alert('数据已提交，请查看控制台');
  };

  return (
    <div>
      <h2>场景5：跨数组依赖</h2>
      <p>
        <strong>业务场景：</strong>当权限列表中存在管理员权限时，功能列表中的所有功能都自动启用
      </p>
      <p>
        <strong>技术要点：</strong>
      </p>
      <ul>
        <li>数组 A 的聚合状态影响数组 B 的所有元素</li>
        <li>
          使用 <code>some()</code> 进行聚合判断
        </li>
        <li>每个 features 元素的 enabled 字段都会调用同一个函数</li>
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
