import React, { useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { FormGroup } from '@blueprintjs/core';
import { FieldLabel } from '../components/FieldLabel';
import { FieldError } from '../components/FieldError';
import { FieldHelp } from '../components/FieldHelp';
import { FieldRegistry } from '../core/FieldRegistry';
import { useWidgets } from '../context/WidgetsContext';
import type { FieldConfig } from '../types/schema';
import type { LinkageResult } from '../types/linkage';

export interface FormFieldProps {
  field: FieldConfig;
  disabled?: boolean;
  readonly?: boolean;
  linkageState?: LinkageResult;
  layout?: 'vertical' | 'horizontal' | 'inline';
  labelWidth?: number | string;
  enableVirtualScroll?: boolean;
  virtualScrollHeight?: number;
}

const FormFieldComponent: React.FC<FormFieldProps> = ({
  field,
  disabled,
  readonly,
  linkageState,
  layout = 'vertical',
  labelWidth,
  enableVirtualScroll,
  virtualScrollHeight,
}) => {
  const { control } = useFormContext();

  // 从 Context 获取 widgets
  const widgets = useWidgets();

  const WidgetComponent = widgets[field.widget] || FieldRegistry.getWidget(field.widget);

  if (!WidgetComponent) {
    console.warn(`Widget "${field.widget}" not found`);
    return null;
  }

  // 检查是否是 flattenPath 字段（路径透明化）
  // flattenPath 字段不应该显示 label，因为它是视觉透明的
  const isFlattenPath = field.schema?.ui?.flattenPath === true;

  // 计算 layout 的优先级：字段级 > 父级 > 全局级
  const effectiveLayout = field.schema?.ui?.layout ?? layout;

  // 计算 labelWidth 的优先级：字段级 > 全局级
  const effectiveLabelWidth = field.schema?.ui?.labelWidth ?? labelWidth;

  // 使用 useMemo 缓存 formGroupStyle，避免每次渲染都创建新对象
  const formGroupStyle = useMemo(() => {
    const style: React.CSSProperties = {};
    if (effectiveLayout === 'horizontal') {
      style.flexDirection = 'row'; // 覆盖 Blueprint 的 column
      style.alignItems = 'flex-start';
    } else if (effectiveLayout === 'inline') {
      style.display = 'inline-flex';
      style.marginRight = '15px';
    }
    return style;
  }, [effectiveLayout]);

  // 使用 useMemo 缓存 labelStyle，避免每次渲染都创建新对象
  const labelStyle = useMemo(() => {
    const style: React.CSSProperties = {};
    if (effectiveLayout === 'horizontal' && effectiveLabelWidth) {
      style.width =
        typeof effectiveLabelWidth === 'number' ? `${effectiveLabelWidth}px` : effectiveLabelWidth;
      style.flexShrink = 0;
      style.marginRight = '12px';
    }
    return style;
  }, [effectiveLayout, effectiveLabelWidth]);

  return (
    <FormGroup
      label={
        // flattenPath 字段不显示 label（视觉透明）
        !isFlattenPath && field.label ? (
          <div style={labelStyle}>
            <FieldLabel htmlFor={field.name} label={field.label} required={field.required} />
          </div>
        ) : undefined
      }
      labelFor={field.name}
      helperText={field.description ? <FieldHelp text={field.description} /> : undefined}
      style={formGroupStyle}
    >
      <Controller
        name={field.name}
        control={control}
        rules={field.validation}
        render={({ field: controllerField, fieldState }) => {
          // 使用 Controller 的 fieldState 获取错误信息
          // 这样只有当前字段的状态变化时才会重渲染，而不是所有字段
          const error = fieldState.error?.message;

          return (
            <>
              <FormGroup intent={error ? 'danger' : 'none'}>
                <WidgetComponent
                  {...controllerField}
                  placeholder={field.placeholder}
                  disabled={disabled || field.disabled}
                  readonly={readonly || field.readonly}
                  options={field.options}
                  error={error}
                  schema={field.schema}
                  layout={effectiveLayout}
                  labelWidth={effectiveLabelWidth}
                  enableVirtualScroll={enableVirtualScroll}
                  virtualScrollHeight={virtualScrollHeight}
                  {...(field.schema?.ui?.widgetProps || {})}
                />
              </FormGroup>
              {error && <FieldError message={error} />}
            </>
          );
        }}
      />
    </FormGroup>
  );
};

/**
 * 自定义比较函数：只在关键 props 变化时重渲染
 *
 * 优化策略：
 * 1. 比较 field 对象的关键属性（name, widget, disabled, readonly）
 * 2. 比较其他基本类型的 props
 * 3. 对于 linkageState，进行浅比较
 */
export function arePropsEqual(prevProps: FormFieldProps, nextProps: FormFieldProps): boolean {
  // 比较 field 的关键属性
  if (
    prevProps.field.name !== nextProps.field.name ||
    prevProps.field.widget !== nextProps.field.widget ||
    prevProps.field.disabled !== nextProps.field.disabled ||
    prevProps.field.readonly !== nextProps.field.readonly ||
    prevProps.field.label !== nextProps.field.label ||
    prevProps.field.placeholder !== nextProps.field.placeholder
  ) {
    return false;
  }

  // 比较其他基本 props
  if (
    prevProps.disabled !== nextProps.disabled ||
    prevProps.readonly !== nextProps.readonly ||
    prevProps.layout !== nextProps.layout ||
    prevProps.labelWidth !== nextProps.labelWidth ||
    prevProps.enableVirtualScroll !== nextProps.enableVirtualScroll ||
    prevProps.virtualScrollHeight !== nextProps.virtualScrollHeight
  ) {
    return false;
  }

  // 比较 field.schema（用于 schema 联动）
  if (prevProps.field.schema !== nextProps.field.schema) {
    return false;
  }

  // 比较 linkageState（浅比较）
  if (prevProps.linkageState !== nextProps.linkageState) {
    // 如果引用不同，检查内容是否相同
    if (!prevProps.linkageState && !nextProps.linkageState) {
      return true;
    }
    if (!prevProps.linkageState || !nextProps.linkageState) {
      return false;
    }
    // 比较 linkageState 的关键属性
    if (
      prevProps.linkageState.visible !== nextProps.linkageState.visible ||
      prevProps.linkageState.disabled !== nextProps.linkageState.disabled ||
      prevProps.linkageState.readonly !== nextProps.linkageState.readonly ||
      prevProps.linkageState.value !== nextProps.linkageState.value ||
      prevProps.linkageState.schema !== nextProps.linkageState.schema ||
      prevProps.linkageState.options !== nextProps.linkageState.options
    ) {
      return false;
    }
  }

  // 所有关键 props 都相同，不需要重渲染
  return true;
}

// 使用 React.memo 包装组件，传入自定义比较函数
export const FormField = React.memo(FormFieldComponent, arePropsEqual);
