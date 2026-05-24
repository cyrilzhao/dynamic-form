import type { ExtendedJSONSchema } from '../types/schema';

/**
 * 从 JSON Schema 中递归提取所有字段的 default 值
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
export function extractSchemaDefaults(schema: ExtendedJSONSchema): Record<string, any> {
  const defaults: Record<string, any> = {};

  if (!schema || schema.type !== 'object' || !schema.properties) {
    return defaults;
  }

  Object.entries(schema.properties).forEach(([key, propSchema]) => {
    const fieldSchema = propSchema as ExtendedJSONSchema;

    // 情况1：字段有直接的 default 值
    if (fieldSchema.default !== undefined) {
      defaults[key] = fieldSchema.default;
      return;
    }

    // 情况2：嵌套对象，递归提取
    if (fieldSchema.type === 'object' && fieldSchema.properties) {
      const nestedDefaults = extractSchemaDefaults(fieldSchema);
      if (Object.keys(nestedDefaults).length > 0) {
        defaults[key] = nestedDefaults;
      }
    }

    // 注意：数组类型的 default 由 ArrayFieldWidget 在添加新元素时处理
    // 这里不处理数组的默认值，因为数组初始通常为空
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
  userDefaults: Record<string, any>
): Record<string, any> {
  const result = { ...schemaDefaults };

  Object.entries(userDefaults).forEach(([key, value]) => {
    // 如果两边都是普通对象，递归合并
    if (
      isPlainObject(result[key]) &&
      isPlainObject(value)
    ) {
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
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
