import type {
  CallbackPropRef,
  ExtendedJSONSchema,
  FieldVariant,
} from '../types/schema'
import { executeInlineScript } from './executeInlineScript'

export interface VariantDetectContext {
  /** 字段在当前表单中的完整路径，用于嵌套对象和数组元素定位。 */
  fieldPath?: string
  /** 数组字段中的元素索引；普通字段没有该值。 */
  arrayIndex?: number
  [key: string]: unknown
}

/**
 * 构造当前 Variant 的有效 schema。
 *
 * Variant 代表同一字段的独立数据形态，因此未声明的类型约束不能继续
 * 沿用基础字段或上一个 Variant；否则切换到 object 后仍可能执行 phone
 * 的 minLength、validators 或 transform。公共 UI 配置继续继承，Variant
 * 的专属配置则使用替代语义。
 */
export function buildVariantSchema(
  baseSchema: ExtendedJSONSchema,
  variant: FieldVariant,
): ExtendedJSONSchema {
  const variantSchema = variant.schema || {}
  const variantUi = variantSchema.ui || {}
  const effective: ExtendedJSONSchema = {
    ...baseSchema,
    ...variantSchema,
    type: variant.type,
    ui: {
      ...(baseSchema.ui || {}),
      ...variantUi,
      transform: variantUi.transform,
      ...(variant.widget !== undefined ? { widget: variant.widget } : {}),
    },
  }

  // 这些 UI 配置与当前 Variant 的 Widget/校验契约绑定，不能从旧 Variant 继承。
  const variantOnlyUiKeys = [
    'widget',
    'errorMessages',
    'widgetProps',
    'callbackProps',
    'validators',
  ] as const
  for (const key of variantOnlyUiKeys) {
    if (key === 'widget' && variant.widget !== undefined) {
      continue
    }
    if (!(key in variantUi)) {
      delete effective.ui?.[key]
    }
  }
  // transform 与 validators 一样属于 Variant schema 的 UI 配置。
  if (!('transform' in variantUi)) {
    delete effective.ui?.transform
  }

  // 这些 JSON Schema 规则会改变字段的数据契约，不能从其他 Variant 泄漏。
  const variantOnlyKeys = [
    'format',
    'pattern',
    'enum',
    'const',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'minLength',
    'maxLength',
    'required',
    'properties',
    'items',
  ] as const
  for (const key of variantOnlyKeys) {
    if (!(key in variantSchema)) {
      delete effective[key]
    }
  }

  return effective
}

/**
 * 异步执行所有 Variant 的检测回调，并返回第一个匹配项。
 *
 * 使用异步版本是因为检测器可能需要查询外部数据或执行异步业务规则；
 * 按配置顺序尝试可以保持“第一个匹配项获胜”的确定性。检测器异常只跳过
 * 当前 Variant，避免一个非法脚本阻断整个表单的其他模式。
 */
export async function detectVariant({
  variants,
  value,
  formData,
  context,
  callbacks,
  helpers,
}: {
  variants?: FieldVariant[]
  value: unknown
  formData: Record<string, unknown>
  context: VariantDetectContext
  callbacks: Record<string, (...args: any[]) => any>
  helpers: Record<string, any>
}): Promise<FieldVariant | undefined> {
  for (const variant of variants || []) {
    // 顺序遍历保证多个检测规则重叠时结果可预测，并遵循配置列表的优先级。
    const ref: CallbackPropRef | undefined = variant.detect?.callback
    if (!ref) {
      continue
    }
    try {
      const result =
        typeof ref === 'string'
          ? await callbacks[ref]?.({ value, formData, context, helpers })
          : await executeInlineScript({
              code: ref.code,
              params: { value, formData, context },
              helpers,
            })
      // truthy 才代表匹配；允许检测器返回 Promise<boolean> 以支持异步业务判断。
      if (result) {
        return variant
      }
    } catch {
      /* 检测失败时尝试下一个 Variant。 */
    }
  }
  return undefined
}

/**
 * 在渲染阶段执行同步检测。
 *
 * React 渲染不能等待 Promise，因此这里只接受同步返回值；如果 inline script
 * 返回 Promise，则视为本次未匹配，后续由异步校验/外部值流程重新检测。
 * 该函数与 detectVariant 保持相同的参数契约，确保 function name 和 inline
 * script 都能获得完整的表单上下文与 helpers。
 */
export function detectVariantSync({
  variants,
  value,
  formData,
  context,
  callbacks,
  helpers,
}: {
  variants?: FieldVariant[]
  value: unknown
  formData: Record<string, unknown>
  context: VariantDetectContext
  callbacks: Record<string, (...args: any[]) => any>
  helpers: Record<string, any>
}): FieldVariant | undefined {
  for (const variant of variants || []) {
    const ref = variant.detect?.callback
    if (!ref) {
      continue
    }
    try {
      const result =
        typeof ref === 'string'
          ? callbacks[ref]?.({ value, formData, context, helpers })
          : (() => {
              const out = executeInlineScript({
                code: ref.code,
                params: { value, formData, context },
                helpers,
              })
              // 渲染阶段不能暂停等待 Promise；异步检测交给 resolver/校验流程处理。
              return out instanceof Promise ? false : out
            })()
      if (result) {
        return variant
      }
    } catch {
      /* ignore invalid detector */
    }
  }
  return undefined
}

/**
 * 在没有匹配检测器时选择回退 Variant。
 *
 * 回退顺序与设计文档保持一致：先按 JavaScript 值类型匹配，再使用
 * defaultVariant，最后使用列表第一项。这样空值、未知值或检测器缺失时
 * 仍能稳定渲染一个明确的 Widget，而不会把联合类型传给基础 Widget。
 */
export function fallbackVariant(
  schema: ExtendedJSONSchema,
  value: unknown,
): FieldVariant | undefined {
  const variants = schema.ui?.variants
  if (!variants?.length) {
    return undefined
  }
  const type =
    value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
  return (
    // 先按实际值类型选择，避免无检测规则时总是强制使用 defaultVariant。
    variants.find((variant) => variant.type === type) ||
    // 类型无法匹配时再使用显式默认模式，保证空值和未知值仍有稳定 Widget。
    variants.find((variant) => variant.name === schema.ui?.defaultVariant) ||
    // 最后使用第一项作为容错兜底，避免把联合类型直接交给基础 Widget。
    variants[0]
  )
}
