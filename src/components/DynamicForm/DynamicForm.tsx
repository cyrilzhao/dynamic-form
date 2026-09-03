import React, {
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useRef,
} from 'react'
import {
  useForm,
  FormProvider,
  useFormContext,
  type UseFormReturn,
} from 'react-hook-form'
import { Button } from '@blueprintjs/core'
import { SchemaParser } from './core/SchemaParser'
import { FormField } from './layout/FormField'
import { ErrorList } from './components/ErrorList'
import type { DynamicFormProps, DynamicFormRef } from './types'
import type { ArrayAction, FieldChangeSource, FormChangeMeta } from './types'
import {
  parseSchemaLinkages,
  transformToAbsolutePaths,
} from './utils/schemaLinkageParser'
import { useArrayLinkageManager } from './hooks/useArrayLinkageManager'
import type { LinkageConfig } from './types/linkage'
import type { ExtendedJSONSchema } from './types/schema'
import { filterValueWithNestedSchemas } from './utils/filterValueWithNestedSchemas'
import {
  NestedSchemaProvider,
  useNestedSchemaRegistryOptional,
} from './context/NestedSchemaContext'
import { PathPrefixProvider } from './context/PathPrefixContext'
import {
  LinkageStateProvider,
  useLinkageStateContext,
} from './context/LinkageStateContext'
import { WidgetsProvider } from './context/WidgetsContext'
import { CallbacksProvider } from './context/CallbacksContext'
import { HelpersProvider } from './context/HelpersContext'
import {
  TextFieldFocusProvider,
  useTextFieldFocus,
} from './context/TextFieldFocusContext'
import {
  wrapPrimitiveArrays,
  unwrapPrimitiveArrays,
} from './utils/arrayTransformer'
import {
  extractSchemaDefaults,
  mergeDefaults,
} from './utils/extractSchemaDefaults'
import { createSchemaResolver } from './utils/createSchemaResolver'
import { resolveTransformFn } from './utils/resolveTransformFn'
import { PathResolver } from './utils/pathResolver'
import { mergeSchemaWithLinkage } from './utils/mergeSchemaWithLinkage'
import { LinkageOperationController } from './utils/linkageOperationController'
import { builtInHelpers } from './utils/builtInHelpers'
import {
  registerArrayActionStore,
  consumeArrayActionForSnapshot,
  clearArrayAction,
} from './utils/arrayActionRegistry'
import {
  createFieldVariantStore,
  FieldVariantProvider,
  useFieldVariantStoreOptional,
} from './context/FieldVariantContext'
import {
  buildVariantSchema,
  detectVariantSync,
  fallbackVariant,
} from './utils/resolveVariant'
import '@blueprintjs/core/lib/css/blueprint.css'

// 空对象常量，避免每次渲染创建新对象
const EMPTY_LINKAGE_FUNCTIONS = {}
const EMPTY_WIDGETS = {}
const EMPTY_CUSTOM_FORMATS = {}
const EMPTY_CALLBACKS = {}
const EMPTY_HELPERS = {}

/**
 * 根据数组前后快照推断结构动作。
 * 该函数独立于 watch 订阅，便于同时服务带路径和无路径的 RHF 通知；
 * Select 多选不属于结构操作，因此显式排除。
 */
function isDeepEqual(previousValue: unknown, value: unknown): boolean {
  if (Object.is(previousValue, value)) {
    return true
  }
  if (Array.isArray(previousValue) && Array.isArray(value)) {
    return (
      previousValue.length === value.length &&
      previousValue.every((item, index) => isDeepEqual(item, value[index]))
    )
  }
  if (
    previousValue &&
    value &&
    typeof previousValue === 'object' &&
    typeof value === 'object'
  ) {
    const previousKeys = Object.keys(previousValue as Record<string, unknown>)
    const valueRecord = value as Record<string, unknown>
    return (
      previousKeys.length === Object.keys(valueRecord).length &&
      previousKeys.every(
        (key) =>
          key in valueRecord &&
          isDeepEqual(
            (previousValue as Record<string, unknown>)[key],
            valueRecord[key],
          ),
      )
    )
  }
  return false
}

function inferArrayAction(
  schema: ExtendedJSONSchema,
  path: string,
  previousValue: unknown,
  value: unknown,
): ArrayAction | undefined {
  if (previousValue === undefined && Array.isArray(value)) {
    return value.length > 0
      ? { action: 'insert', index: 0, value: value[0] }
      : undefined
  }
  // 仅对动态数组结构推断动作；Select 多选数组属于值更新，不应标记数组结构操作。
  const fieldSchema = getSchemaAtPath(schema, path)
  if (
    fieldSchema?.type !== 'array' ||
    fieldSchema.ui?.widget === 'select' ||
    !Array.isArray(previousValue) ||
    !Array.isArray(value)
  ) {
    return undefined
  }
  if (value.length > previousValue.length) {
    if (value.length !== previousValue.length + 1) {
      return undefined
    }
    const candidates = value
      .map((_, index) => index)
      .filter((insertIndex) =>
        previousValue.every((item, i) =>
          i < insertIndex
            ? isDeepEqual(item, value[i])
            : isDeepEqual(item, value[i + 1]),
        ),
      )
    return candidates.length === 1
      ? { action: 'insert', index: candidates[0], value: value[candidates[0]] }
      : undefined
  }
  if (value.length < previousValue.length) {
    if (previousValue.length !== value.length + 1) {
      return undefined
    }
    const candidates = previousValue
      .map((_, index) => index)
      .filter((removeIndex) =>
        value.every((item, i) =>
          i < removeIndex
            ? isDeepEqual(item, previousValue[i])
            : isDeepEqual(item, previousValue[i + 1]),
        ),
      )
    return candidates.length === 1
      ? {
          action: 'remove',
          index: candidates[0],
          value: previousValue[candidates[0]],
        }
      : undefined
  }
  // 首个差异位置用于判断相邻元素发生了上移还是下移。
  const changedIndex = value.findIndex(
    (item, index) => !Object.is(item, previousValue[index]),
  )
  if (changedIndex < 0) {
    return undefined
  }
  if (
    changedIndex < value.length - 1 &&
    isDeepEqual(value[changedIndex], previousValue[changedIndex + 1]) &&
    isDeepEqual(value[changedIndex + 1], previousValue[changedIndex])
  ) {
    return {
      action: 'move',
      fromIndex: changedIndex + 1,
      toIndex: changedIndex,
      value: value[changedIndex],
    }
  }
  if (
    changedIndex > 0 &&
    isDeepEqual(value[changedIndex], previousValue[changedIndex - 1]) &&
    isDeepEqual(value[changedIndex - 1], previousValue[changedIndex])
  ) {
    return {
      action: 'move',
      fromIndex: changedIndex - 1,
      toIndex: changedIndex,
      value: value[changedIndex],
    }
  }
  return undefined
}

/**
 * 递归展开嵌套对象，对每层路径都调用 setValue
 *
 * NestedFormWidget 的对象路径是结构节点，实际值由 address.street 等叶子 Controller 管理。
 * 对对象路径整体调用 setValue 时，仍需确保已挂载的叶子 Controller 同步收到新值。
 *
 * 解决方案：递归展开嵌套对象，对每层路径都调用 setValue，确保所有 Controller 都被更新。
 */
function setValuesRecursive(
  methods: UseFormReturn,
  obj: Record<string, any>,
  options?: {
    shouldValidate?: boolean
    shouldDirty?: boolean
    shouldTouch?: boolean
  },
  prefix = '',
) {
  Object.entries(obj || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    // 设置当前路径的值
    methods.setValue(path, value, options)
    // 普通对象递归展开（数组和 null 除外）：
    // NestedFormWidget 内部只有叶子字段注册 Controller（如 address.street）。
    // 对每一层路径调用 setValue，确保嵌套表单的已挂载叶子字段同步更新。
    // 数组由 useFieldArray 管理，直接设置整体即可，无需递归展开。
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      setValuesRecursive(methods, value, options, path)
    }
  })
}

/**
 * 根据 schema 结构构建类型恰当的空值对象
 *
 * 用于 reset({}) 场景：需要为每个字段生成正确类型的空值，
 * 避免使用 undefined（会导致 React 受控组件变为非受控组件，保留旧值）。
 *
 * 类型映射：
 * - string → ''
 * - number/integer → undefined（数字字段 undefined 是合法的空状态）
 * - boolean → false
 * - array → []
 * - object → 递归构建空对象
 */
function buildEmptyValues(schema: ExtendedJSONSchema): Record<string, any> {
  if (schema.type !== 'object' || !schema.properties) {
    return {}
  }

  const result: Record<string, any> = {}

  Object.entries(schema.properties).forEach(([key, fieldSchema]) => {
    const typedSchema = fieldSchema as ExtendedJSONSchema

    if (typedSchema.type === 'array') {
      result[key] = []
    } else if (typedSchema.type === 'object' && typedSchema.properties) {
      result[key] = buildEmptyValues(typedSchema)
    } else if (typedSchema.type === 'string') {
      result[key] = ''
    } else {
      // number/integer/boolean 等：undefined 是合法的空状态
      result[key] = undefined
    }
  })

  return result
}

/**
 * 批量设置表单值，处理基本类型数组包装和嵌套对象展开
 */
function setFormValues({
  methods,
  values,
  schema,
  options,
}: {
  methods: UseFormReturn
  values: Record<string, any>
  schema: ExtendedJSONSchema
  options?: {
    shouldValidate?: boolean
    shouldDirty?: boolean
    shouldTouch?: boolean
  }
}) {
  // 步骤1：基本类型数组包装
  const wrapped = wrapPrimitiveArrays(values, schema)
  // 步骤2：递归设置值
  setValuesRecursive(methods, wrapped, options)
}

/**
 * 转换表单数据：数组解包 + 数据过滤
 *
 * 新方案（v3.0）：
 * - 移除路径转换逻辑，数据保持标准的嵌套格式
 * - 只需要解包基本类型数组和过滤数据
 *
 * @param data - 原始表单数据
 * @param schema - Schema 定义
 * @param nestedSchemaRegistry - 嵌套 Schema 注册表（可选）
 * @param shouldFilter - 是否需要过滤数据（默认 false）
 * @returns 转换后的数据
 */
function transformFormData(
  data: Record<string, any>,
  schema: ExtendedJSONSchema,
  nestedSchemaRegistry?: {
    getAllSchemas: () => Map<string, ExtendedJSONSchema>
  },
  shouldFilter: boolean = false,
): Record<string, any> {
  // 第一步：解包基本类型数组。Variant 解析由调用方提前完成，保持本函数纯粹。
  let processedData = unwrapPrimitiveArrays(data, schema)

  // 第二步：根据 schema 过滤数据（仅在需要时执行）
  if (shouldFilter) {
    processedData = nestedSchemaRegistry
      ? filterValueWithNestedSchemas(
          processedData,
          schema,
          nestedSchemaRegistry.getAllSchemas(),
        )
      : filterValueWithNestedSchemas(processedData, schema, new Map())
  }

  return processedData
}

function resolveVariantForValue(
  fieldSchema: ExtendedJSONSchema,
  value: unknown,
  callbacks: Record<string, (...args: any[]) => any> = {},
  helpers: Record<string, any> = {},
  path = '',
  variantStore?: ReturnType<typeof createFieldVariantStore>,
) {
  const variants = fieldSchema.ui?.variants
  if (!variants?.length) {
    return null
  }
  const activeName = variantStore?.getActive(path)
  const activeVariant = variants.find((variant) => variant.name === activeName)
  if (activeVariant) {
    return activeVariant
  }
  const detected = detectVariantSync({
    variants,
    value,
    formData: {},
    context: {},
    callbacks,
    helpers,
  })
  return detected || fallbackVariant(fieldSchema, value) || null
}

function getEffectiveVariantSchema(
  fieldSchema: ExtendedJSONSchema,
  value: unknown,
  callbacks: Record<string, (...args: any[]) => any> = {},
  helpers: Record<string, any> = {},
  path = '',
  variantStore?: ReturnType<typeof createFieldVariantStore>,
): ExtendedJSONSchema {
  const variant = resolveVariantForValue(
    fieldSchema,
    value,
    callbacks,
    helpers,
    path,
    variantStore,
  )
  if (!variant) {
    return fieldSchema
  }
  return buildVariantSchema(fieldSchema, variant)
}

function buildEffectiveSchemaTree({
  schema,
  value,
  callbacks,
  helpers,
  variantStore,
  path = '',
}: {
  schema: ExtendedJSONSchema
  value: any
  callbacks: Record<string, (...args: any[]) => any>
  helpers: Record<string, any>
  variantStore: ReturnType<typeof createFieldVariantStore>
  path?: string
}): ExtendedJSONSchema {
  const effective = getEffectiveVariantSchema(
    schema,
    value,
    callbacks,
    helpers,
    path,
    variantStore,
  )
  if (effective.properties && value && typeof value === 'object') {
    effective.properties = Object.fromEntries(
      Object.entries(effective.properties).map(([key, child]) => [
        key,
        buildEffectiveSchemaTree({
          schema: child as ExtendedJSONSchema,
          value: value[key],
          callbacks,
          helpers,
          variantStore,
          path: path ? `${path}.${key}` : key,
        }),
      ]),
    )
  }
  if (
    effective.type === 'array' &&
    !Array.isArray(effective.items) &&
    effective.items
  ) {
    effective.items = buildEffectiveSchemaTree({
      schema: effective.items as ExtendedJSONSchema,
      value: Array.isArray(value) ? value[0] : undefined,
      callbacks,
      helpers,
      variantStore,
      path: path ? `${path}.items` : 'items',
    })
  }
  return effective
}

/**
 * 将表单数据中所有配置了 ui.transform.callback 的字段值从展示域转为存储域
 *
 * 调用时机：getValues、onChange 回调、onSubmit 回调。
 * 原因：表单内部存储展示域值（用户输入），对外暴露的所有数据出口统一返回存储域值，
 * 使外部调用方无需感知转换逻辑。
 *
 * 调用方需要先通过 buildEffectiveSchemaTree 构造当前值对应的有效 schema；
 * 本函数只负责遍历字段并应用 transform，不负责解析 Variant。
 */
function applyFieldTransforms(
  data: any,
  schema: ExtendedJSONSchema,
  callbacks: Record<string, (...args: any[]) => any>,
  helpers: Record<string, any>,
  variantStore?: ReturnType<typeof createFieldVariantStore>,
  path = '',
): any {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data
  }
  const result: Record<string, any> = { ...data }
  const properties = schema.properties || {}
  for (const [key, fieldSchema] of Object.entries(properties)) {
    if (!(key in result)) {
      continue
    }
    const cb = fieldSchema.ui?.transform?.callback
    const fn = resolveTransformFn(cb, callbacks)
    if (fn) {
      try {
        result[key] = fn({ value: result[key], helpers })
      } catch {
        /* keep */
      }
      continue
    }
    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      result[key] = applyFieldTransforms(
        result[key],
        fieldSchema,
        callbacks,
        helpers,
        variantStore,
        path ? `${path}.${key}` : key,
      )
    }
    if (
      fieldSchema.type === 'array' &&
      !Array.isArray(fieldSchema.items) &&
      fieldSchema.items &&
      Array.isArray(result[key])
    ) {
      result[key] = (result[key] as any[]).map((item, index) => {
        const itemPath = path ? `${path}.${key}.${index}` : `${key}.${index}`
        const effectiveItemSchema = variantStore
          ? buildEffectiveSchemaTree({
              schema: fieldSchema.items as ExtendedJSONSchema,
              value: item,
              callbacks,
              helpers,
              variantStore,
              path: itemPath,
            })
          : (fieldSchema.items as ExtendedJSONSchema)
        return applyFieldTransforms(
          item,
          effectiveItemSchema,
          callbacks,
          helpers,
          variantStore,
          itemPath,
        )
      })
    }
  }
  return result
}

/**
 * 根据路径字符串（如 "a.b.c" 或 "items.0.name"）从 schema 树中查找对应的子 schema
 *
 * 用于 setValue/getValue 时找到单个字段的 transform 配置，以便对值进行单字段级别转换。
 * 数字段（如 "0"）表示数组索引，此时跳入 items schema 继续查找。
 */
function getSchemaAtPath(
  schema: ExtendedJSONSchema,
  path: string,
): ExtendedJSONSchema | undefined {
  const parts = path.split('.')
  let current: ExtendedJSONSchema = schema
  for (const part of parts) {
    const next =
      current.properties?.[part] ??
      (!isNaN(parseInt(part)) && !Array.isArray(current.items)
        ? current.items
        : undefined)
    if (!next) {
      return undefined
    }
    current = next as ExtendedJSONSchema
  }
  return current
}

/**
 * 将外部传入的存储域值反向转换为展示域值，写入表单内部
 *
 * 调用时机：setValues、setValue、reset 等外部赋值 API。
 * 原因：表单内部存储展示域值，外部 API 统一接收存储域值，
 * 因此写入前需要先通过 reverseCallback 转换。
 *
 * 调用方需要先通过 buildEffectiveSchemaTree 构造当前值对应的有效 schema；
 * 本函数只负责遍历字段并应用 reverseTransform，不负责解析 Variant。
 */
function reverseFieldTransforms(
  data: any,
  schema: ExtendedJSONSchema,
  callbacks: Record<string, (...args: any[]) => any>,
  helpers: Record<string, any>,
  variantStore?: ReturnType<typeof createFieldVariantStore>,
  path = '',
): any {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data
  }
  const result: Record<string, any> = { ...data }
  const properties = schema.properties || {}
  for (const [key, fieldSchema] of Object.entries(properties)) {
    if (!(key in result)) {
      continue
    }
    const cb = fieldSchema.ui?.transform?.reverseCallback
    const fn = resolveTransformFn(cb, callbacks)
    if (fn) {
      try {
        result[key] = fn({ value: result[key], helpers })
      } catch {
        /* keep */
      }
      continue
    }
    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      result[key] = reverseFieldTransforms(
        result[key],
        fieldSchema,
        callbacks,
        helpers,
        variantStore,
        path ? `${path}.${key}` : key,
      )
    }
    if (
      fieldSchema.type === 'array' &&
      !Array.isArray(fieldSchema.items) &&
      fieldSchema.items &&
      Array.isArray(result[key])
    ) {
      result[key] = (result[key] as any[]).map((item, index) => {
        const itemPath = path ? `${path}.${key}.${index}` : `${key}.${index}`
        const effectiveItemSchema = variantStore
          ? buildEffectiveSchemaTree({
              schema: fieldSchema.items as ExtendedJSONSchema,
              value: item,
              callbacks,
              helpers,
              variantStore,
              path: itemPath,
            })
          : (fieldSchema.items as ExtendedJSONSchema)
        return reverseFieldTransforms(
          item,
          effectiveItemSchema,
          callbacks,
          helpers,
          variantStore,
          itemPath,
        )
      })
    }
  }
  return result
}

/**
 * 检查字段是否应该被隐藏（包括检查父级路径的联动状态）
 *
 * 新方案（v3.0）：
 * - 使用标准的 . 分隔符
 * - 检查字段自身和所有父级路径的联动状态
 *
 * @param fieldPath - 字段路径，如 'auth.content.key'
 * @param linkageStates - 联动状态映射
 * @returns 如果字段或其任何父级被隐藏，返回 true
 */
function isFieldHiddenByLinkage(
  fieldPath: string,
  linkageStates: Record<string, { visible?: boolean }>,
): boolean {
  // 检查字段自身的联动状态
  if (linkageStates[fieldPath]?.visible === false) {
    return true
  }

  // 使用标准的 . 分隔符拆分路径
  const parts = fieldPath.split('.')

  // 检查每个父级路径的联动状态
  for (let i = 1; i < parts.length; i++) {
    const parentPath = parts.slice(0, i).join('.')
    if (linkageStates[parentPath]?.visible === false) {
      return true
    }
  }

  return false
}

// 内层组件：实际的表单逻辑
// ✅ 使用 React.memo 优化，避免不必要的重渲染
const DynamicFormInner = React.memo(
  forwardRef<DynamicFormRef, DynamicFormProps>(
    (
      {
        schema,
        defaultValues = {},
        onSubmit,
        onChange,
        onTextFieldFocus,
        widgets,
        linkageFunctions,
        linkageContext,
        callbacks,
        customFormats,
        helpers,
        layout = 'vertical',
        labelWidth,
        columnsCount = 1,
        showErrorList = false,
        showSubmitButton = true,
        renderAsForm = true,
        validateMode = 'onSubmit',
        reValidateMode = 'onChange',
        loading = false,
        disabled = false,
        readonly = false,
        className,
        style,
        fieldsWrapperStyle,
        fieldRowStyle,
        fieldLabelStyle,
        fieldControlStyle,
        pathPrefix = '',
        asNestedForm = false,
        enableVirtualScroll = false,
        virtualScrollHeight = 600,
      },
      ref,
    ) => {
      // ========== Context 获取（集中管理） ==========
      const parentFormContext = useFormContext()
      const linkageStateContext = useLinkageStateContext()
      const inheritedTextFieldFocus = useTextFieldFocus()
      const effectiveTextFieldFocus =
        onTextFieldFocus ?? inheritedTextFieldFocus

      // 只有显式声明 asNestedForm 的 DynamicForm 才能继承父级联动上下文。
      //
      // 背景：
      // DynamicForm 既支持 NestedFormWidget 这类“真正的嵌套表单”，也支持业务 widget 内部
      // 再渲染一个“独立 DynamicForm”。后者虽然在 React 树上位于父级 LinkageStateProvider
      // 之下，但业务语义上应该拥有自己的 useForm 和联动状态。
      //
      // 如果这里无条件使用 linkageStateContext，独立内层表单的 useLinkageManager 会监听父级
      // form：内层字段变更不会触发自己的联动，父级同名字段反而可能误触发内层联动。
      // 因此使用 inheritedLinkageStateContext 明确继承边界：asNestedForm=true 表示复用父级
      // form/linkage state/operationController；默认 DynamicForm 则完全按独立表单处理。
      const inheritedLinkageStateContext = asNestedForm
        ? linkageStateContext
        : null
      const nestedSchemaRegistry = useNestedSchemaRegistryOptional()

      // ========== 空对象常量处理（统一管理） ==========
      const stableLinkageFunctions = linkageFunctions || EMPTY_LINKAGE_FUNCTIONS
      const stableLinkageContext = linkageContext || {}
      const stableWidgets = widgets || EMPTY_WIDGETS
      const stableCustomFormats = customFormats || EMPTY_CUSTOM_FORMATS
      const stableCallbacks = callbacks || EMPTY_CALLBACKS
      const stableHelpers = helpers || EMPTY_HELPERS

      // 合并内置和用户提供的 helpers
      // 用户提供的 helpers 优先级更高，可以覆盖内置 helpers
      const mergedHelpers = useMemo(
        () => ({
          ...builtInHelpers,
          ...stableHelpers,
        }),
        [stableHelpers],
      )
      const parentVariantStore = useFieldVariantStoreOptional()
      const ownVariantStore = useMemo(() => createFieldVariantStore(), [])
      const variantStore = parentVariantStore || ownVariantStore

      // 设置自定义格式验证器并解析字段
      // 当 asNestedForm 为 true 时，需要为字段名添加 pathPrefix 前缀
      const fields = useMemo(() => {
        if (
          stableCustomFormats &&
          Object.keys(stableCustomFormats).length > 0
        ) {
          SchemaParser.setCustomFormats(stableCustomFormats)
        }

        // 从 schema.ui 中读取 prefixLabel（用于 flattenPrefix 场景）
        const prefixLabel = schema.ui?.prefixLabel || ''

        const parsedFields = SchemaParser.parse(schema, {
          prefixLabel,
        })

        // 如果是嵌套表单模式且有路径前缀，为字段名添加前缀
        if (asNestedForm && pathPrefix) {
          return parsedFields.map((field) => ({
            ...field,
            name: `${pathPrefix}.${field.name}`,
          }))
        }
        return parsedFields
      }, [schema, stableCustomFormats, asNestedForm, pathPrefix])

      // 处理 defaultValues：提取 schema 中的 default 值并与用户提供的 defaultValues 合并
      // 优先级：用户提供的 defaultValues > schema 中的 default 值
      // 新方案（v3.0）：数据保持标准嵌套格式，无需路径转换
      const processedDefaultValues = useMemo(() => {
        // 步骤1：从 schema 中提取所有 default 值
        const schemaDefaults = extractSchemaDefaults(schema)

        // 步骤2：合并 schema 默认值和用户提供的默认值
        const merged = defaultValues
          ? mergeDefaults(schemaDefaults, defaultValues)
          : schemaDefaults

        // 步骤3：如果没有任何默认值，返回 undefined
        if (Object.keys(merged).length === 0) {
          return undefined
        }

        // 步骤4：包装基本类型数组（schema default 本身是展示域，无需反转）
        return wrapPrimitiveArrays(merged, schema)
      }, [defaultValues, schema])

      // 用于向 resolver 传递最新联动状态（ref 避免重新创建 resolver）
      // resolver 需要读取最新的联动状态（用于跳过隐藏字段的校验），但不能将 linkageStates 作为
      // useForm 的依赖：每次联动状态变化都重新创建 resolver 会导致表单重新初始化、清空用户输入。
      // 用 ref 保存最新状态，resolver 通过 ref 读取而不触发 useForm 重建。
      const linkageStatesRef = useRef<
        Record<string, { visible?: boolean; disabled?: boolean }>
      >({})

      // 用于向 resolver 传递最新 helpers
      const helpersRef = useRef<Record<string, any>>(mergedHelpers)
      helpersRef.current = mergedHelpers

      // 只有非嵌套表单模式才创建新的 useForm 实例
      const ownMethods = useForm({
        defaultValues: processedDefaultValues,
        mode: validateMode,
        reValidateMode: reValidateMode,
        resolver: createSchemaResolver(
          schema,
          stableCallbacks,
          linkageStatesRef,
          helpersRef,
          stableCustomFormats,
          variantStore,
        ),
      })

      // 根据模式选择使用哪个 form methods
      // 嵌套表单模式下复用父表单的 FormContext，否则使用自己的
      const methods =
        asNestedForm && parentFormContext ? parentFormContext : ownMethods

      const ownOperationControllerRef = useRef(new LinkageOperationController())
      // 根表单创建控制器，嵌套表单复用 Context 中的控制器。
      // 这样外部 ref.setValues/reset、父级数组联动和子级 DynamicForm 的异步联动
      // 都使用同一套表单版本号；否则不同层级各自判断“最新”，旧结果仍可能跨层覆盖新值。
      const operationController =
        inheritedLinkageStateContext?.operationController ??
        ownOperationControllerRef.current

      // ✅ 使用 useRef 保持 methods 引用稳定，避免触发不必要的重新计算
      const methodsRef = React.useRef(methods)
      React.useEffect(() => {
        methodsRef.current = methods
      }, [methods])

      const callbacksRef =
        useRef<{ [key in string]: (...args: any) => any }>(stableCallbacks)
      callbacksRef.current = stableCallbacks

      // 当前写入来源；用户输入为默认值，ref API 操作期间临时切换来源。
      const changeSourceRef = useRef<FieldChangeSource>('user')
      // 保存上一次对外快照，用于计算字段 previousValue。
      const previousChangeDataRef = useRef<Record<string, any> | null>(null)
      // RHF 未提供路径时，保存 setValue 指定的路径作为兜底。
      const pendingChangePathRef = useRef<string | null>(null)
      // 保存兜底路径对应的来源，避免异步 watch 丢失操作语义。
      const pendingChangeSourceRef = useRef<FieldChangeSource | null>(null)
      // 保存 setValue 调用前的原值，供 watch 计算差异。
      const pendingPreviousValueRef = useRef<unknown>(undefined)
      // 聚合同一事件循环内的多个字段变化，最终一次性 flush。
      const pendingChangesRef = useRef<FormChangeMeta['changes']>([])
      // 保存当前待 flush 的完整表单快照。
      const pendingDataRef = useRef<Record<string, any> | null>(null)
      // 延迟 flush 的定时器句柄，用于合并连续同步写入。
      const changeFlushTimerRef = useRef<number | null>(null)
      const arrayActionStore = useRef<
        Array<{ path: string; action: ArrayAction }>
      >([])
      registerArrayActionStore(methods.control, arrayActionStore)
      const latestOnChangeRef = useRef(onChange)
      latestOnChangeRef.current = onChange

      // ✅ 使用 useRef 保持 refreshLinkage 引用，避免循环依赖
      // const refreshLinkageRef = React.useRef<() => void>(() => {});

      // 解析 schema 中的联动配置
      // 分层计算策略：遇到数组字段时停止递归，数组元素内部由 NestedFormWidget 独立处理
      const { linkages: rawLinkages } = useMemo(() => {
        const parsed = parseSchemaLinkages(schema)
        // if (process.env.NODE_ENV !== 'production') {
        //   console.log(
        //     '[DynamicForm] 解析 schema 联动配置:',
        //     JSON.stringify({
        //       schema: schema.title || 'root',
        //       pathPrefix,
        //       asNestedForm,
        //       linkagesCount: Object.keys(parsed.linkages).length,
        //     })
        //   );
        // }
        return parsed
      }, [schema])

      // 统一处理联动配置：路径转换 -> 过滤父级联动
      const { processedLinkages, formToUse, effectiveLinkageFunctions } =
        useMemo(() => {
          // 步骤1: 路径转换和过滤
          let linkages = rawLinkages
          if (asNestedForm && pathPrefix) {
            const transformed = transformToAbsolutePaths(
              rawLinkages,
              pathPrefix,
            )

            // 过滤掉已经由外层 DynamicForm 负责的联动配置。
            // 联动以数组字段为边界分层计算，每层只负责本层数组边界以内、下一层数组边界以外的联动。
            // 若内层重复计算外层已处理的联动，会导致同一字段被两个 useLinkageManager 实例同时管理，
            // 引发竞态条件和状态不一致。
            //
            // 使用外层的静态配置（parentLinkages）而不是运行时状态（parentLinkageStates）进行过滤：
            // parentLinkageStates 在外层 refreshLinkage 执行前为空，内层初始化时若依赖它做过滤，
            // 会因时序问题导致过滤失败，内层错误接管外层的联动，产生空对象覆盖有效状态的问题。
            // parentLinkages 是静态配置，在外层 useMemo 时即可确定，内层初始化时立即可读。
            if (inheritedLinkageStateContext?.parentLinkages) {
              const filtered: Record<string, LinkageConfig[]> = {}
              Object.entries(transformed).forEach(([key, value]) => {
                if (!(key in inheritedLinkageStateContext.parentLinkages)) {
                  filtered[key] = value
                }
              })
              linkages = filtered
            } else {
              // if (process.env.NODE_ENV !== 'production') {
              //   console.log('[DynamicForm] 嵌套表单路径转换:', {
              //     pathPrefix,
              //     rawLinkages,
              //     transformed,
              //   });
              // }
              linkages = transformed
            }
          }

          // 步骤2: 确定使用的表单实例和联动函数
          // 优先使用自己的 linkageFunctions（如果有内容），否则使用 Context 中的
          const hasOwnFunctions = Object.keys(stableLinkageFunctions).length > 0
          const finalLinkageFunctions = hasOwnFunctions
            ? stableLinkageFunctions
            : inheritedLinkageStateContext?.linkageFunctions ||
              EMPTY_LINKAGE_FUNCTIONS

          // if (process.env.NODE_ENV !== 'production') {
          //   console.log(
          //     '[DynamicForm] 联动函数解析:',
          //     JSON.stringify({
          //       pathPrefix,
          //       asNestedForm,
          //       hasOwnFunctions,
          //       stableLinkageFunctions: Object.keys(stableLinkageFunctions),
          //       contextLinkageFunctions: linkageStateContext?.linkageFunctions
          //         ? Object.keys(linkageStateContext.linkageFunctions)
          //         : null,
          //       finalLinkageFunctions: Object.keys(finalLinkageFunctions),
          //     })
          //   );
          // }

          return {
            processedLinkages: linkages,

            // 联动计算必须使用与当前表单语义一致的 form 实例：
            // - asNestedForm=true 时，字段注册在父级数据树下，需要读取父级 form；
            // - 默认独立 DynamicForm 时，即使外层存在 LinkageStateProvider，也必须读取自己的 form。
            // 这里统一通过 inheritedLinkageStateContext 做分流，避免独立内层表单误继承父级 form。
            formToUse: inheritedLinkageStateContext?.form || methodsRef.current,
            effectiveLinkageFunctions: finalLinkageFunctions,
          }
        }, [
          rawLinkages,
          asNestedForm,
          pathPrefix,
          inheritedLinkageStateContext?.parentLinkages,
          inheritedLinkageStateContext?.form,
          inheritedLinkageStateContext?.linkageFunctions,
          stableLinkageFunctions,
          // 移除 methods 依赖，因为它会在每次表单状态变化时触发重新计算
          // methods 只是用来获取表单实例，不应该触发联动配置的重新计算
        ])

      // 步骤3: 计算自己的联动状态
      const {
        linkageStates: ownLinkageStates,
        refresh: refreshLinkage,
        setValueWithoutLinkage,
        activeLinkages,
      } = useArrayLinkageManager({
        form: formToUse,
        baseLinkages: processedLinkages,
        linkageFunctions: effectiveLinkageFunctions,
        linkageContext: stableLinkageContext,
        schema,
        operationController,
      })

      // // 更新 refreshLinkageRef
      // React.useEffect(() => {
      //   refreshLinkageRef.current = refreshLinkage;
      // }, [refreshLinkage]);

      // 步骤4: 合并父级和自己的联动状态
      const linkageStates = useMemo(() => {
        if (inheritedLinkageStateContext?.parentLinkageStates) {
          // 父级状态后合并，确保同一个字段被父级动态数组联动管理时，父级结果是权威值。
          // 原因：数组元素内层 DynamicForm 可能在动态 linkages 更新前短暂生成过自己的状态；
          // 如果让这些旧 ownLinkageStates 覆盖父级状态，会出现 workInfo 等字段明明已由父级算出隐藏，
          // 但渲染仍使用子级旧状态而显示的竞态。
          const merged = {
            ...ownLinkageStates,
            ...inheritedLinkageStateContext.parentLinkageStates,
          }
          return merged
        }
        return { ...ownLinkageStates }
      }, [inheritedLinkageStateContext?.parentLinkageStates, ownLinkageStates])

      // 同步更新 ref，确保 resolver 始终使用最新联动状态
      linkageStatesRef.current = linkageStates

      const {
        handleSubmit,
        watch,
        formState: { errors },
      } = methods

      // ========== 暴露外部可访问的 API ==========
      useImperativeHandle(
        ref,
        () => ({
          setValue: (name, value, options) => {
            operationController.markFormMutation()
            const fieldSchema = getSchemaAtPath(schema, name)
            const effectiveSchema = fieldSchema
              ? getEffectiveVariantSchema(
                  fieldSchema,
                  value,
                  callbacksRef.current,
                  mergedHelpers,
                  name,
                  variantStore,
                )
              : undefined
            const reverseFn = resolveTransformFn(
              effectiveSchema?.ui?.transform?.reverseCallback,
              callbacksRef.current,
            )
            const previousSource = changeSourceRef.current
            changeSourceRef.current = 'setValue'
            pendingChangePathRef.current = name
            pendingChangeSourceRef.current = 'setValue'
            pendingPreviousValueRef.current = methods.getValues(name as any)
            try {
              methods.setValue(
                name,
                reverseFn
                  ? reverseFn({ value, helpers: mergedHelpers })
                  : value,
                options,
              )
            } finally {
              changeSourceRef.current = previousSource
            }
          },
          getValue: (name: string) => {
            const displayValue = methods.getValues(name as any)
            const fieldSchema = getSchemaAtPath(schema, name)
            const effectiveSchema = fieldSchema
              ? getEffectiveVariantSchema(
                  fieldSchema,
                  displayValue,
                  callbacksRef.current,
                  mergedHelpers,
                  name,
                  variantStore,
                )
              : undefined
            const fn = resolveTransformFn(
              effectiveSchema?.ui?.transform?.callback,
              callbacksRef.current,
            )
            return fn
              ? fn({ value: displayValue, helpers: mergedHelpers })
              : displayValue
          },
          getValues: () => {
            const displayValues = methods.getValues()
            const effectiveSchema = buildEffectiveSchemaTree({
              schema,
              value: displayValues,
              callbacks: callbacksRef.current,
              helpers: mergedHelpers,
              variantStore,
            })
            return applyFieldTransforms(
              transformFormData(displayValues, effectiveSchema),
              effectiveSchema,
              callbacksRef.current,
              mergedHelpers,
              variantStore,
            )
          },
          setValues: (values, options) => {
            // 外部批量写入代表表单快照整体变化，必须先递增版本，让所有旧异步联动失效。
            // 之后再进入 batch，把递归 setValue 触发的多次 watch 合并为一次最终快照刷新。
            operationController.markFormMutation()
            const previousSource = changeSourceRef.current
            changeSourceRef.current = 'setValues'
            const displayValues = reverseFieldTransforms(
              values,
              buildEffectiveSchemaTree({
                schema,
                value: values,
                callbacks: callbacksRef.current,
                helpers: mergedHelpers,
                variantStore,
              }),
              callbacksRef.current,
              mergedHelpers,
              variantStore,
            )
            operationController.beginBatch()
            try {
              if (options?.silence) {
                // silence 语义是”不触发新联动”，不是”允许旧联动继续提交”。
                // 因此前面的 markFormMutation 仍然保留，用来阻止旧 run 覆盖本次静默写入的新值。
                setValueWithoutLinkage(() => {
                  setFormValues({
                    methods,
                    values: displayValues,
                    schema,
                    options,
                  })
                })
              } else {
                setFormValues({
                  methods,
                  values: displayValues,
                  schema,
                  options,
                })
              }
            } finally {
              const shouldRefresh = operationController.endBatch()
              if (shouldRefresh && !options?.silence) {
                // 批量写入结束后只刷新一次，且刷新读取的是最终表单快照。
                // 不 await 是为了保持 setValues 现有 void API；refreshLinkage 内部仍有 token 保护。
                void refreshLinkage()
              }
              changeSourceRef.current = previousSource
            }
          },
          reset: (values) => {
            operationController.markFormMutation()
            const previousSource = changeSourceRef.current
            const previousMutationSource =
              operationController.setMutationSource('reset')
            changeSourceRef.current = 'reset'
            try {
              if (values && Object.keys(values).length > 0) {
                const reversed = reverseFieldTransforms(
                  values,
                  buildEffectiveSchemaTree({
                    schema,
                    value: values,
                    callbacks: callbacksRef.current,
                    helpers: mergedHelpers,
                    variantStore,
                  }),
                  callbacksRef.current,
                  mergedHelpers,
                  variantStore,
                )
                const processed = wrapPrimitiveArrays(reversed, schema)
                methods.reset(processed)
                setValuesRecursive(methods, processed)
              } else {
                // 清空：构建类型恰当的空值，确保受控组件正确清除
                const emptyValues = buildEmptyValues(schema)
                methods.reset(emptyValues)
                setValuesRecursive(methods, emptyValues)
              }
            } finally {
              changeSourceRef.current = previousSource
              // RHF 的 reset/setValue 通知可能在当前调用栈结束后才派发，保持来源到下一轮事件循环。
              window.setTimeout(
                () =>
                  operationController.setMutationSource(previousMutationSource),
                0,
              )
            }
          },
          validate: async (name) => {
            methods.clearErrors(name)
            return methods.trigger(name)
          },
          getErrors: () => {
            return methods.formState.errors
          },
          clearErrors: (name) => {
            methods.clearErrors(name)
          },
          setError: (name, error) => {
            methods.setError(name, error)
          },
          getFormState: () => {
            const { isDirty, isValid, isSubmitting, isSubmitted, submitCount } =
              methods.formState
            return { isDirty, isValid, isSubmitting, isSubmitted, submitCount }
          },
          refreshLinkage: async () => {
            await refreshLinkage()
          },
        }),
        [
          methods,
          schema,
          refreshLinkage,
          operationController,
          mergedHelpers,
          setValueWithoutLinkage,
          variantStore,
        ],
      )

      React.useEffect(() => {
        if (onChange) {
          if (previousChangeDataRef.current === null) {
            const initialData = methods.getValues()
            const initialSchema = buildEffectiveSchemaTree({
              schema,
              value: initialData,
              callbacks: callbacksRef.current,
              helpers: mergedHelpers,
              variantStore,
            })
            previousChangeDataRef.current = applyFieldTransforms(
              transformFormData(initialData, initialSchema),
              initialSchema,
              callbacksRef.current,
              mergedHelpers,
              variantStore,
            )
          }
          const subscription = watch((data, { name }) => {
            const effectiveSchema = buildEffectiveSchemaTree({
              schema,
              value: data,
              callbacks: callbacksRef.current,
              helpers: mergedHelpers,
              variantStore,
            })
            const processedData = transformFormData(data, effectiveSchema)
            const externalData = applyFieldTransforms(
              processedData,
              effectiveSchema,
              callbacksRef.current,
              mergedHelpers,
              variantStore,
            )
            // 以上一次对外快照为基线；首次通知没有旧快照时使用空对象。
            const previousData = previousChangeDataRef.current ?? {}
            // 当前 watch 通知检测出的变化，稍后会合并到批次缓存。
            const changes: FormChangeMeta['changes'] = []
            // RHF 路径优先；缺失时使用 setValue 保存的兜底路径。
            let changePath = name ?? pendingChangePathRef.current
            let explicitArrayAction: ArrayAction | undefined
            if (changePath) {
              explicitArrayAction = consumeArrayActionForSnapshot(
                methods.control,
                changePath,
                PathResolver.getNestedValue(previousData, changePath),
                PathResolver.getNestedValue(externalData, changePath),
              )
              if (!explicitArrayAction) {
                const parts = changePath.split('.')
                for (let i = parts.length - 1; i > 0; i -= 1) {
                  const candidate = parts.slice(0, i).join('.')
                  const previousArray = PathResolver.getNestedValue(
                    previousData,
                    candidate,
                  )
                  const nextArray = PathResolver.getNestedValue(
                    externalData,
                    candidate,
                  )
                  if (
                    Array.isArray(previousArray) &&
                    Array.isArray(nextArray)
                  ) {
                    explicitArrayAction = consumeArrayActionForSnapshot(
                      methods.control,
                      candidate,
                      previousArray,
                      nextArray,
                    )
                    if (explicitArrayAction) {
                      changePath = candidate
                      break
                    }
                  }
                }
              }
            }
            if (changePath && name && changePath.match(/\.\d+\.value$/)) {
              // 基本类型数组内部使用 path.value 包装，外部数据则使用数组元素路径。
              const primitiveArrayPath = changePath.replace(/\.value$/, '')
              // 删除元素后内部路径可能消失，因此额外提取数组根路径。
              const match = changePath.match(/^(.*)\.\d+\.value$/)
              const arrayPath = match?.[1]
              // 解包后的数组元素值，用于判断普通编辑还是结构删除。
              const externalValue = PathResolver.getNestedValue(
                externalData,
                primitiveArrayPath,
              )
              // RHF 内部包装值；删除后通常为 undefined。
              const rawValue = PathResolver.getNestedValue(data, changePath)
              if (
                rawValue === undefined &&
                arrayPath &&
                Array.isArray(
                  PathResolver.getNestedValue(externalData, arrayPath),
                )
              ) {
                changePath = arrayPath
              } else if (
                externalValue !== undefined &&
                rawValue !== undefined
              ) {
                changePath = primitiveArrayPath
              }
            }
            if (changePath) {
              // 读取外部值域的旧值；setValue 无路径通知时使用调用前保存的原值。
              const previousValue =
                !name && pendingChangePathRef.current === changePath
                  ? pendingPreviousValueRef.current
                  : PathResolver.getNestedValue(previousData, changePath)
              // 读取转换后的外部新值，确保与 onChange 第一参数保持同一数据契约。
              const value = PathResolver.getNestedValue(
                externalData,
                changePath,
              )
              if (!isDeepEqual(previousValue, value)) {
                const arrayAction =
                  (explicitArrayAction &&
                  ((explicitArrayAction.action === 'insert' &&
                    Array.isArray(previousValue) &&
                    Array.isArray(value) &&
                    value.length === previousValue.length + 1) ||
                    (explicitArrayAction.action === 'remove' &&
                      Array.isArray(previousValue) &&
                      Array.isArray(value) &&
                      value.length === previousValue.length - 1) ||
                    explicitArrayAction.action === 'move')
                    ? explicitArrayAction
                    : undefined) ??
                  inferArrayAction(schema, changePath, previousValue, value)
                changes.push({
                  path: changePath,
                  previousValue,
                  value,
                  source: name
                    ? operationController.getMutationSource() === 'linkage'
                      ? 'linkage'
                      : changeSourceRef.current
                    : (pendingChangeSourceRef.current ??
                      changeSourceRef.current),
                  ...(arrayAction ? { arrayAction } : {}),
                })
              }
              pendingChangePathRef.current = null
              pendingChangeSourceRef.current = null
            } else if (previousChangeDataRef.current) {
              Object.keys(externalData).forEach((path) => {
                // 无具体 name 时按顶层路径比较快照，用于数组结构等整节点变化。
                const previousValue = PathResolver.getNestedValue(
                  previousData,
                  path,
                )
                const value = PathResolver.getNestedValue(externalData, path)
                if (!isDeepEqual(previousValue, value)) {
                  // 推断数组长度变化或相邻元素交换，供业务区分结构操作。
                  let arrayAction: ArrayAction | undefined
                  // 当前路径对应的 schema，用于排除 Select 多选数组。
                  const fieldSchema = getSchemaAtPath(schema, path)
                  if (
                    fieldSchema?.type === 'array' &&
                    fieldSchema.ui?.widget !== 'select' &&
                    Array.isArray(previousValue) &&
                    Array.isArray(value)
                  ) {
                    if (value.length > previousValue.length) {
                      const index = previousValue.findIndex(
                        (item, i) => !isDeepEqual(item, value[i]),
                      )
                      const insertIndex = index < 0 ? value.length - 1 : index
                      arrayAction = {
                        action: 'insert',
                        index: insertIndex,
                        value: value[insertIndex],
                      }
                    } else if (value.length < previousValue.length) {
                      const index = value.findIndex(
                        (item, i) => !isDeepEqual(item, previousValue[i]),
                      )
                      const removeIndex = index < 0 ? value.length : index
                      arrayAction = {
                        action: 'remove',
                        index: removeIndex,
                        value: previousValue[removeIndex],
                      }
                    } else {
                      // 计算数组首个差异索引，识别相邻元素移动方向。
                      const changedIndex = value.findIndex(
                        (item, index) => !Object.is(item, previousValue[index]),
                      )
                      if (
                        changedIndex >= 0 &&
                        changedIndex < value.length - 1 &&
                        isDeepEqual(
                          value[changedIndex],
                          previousValue[changedIndex + 1],
                        ) &&
                        isDeepEqual(
                          value[changedIndex + 1],
                          previousValue[changedIndex],
                        )
                      ) {
                        arrayAction = {
                          action: 'move',
                          fromIndex: changedIndex + 1,
                          toIndex: changedIndex,
                          value: value[changedIndex],
                        }
                      } else if (
                        changedIndex > 0 &&
                        isDeepEqual(
                          value[changedIndex],
                          previousValue[changedIndex - 1],
                        ) &&
                        isDeepEqual(
                          value[changedIndex - 1],
                          previousValue[changedIndex],
                        )
                      ) {
                        arrayAction = {
                          action: 'move',
                          fromIndex: changedIndex - 1,
                          toIndex: changedIndex,
                          value: value[changedIndex],
                        }
                      }
                    }
                  }
                  changes.push({
                    path,
                    previousValue,
                    value,
                    source: operationController.getMutationSource(),
                    ...(arrayAction ? { arrayAction } : {}),
                  })
                }
              })
            }
            previousChangeDataRef.current = externalData
            pendingDataRef.current = externalData
            changes.forEach((change) => {
              const existing = pendingChangesRef.current.find(
                (item) => item.path === change.path,
              )
              if (existing) {
                existing.value = change.value
                existing.source = change.source
                existing.arrayAction = change.arrayAction
              } else {
                pendingChangesRef.current.push(change)
              }
            })
            if (
              pendingChangesRef.current.length > 0 &&
              changeFlushTimerRef.current === null
            ) {
              changeFlushTimerRef.current = window.setTimeout(() => {
                changeFlushTimerRef.current = null
                const nextData = pendingDataRef.current
                if (nextData) {
                  const changesSnapshot = pendingChangesRef.current
                  pendingChangesRef.current = []
                  pendingDataRef.current = null
                  clearArrayAction(methods.control)
                  latestOnChangeRef.current?.(nextData, {
                    changes: changesSnapshot,
                  })
                }
              }, 0)
            }
          })
          return () => {
            subscription.unsubscribe()
            if (changeFlushTimerRef.current !== null) {
              clearTimeout(changeFlushTimerRef.current)
              changeFlushTimerRef.current = null
            }
            pendingChangesRef.current = []
            pendingDataRef.current = null
            clearArrayAction(methods.control)
          }
        }
      }, [
        mergedHelpers,
        methods,
        onChange,
        operationController,
        schema,
        variantStore,
        watch,
      ])

      // ✅ 使用 useCallback 缓存 onSubmitHandler，避免每次渲染创建新函
      const onSubmitHandler = useCallback(
        async (data: Record<string, any>) => {
          if (onSubmit) {
            // 使用公共函数进行数据转换，包含过滤步骤
            const effectiveSchema = buildEffectiveSchemaTree({
              schema,
              value: data,
              callbacks: stableCallbacks,
              helpers: mergedHelpers,
              variantStore,
            })
            const filteredData = transformFormData(
              data,
              effectiveSchema,
              nestedSchemaRegistry || undefined,
              true, // 需要过滤数据
            )

            await onSubmit(
              applyFieldTransforms(
                filteredData,
                effectiveSchema,
                stableCallbacks,
                mergedHelpers,
                variantStore,
              ),
            )
          }
        },
        [
          onSubmit,
          schema,
          nestedSchemaRegistry,
          stableCallbacks,
          mergedHelpers,
          variantStore,
        ],
      )

      // 使用 useMemo 缓存 LinkageStateContext 的 value 对象
      // 避免每次 linkageStates 变化时都创建新对象，导致所有消费该 Context 的组件重新渲染
      const linkageContextValue = useMemo(
        () => ({
          parentLinkageStates: linkageStates,
          parentLinkages: activeLinkages, // 传递实际配置，用于子级过滤动态数组联动
          form: methodsRef.current, // ✅ 使用 ref 避免 methods 变化触发重新计算
          rootSchema: schema,
          pathPrefix: pathPrefix,
          linkageFunctions: effectiveLinkageFunctions,
          operationController,
        }),
        [
          linkageStates,
          activeLinkages,
          schema,
          pathPrefix,
          effectiveLinkageFunctions,
          operationController,
        ], // ✅ 移除 methods 依赖
      )

      // 使用 useMemo 缓存字段内容，避免每次渲染都创建新的 children
      const fieldsContent = useMemo(
        () => (
          <div
            className="dynamic-form__fields"
            style={{
              ...fieldsWrapperStyle,
              ...(columnsCount > 1
                ? {
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columnsCount}, 1fr)`,
                    gap: '0 16px',
                  }
                : undefined),
            }}
          >
            {fields.map((field) => {
              const currentValue = field.name
                .split('.')
                .reduce(
                  (current: any, key) => current?.[key],
                  methods.getValues(),
                )
              const variant =
                field.schema?.ui?.widget === 'variant'
                  ? null
                  : resolveVariantForValue(
                      field.schema || {},
                      currentValue,
                      callbacksRef.current,
                      mergedHelpers,
                    )
              if (variant) {
                const variantSchema = buildVariantSchema(
                  field.schema || {},
                  variant,
                )
                field = {
                  ...field,
                  type: variant.type,
                  widget: variant.widget || field.widget,
                  schema: variantSchema,
                }
              }
              const linkageState = linkageStates[field.name]

              // 如果联动状态指定不可见，则不渲染该字段
              if (isFieldHiddenByLinkage(field.name, linkageStates)) {
                return null
              }

              // 如果存在 schema 联动，合并到字段 schema
              let effectiveField = field
              if (linkageState?.schema) {
                const mergedSchema = mergeSchemaWithLinkage(
                  field.schema || { type: 'object', properties: {} },
                  linkageState.schema,
                )
                effectiveField = {
                  ...field,
                  schema: mergedSchema,
                  // 重新提取 UI 属性到 field 对象，确保 UI 联动生效
                  placeholder:
                    mergedSchema.ui?.placeholder ?? field.placeholder,
                  description: mergedSchema.ui?.help ?? field.description,
                  widget: mergedSchema.ui?.widget ?? field.widget,
                  disabled: mergedSchema.ui?.disabled ?? field.disabled,
                  readonly: mergedSchema.ui?.readonly ?? field.readonly,
                  hidden: mergedSchema.ui?.hidden ?? field.hidden,
                  // 统一在此处应用 options 联动
                  options: linkageState?.options ?? field.options,
                }
              } else if (linkageState?.options) {
                // 只有 options 联动时，也需要更新 field
                effectiveField = {
                  ...field,
                  options: linkageState.options,
                }
              }

              return (
                <FormField
                  key={field.name}
                  field={effectiveField}
                  disabled={
                    disabled ||
                    field.disabled ||
                    loading ||
                    linkageState?.disabled
                  }
                  readonly={
                    readonly || field.readonly || linkageState?.readonly
                  }
                  linkageState={linkageState}
                  layout={layout}
                  labelWidth={labelWidth}
                  fieldRowStyle={fieldRowStyle}
                  fieldLabelStyle={fieldLabelStyle}
                  fieldControlStyle={fieldControlStyle}
                  enableVirtualScroll={enableVirtualScroll}
                  virtualScrollHeight={virtualScrollHeight}
                  columnsCount={columnsCount}
                  onTextFieldFocus={effectiveTextFieldFocus}
                />
              )
            })}
          </div>
        ),
        [
          disabled,
          enableVirtualScroll,
          fields,
          fieldControlStyle,
          fieldLabelStyle,
          fieldRowStyle,
          linkageStates,
          labelWidth,
          layout,
          loading,
          readonly,
          virtualScrollHeight,
          fieldsWrapperStyle,
          columnsCount,
          effectiveTextFieldFocus,
          mergedHelpers,
          methods,
        ],
      )

      // 使用 useMemo 缓存带 Provider 的字段内容
      const renderedFields = useMemo(() => {
        // 如果不是嵌套表单，提供 LinkageStateContext
        if (!asNestedForm) {
          return (
            <LinkageStateProvider value={linkageContextValue}>
              {fieldsContent}
            </LinkageStateProvider>
          )
        }
        return fieldsContent
      }, [asNestedForm, linkageContextValue, fieldsContent])

      // 使用 useMemo 缓存提交按钮
      const submitButton = useMemo(() => {
        if (!showSubmitButton) {
          return null
        }

        return (
          <div className="dynamic-form__actions" style={{ marginTop: '20px' }}>
            <Button
              type="submit"
              intent="primary"
              loading={loading}
              disabled={loading || disabled}
            >
              {loading ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        )
      }, [showSubmitButton, loading, disabled])

      const formClassName = `dynamic-form dynamic-form--${layout} ${className || ''}`

      // 使用 useMemo 缓存表单内容，避免每次渲染都创建新的 children
      const formContent = useMemo(() => {
        const content = (
          <PathPrefixProvider prefix={asNestedForm ? '' : pathPrefix}>
            {renderAsForm ? (
              <form
                onSubmit={handleSubmit(onSubmitHandler)}
                className={formClassName}
                style={style}
              >
                {showErrorList && Object.keys(errors).length > 0 && (
                  <ErrorList errors={errors} />
                )}
                {renderedFields}
                {submitButton}
              </form>
            ) : (
              <div className={formClassName} style={style}>
                {showErrorList && Object.keys(errors).length > 0 && (
                  <ErrorList errors={errors} />
                )}
                {renderedFields}
                {submitButton}
              </div>
            )}
          </PathPrefixProvider>
        )

        // 只在顶层（非嵌套表单）创建 WidgetsProvider
        if (asNestedForm) {
          return content
        }

        return (
          <FieldVariantProvider store={variantStore}>
            <TextFieldFocusProvider onTextFieldFocus={effectiveTextFieldFocus}>
              <HelpersProvider helpers={mergedHelpers}>
                <CallbacksProvider callbacks={stableCallbacks}>
                  <WidgetsProvider widgets={stableWidgets}>
                    {content}
                  </WidgetsProvider>
                </CallbacksProvider>
              </HelpersProvider>
            </TextFieldFocusProvider>
          </FieldVariantProvider>
        )
      }, [
        asNestedForm,
        pathPrefix,
        renderAsForm,
        handleSubmit,
        onSubmitHandler,
        formClassName,
        style,
        showErrorList,
        errors,
        renderedFields,
        submitButton,
        stableWidgets,
        stableCallbacks,
        effectiveTextFieldFocus,
        mergedHelpers,
        variantStore,
      ])

      // 嵌套表单模式下不需要再包裹 FormProvider，因为已经复用了父表单的 context
      if (asNestedForm && parentFormContext) {
        return formContent
      }

      // 非嵌套表单模式，需要提供 FormProvider
      return <FormProvider {...methods}>{formContent}</FormProvider>
    },
  ),
)

// 外层组件：提供 NestedSchemaProvider
export const DynamicForm = forwardRef<DynamicFormRef, DynamicFormProps>(
  (props, ref) => {
    // 如果已经在 NestedSchemaProvider 内部（嵌套表单场景），直接渲染内层组件
    const existingRegistry = useNestedSchemaRegistryOptional()

    if (existingRegistry) {
      return <DynamicFormInner {...props} ref={ref} />
    }

    // 否则提供新的 NestedSchemaProvider（顶层表单场景）
    return (
      <NestedSchemaProvider>
        <DynamicFormInner {...props} ref={ref} />
      </NestedSchemaProvider>
    )
  },
)
