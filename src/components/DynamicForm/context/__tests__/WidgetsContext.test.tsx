import React from 'react';
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WidgetsProvider, useWidgets, useWidgetsOptional } from '../WidgetsContext';

describe('WidgetsContext', () => {
  const MockWidget: React.FC = () => <div>Mock Widget</div>;
  const AnotherWidget: React.FC = () => <div>Another Widget</div>;

  describe('WidgetsProvider', () => {
    it('应该正确渲染子组件', () => {
      render(
        <WidgetsProvider>
          <div data-testid="child">Child</div>
        </WidgetsProvider>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('应该接受空的 widgets 对象', () => {
      render(
        <WidgetsProvider widgets={{}}>
          <div data-testid="child">Child</div>
        </WidgetsProvider>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('useWidgetsOptional', () => {
    it('在 Provider 外部使用时应该返回 null', () => {
      const { result } = renderHook(() => useWidgetsOptional());
      expect(result.current).toBeNull();
    });

    it('在 Provider 内部应该返回 widgets 对象', () => {
      const widgets = { custom: MockWidget };
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WidgetsProvider widgets={widgets}>{children}</WidgetsProvider>
      );

      const { result } = renderHook(() => useWidgetsOptional(), { wrapper });
      expect(result.current).toEqual(widgets);
    });

    it('当 widgets 为空对象时应该返回空对象', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WidgetsProvider widgets={{}}>{children}</WidgetsProvider>
      );

      const { result } = renderHook(() => useWidgetsOptional(), { wrapper });
      expect(result.current).toEqual({});
    });
  });

  describe('useWidgets', () => {
    it('在 Provider 外部使用时应该返回空对象', () => {
      const { result } = renderHook(() => useWidgets());
      expect(result.current).toEqual({});
    });

    it('在 Provider 内部应该返回 widgets 对象', () => {
      const widgets = { custom: MockWidget, another: AnotherWidget };
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WidgetsProvider widgets={widgets}>{children}</WidgetsProvider>
      );

      const { result } = renderHook(() => useWidgets(), { wrapper });
      expect(result.current).toEqual(widgets);
      expect(result.current.custom).toBe(MockWidget);
      expect(result.current.another).toBe(AnotherWidget);
    });
  });
});
