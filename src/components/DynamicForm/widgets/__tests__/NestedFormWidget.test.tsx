import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NestedFormWidget } from '../NestedFormWidget';
import { TestWrapper } from './testHelpers';
import type { ExtendedJSONSchema } from '../../types/schema';

// Mock DynamicForm 组件，避免复杂的依赖
jest.mock('../../DynamicForm', () => ({
  DynamicForm: ({ schema, disabled, readonly }: any) => (
    <div data-testid="dynamic-form" data-disabled={disabled} data-readonly={readonly}>
      {Object.keys(schema.properties || {}).map(key => (
        <div key={key} data-testid={`field-${key}`}>
          {key}
        </div>
      ))}
    </div>
  ),
}));

describe('NestedFormWidget', () => {
  const simpleSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      firstName: { type: 'string', title: 'First Name' },
      lastName: { type: 'string', title: 'Last Name' },
    },
  };

  describe('基本渲染', () => {
    it('应该渲染嵌套表单', () => {
      render(
        <TestWrapper defaultValues={{ person: {} }}>
          <NestedFormWidget name="person" schema={simpleSchema} />
        </TestWrapper>
      );
      expect(screen.getByTestId('dynamic-form')).toBeInTheDocument();
    });

    it('应该渲染所有字段', () => {
      render(
        <TestWrapper defaultValues={{ person: {} }}>
          <NestedFormWidget name="person" schema={simpleSchema} />
        </TestWrapper>
      );
      expect(screen.getByTestId('field-firstName')).toBeInTheDocument();
      expect(screen.getByTestId('field-lastName')).toBeInTheDocument();
    });
  });

  describe('禁用状态', () => {
    it('disabled 应该传递给子表单', () => {
      render(
        <TestWrapper defaultValues={{ person: {} }}>
          <NestedFormWidget name="person" schema={simpleSchema} disabled={true} />
        </TestWrapper>
      );
      expect(screen.getByTestId('dynamic-form')).toHaveAttribute('data-disabled', 'true');
    });

    it('readonly 应该传递给子表单', () => {
      render(
        <TestWrapper defaultValues={{ person: {} }}>
          <NestedFormWidget name="person" schema={simpleSchema} readonly={true} />
        </TestWrapper>
      );
      expect(screen.getByTestId('dynamic-form')).toHaveAttribute('data-readonly', 'true');
    });
  });

  describe('noCard 模式', () => {
    it('noCard=true 时不应该渲染 Card', () => {
      const { container } = render(
        <TestWrapper defaultValues={{ person: {} }}>
          <NestedFormWidget name="person" schema={simpleSchema} noCard={true} />
        </TestWrapper>
      );
      expect(container.querySelector('.bp6-card')).not.toBeInTheDocument();
      expect(container.querySelector('.nested-form-widget--flatten')).toBeInTheDocument();
    });
  });

  describe('flattenPath 模式', () => {
    it('flattenPath=true 时不应该渲染 Card', () => {
      const schemaWithFlatten: ExtendedJSONSchema = {
        ...simpleSchema,
        ui: { flattenPath: true },
      };
      const { container } = render(
        <TestWrapper defaultValues={{ person: {} }}>
          <NestedFormWidget name="person" schema={schemaWithFlatten} />
        </TestWrapper>
      );
      expect(container.querySelector('.bp6-card')).not.toBeInTheDocument();
    });
  });

  describe('空 schema', () => {
    it('没有 properties 时应该返回 null', () => {
      const emptySchema: ExtendedJSONSchema = { type: 'object' };
      const { container } = render(
        <TestWrapper defaultValues={{ person: {} }}>
          <NestedFormWidget name="person" schema={emptySchema} />
        </TestWrapper>
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
