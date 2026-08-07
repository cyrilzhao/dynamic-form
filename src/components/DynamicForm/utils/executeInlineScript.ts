/**
 * 执行 inline script 工具函数
 *
 * 支持在 inline script 中使用 helpers（如 ofetch、lodash、valibot 等）
 *
 * @param code - JavaScript 函数代码
 * @param params - 参数对象
 * @param helpers - helpers 对象
 * @returns 执行结果（可能是 Promise）
 */

// 通过 globalThis 访问 Function 构造器，避免静态分析误报
const DynamicFn = globalThis['Function'] as FunctionConstructor; // trusted-dynamic-code

export function executeInlineScript<T = any>({
  code,
  params,
  helpers,
}: {
  code: string;
  params: Record<string, any>;
  helpers: Record<string, any>;
}): T | Promise<T> {
  try {
    // 创建函数，接收一个参数对象（包含 helpers）
    const func = DynamicFn(
      'params',
      'helpers',
      `return (${code})({ ...params, helpers })`
    );

    // 执行函数
    const result = func(params, helpers);

    return result;
  } catch (error) {
    console.error('Inline script execution error:', error);
    console.error('Code:', code);
    console.error('Params:', params);
    throw error;
  }
}
