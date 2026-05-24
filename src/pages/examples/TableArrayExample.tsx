import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, H3, H4 } from '@blueprintjs/core';

export const TableArrayExample: React.FC = () => {
  // 示例 1: 普通渲染 - 用户列表
  const normalSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      users: {
        type: 'array',
        title: 'User List (Normal Rendering)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Name' },
            age: { type: 'number', title: 'Age' },
            email: { type: 'string', title: 'Email', format: 'email' },
            role: {
              type: 'string',
              title: 'Role',
              enum: ['admin', 'user', 'guest'],
              enumNames: ['Admin', 'User', 'Guest'],
            },
          },
        },
        minItems: 1,
        maxItems: 10,
        ui: {
          widget: 'table-array',
          widgetProps: {
            enableVirtualScroll: false,
            addButtonText: 'Add User',
            emptyText: 'No users yet',
          },
        },
      },
    },
  };

  const normalDefaultValues = {
    users: [
      { name: 'Alice', age: 25, email: 'alice@example.com', role: 'admin' },
      { name: 'Bob', age: 30, email: 'bob@example.com', role: 'user' },
      { name: 'Charlie', age: 28, email: 'charlie@example.com', role: 'user' },
    ],
  };

  // 示例 2: 虚拟滚动 - 产品列表（大量数据）
  const virtualScrollSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        title: 'Product List (Virtual Scroll)',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', title: 'ID' },
            name: { type: 'string', title: 'Product Name' },
            price: { type: 'number', title: 'Price' },
            stock: { type: 'number', title: 'Stock' },
            category: {
              type: 'string',
              title: 'Category',
              enum: ['electronics', 'clothing', 'food', 'books'],
              enumNames: ['Electronics', 'Clothing', 'Food', 'Books'],
            },
          },
        },
        ui: {
          widget: 'table-array',
          widgetProps: {
            enableVirtualScroll: true,
            virtualScrollHeight: 400,
            columns: ['name', 'price', 'stock', 'category'],
            addButtonText: 'Add Product',
          },
        },
      },
    },
  };

  // 生成大量测试数据
  const generateProducts = (count: number) => {
    const categories = ['electronics', 'clothing', 'food', 'books'];
    const products = [];
    for (let i = 1; i <= count; i++) {
      products.push({
        id: `P${String(i).padStart(4, '0')}`,
        name: `Product ${i}`,
        price: Math.floor(Math.random() * 1000) + 10,
        stock: Math.floor(Math.random() * 500),
        category: categories[Math.floor(Math.random() * categories.length)],
      });
    }
    return products;
  };

  const virtualScrollDefaultValues = {
    products: generateProducts(100),
  };

  // 示例 3: 自定义列顺序
  const customColumnsSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      employees: {
        type: 'array',
        title: 'Employee List (Custom Column Order)',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', title: 'ID' },
            name: { type: 'string', title: 'Name' },
            department: { type: 'string', title: 'Department' },
            position: { type: 'string', title: 'Position' },
            salary: { type: 'number', title: 'Salary' },
          },
        },
        ui: {
          widget: 'table-array',
          widgetProps: {
            columns: ['name', 'position', 'department', 'salary'],
            addButtonText: 'Add Employee',
          },
        },
      },
    },
  };

  const customColumnsDefaultValues = {
    employees: [
      { id: 'E001', name: 'John Doe', department: 'Engineering', position: 'Senior Developer', salary: 80000 },
      { id: 'E002', name: 'Jane Smith', department: 'Marketing', position: 'Manager', salary: 75000 },
      { id: 'E003', name: 'Mike Johnson', department: 'Sales', position: 'Sales Rep', salary: 60000 },
    ],
  };

  const handleSubmit = (data: any, title: string) => {
    console.log(`${title} 数据:`, data);
    alert(`提交成功！请查看控制台输出`);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <H3>TableArrayWidget 示例</H3>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        TableArrayWidget 专门用于以表格形式渲染对象数组，支持虚拟滚动优化，适合展示大量数据。
      </p>

      {/* 示例 1: 普通渲染 */}
      <Card style={{ marginBottom: '30px' }}>
        <H4>示例 1: 普通渲染（少量数据）</H4>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          适用于数据量较少的场景（建议少于 50 条），不启用虚拟滚动。
        </p>
        <DynamicForm
          schema={normalSchema}
          defaultValues={normalDefaultValues}
          onSubmit={(data) => handleSubmit(data, '用户列表')}
        />
      </Card>

      {/* 示例 2: 虚拟滚动 */}
      <Card style={{ marginBottom: '30px' }}>
        <H4>示例 2: 虚拟滚动（大量数据）</H4>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          适用于数据量较大的场景（超过 50 条），启用虚拟滚动优化性能。当前示例包含 100 条数据。
        </p>
        <DynamicForm
          schema={virtualScrollSchema}
          defaultValues={virtualScrollDefaultValues}
          onSubmit={(data) => handleSubmit(data, '产品列表')}
        />
      </Card>

      {/* 示例 3: 自定义列顺序 */}
      <Card style={{ marginBottom: '30px' }}>
        <H4>示例 3: 自定义列顺序</H4>
        <p style={{ fontSize: '14px', color: '#666', marginBottom: '15px' }}>
          通过 columns 配置控制列的显示顺序。注意：id 字段未在 columns 中指定，因此不会显示。
        </p>
        <DynamicForm
          schema={customColumnsSchema}
          defaultValues={customColumnsDefaultValues}
          onSubmit={(data) => handleSubmit(data, '员工列表')}
        />
      </Card>

      {/* 特性说明 */}
      <Card>
        <H4>特性说明</H4>
        <ul style={{ fontSize: '14px', color: '#666', lineHeight: '1.8' }}>
          <li>✅ 表格式布局，自动根据 schema 生成列</li>
          <li>✅ 支持虚拟滚动（处理大量数据）</li>
          <li>✅ 支持自定义列顺序</li>
          <li>✅ 支持动态添加和删除</li>
          <li>✅ 支持最小/最大项数限制</li>
          <li>✅ 删除操作带确认弹窗</li>
          <li>✅ 空状态提示</li>
          <li>✅ 列宽自适应（flex 布局）</li>
        </ul>
      </Card>

      {/* Schema 配置示例 */}
      <Card style={{ marginTop: '20px' }}>
        <H4>Schema 配置示例（虚拟滚动）</H4>
        <pre style={{ background: '#f5f5f5', padding: '15px', overflow: 'auto', fontSize: '13px' }}>
          {JSON.stringify(virtualScrollSchema, null, 2)}
        </pre>
      </Card>
    </div>
  );
};
