import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useForm } from 'react-hook-form';
import {
  LinkageStateProvider,
  useLinkageStateContext,
  useLinkageStateContextRequired,
} from '../LinkageStateContext';
import type { LinkageStateContextValue } from '../LinkageStateContext';
import type { ExtendedJSONSchema } from '../../types/schema';

describe('LinkageStateContext', () => {
  const mockSchema: ExtendedJSONSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
  };

  const createMockContextValue = (
    form: ReturnType<typeof useForm>
  ): LinkageStateContextValue => ({
    parentLinkageStates: {},
    form,
    rootSchema: mockSchema,
    pathPrefix: '',
    linkageFunctions: {},
  });

  describe('LinkageStateProvider', () => {
    it('应该正确渲染子组件', () => {
      const { result } = renderHook(() => useForm());
      const mockValue = createMockContextValue(result.current);

      render(
        <LinkageStateProvider value={mockValue}>
          <div data-testid="child">Child</div>
        </LinkageStateProvider>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('useLinkageStateContext', () => {
    it('在 Provider 外部使用时应该返回 null', () => {
      const { result } = renderHook(() => useLinkageStateContext());
      expect(result.current).toBeNull();
    });

    it('在 Provider 内部应该返回 context 值', () => {
      const { result: formResult } = renderHook(() => useForm());
      const mockValue = createMockContextValue(formResult.current);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LinkageStateProvider value={mockValue}>{children}</LinkageStateProvider>
      );

      const { result } = renderHook(() => useLinkageStateContext(), { wrapper });
      expect(result.current).toBe(mockValue);
    });
  });

  describe('useLinkageStateContextRequired', () => {
    it('在 Provider 外部使用时应该抛出错误', () => {
      expect(() => {
        renderHook(() => useLinkageStateContextRequired());
      }).toThrow('useLinkageStateContextRequired must be used within LinkageStateProvider');
    });

    it('在 Provider 内部应该返回 context 值', () => {
      const { result: formResult } = renderHook(() => useForm());
      const mockValue = createMockContextValue(formResult.current);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LinkageStateProvider value={mockValue}>{children}</LinkageStateProvider>
      );

      const { result } = renderHook(() => useLinkageStateContextRequired(), { wrapper });
      expect(result.current).toBe(mockValue);
    });
  });

  describe('context 值传递', () => {
    it('应该正确传递 parentLinkageStates', () => {
      const { result: formResult } = renderHook(() => useForm());
      const mockValue: LinkageStateContextValue = {
        ...createMockContextValue(formResult.current),
        parentLinkageStates: {
          field1: { visible: true, disabled: false },
        },
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LinkageStateProvider value={mockValue}>{children}</LinkageStateProvider>
      );

      const { result } = renderHook(() => useLinkageStateContext(), { wrapper });
      expect(result.current?.parentLinkageStates).toEqual({
        field1: { visible: true, disabled: false },
      });
    });

    it('应该正确传递 pathPrefix', () => {
      const { result: formResult } = renderHook(() => useForm());
      const mockValue: LinkageStateContextValue = {
        ...createMockContextValue(formResult.current),
        pathPrefix: 'company.details',
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LinkageStateProvider value={mockValue}>{children}</LinkageStateProvider>
      );

      const { result } = renderHook(() => useLinkageStateContext(), { wrapper });
      expect(result.current?.pathPrefix).toBe('company.details');
    });

    it('应该正确传递 linkageFunctions', () => {
      const { result: formResult } = renderHook(() => useForm());
      const mockLinkageFunction = jest.fn();
      const mockValue: LinkageStateContextValue = {
        ...createMockContextValue(formResult.current),
        linkageFunctions: {
          customFunc: mockLinkageFunction,
        },
      };

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LinkageStateProvider value={mockValue}>{children}</LinkageStateProvider>
      );

      const { result } = renderHook(() => useLinkageStateContext(), { wrapper });
      expect(result.current?.linkageFunctions.customFunc).toBe(mockLinkageFunction);
    });
  });
});
