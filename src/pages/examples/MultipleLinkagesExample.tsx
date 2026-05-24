import React, { useRef } from 'react';
import { Card, Button } from '@blueprintjs/core';
import { DynamicForm, type DynamicFormRef } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import type { LinkageFunction } from '@/components/DynamicForm/types/linkage';

/**
 * 多联动类型示例
 *
 * 场景说明：
 * 1. category 字段变化时，action 字段同时触发两个联动：
 *    - value 联动：清空 action 的值
 *    - options 联动：根据 category 异步加载 action 的选项列表
 *
 * 实现方式：
 * - 使用 linkages 数组配置多个联动规则
 * - 系统自动并行执行并合并结果
 */

// 模拟 API 请求：根据 category 获取 action 列表
const fetchActionsByCategory = async (category: string): Promise<Array<{ label: string; value: string }>> => {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 500));

  // 模拟不同 category 对应的 action 列表
  const actionsMap: Record<string, Array<{ label: string; value: string }>> = {
    user: [
      { label: 'Create User', value: 'create_user' },
      { label: 'Update User', value: 'update_user' },
      { label: 'Delete User', value: 'delete_user' },
      { label: 'List Users', value: 'list_users' },
    ],
    product: [
      { label: 'Add Product', value: 'add_product' },
      { label: 'Update Product', value: 'update_product' },
      { label: 'Remove Product', value: 'remove_product' },
      { label: 'Search Products', value: 'search_products' },
    ],
    order: [
      { label: 'Create Order', value: 'create_order' },
      { label: 'Cancel Order', value: 'cancel_order' },
      { label: 'Refund Order', value: 'refund_order' },
      { label: 'Track Order', value: 'track_order' },
    ],
  };

  return actionsMap[category] || [];
};

// Schema 定义
const schema: ExtendedJSONSchema = {
  type: 'object',
  title: 'Multiple Linkages Form',
  properties: {
    category: {
      type: 'string',
      title: 'Category',
      enum: ['user', 'product', 'order'],
      enumNames: ['User Management', 'Product Management', 'Order Management'],
      ui: {
        widget: 'select',
        placeholder: 'Please select a category',
      },
    },
    action: {
      type: 'string',
      title: 'Action',
      ui: {
        widget: 'select',
        placeholder: 'Please select an action',
        // 使用 linkages 数组配置多个联动规则
        linkages: [
          {
            // 联动 1：清空值
            type: 'value',
            dependencies: ['#/properties/category'],
            fulfill: {
              value: '', // 当 category 变化时，清空 action 的值
            },
          },
          {
            // 联动 2：加载选项
            type: 'options',
            dependencies: ['#/properties/category'],
            enableCache: true, // 启用缓存，避免重复请求
            fulfill: {
              function: 'loadActionOptions',
            },
          },
        ],
      },
    },
    description: {
      type: 'string',
      title: 'Description',
      ui: {
        widget: 'textarea',
        placeholder: 'Optional description',
        rows: 3,
      },
    },
  },
  required: ['category', 'action'],
};

export const MultipleLinkagesExample: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null);

  // 联动函数：加载 action 选项
  const linkageFunctions: Record<string, LinkageFunction> = {
    loadActionOptions: async (formData: any) => {
      const { category } = formData;

      // 如果没有选择 category，返回空选项
      if (!category) {
        return [];
      }

      // 异步加载新的选项列表
      try {
        const options = await fetchActionsByCategory(category);
        return options;
      } catch (error) {
        console.error('Failed to load actions:', error);
        return [];
      }
    },
  };

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Form submitted:', data);
    alert(`Submitted:\nCategory: ${data.category}\nAction: ${data.action}\nDescription: ${data.description || 'N/A'}`);
  };

  const handleReset = () => {
    formRef.current?.reset();
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <h2>Multiple Linkages Example</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          This example demonstrates the new <strong>multiple linkages</strong> feature:
        </p>
        <ul style={{ color: '#666', marginBottom: '20px' }}>
          <li>Use <code>linkages</code> array to define multiple linkage rules for a single field</li>
          <li>When <code>category</code> changes, <code>action</code> field triggers two linkages simultaneously:
            <ul>
              <li><strong>Value linkage</strong>: Clear the current value</li>
              <li><strong>Options linkage</strong>: Load new options based on category</li>
            </ul>
          </li>
          <li>System automatically executes linkages in parallel and merges results</li>
          <li>Enable caching to avoid duplicate API requests</li>
        </ul>

        <DynamicForm
          ref={formRef}
          schema={schema}
          linkageFunctions={linkageFunctions}
          onSubmit={handleSubmit}
          layout="vertical"
        />

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <Button onClick={handleReset}>Reset Form</Button>
        </div>
      </Card>

      <Card style={{ marginTop: '20px' }}>
        <h3>Implementation Notes</h3>
        <div style={{ color: '#666' }}>
          <h4>Key Features:</h4>
          <ol>
            <li>
              <strong>Multiple Linkages Support:</strong> Use <code>linkages</code> array instead of single <code>linkage</code> object.
            </li>
            <li>
              <strong>Automatic Value Clearing:</strong> No need to manually call <code>form.setValue()</code> in linkage functions.
            </li>
            <li>
              <strong>Parallel Execution:</strong> All linkage rules execute in parallel using <code>Promise.allSettled</code>.
            </li>
            <li>
              <strong>Smart Result Merging:</strong>
              <ul>
                <li>State types (visibility/disabled/readonly): Direct merge</li>
                <li>Value/options/schema types: Last-wins strategy</li>
              </ul>
            </li>
            <li>
              <strong>Backward Compatible:</strong> Single <code>linkage</code> configuration still works.
            </li>
          </ol>

          <h4>Advantages over Single Linkage:</h4>
          <ul>
            <li>✅ Cleaner configuration: No need to mix value clearing logic in options linkage function</li>
            <li>✅ Better separation of concerns: Each linkage rule has a single responsibility</li>
            <li>✅ No form ref required: Value clearing is declarative, not imperative</li>
            <li>✅ More maintainable: Easy to add/remove/modify individual linkage rules</li>
          </ul>

          <h4>Configuration Comparison:</h4>
          <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
{`// Old approach (single linkage with manual value clearing)
linkage: {
  type: 'options',
  dependencies: ['#/properties/category'],
  fulfill: {
    function: 'loadActionOptions', // Must manually clear value inside
  },
}

// New approach (multiple linkages)
linkages: [
  {
    type: 'value',
    dependencies: ['#/properties/category'],
    fulfill: { value: '' }, // Declarative value clearing
  },
  {
    type: 'options',
    dependencies: ['#/properties/category'],
    fulfill: { function: 'loadActionOptions' }, // Pure options loading
  },
]`}
          </pre>
        </div>
      </Card>
    </div>
  );
};
