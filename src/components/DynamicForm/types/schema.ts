import type { JSONSchema7 } from 'json-schema';
import type { LinkageConfig } from './linkage';

// 重新导出联动相关类型，方便其他模块使用
export type { LinkageConfig, ConditionExpression } from './linkage';

/**
 * Widget 类型
 */
export type WidgetType =
  | 'text'
  | 'textarea'
  | 'password'
  | 'email'
  | 'url'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'checkboxes'
  | 'switch'
  | 'date'
  | 'datetime'
  | 'time'
  | 'range'
  | 'color'
  | 'file'
  | 'nested-form'
  | 'array';

/**
 * 错误信息配置
 */
export interface ErrorMessages {
  required?: string;
  minLength?: string;
  maxLength?: string;
  min?: string;
  max?: string;
  pattern?: string;
  [key: string]: string | undefined;
}

/**
 * UI 配置类型
 */
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
  layout?: 'vertical' | 'horizontal' | 'inline'; // 布局方式（优先级高于全局配置）

  // 字段透明化渲染配置
  flattenPath?: boolean; // 是否将嵌套对象的子字段提升到当前层级渲染
  flattenPrefix?: boolean; // 是否在字段标签前添加父级标题作为前缀

  // 数组特有配置
  arrayMode?: 'dynamic' | 'static'; // 渲染模式：dynamic 可增删，static 不可增删
  showAddButton?: boolean; // 是否显示添加按钮
  showRemoveButton?: boolean; // 是否显示删除按钮
  showMoveButtons?: boolean; // 是否显示移动按钮
  enableDragSort?: boolean; // 是否启用拖拽排序
  addButtonText?: string; // 添加按钮文本
  removeButtonText?: string; // 删除按钮文本
  emptyText?: string; // 空数组提示文本
  itemLayout?: 'vertical' | 'horizontal' | 'inline'; // 数组项布局
  itemClassName?: string; // 数组项自定义类名
  itemStyle?: React.CSSProperties; // 数组项自定义样式

  // 自定义 widget 额外参数，会被直接展开传递给 widget 组件
  widgetProps?: Record<string, any>;

  // Widget 回调函数引用（key=prop名，value=函数名，运行时从 DynamicForm.callbacks 注册表解析）
  callbackProps?: Record<string, string>;

  [key: string]: any;
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
