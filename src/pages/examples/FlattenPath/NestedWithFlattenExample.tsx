import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

export const NestedWithFlattenExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      // 第一层：正常的嵌套表单（会显示 Card）
      basicInfo: {
        type: 'object',
        title: '基本信息',
        properties: {
          name: {
            type: 'string',
            title: '服务名称',
            ui: {
              placeholder: '请输入服务名称',
            },
          },
          description: {
            type: 'string',
            title: '服务描述',
            ui: {
              widget: 'textarea',
              placeholder: '请输入服务描述',
            },
          },
        },
        required: ['name'],
      },

      // 第二层：正常的嵌套表单，但内部使用路径透明化
      apiConfig: {
        type: 'object',
        title: 'API 配置',
        properties: {
          endpoint: {
            type: 'string',
            title: '接口地址',
            ui: {
              placeholder: 'https://api.example.com',
            },
          },

          // 这里开始使用路径透明化
          authentication: {
            type: 'object',
            title: '认证配置',
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
                  apiKey: {
                    type: 'string',
                    title: 'API 密钥',
                    minLength: 10,
                    ui: {
                      placeholder: '请输入 API 密钥',
                      errorMessages: {
                        required: 'API 密钥不能为空',
                        minLength: 'API 密钥至少需要 10 个字符',
                      },
                    },
                  },
                  apiSecret: {
                    type: 'string',
                    title: 'API 密文',
                    ui: {
                      widget: 'password',
                      placeholder: '请输入 API 密文',
                    },
                  },
                },
                required: ['apiKey'],
              },
            },
          },

          timeout: {
            type: 'integer',
            title: '超时时间（秒）',
            minimum: 1,
            maximum: 300,
            default: 30,
          },
        },
        required: ['endpoint'],
      },

      // 第三层：深层嵌套 + 路径透明化
      advancedSettings: {
        type: 'object',
        title: '高级设置',
        properties: {
          // 正常字段
          enabled: {
            type: 'boolean',
            title: '启用高级功能',
            default: false,
          },

          // 多层路径透明化
          performance: {
            type: 'object',
            title: '性能配置',
            ui: {
              flattenPath: true,
              flattenPrefix: true,
            },
            properties: {
              cache: {
                type: 'object',
                ui: {
                  flattenPath: true,
                },
                properties: {
                  settings: {
                    type: 'object',
                    ui: {
                      flattenPath: true,
                    },
                    properties: {
                      ttl: {
                        type: 'integer',
                        title: 'TTL（秒）',
                        minimum: 0,
                        default: 3600,
                      },
                      maxSize: {
                        type: 'integer',
                        title: '最大缓存大小（MB）',
                        minimum: 1,
                        default: 100,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const defaultValues = {
    basicInfo: {
      name: '示例服务',
      description: '这是一个示例服务',
    },
    apiConfig: {
      endpoint: 'https://api.example.com',
      authentication: {
        credentials: {
          apiKey: 'existing-key-123456',
        },
      },
      timeout: 30,
    },
    advancedSettings: {
      enabled: true,
      performance: {
        cache: {
          settings: {
            ttl: 7200,
            maxSize: 200,
          },
        },
      },
    },
  };

  const handleSubmit = (data: any) => {
    console.log('混合嵌套表单数据:', JSON.stringify(data));
    alert('提交成功！请查看控制台输出');
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '800px' }}>
      <h3>嵌套表单 + 路径透明化混合使用</h3>
      <p>这个示例展示了如何在多层嵌套表单中使用路径透明化：</p>
      <ul>
        <li>
          <strong>基本信息</strong>：正常的嵌套表单（显示 Card 边框）
        </li>
        <li>
          <strong>API 配置</strong>：正常的嵌套表单，但内部的 "认证配置" 使用了路径透明化
          <br />- 字段显示为：<code>认证配置 - API 密钥</code>、<code>认证配置 - API 密文</code>
          <br />- 不会有多余的 Card 边框
        </li>
        <li>
          <strong>高级设置</strong>：正常的嵌套表单，但内部的 "性能配置" 使用了多层路径透明化
          <br />- 字段显示为：<code>性能配置 - TTL（秒）</code>、
          <code>性能配置 - 最大缓存大小（MB）</code>
          <br />- 跳过了 <code>cache</code> 和 <code>settings</code> 两层嵌套
        </li>
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
