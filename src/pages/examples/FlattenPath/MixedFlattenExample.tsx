import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

export const MixedFlattenExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      basicInfo: {
        type: 'object',
        title: '基本信息',
        properties: {
          name: {
            type: 'string',
            title: '名称',
            ui: {
              placeholder: '请输入名称',
            },
          },
          description: {
            type: 'string',
            title: '描述',
            ui: {
              widget: 'textarea',
              placeholder: '请输入描述',
            },
          },
        },
        required: ['name'],
        ui: {
          widget: 'nested-form',
        },
      },
      advancedConfig: {
        type: 'object',
        title: '高级配置',
        ui: {
          flattenPath: true,
          flattenPrefix: true,
        },
        properties: {
          performance: {
            type: 'object',
            ui: {
              flattenPath: true,
            },
            properties: {
              timeout: {
                type: 'integer',
                title: '超时时间（秒）',
                minimum: 1,
                maximum: 300,
                default: 30,
                ui: {
                  placeholder: '请输入超时时间',
                },
              },
              retries: {
                type: 'integer',
                title: '重试次数',
                minimum: 0,
                maximum: 10,
                default: 3,
                ui: {
                  placeholder: '请输入重试次数',
                },
              },
            },
          },
        },
      },
    },
  };

  const handleSubmit = (data: any) => {
    console.log('混合使用表单数据:', JSON.stringify(data));
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '600px' }}>
      <h3>混合使用：部分透明化 + 部分正常嵌套</h3>
      <p>
        基本信息使用正常的嵌套表单，高级配置使用路径透明化。
        <br />
        表单显示结构：
      </p>
      <ul style={{ fontSize: '14px', color: '#666' }}>
        <li>
          基本信息（嵌套表单）
          <ul>
            <li>├─ 名称</li>
            <li>└─ 描述</li>
          </ul>
        </li>
        <li>高级配置 - 超时时间（秒）</li>
        <li>高级配置 - 重试次数</li>
      </ul>
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
