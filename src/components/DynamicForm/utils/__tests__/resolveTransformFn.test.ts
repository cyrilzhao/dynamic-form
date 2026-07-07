import { resolveTransformFn } from "../resolveTransformFn";

describe("resolveTransformFn", () => {
  it("ref 为空时应该返回 undefined", () => {
    const callbacks = {
      toStored: jest.fn((value: number) => value / 100),
    };

    expect(resolveTransformFn(undefined, callbacks)).toBeUndefined();
  });

  it("ref 为字符串时应该从 callbacks 注册表返回对应函数", () => {
    const toStored = jest.fn((value: number) => value / 100);
    const callbacks = { toStored };

    const fn = resolveTransformFn("toStored", callbacks);

    expect(fn).toBe(toStored);
    expect(fn?.(96)).toBe(0.96);
    expect(toStored).toHaveBeenCalledWith(96);
  });

  it("ref 为字符串但 callbacks 中不存在时应该返回 undefined", () => {
    const fn = resolveTransformFn("missingTransform", {});

    expect(fn).toBeUndefined();
  });

  it("ref 为 script 时应该编译并返回转换函数", () => {
    const fn = resolveTransformFn(
      {
        type: "script",
        code: "return value == null ? value : value.trim().toUpperCase();",
      },
      {},
    );

    expect(fn).toBeDefined();
    expect(fn?.(" alice ")).toBe("ALICE");
    expect(fn?.(null)).toBeNull();
  });

  it("script 可以访问 Function 参数 value 但不依赖 callbacks", () => {
    const callbacks = {
      unused: jest.fn(() => "unused"),
    };

    const fn = resolveTransformFn(
      {
        type: "script",
        code: "return { stored: value * 2 };",
      },
      callbacks,
    );

    expect(fn?.(21)).toEqual({ stored: 42 });
    expect(callbacks.unused).not.toHaveBeenCalled();
  });

  it("script code 为空白时应该返回 undefined", () => {
    const fn = resolveTransformFn({ type: "script", code: "   " }, {});

    expect(fn).toBeUndefined();
  });

  it("script 编译失败时应该返回 undefined 且不抛出异常", () => {
    const fn = resolveTransformFn(
      {
        type: "script",
        code: "return value + ;",
      },
      {},
    );

    expect(fn).toBeUndefined();
  });

  it("script 运行时错误应该由调用方处理", () => {
    const fn = resolveTransformFn(
      {
        type: "script",
        code: "throw new Error('boom');",
      },
      {},
    );

    expect(fn).toBeDefined();
    expect(() => fn?.("value")).toThrow("boom");
  });
});
