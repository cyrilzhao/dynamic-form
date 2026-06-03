# 动态表单组件技术方案 - Part 3

## 组件架构设计

### 6.1 核心组件层次结构

```
DynamicForm (根组件)
├── FormProvider (react-hook-form 上下文)
├── SchemaParser (Schema 解析器)
├── FormLayout (布局容器)
│   ├── FormSection (表单分组)
│   │   ├── FormField (字段包装器)
│   │   │   ├── FieldLabel (字段标签)
│   │   │   ├── FieldWidget (字段组件)
│   │   │   └── FieldError (错误提示)
│   │   └── ...
│   └── ...
└── FormActions (表单操作按钮)
```

### 6.2 核心类型定义

```typescript
// src/types/schema.ts

import { JSONSchema7 } from 'json-schema';

/**
 * UI 配置类型
 */
export interface UIConfig {
  widget?: WidgetType;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  help?: string;
  className?: string;
  style?: React.CSSProperties;
  order?: string[];
  errorMessages?: ErrorMessages;
  linkage?: LinkageConfig; // UI 联动配置（详见 UI_LINKAGE_DESIGN.md）
  labelWidth?: number | string; // 标签宽度（仅在 horizontal layout 下生效）
  layout?: 'vertical' | 'horizontal' | 'inline'; // 布局方式（优先级高于全局配置）

  // 路径透明化配置（详见 FIELD_PATH_FLATTENING.md）
  flattenPath?: boolean; // 是否跳过该对象层级
  flattenPrefix?: boolean; // 是否添加当前字段 title 作为前缀

  // 数组特有配置（详见 ARRAY_FIELD_WIDGET.md）
  arrayMode?: 'dynamic' | 'static'; // 数组渲染模式：dynamic 可增删，static 不可增删
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

  [key: string]: any; // 支持其他自定义属性
}

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
 * 扩展的 JSON Schema 类型
 */
export interface ExtendedJSONSchema extends JSONSchema7 {
  // UI 扩展配置
  ui?: UIConfig;

  // 自定义属性
  enumNames?: string[];
  dependencies?: Record<string, any>;
}

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
  | 'nested-form' // 嵌套表单组件
  | 'array'; // 数组字段组件

/**
 * 字段配置
 */
export interface FieldConfig {
  name: string;
  type: string;
  widget: WidgetType;
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
  dependencies?: any; // JSON Schema dependencies（保留原始格式）
  schema?: ExtendedJSONSchema; // 用于嵌套表单
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
```

### 6.3 主组件接口设计

```typescript
// src/components/DynamicForm/types/index.ts

import type { ExtendedJSONSchema, FieldOption } from './schema';
import type { LinkageFunction } from './linkage';

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
  schema?: ExtendedJSONSchema; // 完整的字段 schema（包含 ui 配置）
  [key: string]: any;
}
```

### 6.4 目录结构设计

```
src/
├── components/
│   └── DynamicForm/
│       ├── index.tsx                    # 主组件导出
│       ├── DynamicForm.tsx              # 主组件实现
│       ├── types.ts                     # 类型定义
│       │
│       ├── core/                        # 核心功能
│       │   ├── SchemaParser.ts          # Schema 解析器
│       │   ├── FieldRegistry.ts         # 字段注册表
│       │   └── Validator.ts             # 验证器
│       │
│       ├── widgets/                     # 字段组件
│       │   ├── index.ts                 # 统一导出
│       │   ├── TextWidget.tsx           # 文本输入
│       │   ├── TextareaWidget.tsx       # 多行文本
│       │   ├── NumberWidget.tsx         # 数字输入
│       │   ├── SelectWidget.tsx         # 下拉选择
│       │   ├── RadioWidget.tsx          # 单选按钮
│       │   ├── CheckboxWidget.tsx       # 复选框
│       │   ├── SwitchWidget.tsx         # 开关
│       │   ├── DateWidget.tsx           # 日期选择
│       │   └── ...
│       │
│       ├── layout/                      # 布局组件
│       │   ├── FormLayout.tsx           # 表单布局
│       │   ├── FormSection.tsx          # 表单分组
│       │   ├── FormField.tsx            # 字段包装器
│       │   └── FormActions.tsx          # 操作按钮
│       │
│       ├── components/                  # 辅助组件
│       │   ├── FieldLabel.tsx           # 字段标签
│       │   ├── FieldError.tsx           # 错误提示
│       │   ├── FieldHelp.tsx            # 帮助文本
│       │   └── ErrorList.tsx            # 错误列表
│       │
│       ├── hooks/                       # 自定义 Hooks
│       │   ├── useSchemaParser.ts       # Schema 解析
│       │   ├── useFieldConfig.ts        # 字段配置
│       │   └── useFormValidation.ts     # 表单验证
│       │
│       └── styles/                      # 样式文件
│           └── DynamicForm.scss
│
├── types/
│   └── schema.ts                        # Schema 类型定义
│
└── utils/
    ├── schemaUtils.ts                   # Schema 工具函数
    └── validationUtils.ts               # 验证工具函数
```

### 6.5 核心模块设计

#### 6.5.1 Schema Parser (解析器)

```typescript
// src/components/DynamicForm/core/SchemaParser.ts

import type {
  ExtendedJSONSchema,
  FieldConfig,
  WidgetType,
  ValidationRules,
  FieldOption,
} from '../types/schema';
import { FLATTEN_PATH_SEPARATOR } from '../utils/schemaLinkageParser';

/**
 * Schema 解析配置
 */
interface ParseOptions {
  parentPath?: string;
  prefixLabel?: string;
  inheritedUI?: {
    layout?: 'vertical' | 'horizontal' | 'inline';
    labelWidth?: number | string;
  };
}

export class SchemaParser {
  private static customFormats: Record<string, (value: string) => boolean> = {};

  /**
   * 设置自定义格式验证器
   */
  static setCustomFormats(formats: Record<string, (value: string) => boolean>) {
    this.customFormats = formats;
  }

  /**
   * 构建字段路径（v3.0 - 使用标准 . 分隔符）
   * @param parentPath - 父级路径
   * @param fieldName - 当前字段名
   * @returns 构建的字段路径
   *
   * v3.0 变更：
   * - 移除了 isFlattenPath 参数和 ~~ 分隔符逻辑
   * - 所有路径统一使用标准 . 分隔符
   * - flattenPath 字段的路径与普通嵌套字段完全相同
   *
   * 示例：
   * - buildFieldPath('', 'region') → 'region'
   * - buildFieldPath('region', 'market') → 'region.market'
   * - buildFieldPath('region.market', 'contacts') → 'region.market.contacts'
   * - buildFieldPath('region.market.contacts.0', 'category') → 'region.market.contacts.0.category'
   */
  static buildFieldPath(parentPath: string, fieldName: string): string {
    if (!parentPath) {
      return fieldName;
    }
    return `${parentPath}.${fieldName}`;
  }

  /**
   * 检查 schema 中是否使用了路径扁平化
   */
  static hasFlattenPath(schema: ExtendedJSONSchema): boolean {
    if (schema.type !== 'object' || !schema.properties) {
      return false;
    }

    const properties = schema.properties;

    for (const key of Object.keys(properties)) {
      const property = properties[key];
      if (!property || typeof property === 'boolean') continue;

      const fieldSchema = property as ExtendedJSONSchema;

      // 如果当前字段使用了 flattenPath
      if (fieldSchema.type === 'object' && fieldSchema.ui?.flattenPath) {
        return true;
      }

      // 递归检查子字段
      if (fieldSchema.type === 'object' && this.hasFlattenPath(fieldSchema)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 解析 Schema 生成字段配置（支持路径扁平化）
   */
  static parse(schema: ExtendedJSONSchema, options: ParseOptions = {}): FieldConfig[] {
    const { parentPath = '', prefixLabel = '', inheritedUI } = options;
    const fields: FieldConfig[] = [];

    if (schema.type !== 'object' || !schema.properties) {
      return fields;
    }

    const properties = schema.properties;
    const required = schema.required || [];
    const order = schema.ui?.order || Object.keys(properties);

    for (const key of order) {
      const property = properties[key];
      if (!property || typeof property === 'boolean') continue;

      const fieldSchema = property as ExtendedJSONSchema;

      // 检查当前字段是否设置了 flattenPath
      const isFlattenPath = fieldSchema.type === 'object' && fieldSchema.ui?.flattenPath;

      // 使用 buildFieldPath 方法正确处理 flattenPath 的路径
      const currentPath = this.buildFieldPath(parentPath, key, isFlattenPath || false);

      // 检查是否需要路径扁平化
      if (isFlattenPath) {
        // 确定是否需要添加前缀
        const newPrefixLabel =
          fieldSchema.ui?.flattenPrefix && fieldSchema.title
            ? prefixLabel
              ? `${prefixLabel} - ${fieldSchema.title}`
              : fieldSchema.title
            : prefixLabel;

        // 准备要继承的 UI 配置（父级配置 + 当前层级配置）
        const newInheritedUI = {
          layout: fieldSchema.ui?.layout ?? inheritedUI?.layout,
          labelWidth: fieldSchema.ui?.labelWidth ?? inheritedUI?.labelWidth,
        };

        // 递归解析子字段，传递当前路径（v3.0 - 使用标准 . 分隔符）
        // currentPath 已经通过 buildFieldPath 正确计算，无需重复构建
        const nestedFields = this.parse(fieldSchema, {
          parentPath: currentPath,
          prefixLabel: newPrefixLabel,
          inheritedUI: newInheritedUI,
        });
        fields.push(...nestedFields);
      } else {
        // 正常解析字段
        const fieldConfig = this.parseField(
          currentPath,
          fieldSchema,
          required.includes(key),
          prefixLabel,
          inheritedUI
        );

        if (!fieldConfig.hidden) {
          fields.push(fieldConfig);
        }
      }
    }

    return fields;
  }

  /**
   * 解析单个字段（支持嵌套路径和标签前缀）
   */
  private static parseField(
    path: string,
    schema: ExtendedJSONSchema,
    required: boolean,
    prefixLabel: string = '',
    inheritedUI?: ParseOptions['inheritedUI']
  ): FieldConfig {
    const ui = schema.ui || {};

    // 如果有前缀标签，添加到字段标签前
    const label = prefixLabel && schema.title ? `${prefixLabel} - ${schema.title}` : schema.title;

    // 如果有继承的 UI 配置，需要合并到 schema 中
    let finalSchema = schema;
    if (inheritedUI && (inheritedUI.layout || inheritedUI.labelWidth)) {
      finalSchema = {
        ...schema,
        ui: {
          ...ui,
          // 只有当字段自己没有配置时，才使用继承的配置
          layout: ui.layout ?? inheritedUI.layout,
          labelWidth: ui.labelWidth ?? inheritedUI.labelWidth,
        },
      };
    }

    return {
      name: path, // 使用完整路径作为字段名
      type: schema.type as string,
      widget: this.getWidget(schema),
      label,
      placeholder: ui.placeholder,
      description: schema.description,
      defaultValue: schema.default,
      required,
      disabled: ui.disabled,
      readonly: ui.readonly,
      hidden: ui.hidden,
      validation: this.getValidationRules(schema, required),
      options: this.getOptions(schema),
      schema: finalSchema, // 保留完整的 schema（包含 ui 配置和继承的配置）
    };
  }

  /**
   * 获取 Widget 类型
   */
  private static getWidget(schema: ExtendedJSONSchema): WidgetType {
    if (schema.ui?.widget) {
      return schema.ui.widget;
    }

    const type = schema.type;

    if (type === 'string') {
      if (schema.format === 'email') return 'email';
      if (schema.format === 'date') return 'date';
      if (schema.format === 'date-time') return 'datetime';
      if (schema.format === 'time') return 'time';
      if (schema.enum) return 'select';
      if (schema.maxLength && schema.maxLength > 100) return 'textarea';
      return 'text';
    }

    if (type === 'number' || type === 'integer') {
      return 'number';
    }

    if (type === 'boolean') {
      return 'checkbox';
    }

    if (type === 'array') {
      // 所有数组类型统一使用 ArrayFieldWidget 处理
      // ArrayFieldWidget 内部会根据 items.enum 自动判断渲染模式（static/dynamic）
      return 'array';
    }

    if (type === 'object') {
      return 'nested-form';
    }

    return 'text';
  }

  /**
   * 获取验证规则
   */
  static getValidationRules(
    schema: ExtendedJSONSchema,
    required: boolean = false
  ): ValidationRules {
    const rules: ValidationRules = {};
    const errorMessages = schema.ui?.errorMessages || {};

    if (required) {
      rules.required = errorMessages.required || '此字段为必填项';
    }

    if (schema.minLength) {
      // react-hook-form 的 minLength 规则默认不会对空值进行校验，
      // 这里使用自定义 validate 规则，确保空值也会触发 minLength 校验
      rules.validate = rules.validate || {};
      rules.validate.minLength = (value: any) => {
        if (value === null || value === undefined) {
          return errorMessages.minLength || `最小长度为 ${schema.minLength} 个字符`;
        }
        const strValue = String(value);
        if (strValue.length < schema.minLength!) {
          return errorMessages.minLength || `最小长度为 ${schema.minLength} 个字符`;
        }
        return true;
      };
    }

    if (schema.maxLength) {
      rules.maxLength = {
        value: schema.maxLength,
        message: errorMessages.maxLength || `最大长度为 ${schema.maxLength} 个字符`,
      };
    }

    if (schema.minimum !== undefined) {
      rules.min = {
        value: schema.minimum,
        message: errorMessages.min || `最小值为 ${schema.minimum}`,
      };
    }

    if (schema.maximum !== undefined) {
      rules.max = {
        value: schema.maximum,
        message: errorMessages.max || `最大值为 ${schema.maximum}`,
      };
    }

    if (schema.pattern) {
      rules.pattern = {
        value: new RegExp(schema.pattern),
        message: errorMessages.pattern || '格式不正确',
      };
    }

    // 处理 format 验证
    if (schema.format) {
      // 优先使用自定义格式验证器
      if (this.customFormats[schema.format]) {
        const formatName = schema.format;
        rules.validate = rules.validate || {};
        rules.validate[formatName] = (value: string) => {
          if (!value) return true; // 空值由 required 规则处理
          const isValid = this.customFormats[formatName](value);
          return isValid || errorMessages.format || `${formatName} 格式不正确`;
        };
      } else if (schema.format === 'email') {
        // 内置邮箱格式验证
        rules.pattern = {
          value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
          message: errorMessages.format || '请输入有效的邮箱地址',
        };
      }
    }

    return rules;
  }

  /**
   * 获取选项列表
   */
  private static getOptions(schema: ExtendedJSONSchema): FieldOption[] | undefined {
    if (!schema.enum) return undefined;

    const enumNames = schema.enumNames || schema.enum;

    return schema.enum.map((value, index) => ({
      label: String(enumNames[index]),
      value,
    }));
  }
}
```

### 6.6 实际类型定义

以下是实际代码中使用的类型定义（`src/types/schema.ts`）：

```typescript
/**
 * 字段配置
 */
export interface FieldConfig {
  name: string;
  type: string;
  widget: WidgetType;
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
  dependencies?: any; // JSON Schema dependencies（保留原始格式）
  schema?: ExtendedJSONSchema; // 保留完整的 schema（包含 ui 配置），用于嵌套表单和布局配置
}
```

> **注意**：
>
> - `schema` 字段保留了完整的 ExtendedJSONSchema，包括 `ui` 配置（如 layout、labelWidth 等）
> - 这使得 FormField 组件可以访问字段级别的布局配置，实现布局优先级覆盖
> - UI 联动配置（如 linkage）在 schema 的 `ui` 字段中定义，不在 FieldConfig 中
> - JSON Schema 的条件验证（if/then/else、allOf/anyOf/oneOf）由 react-hook-form 和 JSON Schema 验证器处理
> - 完整的 UI 联动设计和实现请参考：[UI 联动设计文档](./UI_LINKAGE_DESIGN.md)

---

**下一部分**: 代码实现示例
