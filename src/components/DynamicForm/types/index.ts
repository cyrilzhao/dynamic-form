import type { FocusEvent } from 'react'
import type { FieldErrors } from 'react-hook-form'
import type { ExtendedJSONSchema, FieldOption } from './schema'
import type { LinkageFunction } from './linkage'

/**
 * Widget 回调函数类型 - 用于 ui.callbackProps
 * Widget 决定传递哪些参数，统一包装为 args 数组
 */
export type WidgetCallback = (params: {
  args: any[]
  helpers: Record<string, any>
}) => any

/**
 * Transform 回调函数类型 - 用于 ui.transform.callback 和 ui.transform.reverseCallback
 * 将值在展示域和存储域之间转换
 */
export type TransformCallback = (params: {
  value: any
  helpers: Record<string, any>
}) => any

/**
 * Validator 回调函数类型 - 用于 ui.validators
 * 返回 null 表示验证通过，返回字符串表示错误信息
 */
export type ValidatorCallback = (params: {
  value: any
  formValues: Record<string, any>
  helpers: Record<string, any>
}) => string | null | Promise<string | null>

/**
 * Callback 函数联合类型
 * 所有 callback 都使用对象解构参数形式，并自动注入 helpers
 */
export type CallbackFunction =
  | WidgetCallback
  | TransformCallback
  | ValidatorCallback

/**
 * 文本字段获得焦点时通知页面层的数据。
 * 页面可基于 name 查询业务元数据，例如文档审核场景中的原文位置。
 */
export interface TextFieldFocusPayload {
  name: string
  value: string
  event: FocusEvent<HTMLInputElement>
}

/**
 * DynamicForm 组件对外暴露的方法
 * 通过 ref 访问这些方法
 *
 * @example
 * ```tsx
 * const formRef = useRef<DynamicFormRef>(null);
 *
 * // 设置单个字段
 * formRef.current?.setValue('email', 'user@example.com');
 *
 * // 设置嵌套字段
 * formRef.current?.setValue('address.city', 'Beijing');
 *
 * // 获取表单值
 * const values = formRef.current?.getValues();
 * console.log(values); // { email: '...', address: { city: '...' } }
 * ```
 */
export interface DynamicFormRef {
  /**
   * 设置单个字段的值
   *
   * 注意事项：
   * - 支持嵌套路径，使用 `.` 分隔符，如 `'address.city'` 或 `'items.0.name'`
   * - 会自动应用字段的 `reverseCallback` 转换（存储域 → 展示域）
   * - 会触发表单联动计算（除非使用 `setValues` 的 `silence` 选项）
   * - 会标记表单为脏状态（dirty），除非设置 `shouldDirty: false`
   *
   * @param name - 字段路径，支持嵌套路径（如 'email'、'address.city'、'items.0.name'）
   * @param value - 要设置的值（存储域值，会自动转换为展示域）
   * @param options - 可选配置
   * @param options.shouldValidate - 是否立即验证该字段（默认 false）
   * @param options.shouldDirty - 是否标记为脏状态（默认 true）
   * @param options.shouldTouch - 是否标记为已触摸（默认 false）
   *
   * @example
   * ```tsx
   * // 设置顶层字段
   * formRef.current?.setValue('email', 'user@example.com');
   *
   * // 设置嵌套对象字段
   * formRef.current?.setValue('address.city', 'Beijing');
   *
   * // 设置数组元素
   * formRef.current?.setValue('items.0.name', 'Item 1');
   *
   * // 设置并立即验证
   * formRef.current?.setValue('email', 'invalid-email', {
   *   shouldValidate: true,
   * });
   * ```
   */
  setValue: (
    name: string,
    value: any,
    options?: {
      shouldValidate?: boolean
      shouldDirty?: boolean
      shouldTouch?: boolean
    },
  ) => void

  /**
   * 获取单个字段的值
   *
   * 注意事项：
   * - 支持嵌套路径，使用 `.` 分隔符
   * - 会自动应用字段的 `callback` 转换（展示域 → 存储域）
   * - 返回的是存储域值，适合用于提交到后端
   *
   * @param name - 字段路径，支持嵌套路径（如 'email'、'address.city'、'items.0.name'）
   * @returns 字段值（存储域值）
   *
   * @example
   * ```tsx
   * // 获取顶层字段
   * const email = formRef.current?.getValue('email');
   *
   * // 获取嵌套字段
   * const city = formRef.current?.getValue('address.city');
   *
   * // 获取数组元素
   * const itemName = formRef.current?.getValue('items.0.name');
   * ```
   */
  getValue: (name: string) => any

  /**
   * 获取所有表单值
   *
   * 注意事项：
   * - 返回完整的表单数据对象（嵌套结构）
   * - 会自动应用所有字段的 `callback` 转换（展示域 → 存储域）
   * - 会解包基本类型数组（内部使用 `{ value }` 包装的数组会被解包）
   * - 返回的数据适合直接提交到后端 API
   *
   * @returns 完整的表单数据对象（存储域值）
   *
   * @example
   * ```tsx
   * const values = formRef.current?.getValues();
   * console.log(values);
   * // {
   * //   email: 'user@example.com',
   * //   address: {
   * //     city: 'Beijing',
   * //     street: 'Main St'
   * //   },
   * //   items: [
   * //     { name: 'Item 1' },
   * //     { name: 'Item 2' }
   * //   ]
   * // }
   *
   * // 提交到后端
   * await fetch('/api/submit', {
   *   method: 'POST',
   *   body: JSON.stringify(values),
   * });
   * ```
   */
  getValues: () => Record<string, any>

  /**
   * 批量设置表单值
   *
   * 注意事项：
   * - 接受完整或部分的表单数据对象
   * - 会自动应用所有字段的 `reverseCallback` 转换（存储域 → 展示域）
   * - 会递归设置所有嵌套字段，确保所有 React Hook Form 的 Controller 都能收到新值
   * - 默认会触发表单联动计算，可使用 `silence: true` 禁用
   * - 会包装基本类型数组（字符串数组等会被包装为 `{ value }` 结构）
   *
   * @param values - 要设置的值对象（存储域值，会自动转换为展示域）
   * @param options - 可选配置
   * @param options.shouldValidate - 是否立即验证（默认 false）
   * @param options.shouldDirty - 是否标记为脏状态（默认 true）
   * @param options.shouldTouch - 是否标记为已触摸（默认 false）
   * @param options.silence - 是否静默设置（不触发联动计算，默认 false）
   *
   * @example
   * ```tsx
   * // 批量设置表单值
   * formRef.current?.setValues({
   *   email: 'user@example.com',
   *   address: {
   *     city: 'Beijing',
   *     street: 'Main St'
   *   }
   * });
   *
   * // 静默设置（不触发联动）
   * formRef.current?.setValues(
   *   { email: 'new@example.com' },
   *   { silence: true }
   * );
   *
   * // 设置并立即验证
   * formRef.current?.setValues(
   *   { email: 'invalid-email' },
   *   { shouldValidate: true }
   * );
   * ```
   */
  setValues: (
    values: Record<string, any>,
    options?: {
      shouldValidate?: boolean
      shouldDirty?: boolean
      shouldTouch?: boolean
      silence?: boolean
    },
  ) => void

  /**
   * 重置表单到初始值或指定值
   *
   * 注意事项：
   * - 如果提供 `values` 参数，会重置到指定值
   * - 如果不提供参数或提供空对象，会重置为类型恰当的空值（避免受控组件变为非受控组件）
   * - 会清除表单的脏状态、错误状态和触摸状态
   * - 会应用字段的 `reverseCallback` 转换
   * - 会递归设置所有嵌套字段
   *
   * @param values - 可选的重置目标值（存储域值）。不提供则重置为空值
   *
   * @example
   * ```tsx
   * // 重置为初始值（defaultValues）
   * formRef.current?.reset();
   *
   * // 重置为空值
   * formRef.current?.reset({});
   *
   * // 重置为指定值
   * formRef.current?.reset({
   *   email: 'admin@example.com',
   *   address: {
   *     city: 'Shanghai'
   *   }
   * });
   * ```
   */
  reset: (values?: Record<string, any>) => void

  /**
   * 触发表单验证
   *
   * 注意事项：
   * - 不提供 `name` 参数时，验证整个表单
   * - 提供 `name` 参数时，只验证指定的字段或字段数组
   * - 支持嵌套路径（如 'address.city'）
   * - 会跳过被联动隐藏的字段（visible: false）
   * - 异步验证器会等待完成
   *
   * @param name - 可选，指定要验证的字段路径或路径数组
   * @returns Promise，resolve 为 true 表示验证通过，false 表示验证失败
   *
   * @example
   * ```tsx
   * // 验证整个表单
   * const isValid = await formRef.current?.validate();
   * if (isValid) {
   *   console.log('Form is valid');
   * }
   *
   * // 验证单个字段
   * const isEmailValid = await formRef.current?.validate('email');
   *
   * // 验证多个字段
   * const areFieldsValid = await formRef.current?.validate([
   *   'email',
   *   'address.city'
   * ]);
   * ```
   */
  validate: (name?: string | string[]) => Promise<boolean>

  /**
   * 获取表单错误
   *
   * 注意事项：
   * - 返回 React Hook Form 的 `FieldErrors` 对象
   * - 错误对象的键为字段路径（支持嵌套，如 'address.city'）
   * - 错误值包含 `type` 和 `message` 属性
   *
   * @returns 错误对象，键为字段路径，值为错误信息
   *
   * @example
   * ```tsx
   * const errors = formRef.current?.getErrors();
   * console.log(errors);
   * // {
   * //   email: { type: 'required', message: 'Email is required' },
   * //   'address.city': { type: 'minLength', message: 'Too short' }
   * // }
   *
   * // 检查特定字段是否有错误
   * if (errors?.email) {
   *   console.log('Email error:', errors.email.message);
   * }
   * ```
   */
  getErrors: () => FieldErrors

  /**
   * 清除表单错误
   *
   * 注意事项：
   * - 不提供 `name` 参数时，清除所有错误
   * - 提供 `name` 参数时，只清除指定字段的错误
   * - 支持嵌套路径和数组
   *
   * @param name - 可选，指定要清除错误的字段路径或路径数组
   *
   * @example
   * ```tsx
   * // 清除所有错误
   * formRef.current?.clearErrors();
   *
   * // 清除单个字段错误
   * formRef.current?.clearErrors('email');
   *
   * // 清除多个字段错误
   * formRef.current?.clearErrors(['email', 'address.city']);
   * ```
   */
  clearErrors: (name?: string | string[]) => void

  /**
   * 设置字段错误
   *
   * 注意事项：
   * - 支持嵌套路径（如 'address.city'）
   * - 错误会显示在对应的字段下方
   * - 可用于显示服务端验证错误
   *
   * @param name - 字段路径
   * @param error - 错误信息对象
   * @param error.type - 错误类型（如 'required'、'pattern'、'custom'）
   * @param error.message - 错误消息文本
   *
   * @example
   * ```tsx
   * // 设置单个字段错误
   * formRef.current?.setError('email', {
   *   type: 'custom',
   *   message: 'This email is already taken'
   * });
   *
   * // 处理服务端验证错误
   * try {
   *   await submitForm(values);
   * } catch (error) {
   *   if (error.field === 'email') {
   *     formRef.current?.setError('email', {
   *       type: 'server',
   *       message: error.message
   *     });
   *   }
   * }
   * ```
   */
  setError: (name: string, error: { type: string; message: string }) => void

  /**
   * 获取表单状态
   *
   * 返回值说明：
   * - `isDirty`: 表单是否有修改（与初始值不同）
   * - `isValid`: 表单是否通过验证（所有字段都有效）
   * - `isSubmitting`: 表单是否正在提交中
   * - `isSubmitted`: 表单是否已提交过（至少一次）
   * - `submitCount`: 表单提交次数
   *
   * @returns 表单状态对象
   *
   * @example
   * ```tsx
   * const state = formRef.current?.getFormState();
   * console.log(state);
   * // {
   * //   isDirty: true,
   * //   isValid: false,
   * //   isSubmitting: false,
   * //   isSubmitted: false,
   * //   submitCount: 0
   * // }
   *
   * // 根据状态禁用提交按钮
   * const canSubmit = state.isValid && !state.isSubmitting;
   * ```
   */
  getFormState: () => {
    isDirty: boolean
    isValid: boolean
    isSubmitting: boolean
    isSubmitted: boolean
    submitCount: number
  }

  /**
   * 重新触发联动计算
   *
   * 使用场景：
   * - 联动函数依赖异步加载的数据（如员工列表、部门列表等）
   * - 需要在数据加载完成后重新计算联动状态
   * - 外部上下文数据（linkageContext）发生变化后，需要刷新联动
   *
   * 注意事项：
   * - 会读取当前表单的最新值，重新执行所有联动规则
   * - 异步操作，返回 Promise
   * - 通常配合 `linkageContext` 使用
   *
   * @returns Promise，联动计算完成时 resolve
   *
   * @example
   * ```tsx
   * const formRef = useRef<DynamicFormRef>(null);
   * const [employees, setEmployees] = useState([]);
   *
   * useEffect(() => {
   *   // 加载员工列表
   *   fetchEmployees().then(employees => {
   *     setEmployees(employees);
   *     // 数据加载完成后，重新触发联动
   *     formRef.current?.refreshLinkage();
   *   });
   * }, []);
   *
   * // 或者在 linkageContext 变化时刷新
   * useEffect(() => {
   *   formRef.current?.refreshLinkage();
   * }, [linkageContext]);
   * ```
   */
  refreshLinkage: () => Promise<void>
}

/**
 * DynamicForm 组件属性
 */
export interface DynamicFormProps {
  // 必需属性
  schema: ExtendedJSONSchema

  // 可选属性
  defaultValues?: Record<string, any>
  onSubmit?: (data: Record<string, any>) => void | Promise<void>
  onChange?: (data: Record<string, any>, meta?: FormChangeMeta) => void
  /**
   * 文本字段获得焦点时触发。
   * 仅 `text` Widget 会调用该回调，其他 Widget 不受影响。
   */
  onTextFieldFocus?: (payload: TextFieldFocusPayload) => void

  // 自定义配置
  widgets?: Record<string, React.ComponentType<any>>
  linkageFunctions?: Record<string, LinkageFunction> // 联动函数（详见 UI_LINKAGE_DESIGN.md）
  linkageContext?: Record<string, any> // 联动函数的外部上下文数据（如页面级 state、API 数据等）
  /**
   * 回调函数注册表，用于 Widget callbacks、Transform、Validators
   *
   * 所有 callback 函数都使用对象解构参数形式，并自动注入 helpers：
   * - WidgetCallback: `({ args, helpers }) => any` - args 为 Widget 传递的参数数组
   * - TransformCallback: `({ value, helpers }) => any` - value 为待转换的值
   * - ValidatorCallback: `({ value, formValues, helpers }) => any | Promise<any>` - 返回 null（有效）或错误信息字符串
   *
   * @example
   * ```tsx
   * const callbacks: Record<string, CallbackFunction> = {
   *   // Widget callback
   *   handleUpload: async ({ args, helpers }) => {
   *     const [file] = args;
   *     const result = await helpers.ofetch('/api/upload', {
   *       method: 'POST',
   *       body: file,
   *     });
   *     return result.url;
   *   },
   *   // Transform callback
   *   percentToDecimal: ({ value, helpers }) => Number(value) / 100,
   *   // Validator callback
   *   validateEmail: async ({ value, formValues, helpers }) => {
   *     if (!value) return 'Email is required';
   *     const schema = helpers.z.string().email();
   *     const result = schema.safeParse(value);
   *     return result.success ? null : 'Invalid email format';
   *   },
   * };
   * ```
   */
  callbacks?: Record<string, CallbackFunction>
  customFormats?: Record<string, (value: string) => boolean> // 自定义格式验证器

  /**
   * 帮助函数和工具库，可在 inline script 和 callbacks 中使用
   *
   * 内置 helpers:
   * - ofetch: 跨浏览器和 Node.js 环境的请求能力
   * - _: lodash 完整功能
   * - z: Zod 校验工具
   *
   * 用户可以注入自定义 helpers，会与内置 helpers 合并
   *
   * @example
   * ```tsx
   * import dayjs from 'dayjs';
   * <DynamicForm
   *   schema={schema}
   *   helpers={{
   *     dayjs,        // 日期处理库
   *     myUtils,      // 自定义工具函数
   *   }}
   * />
   * ```
   */
  helpers?: Record<string, any>

  // UI 配置
  layout?: 'vertical' | 'horizontal' | 'inline'
  labelWidth?: number | string // 全局标签宽度（仅 horizontal layout 下生效）
  columnsCount?: number // 多列布局列数（默认 1，使用 CSS Grid 实现）
  showErrorList?: boolean // 是否显示错误列表
  showSubmitButton?: boolean // 是否显示提交按钮
  renderAsForm?: boolean // 是否渲染为 <form> 标签（默认 true）

  // 性能优化配置
  enableVirtualScroll?: boolean // 是否启用虚拟滚动（用于数组字段）
  virtualScrollHeight?: number // 虚拟滚动容器高度（像素，默认 600）

  // 表单行为
  validateMode?: 'onSubmit' | 'onBlur' | 'onChange' | 'all'
  reValidateMode?: 'onSubmit' | 'onBlur' | 'onChange' // 重新验证模式

  // 样式
  className?: string
  style?: React.CSSProperties
  fieldsWrapperStyle?: React.CSSProperties
  fieldRowStyle?: React.CSSProperties
  fieldLabelStyle?: React.CSSProperties
  fieldControlStyle?: React.CSSProperties

  // 其他
  loading?: boolean
  disabled?: boolean
  readonly?: boolean
  pathPrefix?: string // 路径前缀（用于嵌套表单）
  /**
   * 是否作为嵌套表单运行
   * - true: 复用父表单的 FormContext，不创建新的 useForm，字段直接注册到父表单
   * - false: 创建独立的 useForm 实例（默认）
   */
  asNestedForm?: boolean
}

/** 字段变更来源 */
export type FieldChangeSource =
  | 'user'
  | 'setValue'
  | 'setValues'
  | 'reset'
  | 'linkage'

export interface ArrayInsertAction {
  action: 'insert'
  index: number
  value: unknown
}

export interface ArrayRemoveAction {
  action: 'remove'
  index: number
  value: unknown
}

export interface ArrayMoveAction {
  action: 'move'
  fromIndex: number
  toIndex: number
  value: unknown
}

export type ArrayAction =
  | ArrayInsertAction
  | ArrayRemoveAction
  | ArrayMoveAction

/** 字段级变更记录 */
export interface FieldChange {
  /** 标准绝对字段路径。 */
  path: string
  /** 本次逻辑操作开始前的外部存储域值。 */
  previousValue: unknown
  /** 本次逻辑操作稳定后的外部存储域值。 */
  value: unknown
  /** 触发变化的来源，用于区分用户输入、API、重置和联动。 */
  source: FieldChangeSource
  /** 数组结构变化时使用；普通字段更新时省略。 */
  arrayAction?: ArrayAction
}

/** 表单变更元数据 */
export interface FormChangeMeta {
  /** 当前稳定回调中发生的一个或多个字段变化。 */
  changes: FieldChange[]
}

/**
 * 字段组件属性
 */
export interface FieldWidgetProps {
  name: string
  label?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  error?: string
  value?: any
  onChange?: (value: any) => void
  onBlur?: () => void
  options?: FieldOption[]
  schema?: ExtendedJSONSchema
  [key: string]: any
}

/**
 * 嵌套表单结构 Widget 属性。
 *
 * 结构 Widget 不拥有对象路径的值，因此不接收 value、onChange、onBlur 或字段 ref。
 */
export interface NestedFormWidgetProps {
  name: string
  schema: ExtendedJSONSchema
  disabled?: boolean
  readonly?: boolean
  layout?: 'vertical' | 'horizontal' | 'inline'
  labelWidth?: number | string
  noCard?: boolean
}
