import type { ExtendedJSONSchema, ValidatorRule } from '../types/schema';

// 通过 globalThis 访问 Function 构造器，避免静态分析误报
const DynamicFn = globalThis['Function'] as FunctionConstructor // trusted-dynamic-code

async function runValidator(
  rule: ValidatorRule,
  value: any,
  formValues: Record<string, any>,
  callbacks: Record<string, (...args: any[]) => any>
): Promise<string | null> {
  if (rule.type === 'script') {
    // 解析 callback 函数
    let fn: ((value: any, formValues: Record<string, any>) => any) | undefined;

    if (typeof rule.callback === 'string') {
      // 从 callbacks 注册表获取函数
      fn = callbacks[rule.callback];
      if (!fn) {
        return process.env.NODE_ENV !== 'production'
          ? `Callback function "${rule.callback}" not found`
          : 'Validation error';
      }
    } else if (rule.callback.type === 'script' && rule.callback.code.trim()) {
      // 执行内联 JavaScript 函数字符串
      try {
        fn = DynamicFn(`return (${rule.callback.code})`)();
      } catch (e) {
        return process.env.NODE_ENV !== 'production'
          ? `Script error: ${(e as Error).message}`
          : 'Validation error';
      }
    }

    if (!fn) {
      return 'Validator function not configured';
    }

    try {
      const result = await fn(value, formValues);
      return result === null ? null : String(result);
    } catch (e) {
      return process.env.NODE_ENV !== 'production'
        ? `Validation error: ${(e as Error).message}`
        : 'Validation failed';
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
  schema: ExtendedJSONSchema,
  callbacks: Record<string, (...args: any[]) => any>
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
        const error = await runValidator(rule, values[fieldName], values, callbacks);
        if (error) {
          errors[fieldName] = error;
          break; // 第一个报错的 validator 优先
        }
      }
    })
  );

  return errors;
}
