import React, { useState, useMemo } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';
import { Card, Callout } from '@blueprintjs/core';

// Mock API: Simulate fetching product configuration schema from server
const mockProductSchemas: Record<string, ExtendedJSONSchema> = {
  laptop: {
    type: 'object',
    properties: {
      processor: {
        type: 'string',
        title: 'Processor',
        enum: ['Intel i5', 'Intel i7', 'Intel i9', 'AMD Ryzen 5', 'AMD Ryzen 7'],
        ui: { placeholder: 'Select processor' },
      },
      ram: {
        type: 'number',
        title: 'RAM (GB)',
        enum: [8, 16, 32, 64],
        ui: { placeholder: 'Select RAM size' },
      },
      storage: {
        type: 'string',
        title: 'Storage',
        enum: ['256GB SSD', '512GB SSD', '1TB SSD', '2TB SSD'],
        ui: { placeholder: 'Select storage' },
      },
      screenSize: {
        type: 'number',
        title: 'Screen Size (inches)',
        enum: [13, 14, 15, 16, 17],
        ui: { placeholder: 'Select screen size' },
      },
    },
    required: ['processor', 'ram', 'storage'],
  },
  smartphone: {
    type: 'object',
    properties: {
      brand: {
        type: 'string',
        title: 'Brand',
        enum: ['Apple', 'Samsung', 'Google', 'OnePlus', 'Xiaomi'],
        ui: { placeholder: 'Select brand' },
      },
      storage: {
        type: 'number',
        title: 'Storage (GB)',
        enum: [64, 128, 256, 512, 1024],
        ui: { placeholder: 'Select storage' },
      },
      color: {
        type: 'string',
        title: 'Color',
        enum: ['Black', 'White', 'Blue', 'Red', 'Gold'],
        ui: { placeholder: 'Select color' },
      },
      screenSize: {
        type: 'number',
        title: 'Screen Size (inches)',
        enum: [5.5, 6.1, 6.5, 6.7],
        ui: { placeholder: 'Select screen size' },
      },
    },
    required: ['brand', 'storage', 'color'],
  },
  tablet: {
    type: 'object',
    properties: {
      brand: {
        type: 'string',
        title: 'Brand',
        enum: ['Apple iPad', 'Samsung Galaxy Tab', 'Microsoft Surface', 'Amazon Fire'],
        ui: { placeholder: 'Select brand' },
      },
      storage: {
        type: 'number',
        title: 'Storage (GB)',
        enum: [64, 128, 256, 512],
        ui: { placeholder: 'Select storage' },
      },
      connectivity: {
        type: 'string',
        title: 'Connectivity',
        enum: ['WiFi Only', 'WiFi + Cellular'],
        ui: { widget: 'radio' },
      },
      screenSize: {
        type: 'number',
        title: 'Screen Size (inches)',
        enum: [8, 10, 11, 12.9],
        ui: { placeholder: 'Select screen size' },
      },
    },
    required: ['brand', 'storage', 'connectivity'],
  },
};

// Simulate API call with delay
const fetchProductSchema = async (productType: string): Promise<ExtendedJSONSchema> => {
  console.log(`[API] Fetching schema for product type: ${productType}`);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  const schema = mockProductSchemas[productType];
  if (!schema) {
    throw new Error(`Schema not found for product type: ${productType}`);
  }

  console.log(`[API] Schema loaded for ${productType}:`, schema);
  return schema;
};

export const SchemaLoaderExample: React.FC = () => {
  const [submittedData, setSubmittedData] = useState<any>(null);

  // 定义联动函数：根据 productType 加载对应的 schema
  const linkageFunctions = useMemo(
    () => ({
      loadProductSchema: async (formData: Record<string, any>) => {
        const productType = formData?.productType;
        if (!productType) {
          return { type: 'object', properties: {} };
        }
        return fetchProductSchema(productType);
      },
    }),
    []
  );

  // 使用 useMemo 缓存 schema，避免每次渲染都创建新的 schemaLoader 函数
  const schema: ExtendedJSONSchema = useMemo(
    () => ({
      type: 'object',
      properties: {
        productType: {
          type: 'string',
          title: 'Product Type',
          enum: ['laptop', 'smartphone', 'tablet'],
          enumNames: ['Laptop', 'Smartphone', 'Tablet'],
          ui: {
            widget: 'radio',
          },
        },
        configuration: {
          type: 'object',
          title: 'Product Configuration',
          properties: {},
          ui: {
            flattenPath: true,
            linkages: [{
              type: 'schema',
              dependencies: ['productType'],
              when: {
                field: 'productType',
                operator: 'isNotEmpty',
              },
              fulfill: {
                function: 'loadProductSchema',
              },
            }],
          },
        },
      },
      required: ['productType'],
    }),
    []
  ); // 空依赖数组，schema 只创建一次

  const handleSubmit = (data: any) => {
    console.log('Schema Loader Example - 提交数据:', data);
    setSubmittedData(data);
  };

  return (
    <Card style={{ marginTop: '20px', maxWidth: '800px' }}>
      <h3>Schema Loader Example</h3>

      <Callout intent="primary" style={{ marginBottom: '20px' }}>
        <h4>Scenario: Dynamic Product Configuration</h4>
        <p>
          This example demonstrates using <code>schemaLoader</code> to asynchronously load product
          configuration schemas from a server based on the selected product type.
        </p>
        <ul style={{ marginBottom: 0 }}>
          <li>Select a product type (Laptop, Smartphone, or Tablet)</li>
          <li>The configuration form will load asynchronously (simulated 800ms delay)</li>
          <li>Each product type has different configuration options</li>
          <li>Check the browser console to see the API calls</li>
        </ul>
      </Callout>

      <DynamicForm schema={schema} onSubmit={handleSubmit} linkageFunctions={linkageFunctions} />

      {submittedData && (
        <Callout intent="success" style={{ marginTop: '20px' }}>
          <h4>Submitted Data:</h4>
          <pre style={{ marginBottom: 0 }}>{JSON.stringify(submittedData, null, 2)}</pre>
        </Callout>
      )}
    </Card>
  );
};
