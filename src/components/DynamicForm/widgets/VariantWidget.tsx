import React, { useMemo, useState } from 'react'
import { FieldRegistry } from '../core/FieldRegistry'
import { Select } from '../../Select'
import type { FieldWidgetProps } from '../types'
import type { ExtendedJSONSchema, FieldVariant } from '../types/schema'
import { useFieldVariantStore } from '../context/FieldVariantContext'
import { useFormContext } from 'react-hook-form'

/**
 * 多模式字段适配器。负责提供模式选择器，并把当前值交给 active variant 的基础 Widget。
 * 模式值缓存保存在组件内部，切换时优先恢复目标模式上一次编辑的值。
 */
export const VariantWidget: React.FC<FieldWidgetProps> = ({
  name,
  value,
  onChange,
  schema,
  ...props
}) => {
  const { clearErrors } = useFormContext()
  const variants = (schema as ExtendedJSONSchema)?.ui?.variants || []
  const variantStore = useFieldVariantStore()
  const defaultName =
    (schema as ExtendedJSONSchema)?.ui?.defaultVariant || variants[0]?.name
  const [activeName, setActiveName] = useState(
    variantStore.getActive(name) || defaultName
  )
  const [cache, setCache] = useState<Record<string, unknown>>({})
  const active =
    variants.find((item) => item.name === activeName) || variants[0]
  const widgetName = active?.widget || active?.type || 'text'
  const Widget = FieldRegistry.getWidget(widgetName)
  const activeSchema = useMemo<ExtendedJSONSchema>(
    () => ({
      ...(schema as ExtendedJSONSchema),
      ...(active?.schema || {}),
      type: active?.type || (schema as ExtendedJSONSchema).type,
      ui: {
        ...((schema as ExtendedJSONSchema).ui || {}),
        ...(active?.schema?.ui || {}),
        widget: widgetName,
      },
    }),
    [active, schema, widgetName]
  )

  if (!active || !Widget) return null
  const activeValue = Object.prototype.hasOwnProperty.call(cache, active.name)
    ? cache[active.name]
    : value
  const switchVariant = (next: FieldVariant) => {
    clearErrors(name)
    const nextValue = Object.prototype.hasOwnProperty.call(cache, next.name)
      ? cache[next.name]
      : next.type === 'object'
        ? {}
        : next.type === 'array'
          ? []
          : next.type === 'boolean'
            ? false
            : next.type === 'number' || next.type === 'integer'
              ? undefined
              : ''
    setCache((previous) => ({ ...previous, [active.name]: value }))
    variantStore.setActive(name, next.name)
    variantStore.setCachedValue(name, active.name, value)
    setActiveName(next.name)
    onChange?.(nextValue)
  }
  const handleWidgetChange = (next: unknown) => {
    const normalizedValue =
      next && typeof next === 'object' && 'target' in next
        ? (next as { target: { value: unknown } }).target.value
        : next
    setCache((previous) => ({ ...previous, [active.name]: normalizedValue }))
    onChange?.(normalizedValue)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        width: '100%',
      }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <Widget
          {...props}
          name={name}
          schema={activeSchema}
          value={activeValue}
          onChange={handleWidgetChange}
        />
      </div>
      <Select
        value={active.name}
        options={variants.map((variant) => ({
          value: variant.name,
          label: variant.label || variant.name,
        }))}
        onChange={(nextName) => {
          const next = variants.find((variant) => variant.name === nextName)
          if (next) switchVariant(next)
        }}
        className="variant-widget__select"
        style={{ flex: '0 0 32px' }}
        renderValue={() => null}
        renderTrigger={({ onClick }) => (
          <button
            type="button"
            aria-label="选择 Variant"
            title="选择 Variant"
            onClick={onClick}
            style={{ width: 30, height: 30 }}
          >
            ▼
          </button>
        )}
      />
    </div>
  )
}
