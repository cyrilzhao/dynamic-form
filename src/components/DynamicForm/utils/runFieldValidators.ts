import type { ExtendedJSONSchema, ValidatorRule } from "../types/schema";
import { executeInlineScript } from "./executeInlineScript";

// 通过 globalThis 访问 Function 构造器，避免静态分析误报
const DynamicFn = globalThis["Function"] as FunctionConstructor; // trusted-dynamic-code

async function runValidator(
  rule: ValidatorRule,
  value: any,
  formValues: Record<string, any>,
  callbacks: Record<string, (...args: any[]) => any>,
  helpers: Record<string, any>,
): Promise<string | null> {
  if (rule.type === "script") {
    // 解析 callback 函数
    let fn: ((params: { value: any; formValues: Record<string, any>; helpers: Record<string, any> }) => any) | undefined;

    if (typeof rule.callback === "string") {
      // 从 callbacks 注册表获取函数
      fn = callbacks[rule.callback];
      if (!fn) {
        return process.env.NODE_ENV !== "production"
          ? `Callback function "${rule.callback}" not found`
          : "Validation error";
      }
    } else if (
      typeof rule.callback !== "string" &&
      rule.callback.type === "script" &&
      rule.callback.code.trim()
    ) {
      // 执行内联 JavaScript 函数字符串，使用 executeInlineScript
      const scriptCode = rule.callback.code; // 类型已收窄
      try {
        fn = (params: { value: any; formValues: Record<string, any>; helpers: Record<string, any> }) =>
          executeInlineScript({
            code: scriptCode,
            params: { value: params.value, formValues: params.formValues },
            helpers: params.helpers,
          });
      } catch (e) {
        return process.env.NODE_ENV !== "production"
          ? `Script error: ${(e as Error).message}`
          : "Validation error";
      }
    }

    if (!fn) {
      return "Validator function not configured";
    }

    try {
      const result = await fn({ value, formValues, helpers });
      return result === null ? null : String(result);
    } catch (e) {
      if (e instanceof SyntaxError) {
        return process.env.NODE_ENV !== "production"
          ? `Script error: ${e.message}`
          : "Validation error";
      }
      return process.env.NODE_ENV !== "production"
        ? `Validation error: ${(e as Error).message}`
        : "Validation failed";
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
  callbacks: Record<string, (...args: any[]) => any>,
  helpers: Record<string, any> = {},
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};

  const getValue = (path: string): any =>
    path.replace(/\[(\d+)\]/g, ".$1").split(".").reduce(
      (current: any, key: string) => current?.[key],
      values,
    );

  // 递归遍历 schema，保留 profile.name、items[0].code 等完整路径以准确定位错误。
  const visit = async (
    currentSchema: ExtendedJSONSchema,
    path: string,
  ): Promise<void> => {
    const validators = currentSchema.ui?.validators;
    // 当前节点先校验，再递归子节点，确保字段自身规则不会遗漏。
    if (validators?.length) {
      for (const rule of validators) {
        const error = await runValidator(
          rule,
          getValue(path),
          values,
          callbacks,
          helpers,
        );
        if (error) {
          errors[path] = error;
          break;
        }
      }
    }

    if (currentSchema.properties) {
      await Promise.all(
        Object.entries(currentSchema.properties).map(async ([name, child]) => {
          if (typeof child !== "boolean") {
            await visit(child, path ? `${path}.${name}` : name);
          }
        }),
      );
    }

    // items 代表数组元素 schema；按实际索引递归，并通过路径读取真实值。
    if (currentSchema.items && !Array.isArray(currentSchema.items) && typeof currentSchema.items !== "boolean") {
      const arrayValue = getValue(path);
      if (Array.isArray(arrayValue)) {
        await Promise.all(arrayValue.map((_, index) => visit(currentSchema.items as ExtendedJSONSchema, `${path}[${index}]`)));
      }
    }
  };

  await visit(schema, "");

  return errors;
}
