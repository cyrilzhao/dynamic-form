import type { Resolver, FieldErrors } from "react-hook-form";
import type { RefObject } from "react";
import { SchemaValidator } from "../core/SchemaValidator";
import { runAllFieldValidators } from "./runFieldValidators";
import { mergeSchemaWithLinkage } from "./mergeSchemaWithLinkage";
import type { ExtendedJSONSchema } from "../types/schema";
import {
  buildVariantSchema,
  detectVariantSync,
  fallbackVariant,
} from "./resolveVariant";
import type { FieldVariantStore } from "../context/FieldVariantContext";

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
  // 按表单实例传入，避免多个表单共享可变的全局 format 配置。
  customFormats: Record<string, (value: string) => boolean> = {},
  variantStore?: FieldVariantStore,
): Resolver {
  const resolveVariant = (
    fieldSchema: ExtendedJSONSchema,
    value: unknown,
    path = "",
  ) => {
    const variants = fieldSchema.ui?.variants;
    if (!variants?.length) return null;
    const activeName = variantStore?.getActive(path);
    console.info("[VariantDebug] resolver", {
      path,
      value: JSON.stringify(value),
      activeName,
      variants: variants.map((variant) => variant.name),
    });
    return (
      variants.find((variant) => variant.name === activeName) ||
      detectVariantSync({
        variants,
        value,
        formData: {},
        context: { fieldPath: path },
        callbacks,
        helpers: helpersRef?.current || {},
      }) ||
      fallbackVariant(fieldSchema, value) ||
      null
    );
  };
  const applyVariants = (
    current: ExtendedJSONSchema,
    value: unknown,
    path = "",
  ): ExtendedJSONSchema => {
    const variant = resolveVariant(current, value, path);
    const effective: ExtendedJSONSchema = variant
      ? buildVariantSchema(current, variant)
      : current;
    if (
      effective.properties &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      effective.properties = Object.fromEntries(
        Object.entries(effective.properties).map(([name, child]) => [
          name,
          typeof child === "boolean"
            ? child
            : applyVariants(
                child,
                (value as Record<string, unknown>)[name],
                path ? `${path}.${name}` : name,
              ),
        ]),
      );
    }
    if (
      effective.items &&
      !Array.isArray(effective.items) &&
      Array.isArray(value)
    ) {
      effective.items = applyVariants(effective.items, value[0], `${path}[0]`);
    }
    return effective;
  };
  return async (values) => {
    const linkageStates = linkageStatesRef?.current ?? {};
    const helpers = helpersRef?.current ?? {};

    // 提交时校验联动后的 effective schema，确保动态约束真正生效。
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
    // 显式传递 customFormats，使动态 schema 的自定义 format 仍可校验。
    effectiveSchema = applyVariants(effectiveSchema, values);
    const validator = new SchemaValidator(
      effectiveSchema,
      undefined,
      customFormats,
    );
    const schemaErrors = validator.validate(values);
    const fieldValidatorErrors = await runAllFieldValidators(
      values,
      schema,
      callbacks,
      helpers,
      variantStore,
    );
    // 标准 Schema 规则与 ui.validators 业务规则互补，合并后统一映射给 RHF。
    const errors = { ...schemaErrors, ...fieldValidatorErrors };
    console.info("[VariantDebug] resolver-errors", {
      values: JSON.stringify(values),
      schemaErrors: JSON.stringify(schemaErrors),
      fieldValidatorErrors: JSON.stringify(fieldValidatorErrors),
      errors: JSON.stringify(errors),
    });

    if (Object.keys(errors).length === 0) {
      return { values, errors: {} };
    }

    // 先过滤隐藏/禁用字段再构造错误树，避免空的父级错误节点阻塞提交。
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
