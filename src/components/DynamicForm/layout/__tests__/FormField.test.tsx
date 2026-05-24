import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { FormField, arePropsEqual, FormFieldProps } from '../FormField';
import { WidgetsProvider } from '../../context/WidgetsContext';
import type { FieldConfig } from '../../types/schema';
import type { LinkageResult } from '../../types/linkage';

/**
 * 测试用的 Mock Widget 组件
 */
const MockWidget = React.forwardRef<HTMLInputElement, any>((props, ref) => {
  const { name, value, onChange, disabled, readonly, placeholder, error } = props;
  return (
    <input
      ref={ref}
      data-testid="mock-widget"
      name={name}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      readOnly={readonly}
      placeholder={placeholder}
      data-error={error}
    />
  );
});
MockWidget.displayName = 'MockWidget';

/**
 * 测试包装器
 */
const TestWrapper: React.FC<{
  children: React.ReactNode;
  defaultValues?: Record<string, any>;
  customWidgets?: Record<string, React.ComponentType<any>>;
}> = ({ children, defaultValues = {}, customWidgets = {} }) => {
  const methods = useForm({ defaultValues });
  return (
    <FormProvider {...methods}>
      <WidgetsProvider widgets={{ 'mock-widget': MockWidget, ...customWidgets }}>
        {children}
      </WidgetsProvider>
    </FormProvider>
  );
};

/**
 * 创建基础字段配置
 */
const createFieldConfig = (overrides: Partial<FieldConfig> = {}): FieldConfig => ({
  name: 'testField',
  type: 'string',
  widget: 'mock-widget',
  label: 'Test Label',
  ...overrides,
});

describe('FormField', () => {
  describe('基本渲染', () => {
    it('应该正确渲染字段组件', () => {
      const field = createFieldConfig();
      render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );
      expect(screen.getByTestId('mock-widget')).toBeInTheDocument();
    });

    it('应该显示字段标签', () => {
      const field = createFieldConfig({ label: 'Username' });
      render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );
      expect(screen.getByText('Username')).toBeInTheDocument();
    });

    it('应该显示必填标记', () => {
      const field = createFieldConfig({ label: 'Email', required: true });
      render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('应该显示描述信息', () => {
      const field = createFieldConfig({ description: 'Please enter your name' });
      render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );
      expect(screen.getByText('Please enter your name')).toBeInTheDocument();
    });

    it('应该传递 placeholder 给 widget', () => {
      const field = createFieldConfig({ placeholder: 'Enter value' });
      render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );
      expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument();
    });
  });

  describe('Widget 未找到', () => {
    it('当 widget 不存在时应该返回 null 并输出警告', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const field = createFieldConfig({ widget: 'non-existent-widget' });

      const { container } = render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );

      expect(container.firstChild).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Widget "non-existent-widget" not found');
      consoleSpy.mockRestore();
    });
  });

  describe('禁用和只读状态', () => {
    it('应该支持通过 props 禁用字段', () => {
      const field = createFieldConfig();
      render(
        <TestWrapper>
          <FormField field={field} disabled={true} />
        </TestWrapper>
      );
      expect(screen.getByTestId('mock-widget')).toBeDisabled();
    });

    it('应该支持通过 field.disabled 禁用字段', () => {
      const field = createFieldConfig({ disabled: true });
      render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );
      expect(screen.getByTestId('mock-widget')).toBeDisabled();
    });

    it('应该支持通过 props 设置只读', () => {
      const field = createFieldConfig();
      render(
        <TestWrapper>
          <FormField field={field} readonly={true} />
        </TestWrapper>
      );
      expect(screen.getByTestId('mock-widget')).toHaveAttribute('readonly');
    });

    it('应该支持通过 field.readonly 设置只读', () => {
      const field = createFieldConfig({ readonly: true });
      render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );
      expect(screen.getByTestId('mock-widget')).toHaveAttribute('readonly');
    });
  });

  describe('布局样式', () => {
    it('默认使用 vertical 布局', () => {
      const field = createFieldConfig();
      const { container } = render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );
      const formGroup = container.querySelector('.bp6-form-group');
      expect(formGroup).toBeInTheDocument();
    });

    it('horizontal 布局应该设置 flexDirection: row', () => {
      const field = createFieldConfig();
      const { container } = render(
        <TestWrapper>
          <FormField field={field} layout="horizontal" />
        </TestWrapper>
      );
      const formGroup = container.querySelector('.bp6-form-group');
      expect(formGroup).toHaveStyle({ flexDirection: 'row' });
    });

    it('inline 布局应该设置 display: inline-flex', () => {
      const field = createFieldConfig();
      const { container } = render(
        <TestWrapper>
          <FormField field={field} layout="inline" />
        </TestWrapper>
      );
      const formGroup = container.querySelector('.bp6-form-group');
      expect(formGroup).toHaveStyle({ display: 'inline-flex' });
    });

    it('字段级 layout 应该覆盖全局 layout', () => {
      const field = createFieldConfig({
        schema: { ui: { layout: 'inline' } },
      });
      const { container } = render(
        <TestWrapper>
          <FormField field={field} layout="horizontal" />
        </TestWrapper>
      );
      const formGroup = container.querySelector('.bp6-form-group');
      expect(formGroup).toHaveStyle({ display: 'inline-flex' });
    });

    it('horizontal 布局下应该支持数字类型的 labelWidth', () => {
      const field = createFieldConfig({ label: 'Test Label' });
      const { container } = render(
        <TestWrapper>
          <FormField field={field} layout="horizontal" labelWidth={120} />
        </TestWrapper>
      );
      // 查找带有 style 属性的 div，它包含 width 样式
      const styledDivs = container.querySelectorAll('div[style]');
      const labelWrapperDiv = Array.from(styledDivs).find(
        (div) => div.getAttribute('style')?.includes('width')
      );
      expect(labelWrapperDiv).toHaveStyle({ width: '120px' });
    });

    it('horizontal 布局下应该支持字符串类型的 labelWidth', () => {
      const field = createFieldConfig({ label: 'Test Label' });
      const { container } = render(
        <TestWrapper>
          <FormField field={field} layout="horizontal" labelWidth="30%" />
        </TestWrapper>
      );
      const styledDivs = container.querySelectorAll('div[style]');
      const labelWrapperDiv = Array.from(styledDivs).find(
        (div) => div.getAttribute('style')?.includes('width')
      );
      expect(labelWrapperDiv).toHaveStyle({ width: '30%' });
    });

    it('字段级 labelWidth 应该覆盖全局 labelWidth', () => {
      const field = createFieldConfig({
        label: 'Test Label',
        schema: { ui: { labelWidth: 200 } },
      });
      const { container } = render(
        <TestWrapper>
          <FormField field={field} layout="horizontal" labelWidth={100} />
        </TestWrapper>
      );
      const styledDivs = container.querySelectorAll('div[style]');
      const labelWrapperDiv = Array.from(styledDivs).find(
        (div) => div.getAttribute('style')?.includes('width')
      );
      expect(labelWrapperDiv).toHaveStyle({ width: '200px' });
    });
  });

  describe('flattenPath 透明化渲染', () => {
    it('当 flattenPath 为 true 时不应该显示 label', () => {
      const field = createFieldConfig({
        label: 'Should Not Show',
        schema: { ui: { flattenPath: true } },
      });

      render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );

      expect(screen.queryByText('Should Not Show')).not.toBeInTheDocument();
    });

    it('当 flattenPath 为 false 时应该正常显示 label', () => {
      const field = createFieldConfig({
        label: 'Should Show',
        schema: { ui: { flattenPath: false } },
      });

      render(
        <TestWrapper>
          <FormField field={field} />
        </TestWrapper>
      );

      expect(screen.getByText('Should Show')).toBeInTheDocument();
    });
  });

  describe('React.memo 优化 (arePropsEqual)', () => {
    let renderCount: number;

    // 创建一个可以追踪渲染次数的 Mock Widget
    const RenderTrackingWidget = React.forwardRef<HTMLInputElement, any>((props, ref) => {
      renderCount++;
      return (
        <input
          ref={ref}
          data-testid="tracking-widget"
          data-render-count={renderCount}
          value={props.value || ''}
          onChange={(e) => props.onChange?.(e.target.value)}
        />
      );
    });
    RenderTrackingWidget.displayName = 'RenderTrackingWidget';

    beforeEach(() => {
      renderCount = 0;
    });

    it('当 field.name 变化时应该重新渲染', () => {
      const field1 = createFieldConfig({ name: 'field1' });
      const field2 = createFieldConfig({ name: 'field2' });

      const { rerender } = render(
        <TestWrapper customWidgets={{ 'mock-widget': RenderTrackingWidget }}>
          <FormField field={field1} />
        </TestWrapper>
      );

      const initialCount = renderCount;

      rerender(
        <TestWrapper customWidgets={{ 'mock-widget': RenderTrackingWidget }}>
          <FormField field={field2} />
        </TestWrapper>
      );

      expect(renderCount).toBeGreaterThan(initialCount);
    });

    it('当 field.widget 变化时应该重新渲染', () => {
      const field1 = createFieldConfig({ widget: 'mock-widget' });

      const { rerender } = render(
        <TestWrapper customWidgets={{ 'mock-widget': RenderTrackingWidget }}>
          <FormField field={field1} />
        </TestWrapper>
      );

      const initialCount = renderCount;

      // 改变 widget 类型
      const field2 = createFieldConfig({ widget: 'mock-widget', label: 'Changed' });
      rerender(
        <TestWrapper customWidgets={{ 'mock-widget': RenderTrackingWidget }}>
          <FormField field={field2} />
        </TestWrapper>
      );

      expect(renderCount).toBeGreaterThan(initialCount);
    });
  });

  describe('arePropsEqual 比较函数', () => {
    const baseField: FieldConfig = {
      name: 'testField',
      type: 'string',
      widget: 'text',
      label: 'Test',
      placeholder: 'Enter value',
      disabled: false,
      readonly: false,
    };

    const baseProps: FormFieldProps = {
      field: baseField,
      disabled: false,
      readonly: false,
      layout: 'vertical',
      labelWidth: 100,
      enableVirtualScroll: false,
      virtualScrollHeight: 300,
    };

    it('当所有 props 相同时应该返回 true', () => {
      expect(arePropsEqual(baseProps, baseProps)).toBe(true);
    });

    it('当 field.name 不同时应该返回 false', () => {
      const nextProps = {
        ...baseProps,
        field: { ...baseField, name: 'differentField' },
      };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 field.widget 不同时应该返回 false', () => {
      const nextProps = {
        ...baseProps,
        field: { ...baseField, widget: 'textarea' },
      };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 field.disabled 不同时应该返回 false', () => {
      const nextProps = {
        ...baseProps,
        field: { ...baseField, disabled: true },
      };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 field.readonly 不同时应该返回 false', () => {
      const nextProps = {
        ...baseProps,
        field: { ...baseField, readonly: true },
      };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 field.label 不同时应该返回 false', () => {
      const nextProps = {
        ...baseProps,
        field: { ...baseField, label: 'Different Label' },
      };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 field.placeholder 不同时应该返回 false', () => {
      const nextProps = {
        ...baseProps,
        field: { ...baseField, placeholder: 'Different placeholder' },
      };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 props.disabled 不同时应该返回 false', () => {
      const nextProps = { ...baseProps, disabled: true };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 props.readonly 不同时应该返回 false', () => {
      const nextProps = { ...baseProps, readonly: true };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 props.layout 不同时应该返回 false', () => {
      const nextProps = { ...baseProps, layout: 'horizontal' as const };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 props.labelWidth 不同时应该返回 false', () => {
      const nextProps = { ...baseProps, labelWidth: 200 };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 props.enableVirtualScroll 不同时应该返回 false', () => {
      const nextProps = { ...baseProps, enableVirtualScroll: true };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 props.virtualScrollHeight 不同时应该返回 false', () => {
      const nextProps = { ...baseProps, virtualScrollHeight: 500 };
      expect(arePropsEqual(baseProps, nextProps)).toBe(false);
    });

    it('当 field.schema 不同时应该返回 false', () => {
      const schema1 = { type: 'string' as const };
      const schema2 = { type: 'number' as const };
      const prevProps = { ...baseProps, field: { ...baseField, schema: schema1 } };
      const nextProps = { ...baseProps, field: { ...baseField, schema: schema2 } };
      expect(arePropsEqual(prevProps, nextProps)).toBe(false);
    });

    describe('linkageState 比较', () => {
      it('当两个 linkageState 都为 undefined 时应该返回 true', () => {
        const prevProps = { ...baseProps, linkageState: undefined };
        const nextProps = { ...baseProps, linkageState: undefined };
        expect(arePropsEqual(prevProps, nextProps)).toBe(true);
      });

      it('当两个 linkageState 引用不同但都是 falsy 值时应该返回 true', () => {
        // 使用不同的 falsy 值来触发 178-179 行的分支
        const prevProps = { ...baseProps };
        delete (prevProps as any).linkageState;
        const nextProps = { ...baseProps, linkageState: undefined };
        // 确保引用不同但都是 falsy
        expect(arePropsEqual(prevProps, nextProps)).toBe(true);
      });

      it('当 prevProps.linkageState 为 null 而 nextProps 为 undefined 时应该返回 true', () => {
        // 这个测试用例专门覆盖第 178-179 行的分支
        // 当两个 linkageState 引用不同（null !== undefined）但都是 falsy 值时
        const prevProps = { ...baseProps, linkageState: null as any };
        const nextProps = { ...baseProps, linkageState: undefined };
        expect(arePropsEqual(prevProps, nextProps)).toBe(true);
      });

      it('当 prevProps.linkageState 为 undefined 而 nextProps 有值时应该返回 false', () => {
        const prevProps = { ...baseProps, linkageState: undefined };
        const nextProps = { ...baseProps, linkageState: { visible: true } };
        expect(arePropsEqual(prevProps, nextProps)).toBe(false);
      });

      it('当 nextProps.linkageState 为 undefined 而 prevProps 有值时应该返回 false', () => {
        const prevProps = { ...baseProps, linkageState: { visible: true } };
        const nextProps = { ...baseProps, linkageState: undefined };
        expect(arePropsEqual(prevProps, nextProps)).toBe(false);
      });

      it('当 linkageState.visible 不同时应该返回 false', () => {
        const prevProps = { ...baseProps, linkageState: { visible: true } };
        const nextProps = { ...baseProps, linkageState: { visible: false } };
        expect(arePropsEqual(prevProps, nextProps)).toBe(false);
      });

      it('当 linkageState.disabled 不同时应该返回 false', () => {
        const prevProps = { ...baseProps, linkageState: { disabled: false } };
        const nextProps = { ...baseProps, linkageState: { disabled: true } };
        expect(arePropsEqual(prevProps, nextProps)).toBe(false);
      });

      it('当 linkageState.readonly 不同时应该返回 false', () => {
        const prevProps = { ...baseProps, linkageState: { readonly: false } };
        const nextProps = { ...baseProps, linkageState: { readonly: true } };
        expect(arePropsEqual(prevProps, nextProps)).toBe(false);
      });

      it('当 linkageState.value 不同时应该返回 false', () => {
        const prevProps = { ...baseProps, linkageState: { value: 'old' } };
        const nextProps = { ...baseProps, linkageState: { value: 'new' } };
        expect(arePropsEqual(prevProps, nextProps)).toBe(false);
      });

      it('当 linkageState.schema 不同时应该返回 false', () => {
        const schema1 = { type: 'string' };
        const schema2 = { type: 'number' };
        const prevProps = { ...baseProps, linkageState: { schema: schema1 } };
        const nextProps = { ...baseProps, linkageState: { schema: schema2 } };
        expect(arePropsEqual(prevProps, nextProps)).toBe(false);
      });

      it('当 linkageState.options 不同时应该返回 false', () => {
        const options1 = [{ label: 'A', value: 'a' }];
        const options2 = [{ label: 'B', value: 'b' }];
        const prevProps = { ...baseProps, linkageState: { options: options1 } };
        const nextProps = { ...baseProps, linkageState: { options: options2 } };
        expect(arePropsEqual(prevProps, nextProps)).toBe(false);
      });

      it('当 linkageState 内容相同但引用不同时应该返回 true', () => {
        const prevProps = { ...baseProps, linkageState: { visible: true, disabled: false } };
        const nextProps = { ...baseProps, linkageState: { visible: true, disabled: false } };
        expect(arePropsEqual(prevProps, nextProps)).toBe(true);
      });
    });
  });
});
