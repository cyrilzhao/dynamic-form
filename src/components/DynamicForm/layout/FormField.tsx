import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import { FormGroup } from '@blueprintjs/core'
import { FieldLabel } from '../components/FieldLabel'
import { FieldError } from '../components/FieldError'
import { FieldHelp } from '../components/FieldHelp'
import { FieldRegistry } from '../core/FieldRegistry'
import { useWidgets } from '../context/WidgetsContext'
import { useCallbacks } from '../context/CallbacksContext'
import type { FieldConfig } from '../types/schema'
import type { LinkageResult } from '../types/linkage'

export interface FormFieldProps {
  field: FieldConfig
  disabled?: boolean
  readonly?: boolean
  linkageState?: LinkageResult
  layout?: 'vertical' | 'horizontal' | 'inline'
  labelWidth?: number | string
  enableVirtualScroll?: boolean
  virtualScrollHeight?: number
}

/**
 * 将 callbackProps 中的函数名解析为实际函数
 * - callbackProps 优先覆盖 widgetProps 中的同名 key
 * - 找不到的函数名：跳过注入，开发环境警告
 * - 同名覆盖时：开发环境警告
 */
function resolveCallbackProps(
  callbackProps: Record<string, string> | undefined,
  callbacks: Record<string, (...args: any[]) => any>,
  widgetProps?: Record<string, any>
): Record<string, (...args: any[]) => any> {
  if (!callbackProps) return {}
  const result: Record<string, (...args: any[]) => any> = {}
  for (const [propName, fnName] of Object.entries(callbackProps)) {
    const fn = callbacks[fnName]
    if (!fn) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[DynamicForm] callbacks missing: "${fnName}" (used by callbackProps.${propName})`
        )
      }
      continue
    }
    if (
      process.env.NODE_ENV !== 'production' &&
      widgetProps &&
      propName in widgetProps
    ) {
      console.warn(
        `[DynamicForm] callbackProps key "${propName}" overrides widgetProps`
      )
    }
    result[propName] = fn
  }
  return result
}

interface WidgetWithTransformProps {
  controllerField: any
  WidgetComponent: React.ComponentType<any>
  transformFn: (val: any) => any
  widgetProps: Record<string, any>
}

const WidgetWithTransform: React.FC<WidgetWithTransformProps> = ({
  controllerField,
  WidgetComponent,
  transformFn,
  widgetProps,
}) => {
  const [displayValue, setDisplayValue] = useState(
    () => controllerField.value ?? ''
  )
  const [transformedPreview, setTransformedPreview] = useState<string | null>(
    () => {
      const initial = controllerField.value
      if (initial != null && initial !== '') {
        try {
          return String(transformFn(initial))
        } catch {
          return null
        }
      }
      return null
    }
  )

  const controllerFieldRef = useRef(controllerField)
  controllerFieldRef.current = controllerField
  const transformRef = useRef(transformFn)
  transformRef.current = transformFn
  const displayValueRef = useRef(displayValue)
  displayValueRef.current = displayValue

  useEffect(() => {
    const val = controllerField.value ?? ''
    if (val === displayValueRef.current) return
    setDisplayValue(val)
    setTransformedPreview(
      val !== '' && val != null
        ? (() => {
            try {
              return String(transformRef.current(val))
            } catch {
              return null
            }
          })()
        : null
    )
  }, [controllerField.value])

  const handleChange = useCallback((val: any) => {
    setDisplayValue(val)
    let preview: any
    try {
      preview = transformRef.current(val)
    } catch {
      preview = undefined
    }
    controllerFieldRef.current.onChange(val)
    setTransformedPreview(preview != null ? String(preview) : null)
  }, [])

  const handleBlur = useCallback((e: any) => {
    controllerFieldRef.current.onBlur(e)
  }, [])

  return (
    <>
      <WidgetComponent
        {...widgetProps}
        name={controllerField.name}
        ref={controllerField.ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {transformedPreview != null && (
        <span
          style={{
            fontSize: 12,
            color: '#888',
            display: 'block',
            marginTop: 2,
          }}
        >
          Converted value: {transformedPreview}
        </span>
      )}
    </>
  )
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
  const { control } = useFormContext()

  // 从 Context 获取 widgets 和 callbacks
  const widgets = useWidgets()
  const callbacks = useCallbacks()

  const resolvedWidget =
    field.widget === 'checkbox' && field.type !== 'boolean'
      ? 'checkbox-group'
      : field.widget
  const WidgetComponent =
    widgets[resolvedWidget] || FieldRegistry.getWidget(resolvedWidget)

  if (!WidgetComponent) {
    console.warn(`Widget "${field.widget}" not found`)
    return null
  }

  // 检查是否是 flattenPath 字段（路径透明化）
  // flattenPath 字段不应该显示 label，因为它是视觉透明的
  const isFlattenPath = field.schema?.ui?.flattenPath === true

  // 计算 layout 的优先级：字段级 > 父级 > 全局级
  const effectiveLayout = field.schema?.ui?.layout ?? layout

  // 计算 labelWidth 的优先级：字段级 > 全局级
  const effectiveLabelWidth = field.schema?.ui?.labelWidth ?? labelWidth

  // 使用 useMemo 缓存 formGroupStyle，避免每次渲染都创建新对象
  const formGroupStyle = useMemo(() => {
    const style: React.CSSProperties = {}
    if (effectiveLayout === 'horizontal') {
      style.flexDirection = 'row' // 覆盖 Blueprint 的 column
      style.alignItems = 'flex-start'
    } else if (effectiveLayout === 'inline') {
      style.display = 'inline-flex'
      style.marginRight = '15px'
    }
    return style
  }, [effectiveLayout])

  // 使用 useMemo 缓存 labelStyle，避免每次渲染都创建新对象
  const labelStyle = useMemo(() => {
    const style: React.CSSProperties = {}
    if (effectiveLayout === 'horizontal' && effectiveLabelWidth) {
      style.width =
        typeof effectiveLabelWidth === 'number'
          ? `${effectiveLabelWidth}px`
          : effectiveLabelWidth
      style.flexShrink = 0
      style.marginRight = '12px'
    }
    return style
  }, [effectiveLayout, effectiveLabelWidth])

  const widgetProps = field.schema?.ui?.widgetProps
  const resolvedCallbacks = resolveCallbackProps(
    field.schema?.ui?.callbackProps,
    callbacks,
    widgetProps
  )

  const transformConfig = field.schema?.ui?.transform
  const transformFn = transformConfig
    ? callbacks[transformConfig.callback]
    : undefined

  return (
    <FormGroup
      label={
        // flattenPath 字段不显示 label（视觉透明）
        !isFlattenPath && field.label ? (
          <div style={labelStyle}>
            <FieldLabel
              htmlFor={field.name}
              label={field.label}
              required={field.required}
            />
          </div>
        ) : undefined
      }
      labelFor={field.name}
      helperText={
        field.description ? <FieldHelp text={field.description} /> : undefined
      }
      style={formGroupStyle}
    >
      <Controller
        name={field.name}
        control={control}
        rules={field.validation}
        render={({ field: controllerField, fieldState }) => {
          const error = fieldState.error?.message
          const commonWidgetProps = {
            placeholder: field.placeholder,
            disabled: disabled || field.disabled,
            readonly: readonly || field.readonly,
            options: linkageState?.options ?? field.options,
            error,
            schema: field.schema,
            layout: effectiveLayout,
            labelWidth: effectiveLabelWidth,
            enableVirtualScroll,
            virtualScrollHeight,
            ...(widgetProps || {}),
            ...resolvedCallbacks,
          }

          return (
            <>
              <FormGroup intent={error ? 'danger' : 'none'}>
                {transformFn ? (
                  <WidgetWithTransform
                    controllerField={controllerField}
                    WidgetComponent={WidgetComponent}
                    transformFn={transformFn}
                    widgetProps={commonWidgetProps}
                  />
                ) : (
                  <WidgetComponent
                    {...controllerField}
                    {...commonWidgetProps}
                  />
                )}
              </FormGroup>
              {error && <FieldError message={error} />}
            </>
          )
        }}
      />
    </FormGroup>
  )
}

/**
 * 自定义比较函数：只在关键 props 变化时重渲染
 *
 * 优化策略：
 * 1. 比较 field 对象的关键属性（name, widget, disabled, readonly）
 * 2. 比较其他基本类型的 props
 * 3. 对于 linkageState，进行浅比较
 */
export function arePropsEqual(
  prevProps: FormFieldProps,
  nextProps: FormFieldProps
): boolean {
  // 比较 field 的关键属性
  if (
    prevProps.field.name !== nextProps.field.name ||
    prevProps.field.widget !== nextProps.field.widget ||
    prevProps.field.disabled !== nextProps.field.disabled ||
    prevProps.field.readonly !== nextProps.field.readonly ||
    prevProps.field.label !== nextProps.field.label ||
    prevProps.field.placeholder !== nextProps.field.placeholder
  ) {
    return false
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
    return false
  }

  // 比较 field.schema（用于 schema 联动）
  if (prevProps.field.schema !== nextProps.field.schema) {
    return false
  }

  // 比较 linkageState（浅比较）
  if (prevProps.linkageState !== nextProps.linkageState) {
    // 如果引用不同，检查内容是否相同
    if (!prevProps.linkageState && !nextProps.linkageState) {
      return true
    }
    if (!prevProps.linkageState || !nextProps.linkageState) {
      return false
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
      return false
    }
  }

  // 所有关键 props 都相同，不需要重渲染
  return true
}

// 使用 React.memo 包装组件，传入自定义比较函数
export const FormField = React.memo(FormFieldComponent, arePropsEqual)
