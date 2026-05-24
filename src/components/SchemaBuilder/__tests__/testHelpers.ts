/**
 * SchemaBuilder 组件测试辅助文件
 */
import React from 'react';
import { render } from '@testing-library/react';
import type { ExtendedJSONSchema } from '../../DynamicForm/types/schema';
import type { LinkageConfig, ConditionExpression } from '../../DynamicForm/types/linkage';

/**
 * 基础测试 Schema
 */
export const basicSchema: ExtendedJSONSchema = {
  type: 'object',
  title: 'Test Form',
  properties: {
    name: {
      type: 'string',
      title: 'Name',
    },
    age: {
      type: 'number',
      title: 'Age',
    },
    email: {
      type: 'string',
      title: 'Email',
      format: 'email',
    },
  },
};

/**
 * 嵌套对象 Schema
 */
export const nestedSchema: ExtendedJSONSchema = {
  type: 'object',
  title: 'Nested Form',
  properties: {
    user: {
      type: 'object',
      title: 'User',
      properties: {
        firstName: {
          type: 'string',
          title: 'First Name',
        },
        lastName: {
          type: 'string',
          title: 'Last Name',
        },
      },
    },
  },
};

/**
 * 数组 Schema
 */
export const arraySchema: ExtendedJSONSchema = {
  type: 'object',
  title: 'Array Form',
  properties: {
    contacts: {
      type: 'array',
      title: 'Contacts',
      items: {
        type: 'object',
        title: 'Contact',
        properties: {
          name: {
            type: 'string',
            title: 'Contact Name',
          },
          phone: {
            type: 'string',
            title: 'Phone',
          },
        },
      },
    },
  },
};

/**
 * 带联动配置的 Schema
 */
export const schemaWithLinkage: ExtendedJSONSchema = {
  type: 'object',
  title: 'Linkage Form',
  properties: {
    showDetails: {
      type: 'boolean',
      title: 'Show Details',
    },
    details: {
      type: 'string',
      title: 'Details',
      ui: {
        linkage: {
          type: 'visibility',
          dependencies: ['#/properties/showDetails'],
          when: {
            field: '#/properties/showDetails',
            operator: '==',
            value: true,
          },
          fulfill: {
            state: { visible: true },
          },
          otherwise: {
            state: { visible: false },
          },
        },
      },
    },
  },
};

/**
 * 创建测试用的单条件表达式
 */
export const createSingleCondition = (
  field: string,
  operator: ConditionExpression extends { operator: infer O } ? O : never,
  value?: any
): ConditionExpression => ({
  field,
  operator: operator as any,
  value,
});

/**
 * 创建测试用的 AND 条件表达式
 */
export const createAndCondition = (conditions: ConditionExpression[]): ConditionExpression => ({
  and: conditions,
});

/**
 * 创建测试用的 OR 条件表达式
 */
export const createOrCondition = (conditions: ConditionExpression[]): ConditionExpression => ({
  or: conditions,
});

/**
 * 创建测试用的联动配置
 */
export const createLinkageConfig = (overrides: Partial<LinkageConfig> = {}): LinkageConfig => ({
  type: 'visibility',
  dependencies: [],
  ...overrides,
});

/**
 * 等待异步操作完成
 */
export const waitForAsync = (ms: number = 0): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * 模拟 SchemaBuilder Context
 */
export interface MockSchemaBuilderContextValue {
  schema: ExtendedJSONSchema;
  selectedPath: string[];
  expandedPaths: Record<string, boolean>;
  onSelect: jest.Mock;
  onUpdate: jest.Mock;
  onAddChild: jest.Mock;
  onAddSibling: jest.Mock;
  onDelete: jest.Mock;
  onToggleExpand: jest.Mock;
}

export const createMockSchemaBuilderContext = (
  overrides: Partial<MockSchemaBuilderContextValue> = {}
): MockSchemaBuilderContextValue => ({
  schema: basicSchema,
  selectedPath: ['properties', 'name'],
  expandedPaths: { '': true },
  onSelect: jest.fn(),
  onUpdate: jest.fn(),
  onAddChild: jest.fn(),
  onAddSibling: jest.fn(),
  onDelete: jest.fn(),
  onToggleExpand: jest.fn(),
  ...overrides,
});
