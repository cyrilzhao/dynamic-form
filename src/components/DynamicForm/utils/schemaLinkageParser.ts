import type { ExtendedJSONSchema, LinkageConfig } from '../types/schema';
import { resolveRelativePath } from './pathTransformer';

/**
 * 解析结果
 *
 * 新方案（v3.0）：
 * - 移除 PathMapping，不再需要路径映射
 * - 移除 hasFlattenPath，不再需要检测
 *
 * v3.1 更新：
 * - 支持多联动类型：linkages 的值类型为 LinkageConfig[]
 * - 移除单个 linkage 配置的支持
 */
export interface ParsedLinkages {
  /** 联动配置（使用标准路径作为 key，值为联动配置数组） */
  linkages: Record<string, LinkageConfig[]>;
}

/**
 * 解析 Schema 中的联动配置
 *
 * 新方案（v3.0）：
 * - 使用标准的 . 分隔符
 * - 移除 PathMapping 逻辑
 *
 * v3.1 更新：
 * - 支持多联动类型：只解析 linkages 数组配置
 * - 移除单个 linkage 配置的支持
 *
 * 分层计算策略：
 * - 解析所有字段的联动配置，但在遇到数组字段时停止递归
 * - 数组字段本身的联动会被收集，但数组元素内部的字段不会被解析
 * - 数组元素内部的联动由 NestedFormWidget 创建的子 DynamicForm 独立解析
 * - 这样每层 DynamicForm 只负责自己这一层的联动，实现真正的分层计算
 *
 * @param schema - JSON Schema
 */
export function parseSchemaLinkages(schema: ExtendedJSONSchema): ParsedLinkages {
  const linkages: Record<string, LinkageConfig[]> = {};

  // 递归解析 schema，收集所有联动配置
  parseSchemaRecursive(schema, '', linkages);

  // if (process.env.NODE_ENV !== 'production') {
  //   console.log(
  //     '[parseSchemaLinkages] 解析完成:',
  //     JSON.stringify({
  //       linkagesCount: Object.keys(linkages).length,
  //     })
  //   );
  // }

  return { linkages };
}

/**
 * 递归解析 schema，收集联动配置
 *
 * 新方案（v3.0）：
 * - 使用标准的 . 分隔符
 * - 移除路径映射逻辑
 *
 * v3.1 更新：
 * - 支持多联动类型：只解析 linkages 数组配置
 *
 * @param schema - 当前 schema
 * @param parentPath - 父路径
 * @param linkages - 收集的联动配置（数组格式）
 */
function parseSchemaRecursive(
  schema: ExtendedJSONSchema,
  parentPath: string,
  linkages: Record<string, LinkageConfig[]>
): void {
  if (!schema.properties) {
    return;
  }

  // if (process.env.NODE_ENV !== 'production') {
  //   console.log(
  //     '[parseSchemaRecursive] 开始解析:',
  //     JSON.stringify({
  //       parentPath,
  //       properties: Object.keys(schema.properties),
  //     })
  //   );
  // }

  // 遍历所有字段
  Object.entries(schema.properties).forEach(([fieldName, fieldSchema]) => {
    if (typeof fieldSchema === 'boolean') return;

    const typedSchema = fieldSchema as ExtendedJSONSchema;

    // 使用标准的 . 分隔符构建字段路径
    const currentPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;

    // if (process.env.NODE_ENV !== 'production') {
    //   console.log(
    //     '[parseSchemaRecursive] 处理字段:',
    //     JSON.stringify({
    //       fieldName,
    //       type: typedSchema.type,
    //       currentPath,
    //       hasLinkages: !!typedSchema.ui?.linkages,
    //     })
    //   );
    // }

    // 收集当前字段的联动配置（只支持 linkages 数组）
    const linkagesArray = typedSchema.ui?.linkages;

    if (linkagesArray && Array.isArray(linkagesArray) && linkagesArray.length > 0) {
      // if (process.env.NODE_ENV !== 'production') {
      //   console.log(
      //     '[parseSchemaRecursive] 找到联动配置:',
      //     JSON.stringify({
      //       currentPath,
      //       linkagesCount: linkagesArray.length,
      //     })
      //   );
      // }
      linkages[currentPath] = linkagesArray;
    }

    // 不递归处理嵌套对象，避免父级 DynamicForm 重复解析子级字段的联动
    // 嵌套对象内部的联动由 NestedFormWidget 创建的子 DynamicForm 独立解析

    // 数组字段：停止递归，不解析数组元素内部的字段
    // 数组元素内部的联动由 NestedFormWidget 创建的子 DynamicForm 独立解析
    // if (typedSchema.type === 'array' && typedSchema.items) {
    //   if (process.env.NODE_ENV !== 'production') {
    //     console.log(
    //       '[parseSchemaRecursive] 遇到数组字段，停止递归:',
    //       JSON.stringify({
    //         fieldName,
    //         currentPath,
    //       })
    //     );
    //   }
    // }
  });
}

/**
 * 将联动配置的字段路径转换为绝对路径
 *
 * 新方案（v3.0）：使用标准的 . 分隔符
 *
 * v3.1 更新：支持数组格式的联动配置
 *
 * @param linkages - 原始联动配置（相对路径，数组格式）
 * @param pathPrefix - 路径前缀（如 'contacts.0'）
 * @returns 转换后的联动配置（绝对路径，数组格式）
 *
 * @example
 * // 输入：{ 'companyName': [{...}], 'department': [{...}] }
 * // pathPrefix: 'contacts.0'
 * // 输出：{ 'contacts.0.companyName': [{...}], 'contacts.0.department': [{...}] }
 */
export function transformToAbsolutePaths(
  linkages: Record<string, LinkageConfig[]>,
  pathPrefix: string
): Record<string, LinkageConfig[]> {
  if (!pathPrefix) {
    return linkages;
  }

  const result: Record<string, LinkageConfig[]> = {};

  Object.entries(linkages).forEach(([fieldPath, linkageArray]) => {
    // 使用标准的 . 分隔符构建绝对路径
    const absolutePath = fieldPath ? `${pathPrefix}.${fieldPath}` : pathPrefix;

    // 转换数组中每个联动配置内部的路径引用
    const transformedLinkages = linkageArray.map(linkage =>
      transformLinkageConfigPaths(linkage, pathPrefix, absolutePath)
    );

    result[absolutePath] = transformedLinkages;
  });

  return result;
}

/**
 * 转换联动配置内部的路径引用
 * @param linkage - 原始联动配置
 * @param pathPrefix - 路径前缀
 * @param fieldPath - 当前字段的完整路径（用于相对路径解析）
 * @returns 转换后的联动配置
 */
function transformLinkageConfigPaths(
  linkage: LinkageConfig,
  pathPrefix: string,
  fieldPath: string
): LinkageConfig {
  const result = { ...linkage };

  // 转换 dependencies 中的相对路径
  if (result.dependencies) {
    result.dependencies = result.dependencies.map(dep => {
      if (dep.startsWith('./')) {
        // 相对路径：使用统一的 resolveRelativePath 函数
        console.log(
          '[transformLinkageConfigPaths] 处理相对路径:',
          JSON.stringify({
            dep,
            fieldPath,
          })
        );

        const resolvedPath = resolveRelativePath(dep, fieldPath);

        console.log(
          '[transformLinkageConfigPaths] 相对路径解析结果:',
          JSON.stringify({
            resolvedPath,
          })
        );

        return resolvedPath;
      }
      // 绝对路径（JSON Pointer）保持不变
      return dep;
    });
  }

  // 转换 when 条件中的路径
  if (result.when && typeof result.when === 'object') {
    result.when = transformConditionPaths(result.when, pathPrefix, fieldPath);
  }

  return result;
}

/**
 * 递归转换条件表达式中的路径
 */
function transformConditionPaths(condition: any, pathPrefix: string, fieldPath: string): any {
  const result = { ...condition };

  // 转换 field 字段
  if (result.field && typeof result.field === 'string') {
    if (result.field.startsWith('./')) {
      // 相对路径：使用统一的 resolveRelativePath 函数
      console.log(
        '[transformConditionPaths] 处理相对路径:',
        JSON.stringify({
          originalField: result.field,
          fieldPath,
        })
      );

      result.field = resolveRelativePath(result.field, fieldPath);

      console.log(
        '[transformConditionPaths] 相对路径解析结果:',
        JSON.stringify({
          resolvedField: result.field,
        })
      );
    }
    // 绝对路径（JSON Pointer）保持不变
  }

  // 递归处理 and/or
  if (result.and && Array.isArray(result.and)) {
    result.and = result.and.map((c: any) => transformConditionPaths(c, pathPrefix, fieldPath));
  }
  if (result.or && Array.isArray(result.or)) {
    result.or = result.or.map((c: any) => transformConditionPaths(c, pathPrefix, fieldPath));
  }

  return result;
}
