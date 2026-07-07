import type { ExtendedJSONSchema, ValidatorRule } from "../../types/schema";
import { runAllFieldValidators } from "../runFieldValidators";

const originalNodeEnv = process.env.NODE_ENV;

function setNodeEnv(value: "test" | "development" | "production"): void {
  process.env.NODE_ENV = value;
}

function createSchema(
  properties?: ExtendedJSONSchema["properties"],
): ExtendedJSONSchema {
  return {
    type: "object",
    properties,
  };
}

function createField(validators?: ValidatorRule[]): ExtendedJSONSchema {
  return {
    type: "string",
    ui: validators ? { validators } : undefined,
  };
}

function createScriptRule(
  callback: ValidatorRule["callback"],
): ValidatorRule {
  return {
    type: "script",
    callback,
  };
}

describe("runAllFieldValidators", () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
  });

  describe("字段遍历与跳过规则", () => {
    it("schema 没有 properties 时应该返回空错误对象", async () => {
      const errors = await runAllFieldValidators({ name: "" }, createSchema(), {});

      expect(errors).toEqual({});
    });

    it("boolean schema property 应该被跳过", async () => {
      const schema = createSchema({
        enabled: true as unknown as ExtendedJSONSchema,
        name: createField([createScriptRule("requiredName")]),
      });
      const callbacks = {
        requiredName: jest.fn(() => "Name is required"),
      };

      const errors = await runAllFieldValidators(
        { enabled: false, name: "" },
        schema,
        callbacks,
      );

      expect(errors).toEqual({ name: "Name is required" });
      expect(callbacks.requiredName).toHaveBeenCalledTimes(1);
    });

    it("没有 ui.validators 的字段应该被跳过", async () => {
      const schema = createSchema({
        name: createField(),
        email: { type: "string", ui: { validators: [] } },
      });

      const errors = await runAllFieldValidators(
        { name: "", email: "" },
        schema,
        {},
      );

      expect(errors).toEqual({});
    });
  });

  describe("callbacks 注册表校验器", () => {
    it("字符串 callback 校验通过时应该返回空错误对象", async () => {
      const schema = createSchema({
        name: createField([createScriptRule("requiredName")]),
      });
      const callbacks = {
        requiredName: jest.fn((value: string) => (value ? null : "Required")),
      };

      const errors = await runAllFieldValidators(
        { name: "Alice" },
        schema,
        callbacks,
      );

      expect(errors).toEqual({});
      expect(callbacks.requiredName).toHaveBeenCalledWith("Alice", {
        name: "Alice",
      });
    });

    it("字符串 callback 返回错误时应该记录到对应字段", async () => {
      const schema = createSchema({
        age: createField([createScriptRule("minAge")]),
      });
      const callbacks = {
        minAge: jest.fn((value: number) =>
          value >= 18 ? null : "Age must be at least 18",
        ),
      };

      const errors = await runAllFieldValidators({ age: 16 }, schema, callbacks);

      expect(errors).toEqual({ age: "Age must be at least 18" });
    });

    it("应该支持异步 validator", async () => {
      const schema = createSchema({
        username: createField([createScriptRule("uniqueUsername")]),
      });
      const callbacks = {
        uniqueUsername: jest.fn(async (value: string) =>
          value === "taken" ? "Username already exists" : null,
        ),
      };

      const errors = await runAllFieldValidators(
        { username: "taken" },
        schema,
        callbacks,
      );

      expect(errors).toEqual({ username: "Username already exists" });
      expect(callbacks.uniqueUsername).toHaveBeenCalledTimes(1);
    });

    it("validator 返回非 null 值时应该转换为字符串错误", async () => {
      const schema = createSchema({
        score: createField([createScriptRule("scoreValidator")]),
        enabled: createField([createScriptRule("enabledValidator")]),
      });
      const callbacks = {
        scoreValidator: jest.fn(() => 123),
        enabledValidator: jest.fn(() => false),
      };

      const errors = await runAllFieldValidators(
        { score: 1, enabled: true },
        schema,
        callbacks,
      );

      expect(errors).toEqual({ score: "123", enabled: "false" });
    });

    it("同字段多个 validators 应该只保留第一个错误并停止后续校验", async () => {
      const schema = createSchema({
        email: createField([
          createScriptRule("requiredEmail"),
          createScriptRule("emailFormat"),
        ]),
      });
      const callbacks = {
        requiredEmail: jest.fn(() => "Email is required"),
        emailFormat: jest.fn(() => "Email is invalid"),
      };

      const errors = await runAllFieldValidators({ email: "" }, schema, callbacks);

      expect(errors).toEqual({ email: "Email is required" });
      expect(callbacks.requiredEmail).toHaveBeenCalledTimes(1);
      expect(callbacks.emailFormat).not.toHaveBeenCalled();
    });

    it("不同字段的 validators 应该都能收集错误", async () => {
      const schema = createSchema({
        name: createField([createScriptRule("requiredName")]),
        email: createField([createScriptRule("requiredEmail")]),
      });
      const callbacks = {
        requiredName: jest.fn(() => "Name is required"),
        requiredEmail: jest.fn(() => "Email is required"),
      };

      const errors = await runAllFieldValidators(
        { name: "", email: "" },
        schema,
        callbacks,
      );

      expect(errors).toEqual({
        name: "Name is required",
        email: "Email is required",
      });
    });
  });

  describe("callback 缺失错误", () => {
    it("开发环境下 callback 缺失时应该返回具体错误信息", async () => {
      setNodeEnv("development");
      const schema = createSchema({
        name: createField([createScriptRule("missingValidator")]),
      });

      const errors = await runAllFieldValidators({ name: "" }, schema, {});

      expect(errors).toEqual({
        name: 'Callback function "missingValidator" not found',
      });
    });

    it("生产环境下 callback 缺失时应该返回通用错误信息", async () => {
      setNodeEnv("production");
      const schema = createSchema({
        name: createField([createScriptRule("missingValidator")]),
      });

      const errors = await runAllFieldValidators({ name: "" }, schema, {});

      expect(errors).toEqual({ name: "Validation error" });
    });
  });

  describe("内联 script 校验器", () => {
    it("内联 script callback 应该正常执行并读取完整表单值", async () => {
      const schema = createSchema({
        confirmPassword: createField([
          createScriptRule({
            type: "script",
            code: "(value, formValues) => value === formValues.password ? null : 'Passwords do not match'",
          }),
        ]),
      });

      const errors = await runAllFieldValidators(
        { password: "secret", confirmPassword: "mismatch" },
        schema,
        {},
      );

      expect(errors).toEqual({
        confirmPassword: "Passwords do not match",
      });
    });

    it("开发环境下内联 script 编译失败时应该返回具体脚本错误", async () => {
      setNodeEnv("development");
      const schema = createSchema({
        name: createField([
          createScriptRule({
            type: "script",
            code: "(value, formValues) => {",
          }),
        ]),
      });

      const errors = await runAllFieldValidators({ name: "" }, schema, {});

      expect(errors.name).toMatch(/^Script error: /);
    });

    it("生产环境下内联 script 编译失败时应该返回通用错误信息", async () => {
      setNodeEnv("production");
      const schema = createSchema({
        name: createField([
          createScriptRule({
            type: "script",
            code: "(value, formValues) => {",
          }),
        ]),
      });

      const errors = await runAllFieldValidators({ name: "" }, schema, {});

      expect(errors).toEqual({ name: "Validation error" });
    });

    it("空白内联 script 应该返回未配置错误", async () => {
      const schema = createSchema({
        name: createField([
          createScriptRule({
            type: "script",
            code: "   ",
          }),
        ]),
      });

      const errors = await runAllFieldValidators({ name: "" }, schema, {});

      expect(errors).toEqual({
        name: "Validator function not configured",
      });
    });
  });

  describe("validator 运行时错误", () => {
    it("开发环境下运行时异常应该返回具体错误信息", async () => {
      setNodeEnv("development");
      const schema = createSchema({
        name: createField([createScriptRule("throwsValidator")]),
      });
      const callbacks = {
        throwsValidator: jest.fn(() => {
          throw new Error("boom");
        }),
      };

      const errors = await runAllFieldValidators({ name: "" }, schema, callbacks);

      expect(errors).toEqual({ name: "Validation error: boom" });
    });

    it("生产环境下运行时异常应该返回通用失败信息", async () => {
      setNodeEnv("production");
      const schema = createSchema({
        name: createField([createScriptRule("throwsValidator")]),
      });
      const callbacks = {
        throwsValidator: jest.fn(() => {
          throw new Error("boom");
        }),
      };

      const errors = await runAllFieldValidators({ name: "" }, schema, callbacks);

      expect(errors).toEqual({ name: "Validation failed" });
    });
  });
});
