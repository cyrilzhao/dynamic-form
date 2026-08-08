import React, { useState } from 'react';
import { Card, Button, Callout, Intent } from '@blueprintjs/core';
import { DynamicForm } from '@/components/DynamicForm';
import { useCustomWidgets } from '@/components/DynamicForm/hooks/useCustomWidgets';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types';

/**
 * 自定义 Widget 使用示例
 * 展示如何在 DynamicForm 中使用自定义 Widget
 */
export const CustomWidgetExample: React.FC = () => {
  const { widgets, loading, error } = useCustomWidgets();
  const [formData, setFormData] = useState({});

  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      rating: {
        type: 'number',
        title: '评分',
        ui: {
          widget: 'star-rating',
        },
      },
      color: {
        type: 'string',
        title: '颜色选择',
        ui: {
          widget: 'color-picker',
        },
      },
      tags: {
        type: 'array',
        title: '标签',
        items: {
          type: 'string',
        },
        ui: {
          widget: 'tag-input',
        },
      },
      name: {
        type: 'string',
        title: '姓名',
      },
      email: {
        type: 'string',
        title: '邮箱',
        format: 'email',
      },
    },
    required: ['name', 'email'],
  };

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Form submitted:', data);
    alert('表单提交成功！请查看控制台输出。');
  };

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <Card>
          <Callout intent={Intent.PRIMARY}>正在加载自定义 Widget...</Callout>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <Card>
          <Callout intent={Intent.DANGER} title="加载失败">
            {error.message}
          </Callout>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 20 }}>
        <h2>自定义 Widget 使用示例</h2>
        <p>
          本示例展示了如何在 DynamicForm 中使用自定义 Widget。
          通过 <code>useCustomWidgets</code> Hook 加载所有已发布的自定义 Widget，
          然后通过 <code>widgets</code> prop 注入到 DynamicForm 中。
        </p>
        <Callout intent={Intent.PRIMARY} style={{ marginTop: 10 }}>
          <strong>已加载的自定义 Widget：</strong>
          <ul style={{ marginTop: 10, marginBottom: 0 }}>
            {Object.keys(widgets).map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </Callout>
      </Card>

      <Card>
        <h3>表单示例</h3>
        <DynamicForm
          schema={schema}
          widgets={widgets}
          value={formData}
          onChange={setFormData}
          onSubmit={handleSubmit}
        />
        <div style={{ marginTop: 20 }}>
          <Button intent={Intent.PRIMARY} type="submit" onClick={() => handleSubmit(formData)}>
            提交
          </Button>
        </div>
      </Card>

      <Card style={{ marginTop: 20 }}>
        <h3>当前表单数据</h3>
        <pre style={{ background: '#F5F8FA', padding: 10, borderRadius: 4 }}>
          {JSON.stringify(formData, null, 2)}
        </pre>
      </Card>
    </div>
  );
};
