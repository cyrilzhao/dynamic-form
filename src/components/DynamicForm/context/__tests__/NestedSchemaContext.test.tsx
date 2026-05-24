import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  NestedSchemaProvider,
  useNestedSchemaRegistry,
  useNestedSchemaRegistryOptional,
} from '../NestedSchemaContext';
import type { ExtendedJSONSchema } from '../../types/schema';

describe('NestedSchemaContext', () => {
  const mockSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
  };

  const mockSchema2: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      age: { type: 'number' },
    },
  };

  describe('NestedSchemaProvider', () => {
    it('应该正确渲染子组件', () => {
      render(
        <NestedSchemaProvider>
          <div data-testid="child">Child</div>
        </NestedSchemaProvider>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('useNestedSchemaRegistry', () => {
    it('在 Provider 外部使用时应该抛出错误', () => {
      expect(() => {
        renderHook(() => useNestedSchemaRegistry());
      }).toThrow('useNestedSchemaRegistry must be used within NestedSchemaProvider');
    });

    it('在 Provider 内部应该返回 registry 对象', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NestedSchemaProvider>{children}</NestedSchemaProvider>
      );

      const { result } = renderHook(() => useNestedSchemaRegistry(), { wrapper });

      expect(result.current).toHaveProperty('register');
      expect(result.current).toHaveProperty('unregister');
      expect(result.current).toHaveProperty('getSchema');
      expect(result.current).toHaveProperty('getAllSchemas');
    });
  });

  describe('useNestedSchemaRegistryOptional', () => {
    it('在 Provider 外部使用时应该返回 null', () => {
      const { result } = renderHook(() => useNestedSchemaRegistryOptional());
      expect(result.current).toBeNull();
    });

    it('在 Provider 内部应该返回 registry 对象', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NestedSchemaProvider>{children}</NestedSchemaProvider>
      );

      const { result } = renderHook(() => useNestedSchemaRegistryOptional(), { wrapper });
      expect(result.current).not.toBeNull();
    });
  });

  describe('registry 操作', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NestedSchemaProvider>{children}</NestedSchemaProvider>
    );

    it('register 应该正确注册 schema', () => {
      const { result } = renderHook(() => useNestedSchemaRegistry(), { wrapper });

      act(() => {
        result.current.register('field1', mockSchema);
      });

      expect(result.current.getSchema('field1')).toBe(mockSchema);
    });

    it('unregister 应该正确注销 schema', () => {
      const { result } = renderHook(() => useNestedSchemaRegistry(), { wrapper });

      act(() => {
        result.current.register('field1', mockSchema);
        result.current.unregister('field1');
      });

      expect(result.current.getSchema('field1')).toBeUndefined();
    });

    it('getSchema 对不存在的字段应该返回 undefined', () => {
      const { result } = renderHook(() => useNestedSchemaRegistry(), { wrapper });
      expect(result.current.getSchema('nonexistent')).toBeUndefined();
    });

    it('getAllSchemas 应该返回所有注册的 schema', () => {
      const { result } = renderHook(() => useNestedSchemaRegistry(), { wrapper });

      act(() => {
        result.current.register('field1', mockSchema);
        result.current.register('field2', mockSchema2);
      });

      const allSchemas = result.current.getAllSchemas();
      expect(allSchemas.size).toBe(2);
      expect(allSchemas.get('field1')).toBe(mockSchema);
      expect(allSchemas.get('field2')).toBe(mockSchema2);
    });

    it('register 应该覆盖已存在的 schema', () => {
      const { result } = renderHook(() => useNestedSchemaRegistry(), { wrapper });

      act(() => {
        result.current.register('field1', mockSchema);
        result.current.register('field1', mockSchema2);
      });

      expect(result.current.getSchema('field1')).toBe(mockSchema2);
    });
  });
});
