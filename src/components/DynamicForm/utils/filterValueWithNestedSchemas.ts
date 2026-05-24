import type { ExtendedJSONSchema } from '../types/schema';

/**
 * 使用嵌套 schema 注册表过滤数据
 *
 * 这个函数会递归遍历数据，对于每个嵌套对象字段：
 * 1. 如果该字段在 nestedSchemas 中有注册的 schema，使用注册的 schema 过滤
 * 2. 否则使用原始 schema 中的定义过滤
 *
 * @param value - 要过滤的数据
 * @param schema - 顶层 schema
 * @param nestedSchemas - 嵌套字段的 schema 注册表 (字段路径 -> schema)
 * @param currentPath - 当前字段路径（用于递归）
 */
export function filterValueWithNestedSchemas(
  value: any,
  schema: ExtendedJSONSchema,
  nestedSchemas: Map<string, ExtendedJSONSchema>,
  currentPath: string = ''
): any {
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
    return value.map((item, index) => {
      const itemPath = currentPath ? `${currentPath}.${index}` : `${index}`;
      return filterValueWithNestedSchemas(
        item,
        schema.items as ExtendedJSONSchema,
        nestedSchemas,
        itemPath
      );
    });
  }

  // 处理对象类型
  if (schema.type === 'object' && typeof value === 'object' && !Array.isArray(value)) {
    if (!schema.properties) {
      return value;
    }

    const filtered: Record<string, any> = {};
    const validKeys = Object.keys(schema.properties);

    for (const key of validKeys) {
      const fieldPath = currentPath ? `${currentPath}.${key}` : key;
      const fieldSchema = schema.properties[key];

      // 检查是否有注册的嵌套 schema
      const registeredSchema = nestedSchemas.get(fieldPath);

      if (registeredSchema) {
        // 使用注册的 schema 过滤（这是动态嵌套表单的当前 schema）
        if (key in value) {
          filtered[key] = filterValueWithNestedSchemas(
            value[key],
            registeredSchema,
            nestedSchemas,
            fieldPath
          );
        }
      } else if (fieldSchema.type === 'object') {
        // 对象字段
        // 注意：即使字段使用了 flattenPath，传入的数据也已经被 PathTransformer 转换成嵌套结构了
        // 所以这里统一按照嵌套对象处理即可
        if (key in value) {
          filtered[key] = filterValueWithNestedSchemas(
            value[key],
            fieldSchema,
            nestedSchemas,
            fieldPath
          );
        }
      } else if (fieldSchema.type === 'array' && key in value) {
        // 数组字段：递归处理
        filtered[key] = filterValueWithNestedSchemas(
          value[key],
          fieldSchema,
          nestedSchemas,
          fieldPath
        );
      } else if (key in value) {
        // 基本类型直接返回
        filtered[key] = value[key];
      }
    }

    return filtered;
  }

  // 基本类型直接返回
  return value;
}
