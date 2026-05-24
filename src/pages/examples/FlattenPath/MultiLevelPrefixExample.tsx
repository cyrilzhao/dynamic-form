import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

export const MultiLevelPrefixExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      service: {
        type: 'object',
        title: '服务',
        ui: {
          flattenPath: true,
          flattenPrefix: true,
        },
        properties: {
          auth: {
            type: 'object',
            title: '认证',
            ui: {
              flattenPath: true,
              flattenPrefix: true,
            },
            properties: {
              credentials: {
                type: 'object',
                ui: {
                  flattenPath: true,
                },
                properties: {
                  username: {
                    type: 'string',
                    title: '用户名',
                    ui: {
                      placeholder: '请输入用户名',
                    },
                  },
                  password: {
                    type: 'string',
                    title: '密码',
                    ui: {
                      widget: 'password',
                      placeholder: '请输入密码',
                    },
                  },
                },
                required: ['username', 'password'],
              },
            },
          },
        },
      },
    },
  };

  const handleSubmit = (data: any) => {
    console.log('多层前缀叠加表单数据:', data);
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>多层前缀叠加</h3>
      <p>
        多个层级都设置了 <code>flattenPrefix: true</code>，前缀会自动叠加。
        <br />
        表单显示：
      </p>
      <ul style={{ fontSize: '14px', color: '#666' }}>
        <li>服务 - 认证 - 用户名</li>
        <li>服务 - 认证 - 密码</li>
      </ul>
      <p>
        提交数据结构：
        <code>{`{ service: { auth: { credentials: { username: 'admin', password: '***' } } } }`}</code>
      </p>
      <DynamicForm schema={schema} onSubmit={handleSubmit} />

      <Card style={{ marginTop: '20px' }}>
        <H3>Schema 配置</H3>
        <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(schema, null, 2)}
        </pre>
      </Card>
    </Card>
  );
};
