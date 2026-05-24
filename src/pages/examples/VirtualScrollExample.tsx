import React, { useState } from 'react';
import { DynamicForm } from '../../components/DynamicForm/DynamicForm';
import type { ExtendedJSONSchema } from '../../components/DynamicForm/types/schema';
import { H3, Button, Card, Switch } from '@blueprintjs/core';

/**
 * 虚拟滚动测试示例
 * 用于测试大规模数组字段的性能优化
 */
export const VirtualScrollExample: React.FC = () => {
  const [enableVirtualScroll, setEnableVirtualScroll] = useState(true);
  const [itemCount, setItemCount] = useState(50);

  // 生成测试数据
  const generateDefaultValues = (count: number) => {
    return {
      configurations: Array.from({ length: count }, (_, index) => ({
        name: `Configuration ${index + 1}`,
        description: `Description for configuration ${index + 1}`,
        enabled: index % 2 === 0,
        priority: index + 1,
      })),
    };
  };

  const [defaultValues, setDefaultValues] = useState(generateDefaultValues(itemCount));

  // Schema 定义
  const schema: ExtendedJSONSchema = {
    type: 'object',
    title: 'Virtual Scroll Test Form',
    properties: {
      configurations: {
        type: 'array',
        title: 'Configurations',
        minItems: 1,
        items: {
          type: 'object',
          title: 'Configuration',
          properties: {
            name: {
              type: 'string',
              title: 'Name',
              ui: {
                placeholder: 'Enter configuration name',
              },
            },
            description: {
              type: 'string',
              title: 'Description',
              ui: {
                widget: 'textarea',
                placeholder: 'Enter description',
              },
            },
            enabled: {
              type: 'boolean',
              title: 'Enabled',
              ui: {
                widget: 'switch',
              },
            },
            priority: {
              type: 'integer',
              title: 'Priority',
              minimum: 1,
              maximum: 100,
            },
          },
          required: ['name', 'priority'],
        },
        ui: {
          addButtonText: 'Add Configuration',
          emptyText: 'No configurations yet',
        },
      },
    },
  };

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Form submitted:', data);
    alert(`Form submitted with ${data.configurations?.length || 0} configurations`);
  };

  const handleItemCountChange = (count: number) => {
    setItemCount(count);
    setDefaultValues(generateDefaultValues(count));
  };

  return (
    <div style={{ padding: '20px' }}>
      <H3>Virtual Scroll Performance Test</H3>

      {/* 控制面板 */}
      <Card style={{ marginBottom: '20px', padding: '15px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <Switch
              checked={enableVirtualScroll}
              label="Enable Virtual Scroll"
              onChange={(e) => setEnableVirtualScroll(e.currentTarget.checked)}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span>Item Count:</span>
            <Button
              small
              onClick={() => handleItemCountChange(20)}
              intent={itemCount === 20 ? 'primary' : 'none'}
            >
              20
            </Button>
            <Button
              small
              onClick={() => handleItemCountChange(50)}
              intent={itemCount === 50 ? 'primary' : 'none'}
            >
              50
            </Button>
            <Button
              small
              onClick={() => handleItemCountChange(100)}
              intent={itemCount === 100 ? 'primary' : 'none'}
            >
              100
            </Button>
          </div>

          <div style={{ marginLeft: 'auto', color: '#999' }}>
            Current: {defaultValues.configurations?.length || 0} items
          </div>
        </div>
      </Card>

      {/* 动态表单 */}
      <DynamicForm
        key={`${enableVirtualScroll}-${itemCount}`}
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        enableVirtualScroll={enableVirtualScroll}
        virtualScrollHeight={600}
      />
    </div>
  );
};
