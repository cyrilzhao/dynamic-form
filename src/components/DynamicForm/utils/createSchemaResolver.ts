import type { Resolver, FieldErrors } from "react-hook-form";
import type { RefObject } from "react";
import { SchemaValidator } from "../core/SchemaValidator";
import { runAllFieldValidators } from "./runFieldValidators";
import { mergeSchemaWithLinkage } from "./mergeSchemaWithLinkage";
import type { ExtendedJSONSchema } from "../types/schema";

/**
 * 将扁平路径（如 "arr[0].name"）写入嵌套错误对象
 */
function setError(
  errors: Record<string, any>,
  path: string,
  value: { type: string; message: string },
): void {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current = errors;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];
    if (!current[key]) {
      current[key] = /^\d+$/.test(nextKey) ? [] : {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * 从 schema 中查找指定路径的字段 schema（跳过数字索引段）
 */
function getFieldSchema(
  path: string,
  schema: ExtendedJSONSchema,
): ExtendedJSONSchema | null {
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((p) => !/^\d+$/.test(p));
  let current: ExtendedJSONSchema = schema;
  for (const part of parts) {
    if (typeof current === "boolean") {
      return null;
    }
    const next =
      current.properties?.[part] ?? (current.items as any)?.properties?.[part];
    if (!next || typeof next === "boolean") {
      return null;
    }
    current = next as ExtendedJSONSchema;
  }
  return current;
}

/**
 * 检查字段是否因联动或 schema 静态配置被隐藏或禁用（需跳过校验）
 */
function isHiddenOrDisabled(
  fieldPath: string,
  linkageStates: Record<string, { visible?: boolean; disabled?: boolean }>,
  schema: ExtendedJSONSchema,
): boolean {
  // 检查字段自身：联动状态
  const state = linkageStates[fieldPath];
  if (state?.visible === false || state?.disabled === true) {
    return true;
  }

  // 检查字段自身：schema 静态配置
  const fieldSchema = getFieldSchema(fieldPath, schema);
  if (fieldSchema?.ui?.hidden === true || fieldSchema?.ui?.disabled === true) {
    return true;
  }

  // 检查父级路径（处理嵌套字段）
  const normalized = fieldPath.replace(/\[(\d+)\]/g, ".$1");
  const parts = normalized.split(".");
  for (let i = 1; i < parts.length; i++) {
    const parentNormalized = parts.slice(0, i).join(".");
    const parentOriginal = parentNormalized.replace(/\.(\d+)/g, "[$1]");

    const parentLinkageState =
      linkageStates[parentOriginal] ?? linkageStates[parentNormalized];
    if (
      parentLinkageState?.visible === false ||
      parentLinkageState?.disabled === true
    ) {
      return true;
    }

    const parentFieldSchema = getFieldSchema(parentOriginal, schema);
    if (
      parentFieldSchema?.ui?.hidden === true ||
      parentFieldSchema?.ui?.disabled === true
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 创建基于 JSON Schema 的表单验证 resolver
 * 用于集成 SchemaValidator 到 react-hook-form 的验证流程
 */
export function createSchemaResolver(
  schema: ExtendedJSONSchema,
  callbacks: Record<string, (...args: any[]) => any> = {},
  linkageStatesRef?: RefObject<
    Record<
      string,
      {
        visible?: boolean;
        disabled?: boolean;
        schema?: Partial<ExtendedJSONSchema>;
      }
    >
  >,
  helpersRef?: RefObject<Record<string, any>>,
): Resolver {
  return async (values) => {
    const linkageStates = linkageStatesRef?.current ?? {};
    const helpers = helpersRef?.current ?? {};

    // 构建应用了 schema 联动的动态 schema
    let effectiveSchema = schema;

    // 如果有 schema 联动，需要构建合并后的 schema
    const hasSchemaLinkage = Object.values(linkageStates).some(
      (state) => state.schema,
    );

    if (hasSchemaLinkage && schema.properties) {
      // 深拷贝 schema，避免修改原始 schema
      effectiveSchema = {
        ...schema,
        properties: { ...schema.properties },
      };

      // 对每个字段应用 schema 联动
      for (const [fieldName, fieldSchema] of Object.entries(
        schema.properties,
      )) {
        const linkageState = linkageStates[fieldName];
        if (linkageState?.schema) {
          // 合并原始 schema 和联动 schema
          effectiveSchema.properties![fieldName] = mergeSchemaWithLinkage(
            fieldSchema as ExtendedJSONSchema,
            linkageState.schema,
          );
        }
      }
    }

    // 使用合并后的 schema 进行验证
    const validator = new SchemaValidator(effectiveSchema);
    const schemaErrors = validator.validate(values);
    const fieldValidatorErrors = await runAllFieldValidators(
      values,
      schema,
      callbacks,
      helpers,
    );
    const errors = { ...schemaErrors, ...fieldValidatorErrors };

    if (Object.keys(errors).length === 0) {
      return { values, errors: {} };
    }

    const fieldErrors: FieldErrors = {};
    for (const [field, message] of Object.entries(errors)) {
      if (isHiddenOrDisabled(field, linkageStates, schema)) {
        continue;
      }
      setError(fieldErrors, field, { type: "validation", message });
    }

    return Object.keys(fieldErrors).length === 0
      ? { values, errors: {} }
      : { values: {}, errors: fieldErrors };
  };
}
