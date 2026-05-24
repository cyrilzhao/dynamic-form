import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

export const BasicArrayExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      tags: {
        type: 'array',
        title: '标签列表（最少1个，最多5个）',
        items: {
          type: 'string',
          maxLength: 20,
          minLength: 3,
        },
        minItems: 1,
        maxItems: 5,
        ui: {
          arrayMode: 'dynamic',
          addButtonText: '添加标签',
          emptyText: '暂无标签，点击下方按钮添加',
        },
      },
      scores: {
        type: 'array',
        title: '分数列表',
        items: {
          type: 'number',
          minimum: 1,
          maximum: 100,
        },
        ui: {
          arrayMode: 'dynamic',
          addButtonText: '添加分数',
        },
      },
    },
  };

  const defaultValues = {
    tags: ['React', 'TypeScript'],
    scores: [85, 92],
  };

  const handleSubmit = (data: any) => {
    console.log('基本类型数组数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>基本类型数组</h3>
      <p>支持字符串数组、数字数组等基本类型。</p>
      <ul style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
        <li>支持动态添加和删除</li>
        <li>支持上移/下移操作</li>
        <li>支持最小/最大数量限制</li>
        <li>支持空状态提示</li>
      </ul>
      <DynamicForm schema={schema} defaultValues={defaultValues} onSubmit={handleSubmit} />

      <Card style={{ marginTop: '20px' }}>
        <H3>Schema 配置</H3>
        <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(schema, null, 2)}
        </pre>
      </Card>
    </Card>
  );
};
