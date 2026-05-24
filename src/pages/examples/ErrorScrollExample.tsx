import React, { useRef, useState } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { DynamicFormRef } from '@/components/DynamicForm/types';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Button, Card, Elevation, Tab, Tabs } from '@blueprintjs/core';

/**
 * 错误滚动示例
 *
 * 展示当数组字段中存在验证错误时，自动滚动到第一个错误项的功能
 * 包含两种渲染模式：
 * 1. 普通渲染模式（适合少量数组项）
 * 2. 虚拟滚动模式（适合大量数组项，性能更好）
 */
export const ErrorScrollExample: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'normal' | 'virtual'>('normal');

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Error Scroll Example</h1>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        This example demonstrates automatic scrolling to the first error field in array items.
        Try clicking "Validate" button to trigger validation - the page will automatically scroll
        to the first item with validation errors.
      </p>

      <Tabs
        id="error-scroll-tabs"
        selectedTabId={activeTab}
        onChange={newTabId => setActiveTab(newTabId as 'normal' | 'virtual')}
        large
      >
        <Tab id="normal" title="Normal Rendering" panel={<NormalRenderingExample />} />
        <Tab id="virtual" title="Virtual Scroll" panel={<VirtualScrollExample />} />
      </Tabs>
    </div>
  );
};

/**
 * 普通渲染模式示例
 */
const NormalRenderingExample: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null);
  const [formData, setFormData] = useState<Record<string, any>>({
    users: generateUsers(15),
  });

  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      users: {
        type: 'array',
        title: 'User List',
        description: 'Scroll down and click "Validate" to see auto-scroll to error',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              title: 'User ID',
              ui: {
                hidden: true,
                autogenerate: 'uuid',
              },
            },
            name: {
              type: 'string',
              title: 'Name',
              minLength: 2,
            },
            email: {
              type: 'string',
              title: 'Email',
              format: 'email',
            },
            age: {
              type: 'integer',
              title: 'Age',
              minimum: 18,
              maximum: 100,
            },
            role: {
              type: 'string',
              title: 'Role',
              enum: ['admin', 'user', 'guest'],
              enumNames: ['Administrator', 'Regular User', 'Guest'],
            },
          },
          required: ['name', 'email', 'age', 'role'],
        },
        minItems: 1,
        ui: {
          addButtonText: 'Add User',
          emptyText: 'No users added yet',
        },
      },
    },
  };

  const handleValidate = async () => {
    if (formRef.current) {
      const isValid = await formRef.current.validate();
      if (isValid) {
        alert('All fields are valid!');
      } else {
        console.log('Validation failed, errors:', formRef.current.getErrors());
      }
    }
  };

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Form submitted:', data);
    alert('Form submitted successfully! Check console for data.');
  };

  return (
    <Card elevation={Elevation.TWO} style={{ marginTop: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3>Normal Rendering Mode</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          This mode renders all array items directly in the DOM. Suitable for arrays with fewer
          than 20 items.
        </p>
        <div style={{ marginTop: '10px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
          <strong>Test Instructions:</strong>
          <ol style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '20px' }}>
            <li>Scroll down to see all 15 user items</li>
            <li>Notice that item #10 has empty required fields (name, email, age, role)</li>
            <li>Click the "Validate" button below</li>
            <li>The page will automatically scroll to item #10 (the first error)</li>
          </ol>
        </div>
      </div>

      <div style={{ maxHeight: '500px', overflow: 'auto', border: '1px solid #ddd', padding: '15px' }}>
        <DynamicForm
          ref={formRef}
          schema={schema}
          defaultValues={formData}
          onChange={setFormData}
          onSubmit={handleSubmit}
          showSubmitButton={false}
          renderAsForm={false}
        />
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <Button intent="primary" onClick={handleValidate} large>
          Validate
        </Button>
        <Button
          intent="success"
          onClick={() => formRef.current?.validate().then(isValid => isValid && handleSubmit(formData))}
          large
        >
          Submit
        </Button>
      </div>
    </Card>
  );
};

/**
 * 虚拟滚动模式示例
 */
const VirtualScrollExample: React.FC = () => {
  const formRef = useRef<DynamicFormRef>(null);
  const [formData, setFormData] = useState<Record<string, any>>({
    products: generateProducts(100),
  });

  const schema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        title: 'Product List',
        description: 'Virtual scroll mode - efficiently handles 100+ items',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              title: 'Product ID',
              ui: {
                hidden: true,
                autogenerate: 'uuid',
              },
            },
            name: {
              type: 'string',
              title: 'Product Name',
              minLength: 3,
            },
            sku: {
              type: 'string',
              title: 'SKU',
              pattern: '^[A-Z]{3}-\\d{4}$',
            },
            price: {
              type: 'number',
              title: 'Price',
              minimum: 0.01,
            },
            stock: {
              type: 'integer',
              title: 'Stock',
              minimum: 0,
            },
            category: {
              type: 'string',
              title: 'Category',
              enum: ['electronics', 'clothing', 'food', 'books'],
              enumNames: ['Electronics', 'Clothing', 'Food', 'Books'],
            },
          },
          required: ['name', 'sku', 'price', 'stock', 'category'],
        },
        minItems: 1,
        ui: {
          addButtonText: 'Add Product',
          emptyText: 'No products added yet',
        },
      },
    },
  };

  const handleValidate = async () => {
    if (formRef.current) {
      const isValid = await formRef.current.validate();
      if (isValid) {
        alert('All fields are valid!');
      } else {
        console.log('Validation failed, errors:', formRef.current.getErrors());
      }
    }
  };

  const handleSubmit = (data: Record<string, any>) => {
    console.log('Form submitted:', data);
    alert('Form submitted successfully! Check console for data.');
  };

  return (
    <Card elevation={Elevation.TWO} style={{ marginTop: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h3>Virtual Scroll Mode</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          This mode uses virtualization to render only visible items. Suitable for arrays with 20+
          items. Provides better performance and smooth scrolling.
        </p>
        <div style={{ marginTop: '10px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
          <strong>Test Instructions:</strong>
          <ol style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '20px' }}>
            <li>Notice there are 100 product items (scroll to see the count)</li>
            <li>Item #50 has empty required fields (name, sku, price, stock, category)</li>
            <li>Click the "Validate" button below</li>
            <li>The virtual scroll will automatically jump to item #50 (the first error)</li>
            <li>Notice the smooth scrolling performance even with 100 items</li>
          </ol>
        </div>
      </div>

      <div style={{ border: '1px solid #ddd', padding: '15px' }}>
        <DynamicForm
          ref={formRef}
          schema={schema}
          defaultValues={formData}
          onChange={setFormData}
          onSubmit={handleSubmit}
          showSubmitButton={false}
          renderAsForm={false}
          enableVirtualScroll={true}
          virtualScrollHeight={500}
        />
      </div>

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <Button intent="primary" onClick={handleValidate} large>
          Validate
        </Button>
        <Button
          intent="success"
          onClick={() => formRef.current?.validate().then(isValid => isValid && handleSubmit(formData))}
          large
        >
          Submit
        </Button>
      </div>
    </Card>
  );
};

/**
 * 生成测试用户数据
 * 第 10 个用户（索引 9）的必填字段为空，用于测试错误滚动
 */
function generateUsers(count: number): any[] {
  const users = [];
  for (let i = 0; i < count; i++) {
    if (i === 9) {
      // 第 10 个用户有错误
      users.push({
        id: `user-${i + 1}`,
        name: '',
        email: '',
        age: undefined,
        role: undefined,
      });
    } else {
      users.push({
        id: `user-${i + 1}`,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        age: 20 + (i % 50),
        role: ['admin', 'user', 'guest'][i % 3],
      });
    }
  }
  return users;
}

/**
 * 生成测试产品数据
 * 第 50 个产品（索引 49）的必填字段为空，用于测试错误滚动
 */
function generateProducts(count: number): any[] {
  const products = [];
  const categories = ['electronics', 'clothing', 'food', 'books'];

  for (let i = 0; i < count; i++) {
    if (i === 49) {
      // 第 50 个产品有错误
      products.push({
        id: `product-${i + 1}`,
        name: '',
        sku: '',
        price: undefined,
        stock: undefined,
        category: undefined,
      });
    } else {
      products.push({
        id: `product-${i + 1}`,
        name: `Product ${i + 1}`,
        sku: `PRD-${String(i + 1).padStart(4, '0')}`,
        price: (Math.random() * 1000).toFixed(2),
        stock: Math.floor(Math.random() * 100),
        category: categories[i % categories.length],
      });
    }
  }
  return products;
}
