import React from 'react';
import { DynamicForm } from '@/components/DynamicForm/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

/**
 * 数组字段 + 路径透明化 + 字段联动综合示例
 *
 * 展示如何同时使用数组字段、路径透明化和字段联动特性
 */
export const ArrayWithFlattenAndLinkageExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      enableRegion: {
        type: 'boolean',
        title: '启用地区配置',
        default: true,
      },
      region: {
        title: '地区',
        type: 'object',
        ui: {
          flattenPath: true,
          flattenPrefix: true,
          linkages: [{
            type: 'visibility',
            dependencies: ['#/properties/enableRegion'],
            when: {
              field: '#/properties/enableRegion',
              operator: '==',
              value: true,
            },
            fulfill: {
              state: { visible: true },
            },
            otherwise: {
              state: { visible: false },
            },
          }],
        },
        properties: {
          market: {
            type: 'object',
            title: '市场',
            ui: {
              flattenPath: true,
            },
            properties: {
              contacts: {
                type: 'array',
                title: '联系人列表',
                items: {
                  type: 'object',
                  title: '联系人',
                  properties: {
                    auth: {
                      title: 'Auth',
                      type: 'object',
                      properties: {
                        enableAuth: {
                          title: 'enableAuth',
                          type: 'boolean',
                        },
                        apiKey: {
                          title: 'apiKey',
                          type: 'string',
                          ui: {
                            linkages: [{
                              type: 'visibility',
                              dependencies: ['./enableAuth'],
                              when: {
                                field: './enableAuth',
                                operator: '==',
                                value: true,
                              },
                              fulfill: {
                                state: { visible: true },
                              },
                              otherwise: {
                                state: { visible: false },
                              },
                            }],
                          },
                        },
                        apiSecret: {
                          title: 'apiSecret',
                          type: 'string',
                          ui: {
                            linkages: [{
                              type: 'visibility',
                              dependencies: ['./enableAuth'],
                              when: {
                                field: './enableAuth',
                                operator: '==',
                                value: true,
                              },
                              fulfill: {
                                state: { visible: true },
                              },
                              otherwise: {
                                state: { visible: false },
                              },
                            }],
                          },
                        },
                      },
                    },
                    category: {
                      type: 'object',
                      title: '分类',
                      ui: {
                        flattenPath: true,
                        flattenPrefix: true,
                      },
                      properties: {
                        group: {
                          type: 'object',
                          title: '分组',
                          ui: {
                            flattenPath: true,
                            flattenPrefix: true,
                          },
                          properties: {
                            type: {
                              type: 'string',
                              title: '类型',
                              enum: ['vip', 'normal'],
                              enumNames: ['VIP', '普通'],
                              default: 'normal',
                              ui: {
                                widget: 'select',
                                placeholder: '请选择类型',
                              },
                            },
                            name: {
                              title: '名称',
                              type: 'string',
                              minLength: 1,
                            },
                            phone: {
                              title: '手机号',
                              type: 'string',
                              pattern: '^1[3-9]\\d{9}$',
                            },
                            vipLevel: {
                              title: 'VIP等级',
                              type: 'string',
                              enum: ['gold', 'silver', 'bronze'],
                              enumNames: ['金卡', '银卡', '铜卡'],
                              ui: {
                                placeholder: '请选择VIP等级',
                                linkages: [{
                                  type: 'visibility',
                                  dependencies: ['./type'],
                                  when: {
                                    field: './type',
                                    operator: '==',
                                    value: 'vip',
                                  },
                                  fulfill: {
                                    state: { visible: true },
                                  },
                                  otherwise: {
                                    state: { visible: false },
                                  },
                                }],
                              },
                            },
                          },
                          required: ['type', 'name', 'phone'],
                        },
                      },
                    },
                  },
                },
                minItems: 1,
                ui: {
                  arrayMode: 'dynamic',
                  addButtonText: '添加联系人',
                },
              },
            },
          },
        },
      },
    },
  };

  const defaultValues = {
    enableRegion: true,
    region: {
      market: {
        contacts: [
          {
            auth: {
              apiKey: 'aaa',
              apiSecret: 'bbb',
            },
            category: {
              group: {
                type: 'normal',
                name: '张三',
                phone: '13800138000',
              },
            },
          },
        ],
      },
    },
  };

  const handleSubmit = (data: any) => {
    console.log('提交的数据:', data);
    alert('提交成功！请查看控制台输出。');
  };

  return (
    <div>
      <H3>数组字段 + 路径透明化 + 字段联动</H3>
      <p>
        这个示例展示了如何同时使用数组字段、路径透明化和字段联动特性。
        包括外层对象的联动、路径透明化，以及数组元素内部的联动。
      </p>

      <Card style={{ marginTop: '20px' }}>
        <DynamicForm schema={schema} defaultValues={defaultValues} onSubmit={handleSubmit} />
      </Card>

      <Card style={{ marginTop: '20px' }}>
        <H3>说明</H3>
        <ul>
          <li>
            <strong>外层联动</strong>：<code>group</code> 对象的显示/隐藏由{' '}
            <code>enableRegion</code> 控制
          </li>
          <li>
            <strong>路径透明化</strong>：<code>group</code> 和 <code>category</code>{' '}
            被扁平化，数组元素内部的 <code>category.group</code> 也被扁平化
          </li>
          <li>
            <strong>数组字段</strong>：<code>contacts</code> 支持动态增删
          </li>
          <li>
            <strong>数组内部联动</strong>：当类型为"VIP"时，显示"VIP等级"字段
          </li>
          <li>
            <strong>相对路径</strong>：使用 <code>./type</code> 引用同一数组元素内的字段
          </li>
          <li>
            <strong>操作步骤</strong>：
            <ol>
              <li>取消勾选"启用地区配置"，整个地区配置会隐藏</li>
              <li>将联系人类型改为"VIP"，会显示"VIP等级"字段</li>
            </ol>
          </li>
        </ul>
      </Card>

      <Card style={{ marginTop: '20px' }}>
        <H3>Schema 配置</H3>
        <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
          {JSON.stringify(schema, null, 2)}
        </pre>
      </Card>
    </div>
  );
};
