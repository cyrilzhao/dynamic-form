import type {
  ExtendedJSONSchema,
  FieldConfig,
  ValidationRules,
  FieldOption,
} from "../types/schema";

/**
 * Schema 解析配置
 */
interface ParseOptions {
  parentPath?: string;
  prefixLabel?: string;
  inheritedUI?: {
    layout?: "vertical" | "horizontal" | "inline";
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
   * 检查 schema 中是否使用了路径扁平化
   */
  static hasFlattenPath(schema: ExtendedJSONSchema): boolean {
    if (schema.type !== "object" || !schema.properties) {
      return false;
    }

    const properties = schema.properties;

    for (const key of Object.keys(properties)) {
      const property = properties[key];
      if (!property || typeof property === "boolean") {
        continue;
      }

      const fieldSchema = property as ExtendedJSONSchema;

      // 如果当前字段使用了 flattenPath
      if (fieldSchema.type === "object" && fieldSchema.ui?.flattenPath) {
        return true;
      }

      // 递归检查子字段
      if (fieldSchema.type === "object" && this.hasFlattenPath(fieldSchema)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 解析 Schema 生成字段配置（支持路径透明化）
   *
   * 新方案（v3.0）：
   * - 使用标准的 . 分隔符构建字段路径
   * - flattenPath 字段会渲染 NestedFormWidget，但使用透明容器
   * - 数据保持标准的嵌套格式，无需路径转换
   */
  static parse(
    schema: ExtendedJSONSchema,
    options: ParseOptions = {},
  ): FieldConfig[] {
    const { parentPath = "", prefixLabel = "", inheritedUI } = options;
    const fields: FieldConfig[] = [];

    if (schema.type !== "object" || !schema.properties) {
      return fields;
    }

    const properties = schema.properties;
    const required = schema.required || [];
    const order = schema.ui?.order || Object.keys(properties);

    for (const key of order) {
      const property = properties[key];
      if (!property || typeof property === "boolean") {
        continue;
      }

      const fieldSchema = property as ExtendedJSONSchema;

      // 使用标准的 . 分隔符构建字段路径
      const currentPath = parentPath ? `${parentPath}.${key}` : key;

      // 处理 flattenPrefix：如果字段设置了 flattenPrefix，添加标签前缀
      const newPrefixLabel =
        fieldSchema.ui?.flattenPrefix && fieldSchema.title
          ? prefixLabel
            ? `${prefixLabel} - ${fieldSchema.title}`
            : fieldSchema.title
          : prefixLabel;

      // 处理 UI 配置继承（用于 flattenPath 场景）
      const newInheritedUI = {
        layout: fieldSchema.ui?.layout ?? inheritedUI?.layout,
        labelWidth: fieldSchema.ui?.labelWidth ?? inheritedUI?.labelWidth,
      };

      // 正常解析字段（包括 flattenPath 字段）
      const fieldConfig = this.parseField(
        currentPath,
        fieldSchema,
        required.includes(key),
        newPrefixLabel,
        newInheritedUI,
      );

      if (!fieldConfig.hidden) {
        fields.push(fieldConfig);
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
    prefixLabel: string,
    inheritedUI: ParseOptions["inheritedUI"],
  ): FieldConfig {
    const ui = schema.ui || {};

    // 如果有前缀标签，添加到字段标签前
    const label =
      prefixLabel && schema.title
        ? `${prefixLabel} - ${schema.title}`
        : schema.title;

    // 合并继承的 UI 配置到 schema 中
    const finalSchema: ExtendedJSONSchema = {
      ...schema,
      ui: {
        ...ui,
        // 只有当字段自己没有配置时，才使用继承的配置
        // 注意：inheritedUI 总是由 parse 方法传递一个对象，不会是 undefined
        layout: ui.layout ?? inheritedUI?.layout,
        labelWidth: ui.labelWidth ?? inheritedUI?.labelWidth,
        // 保存 prefixLabel，供 NestedFormWidget 使用
        prefixLabel: prefixLabel || undefined,
      },
    };

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
  private static getWidget(schema: ExtendedJSONSchema): string {
    if (schema.ui?.widget) {
      return schema.ui.widget;
    }

    const type = schema.type;

    if (type === "string") {
      if (schema.format === "email") {
        return "email";
      }
      if (schema.format === "date") {
        return "date";
      }
      if (schema.format === "date-time") {
        return "datetime";
      }
      if (schema.format === "time") {
        return "time";
      }
      if (schema.enum) {
        return "select";
      }
      if (schema.maxLength && schema.maxLength > 100) {
        return "textarea";
      }
      return "text";
    }

    if (type === "number" || type === "integer") {
      return "number";
    }

    if (type === "boolean") {
      return "checkbox";
    }

    if (type === "array") {
      // 所有数组类型统一使用 ArrayFieldWidget 处理
      // ArrayFieldWidget 内部会根据 items.enum 自动判断渲染模式（static/dynamic）
      return "array";
    }

    if (type === "object") {
      return "nested-form";
    }

    return "text";
  }

  /**
   * 获取验证规则
   */
  static getValidationRules(
    schema: ExtendedJSONSchema,
    required: boolean = false,
  ): ValidationRules {
    const rules: ValidationRules = {};
    const errorMessages = schema.ui?.errorMessages || {};

    if (required) {
      // 使用自定义验证函数替代内置 required 规则
      // 避免 false 值被误判为空值
      rules.validate = rules.validate || {};
      rules.validate.required = (value: any) => {
        // 严格检查：只有 null、undefined 和空字符串才算空值
        if (value === null || value === undefined) {
          return errorMessages.required || "This field is required";
        }
        if (typeof value === "string" && value.trim() === "") {
          return errorMessages.required || "This field is required";
        }
        if (Array.isArray(value) && value.length === 0) {
          return errorMessages.required || "This field is required";
        }
        return true;
      };
    }

    if (schema.minLength) {
      // react-hook-form 的 minLength 规则默认不会对空值进行校验
      // 空值应该由 required 规则处理，这里只验证非空值的长度
      rules.validate = rules.validate || {};
      rules.validate.minLength = (value: any) => {
        // 空值不进行 minLength 校验，由 required 规则处理
        if (value === null || value === undefined || value === "") {
          return true;
        }
        const strValue = String(value);
        if (strValue.length < schema.minLength!) {
          return (
            errorMessages.minLength ||
            `Minimum length is ${schema.minLength} characters`
          );
        }
        return true;
      };
    }

    if (schema.maxLength) {
      rules.maxLength = {
        value: schema.maxLength,
        message:
          errorMessages.maxLength ||
          `Maximum length is ${schema.maxLength} characters`,
      };
    }

    if (schema.minimum !== undefined) {
      rules.min = {
        value: schema.minimum,
        message: errorMessages.min || `Minimum value is ${schema.minimum}`,
      };
    }

    if (schema.maximum !== undefined) {
      rules.max = {
        value: schema.maximum,
        message: errorMessages.max || `Maximum value is ${schema.maximum}`,
      };
    }

    if (schema.pattern) {
      rules.pattern = {
        value: new RegExp(schema.pattern),
        message: errorMessages.pattern || "Invalid format",
      };
    }

    // 处理 format 验证
    if (schema.format) {
      // 优先使用自定义格式验证器
      if (this.customFormats[schema.format]) {
        const formatName = schema.format;
        rules.validate = rules.validate || {};
        rules.validate[formatName] = (value: string) => {
          // 空值由 required 规则处理，严格检查 null/undefined/空字符串
          if (value === null || value === undefined || value === "") {
            return true;
          }
          const isValid = this.customFormats[formatName](value);
          return (
            isValid || errorMessages.format || `Invalid ${formatName} format`
          );
        };
      } else if (schema.format === "email") {
        // 内置邮箱格式验证
        rules.pattern = {
          value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
          message: errorMessages.format || "Please enter a valid email address",
        };
      }
    }

    return rules;
  }

  /**
   * 获取选项列表
   */
  private static getOptions(
    schema: ExtendedJSONSchema,
  ): FieldOption[] | undefined {
    // 如果有 enum，使用 enum 生成选项
    if (schema.enum) {
      const enumNames = schema.enumNames || schema.enum;
      return schema.enum.map((value, index) => ({
        label: String(enumNames[index]),
        value,
      }));
    }

    // 特殊处理：boolean 类型使用 radio/checkbox widget 时，如果没有配置 enum，自动生成默认选项
    // 用户可以通过配置 enum 和 enumNames 来自定义选项文本，例如：
    // { type: 'boolean', enum: [true, false], enumNames: ['Enable', 'Disable'], ui: { widget: 'radio' } }
    if (
      schema.type === "boolean" &&
      (schema.ui?.widget === "radio" || schema.ui?.widget === "checkbox")
    ) {
      return [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ];
    }

    return undefined;
  }
}
