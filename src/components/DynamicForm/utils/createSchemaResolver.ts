import type { Resolver, FieldErrors } from 'react-hook-form';
import type { RefObject } from 'react';
import { SchemaValidator } from '../core/SchemaValidator';
import type { ExtendedJSONSchema } from '../types/schema';

/**
 * 将扁平路径（如 "arr[0].name"）写入嵌套错误对象
 */
function setError(
  errors: Record<string, any>,
  path: string,
  value: { type: string; message: string }
): void {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
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
 * 检查字段是否因联动被隐藏或禁用（需跳过校验）
 */
function isHiddenOrDisabled(
  fieldPath: string,
  linkageStates: Record<string, { visible?: boolean; disabled?: boolean }>
): boolean {
  const state = linkageStates[fieldPath];
  if (state?.visible === false || state?.disabled === true) return true;

  // 检查父级路径（处理嵌套字段）
  const parts = fieldPath.split('.');
  for (let i = 1; i < parts.length; i++) {
    const parentState = linkageStates[parts.slice(0, i).join('.')];
    if (parentState?.visible === false || parentState?.disabled === true) return true;
  }

  return false;
}

/**
 * 创建基于 JSON Schema 的表单验证 resolver
 * 用于集成 SchemaValidator 到 react-hook-form 的验证流程
 */
export function createSchemaResolver(
  schema: ExtendedJSONSchema,
  linkageStatesRef?: RefObject<Record<string, { visible?: boolean; disabled?: boolean }>>
): Resolver {
  return async (values) => {
    const validator = new SchemaValidator(schema);
    const errors = validator.validate(values);

    if (Object.keys(errors).length === 0) {
      return { values, errors: {} };
    }

    const linkageStates = linkageStatesRef?.current ?? {};
    const fieldErrors: FieldErrors = {};
    for (const [field, message] of Object.entries(errors)) {
      if (isHiddenOrDisabled(field, linkageStates)) continue;
      setError(fieldErrors, field, { type: 'validation', message });
    }

    return Object.keys(fieldErrors).length === 0
      ? { values, errors: {} }
      : { values: {}, errors: fieldErrors };
  };
}
