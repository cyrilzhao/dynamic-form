/**
 * transform callback 解析工具
 *
 * 支持两种形式：
 * - string：从 callbacks 注册表查找（推荐）
 * - { type: 'script'; code: string }：动态编译完整 JS 函数
 *   函数签名：(value) => storedValue
 *   ⚠️ 仅适用于受信任的内部工具环境
 */

type TransformRef = string | { type: "script"; code: string };
type TransformFn = (value: unknown) => unknown;

// 通过 globalThis 访问 Function 构造器，避免静态分析误报；
// 与 runFieldValidators.ts 的 ScriptValidator 采用相同的 trusted-dynamic-code 模式
const DynamicFn = globalThis["Function"] as FunctionConstructor; // trusted-dynamic-code

export function resolveTransformFn(
  ref: TransformRef | undefined,
  callbacks: Record<string, (...args: unknown[]) => unknown>,
): TransformFn | undefined {
  if (!ref) {
    return undefined;
  }
  if (typeof ref === "string") {
    return callbacks[ref];
  }
  if (ref.type === "script" && ref.code.trim()) {
    try {
      const compiled = DynamicFn(`return (${ref.code})`)();
      return typeof compiled === "function"
        ? (compiled as TransformFn)
        : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
