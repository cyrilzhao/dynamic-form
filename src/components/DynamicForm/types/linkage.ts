/**
 * 联动类型
 */
export type LinkageType =
  | "visibility"
  | "disabled"
  | "readonly"
  | "value"
  | "options"
  | "schema";

/**
 * 条件操作符
 */
export type ConditionOperator =
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "in"
  | "notIn"
  | "includes"
  | "notIncludes"
  | "isEmpty"
  | "isNotEmpty";

// 单条件表达式
interface SingleCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

// 逻辑组合表达式
interface LogicalCondition {
  and?: ConditionExpression[];
  or?: ConditionExpression[];
}

// 条件表达式（联合类型）
export type ConditionExpression = SingleCondition | LogicalCondition;

/**
 * 联动效果定义
 */
export interface LinkageEffect {
  // 状态变更
  state?: {
    visible?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
  };
  // 直接指定值（用于 value 类型）
  value?: any;
  // 直接指定选项（用于 options 类型）
  options?: Array<{ label: string; value: any }>;
  // 直接指定 Schema（用于 schema 类型）
  schema?: any; // ExtendedJSONSchema
  // 通过函数计算（根据 linkage.type 决定计算结果的用途）
  // 支持两种方式：
  // 1. 函数名（从 callbacks 中查找）
  // 2. 内联脚本对象
  function?: string | { type: "script"; code: string };
}

/**
 * 联动配置
 */
export interface LinkageConfig {
  type: LinkageType;
  dependencies: string[];

  // 条件表达式或函数名（描述"什么时候触发联动"）
  when?: ConditionExpression | string;
  // 条件满足时的效果（描述"触发后做什么"）
  fulfill?: LinkageEffect;
  // 条件不满足时的效果
  otherwise?: LinkageEffect;
  // 是否启用缓存（默认 false，禁用缓存）
  // 建议仅为异步联动（如 API 调用）启用缓存
  enableCache?: boolean;
}

/**
 * 联动结果
 */
export interface LinkageResult {
  visible?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  value?: any;
  options?: Array<{ label: string; value: any }>;
  schema?: any; // ExtendedJSONSchema，用于 schema 类型联动
}

/**
 * 联动函数上下文
 */
export interface LinkageFunctionContext {
  /** 当前字段的完整路径，如 'contacts.0.showCompany' */
  fieldPath: string;
  /** 如果字段在数组内，这是数组元素的索引 */
  arrayIndex?: number;
  /** 如果字段在数组内，这是数组的路径，如 'contacts' */
  arrayPath?: string;
  /** 页面级外部数据（通过 linkageContext prop 传入） */
  externalData: Record<string, any>;
}

/**
 * 联动函数签名（支持同步和异步函数）
 */
export type LinkageFunction = (
  params: {
    formData: Record<string, any>;
    context: LinkageFunctionContext;
    helpers: Record<string, any>;
  },
) => any | Promise<any>;
