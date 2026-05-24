import type { ExtendedJSONSchema } from '../types/schema';

/**
 * 根据 schema 递归过滤数据，只保留 schema 中定义的字段
 *
 * 这个函数用于在表单提交或获取值时，过滤掉不在当前 schema 中定义的字段。
 * 特别适用于动态表单场景，当 schemaKey 切换时，可以保留所有历史数据，
 * 但在提交时只提取当前 schema 需要的字段。
 *
 * @param value - 要过滤的数据
 * @param schema - JSON Schema 定义
 * @returns 过滤后的数据
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'number' }
 *   }
 * };
 *
 * const dirtyData = {
 *   name: 'John',
 *   age: 30,
 *   extraField: 'should be removed'
 * };
 *
 * const cleanData = filterValueBySchema(dirtyData, schema);
 * // 结果: { name: 'John', age: 30 }
 * ```
 */
export function filterValueBySchema(value: any, schema: ExtendedJSONSchema): any {
  // 处理 null 或 undefined
  if (value === null || value === undefined) {
    return value;
  }

  // 处理数组类型
  if (schema.type === 'array' && Array.isArray(value)) {
    if (!schema.items) {
      return value;
    }

    // 递归过滤数组中的每个元素
    return value.map(item => filterValueBySchema(item, schema.items as ExtendedJSONSchema));
  }

  // 处理对象类型
  if (schema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
    if (!schema.properties) {
      return value;
    }

    const filtered: Record<string, any> = {};
    const validKeys = Object.keys(schema.properties);

    for (const key of validKeys) {
      if (key in value) {
        const fieldSchema = schema.properties[key];
        // 递归处理嵌套字段
        filtered[key] = filterValueBySchema(value[key], fieldSchema);
      }
    }

    return filtered;
  }

  // 基本类型直接返回
  return value;
}
