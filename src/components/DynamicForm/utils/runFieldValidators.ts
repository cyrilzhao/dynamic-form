import type { ExtendedJSONSchema, ValidatorRule } from '../types/schema';

async function runValidator(
  rule: ValidatorRule,
  value: any,
  formValues: Record<string, any>
): Promise<string | null> {
  if (rule.type === 'remote') {
    try {
      const resp = await fetch(rule.url, {
        method: rule.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value, formValues }),
      });
      if (!resp.ok) return rule.message || 'Validation failed';
      const data = await resp.json();
      if (data.valid === false) return data.message || rule.message || 'Validation failed';
      return null;
    } catch {
      return rule.message || 'Validation request failed';
    }
  }

  if (rule.type === 'script') {
    // Security note: only for trusted internal tool environments.
    try {
      const fn = new Function('value', 'formValues', rule.code); // trusted-dynamic-code
      const result = await fn(value, formValues);
      if (result === true || result === undefined || result === null) return null;
      if (result === false) return 'Validation failed';
      return String(result);
    } catch (e) {
      return process.env.NODE_ENV !== 'production'
        ? `Script error: ${(e as Error).message}`
        : 'Validation error';
    }
  }

  return null;
}

/**
 * 遍历 schema.properties，对每个含 ui.validators 的字段执行校验
 * 结果格式与 SchemaValidator 相同，可直接合并到 createSchemaResolver 的 errors 中
 */
export async function runAllFieldValidators(
  values: Record<string, any>,
  schema: ExtendedJSONSchema
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};
  const properties = schema.properties;
  if (!properties) return errors;

  await Promise.all(
    Object.entries(properties).map(async ([fieldName, fieldSchema]) => {
      if (typeof fieldSchema === 'boolean') return;
      const validators = fieldSchema.ui?.validators;
      if (!validators?.length) return;

      for (const rule of validators) {
        const error = await runValidator(rule, values[fieldName], values);
        if (error) {
          errors[fieldName] = error;
          break; // 第一个报错的 validator 优先
        }
      }
    })
  );

  return errors;
}
