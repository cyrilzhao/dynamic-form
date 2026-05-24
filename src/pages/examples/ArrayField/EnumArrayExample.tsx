import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

export const EnumArrayExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      skills: {
        type: 'array',
        title: '技能',
        items: {
          type: 'string',
          enum: ['React', 'Vue', 'Angular', 'Svelte', 'Node.js', 'Python'],
          enumNames: ['React', 'Vue.js', 'Angular', 'Svelte', 'Node.js', 'Python'],
        },
        uniqueItems: true,
        minItems: 1,
      },
    },
  };

  const defaultValues = {
    skills: ['React', 'Node.js'],
  };

  const handleSubmit = (data: any) => {
    console.log('枚举数组数据:', JSON.stringify(data));
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>枚举数组（多选框组）</h3>
      <p>当数组的 items 包含 enum 时，自动渲染为多选框组。</p>
      <ul style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
        <li>自动使用 static 模式（不可增删）</li>
        <li>渲染为多选框组</li>
        <li>支持 uniqueItems 验证</li>
        <li>支持 enumNames 自定义显示名称</li>
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
