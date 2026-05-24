import type { FieldErrors } from 'react-hook-form';
import type { ExtendedJSONSchema, FieldOption } from './schema';
import type { LinkageFunction } from './linkage';

/**
 * DynamicForm 组件对外暴露的方法
 * 通过 ref 访问这些方法
 */
export interface DynamicFormRef {
  /**
   * 设置单个字段的值
   * @param name - 字段路径，如 'email' 或 'address.city'
   * @param value - 要设置的值
   * @param options - 可选配置
   */
  setValue: (
    name: string,
    value: any,
    options?: {
      shouldValidate?: boolean;
      shouldDirty?: boolean;
      shouldTouch?: boolean;
    }
  ) => void;

  /**
   * 获取单个字段的值
   * @param name - 字段路径
   * @returns 字段值
   */
  getValue: (name: string) => any;

  /**
   * 获取所有表单值
   * @returns 完整的表单数据对象
   */
  getValues: () => Record<string, any>;

  /**
   * 批量设置表单值
   * @param values - 要设置的值对象
   * @param options - 可选配置
   */
  setValues: (
    values: Record<string, any>,
    options?: {
      shouldValidate?: boolean;
      shouldDirty?: boolean;
      shouldTouch?: boolean;
    }
  ) => void;

  /**
   * 重置表单到初始值或指定值
   * @param values - 可选的重置目标值
   */
  reset: (values?: Record<string, any>) => void;

  /**
   * 触发表单验证
   * @param name - 可选，指定要验证的字段路径
   * @returns 验证是否通过
   */
  validate: (name?: string | string[]) => Promise<boolean>;

  /**
   * 获取表单错误
   * @returns 错误对象
   */
  getErrors: () => FieldErrors;

  /**
   * 清除表单错误
   * @param name - 可选，指定要清除错误的字段路径
   */
  clearErrors: (name?: string | string[]) => void;

  /**
   * 设置字段错误
   * @param name - 字段路径
   * @param error - 错误信息
   */
  setError: (name: string, error: { type: string; message: string }) => void;

  /**
   * 获取表单状态
   */
  getFormState: () => {
    isDirty: boolean;
    isValid: boolean;
    isSubmitting: boolean;
    isSubmitted: boolean;
    submitCount: number;
  };

  /**
   * 重新触发联动初始化
   * 用于在异步数据加载完成后，手动触发表单的联动计算
   *
   * 使用场景：
   * - 联动函数依赖异步加载的数据（如员工列表、部门列表等）
   * - 需要在数据加载完成后重新计算联动状态
   *
   * @example
   * ```tsx
   * const formRef = useRef<DynamicFormRef>(null);
   *
   * useEffect(() => {
   *   // 加载员工列表
   *   fetchEmployees().then(employees => {
   *     setEmployees(employees);
   *     // 数据加载完成后，重新触发联动
   *     formRef.current?.refreshLinkage();
   *   });
   * }, []);
   * ```
   */
  refreshLinkage: () => Promise<void>;
}

/**
 * DynamicForm 组件属性
 */
export interface DynamicFormProps {
  // 必需属性
  schema: ExtendedJSONSchema;

  // 可选属性
  defaultValues?: Record<string, any>;
  onSubmit?: (data: Record<string, any>) => void | Promise<void>;
  onChange?: (data: Record<string, any>) => void;

  // 自定义配置
  widgets?: Record<string, React.ComponentType<any>>;
  linkageFunctions?: Record<string, LinkageFunction>; // 联动函数（详见 UI_LINKAGE_DESIGN.md）
  customFormats?: Record<string, (value: string) => boolean>; // 自定义格式验证器

  // UI 配置
  layout?: 'vertical' | 'horizontal' | 'inline';
  labelWidth?: number | string; // 全局标签宽度（仅 horizontal layout 下生效）
  showErrorList?: boolean; // 是否显示错误列表
  showSubmitButton?: boolean; // 是否显示提交按钮
  renderAsForm?: boolean; // 是否渲染为 <form> 标签（默认 true）

  // 性能优化配置
  enableVirtualScroll?: boolean; // 是否启用虚拟滚动（用于数组字段）
  virtualScrollHeight?: number; // 虚拟滚动容器高度（像素，默认 600）

  // 表单行为
  validateMode?: 'onSubmit' | 'onBlur' | 'onChange' | 'all';
  reValidateMode?: 'onSubmit' | 'onBlur' | 'onChange'; // 重新验证模式

  // 样式
  className?: string;
  style?: React.CSSProperties;

  // 其他
  loading?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  pathPrefix?: string; // 路径前缀（用于嵌套表单）
  /**
   * 是否作为嵌套表单运行
   * - true: 复用父表单的 FormContext，不创建新的 useForm，字段直接注册到父表单
   * - false: 创建独立的 useForm 实例（默认）
   */
  asNestedForm?: boolean;
}

/**
 * 字段组件属性
 */
export interface FieldWidgetProps {
  name: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  error?: string;
  value?: any;
  onChange?: (value: any) => void;
  onBlur?: () => void;
  options?: FieldOption[];
  schema?: ExtendedJSONSchema;
  [key: string]: any;
}
