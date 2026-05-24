import React from 'react';
import { DynamicForm } from '@/components/DynamicForm/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3 } from '@blueprintjs/core';

/**
 * 数组字段 + 路径透明化示例
 *
 * 展示如何在数组元素内部使用路径透明化特性
 */
export const ArrayWithFlattenExample: React.FC = () => {
  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      region: {
        title: '地区',
        type: 'object',
        ui: {
          flattenPath: true,
          flattenPrefix: true,
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
                          },
                          required: ['name', 'phone'],
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
    region: {
      market: {
        contacts: [
          {
            category: {
              group: {
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
      <H3>数组字段 + 路径透明化</H3>
      <p>
        这个示例展示了如何在数组元素内部使用路径透明化特性。外层的 <code>group</code> 和{' '}
        <code>category</code> 被扁平化，数组元素内部的 <code>category.group</code> 也被扁平化。
      </p>

      <Card style={{ marginTop: '20px' }}>
        <DynamicForm schema={schema} defaultValues={defaultValues} onSubmit={handleSubmit} />
      </Card>

      <Card style={{ marginTop: '20px' }}>
        <H3>说明</H3>
        <ul>
          <li>
            <strong>外层路径透明化</strong>：<code>region</code> 和 <code>market</code> 设置了{' '}
            <code>flattenPath: true</code>，不会渲染 Card 边框
          </li>
          <li>
            <strong>数组字段</strong>：<code>contacts</code> 由 ArrayFieldWidget 处理，支持增删操作
          </li>
          <li>
            <strong>数组内部路径透明化</strong>：每个数组元素内部的 <code>category.group</code>{' '}
            也被扁平化，字段标签显示为"分类-分组-名称"和"分类-分组-手机号"
          </li>
          <li>
            <strong>实际字段路径</strong>：
            <ul>
              <li>
                <code>region.market.contacts.0.category.group.name</code>
              </li>
              <li>
                <code>region.market.contacts.0.category.group.phone</code>
              </li>
            </ul>
          </li>
          <li>
            <strong>渲染效果</strong>
            ：外部只显示"地区-联系人列表"标题，数组元素内部的字段带有"分类-分组-"前缀
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
