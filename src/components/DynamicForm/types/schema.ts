import type { JSONSchema7 } from "json-schema";
import type { LinkageConfig } from "./linkage";

// 重新导出联动相关类型，方便其他模块使用
export type { LinkageConfig, ConditionExpression } from "./linkage";

/**
 * Widget 类型
 */
export type WidgetType =
  | "text"
  | "textarea"
  | "password"
  | "email"
  | "url"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "checkboxes"
  | "switch"
  | "date"
  | "datetime"
  | "time"
  | "range"
  | "color"
  | "file"
  | "nested-form"
  | "array";

/**
 * 错误信息配置
 */
export interface ErrorMessages {
  required?: string;
  minLength?: string;
  maxLength?: string;
  min?: string;
  max?: string;
  exclusiveMinimum?: string;
  exclusiveMaximum?: string;
  multipleOf?: string;
  pattern?: string;
  [key: string]: string | undefined;
}

/**
 * Script 校验器：执行自定义 JS 函数进行验证
 *
 * callback 支持两种形式：
 * 1. string：从 callbacks 注册表获取函数名（推荐用于可复用的验证逻辑）
 * 2. { type: 'script'; code: string }：内联 JavaScript 函数字符串（用于简单的一次性验证）
 *
 * 函数签名：(value, formValues) => Promise<string | null> | string | null
 * 函数接收两个参数：
 * - value: 当前字段的值
 * - formValues: 整个表单的数据对象
 *
 * 返回值：
 * - null: 校验通过
 * - string: 校验失败，返回的字符串作为错误信息
 *
 * ⚠️ 内联 script 仅适用于受信任的内部工具环境
 */
export interface ScriptValidator {
  type: "script";
  callback: string | { type: "script"; code: string };
}

export type ValidatorRule = ScriptValidator;

/**
 * Widget 回调函数引用
 *
 * - string：从 DynamicForm callbacks 注册表获取函数
 * - { type: 'script'; code: string }：内联 JavaScript 函数字符串
 *
 * ⚠️ 内联 script 仅适用于受信任的内部工具环境
 */
export type CallbackPropRef = string | { type: "script"; code: string };

export interface UIConfig {
  widget?: WidgetType | string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  help?: string;
  className?: string;
  style?: React.CSSProperties;
  order?: string[];
  errorMessages?: ErrorMessages;
  linkages?: LinkageConfig[]; // 联动配置（支持多个联动规则）
  labelWidth?: number | string; // 标签宽度（仅在 horizontal layout 下生效）
  layout?: "vertical" | "horizontal" | "inline"; // 布局方式（优先级高于全局配置）
  prefixLabel?: string; // 字段标签前缀（由 flattenPrefix 场景写入）

  // 多列布局
  columnsCount?: number; // object 类型字段的多列布局列数（默认 1）
  colSpan?: number; // 在多列布局下，该字段占用的列数（默认 1）

  // 字段透明化渲染配置
  flattenPath?: boolean; // 是否将嵌套对象的子字段提升到当前层级渲染
  flattenPrefix?: boolean; // 是否在字段标签前添加父级标题作为前缀

  // 数组特有配置
  arrayMode?: "dynamic" | "static"; // 渲染模式：dynamic 可增删，static 不可增删
  showAddButton?: boolean; // 是否显示添加按钮
  showRemoveButton?: boolean; // 是否显示删除按钮
  showMoveButtons?: boolean; // 是否显示移动按钮
  enableDragSort?: boolean; // 是否启用拖拽排序
  addButtonText?: string; // 添加按钮文本
  removeButtonText?: string; // 删除按钮文本
  emptyText?: string; // 空数组提示文本
  itemLayout?: "vertical" | "horizontal" | "inline"; // 数组项布局
  itemClassName?: string; // 数组项自定义类名
  itemStyle?: React.CSSProperties; // 数组项自定义样式
  autogenerate?: "uuid";

  // 自定义 widget 额外参数，会被直接展开传递给 widget 组件
  widgetProps?: Record<string, any>;

  // Widget 回调函数引用（key=prop名，value=函数名或内联脚本，运行时解析为函数）
  callbackProps?: Record<string, CallbackPropRef>;

  // 字段级自定义校验规则（由 SchemaBuilder 用户配置，运行时执行）
  validators?: ValidatorRule[];

  /**
   * 字段值转换配置
   *
   * 设计背景：某些字段需要用户以"展示域"输入（如百分比 96），但实际存储"存储域"的值（如 0.96）。
   * 这类转换完全在 DynamicForm 内部完成，外部（setValues/getValues/onChange/onSubmit）
   * 始终以存储域值交互，schema.default/maximum 等配置则使用展示域值（更直观）。
   *
   * - callback：展示域 → 存储域，在 getValues/onChange/onSubmit 时自动应用
   * - reverseCallback：存储域 → 展示域，在 setValues/setValue 时自动应用（将外部存储值转为用户可见的展示值）
   * - hideConvertedValue：是否隐藏字段下方转换后的值，默认不隐藏
   */
  transform?: {
    // 可以是 callbacks 注册表中的函数名（string），也可以是内联完整 JS 函数（CallbackPropRef）
    callback: CallbackPropRef;
    reverseCallback?: CallbackPropRef;
    hideConvertedValue?: boolean;
  };
}

/**
 * 扩展的 JSON Schema 类型
 */
export interface ExtendedJSONSchema extends JSONSchema7 {
  ui?: UIConfig;
  enumNames?: string[];
  dependencies?: Record<string, any>;
  properties?: Record<string, ExtendedJSONSchema>;
  items?: ExtendedJSONSchema | ExtendedJSONSchema[];
}

/**
 * 字段选项
 */
export interface FieldOption {
  label: string;
  value: any;
  disabled?: boolean;
}

/**
 * 验证规则
 */
export interface ValidationRules {
  required?: string | boolean;
  minLength?: { value: number; message: string };
  maxLength?: { value: number; message: string };
  min?: { value: number; message: string };
  max?: { value: number; message: string };
  pattern?: { value: RegExp; message: string };
  validate?: Record<string, (value: any) => boolean | string>;
}

/**
 * 字段配置
 */
export interface FieldConfig {
  name: string;
  type: string;
  widget: string;
  label?: string;
  placeholder?: string;
  description?: string;
  defaultValue?: any;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  validation?: ValidationRules;
  options?: FieldOption[];
  dependencies?: any;
  schema?: ExtendedJSONSchema;
}

// const schema: ExtendedJSONSchema = {
//   type: 'object',
//   properties: {
//     group: {
//       title: '地区',
//       type: 'object',
//       ui: {
//         flattenPath: true,
//         flattenPrefix: true,
//       },
//       properties: {
//         category: {
//           type: 'object',
//           title: '市场',
//           ui: {
//             flattenPath: true,
//           },
//           properties: {
//             contacts: {
//               type: 'array',
//               title: '联系人',
//               items: {
//                 type: 'object',
//                 properties: {
//                   category: {
//                     type: 'object',
//                     title: '分类',
//                     ui: {
//                       flattenPath: true,
//                       flattenPrefix: true,
//                     },
//                     properties: {
//                       group: {
//                         type: 'object',
//                         title: '分组',
//                         ui: {
//                           flattenPath: true,
//                           flattenPrefix: true,
//                         },
//                         properties: {
//                           name: {
//                             title: '名称',
//                             type: 'string',
//                           },
//                           phone: {
//                             title: '手机号',
//                             type: 'string',
//                           },
//                         },
//                       },
//                     },
//                   },
//                 },
//               },
//             },
//           },
//         },
//       },
//     },
//   },
// };

// 渲染效果
// 地区-联系人
// ┌─────────────────────────────┐
// │ 分类-分组-名称: [________]    │
// │ 分类-分组-手机号: [________]  │
// └─────────────────────────────┘
