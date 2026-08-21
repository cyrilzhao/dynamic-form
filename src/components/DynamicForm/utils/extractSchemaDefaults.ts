import type { ExtendedJSONSchema } from "../types/schema";

/**
 * 从 JSON Schema 中递归提取字段的 default 值。
 *
 * object 节点的 default 会作为当前层的显式覆盖，并递归补齐缺失的
 * object 子字段默认值；array 节点的 default 始终作为整体快照保留，
 * 不会根据 items 默认值自动生成或补齐数组元素。
 *
 * 此函数遍历 schema 的 properties，收集所有设置了 default 的字段值，
 * 并构建一个与 schema 结构匹配的默认值对象。
 *
 * @param schema - 要提取默认值的 schema
 * @returns 包含所有默认值的对象
 *
 * @example
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     username: { type: 'string', default: 'guest' },
 *     settings: {
 *       type: 'object',
 *       properties: {
 *         theme: { type: 'string', default: 'dark' }
 *       }
 *     }
 *   }
 * };
 * extractSchemaDefaults(schema); // { username: 'guest', settings: { theme: 'dark' } }
 */
export function extractSchemaDefaults(
  schema: ExtendedJSONSchema,
): Record<string, any> {
  const defaults: Record<string, any> = {};

  if (!schema || schema.type !== "object" || !schema.properties) {
    return defaults;
  }

  Object.entries(schema.properties).forEach(([key, propSchema]) => {
    const fieldSchema = propSchema as ExtendedJSONSchema;

    // 情况1：字段有直接的 default 值
    if (fieldSchema.default !== undefined) {
      // object default 作为当前层的显式覆盖：补齐未声明的 object 子字段，
      // 但不递归进入数组 items，避免按数组索引隐式生成元素或修改数组元素快照。
      if (
        fieldSchema.type === "object" &&
        isPlainObject(fieldSchema.default) &&
        fieldSchema.properties
      ) {
        const nestedDefaults = extractSchemaDefaults(fieldSchema);
        defaults[key] = mergeDefaults(nestedDefaults, fieldSchema.default);
      } else {
        defaults[key] = fieldSchema.default;
      }
      return;
    }

    // 情况2：嵌套对象，递归提取
    if (fieldSchema.type === "object" && fieldSchema.properties) {
      const nestedDefaults = extractSchemaDefaults(fieldSchema);
      if (Object.keys(nestedDefaults).length > 0) {
        defaults[key] = nestedDefaults;
      }
    }

    // 没有直接 default 的数组不从 items 推导默认值；数组元素默认值在
    // 用户新增元素时由 ArrayFieldWidget 根据 items schema 处理。
  });

  return defaults;
}

/**
 * 深度合并两个对象
 *
 * 用户提供的 defaultValues 优先级高于 schema 中的 default 值。
 * 这样用户可以覆盖 schema 中定义的默认值。
 *
 * @param schemaDefaults - 从 schema 提取的默认值
 * @param userDefaults - 用户提供的默认值（优先级更高）
 * @returns 合并后的默认值对象
 */
export function mergeDefaults(
  schemaDefaults: Record<string, any>,
  userDefaults: Record<string, any>,
): Record<string, any> {
  const result = { ...schemaDefaults };

  Object.entries(userDefaults).forEach(([key, value]) => {
    // 如果两边都是普通对象，递归合并
    if (isPlainObject(result[key]) && isPlainObject(value)) {
      result[key] = mergeDefaults(result[key], value);
    } else {
      // 否则用户值覆盖 schema 默认值
      result[key] = value;
    }
  });

  return result;
}

/**
 * 判断值是否为普通对象（非数组、非 null）
 */
function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
