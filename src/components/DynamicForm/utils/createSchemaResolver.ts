import type { Resolver, FieldErrors } from 'react-hook-form';
import { SchemaValidator } from '../core/SchemaValidator';
import type { ExtendedJSONSchema } from '../types/schema';

/**
 * 创建基于 JSON Schema 的表单验证 resolver
 * 用于集成 SchemaValidator 到 react-hook-form 的验证流程
 */
export function createSchemaResolver(schema: ExtendedJSONSchema): Resolver {
  return async (values) => {
    const validator = new SchemaValidator(schema);
    const errors = validator.validate(values);

    if (Object.keys(errors).length === 0) {
      return { values, errors: {} };
    }

    // 转换为 react-hook-form 的错误格式
    const fieldErrors: FieldErrors = {};
    for (const [field, message] of Object.entries(errors)) {
      fieldErrors[field] = { type: 'validation', message };
    }

    return { values: {}, errors: fieldErrors };
  };
}
