import type { ExtendedJSONSchema } from "../types/schema";

/**
 * 合并原始 schema 和联动 schema
 *
 * 用于统一处理所有字段类型的 schema 联动，支持：
 * - 动态改变校验规则（pattern, format, min/max, enum 等）
 * - 动态改变 UI 配置（widget, placeholder, errorMessages 等）
 * - 动态改变元信息（title, description）
 *
 * 合并策略：
 * 1. 校验属性：联动覆盖原始
 * 2. ui 配置：浅层合并，联动覆盖原始的同名属性，但保留原始的 ui.linkages
 * 3. title, description：联动覆盖原始
 * 4. type：保持原始（不允许动态改变类型）
 * 5. properties（仅 object 类型）：联动完全替换
 */
export function mergeSchemaWithLinkage(
  originalSchema: ExtendedJSONSchema,
  linkageSchema: Partial<ExtendedJSONSchema>,
): ExtendedJSONSchema {
  // 校验相关的属性列表
  const validationProps = [
    "pattern",
    "format",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "enum",
    "enumNames",
    "const",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minProperties",
    "maxProperties",
    "required",
    "allOf",
    "anyOf",
    "oneOf",
    "not",
    "if",
    "then",
    "else",
    "dependencies",
  ];

  const merged: ExtendedJSONSchema = { ...originalSchema };

  // 1. 覆盖校验属性
  validationProps.forEach((prop) => {
    if (prop in linkageSchema) {
      // 使用类型断言确保类型安全
      (merged as Record<string, unknown>)[prop] = (
        linkageSchema as Record<string, unknown>
      )[prop];
    }
  });

  // 2. 覆盖 title, description
  if (linkageSchema.title !== undefined) {
    merged.title = linkageSchema.title;
  }
  if (linkageSchema.description !== undefined) {
    merged.description = linkageSchema.description;
  }

  // 3. 合并 ui 配置（保留原始的 linkages）
  if (linkageSchema.ui) {
    const originalLinkages = originalSchema.ui?.linkages;
    merged.ui = {
      ...originalSchema.ui,
      ...linkageSchema.ui,
      // 保持原始的 linkages 配置
      linkages: originalLinkages,
    };
  }

  // 4. 对于 object 类型，替换 properties
  if (originalSchema.type === "object" && linkageSchema.properties) {
    merged.properties = linkageSchema.properties;
  }

  return merged;
}
