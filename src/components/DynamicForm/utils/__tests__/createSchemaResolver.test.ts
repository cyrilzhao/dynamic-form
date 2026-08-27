import { createSchemaResolver } from "../createSchemaResolver";
import type { ExtendedJSONSchema } from "../../types/schema";
import { createRef } from "react";

const schema: ExtendedJSONSchema = {
  type: "object",
  properties: {
    name: { type: "string", title: "Name" },
    email: { type: "string", title: "Email" },
  },
  required: ["name", "email"],
};

describe("createSchemaResolver", () => {
  it("校验通过时返回 values 且 errors 为空", async () => {
    const resolver = createSchemaResolver(schema);
    const result = await resolver(
      { name: "Alice", email: "a@b.com" },
      undefined,
      {} as any,
    );
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ name: "Alice", email: "a@b.com" });
  });

  it("校验失败时返回嵌套错误结构", async () => {
    const resolver = createSchemaResolver(schema);
    const result = await resolver(
      { name: "", email: "" },
      undefined,
      {} as any,
    );
    expect((result.errors as any).name?.message).toBe("Name is required");
    expect((result.errors as any).email?.message).toBe("Email is required");
  });

  it("提交校验应执行 customFormats 并使用自定义错误消息", async () => {
    const formatSchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        phone: {
          type: "string",
          title: "Phone",
          format: "phone",
          ui: { errorMessages: { format: "Invalid phone" } },
        },
      },
    };
    const resolver = createSchemaResolver(formatSchema, {}, undefined, undefined, {
      phone: (value: string) => /^1\d{10}$/.test(value),
    });

    const result = await resolver({ phone: "invalid" }, undefined, {} as any);

    expect((result.errors as any).phone?.message).toBe("Invalid phone");
  });

  it("数组子字段错误转换为嵌套结构", async () => {
    const arraySchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["title"],
            properties: { title: { type: "string", title: "Title" } },
          },
        },
      },
    };
    const resolver = createSchemaResolver(arraySchema);
    const result = await resolver({ items: [{}] }, undefined, {} as any);
    expect((result.errors as any).items?.[0]?.title?.message).toBe(
      "Title is required",
    );
  });

  it("hidden 字段的校验错误被过滤掉", async () => {
    const ref =
      createRef<Record<string, { visible?: boolean; disabled?: boolean }>>();
    (ref as any).current = { email: { visible: false } };
    const resolver = createSchemaResolver(schema, {}, ref);
    const result = await resolver(
      { name: "Alice", email: "" },
      undefined,
      {} as any,
    );
    expect((result.errors as any).email).toBeUndefined();
    expect(result.errors).toEqual({});
  });

  it("disabled 字段的校验错误被过滤掉", async () => {
    const ref =
      createRef<Record<string, { visible?: boolean; disabled?: boolean }>>();
    (ref as any).current = { email: { disabled: true } };
    const resolver = createSchemaResolver(schema, {}, ref);
    const result = await resolver(
      { name: "Alice", email: "" },
      undefined,
      {} as any,
    );
    expect((result.errors as any).email).toBeUndefined();
  });

  it("visible=true 的字段不被过滤", async () => {
    const ref =
      createRef<Record<string, { visible?: boolean; disabled?: boolean }>>();
    (ref as any).current = { email: { visible: true } };
    const resolver = createSchemaResolver(schema, {}, ref);
    const result = await resolver(
      { name: "Alice", email: "" },
      undefined,
      {} as any,
    );
    expect((result.errors as any).email?.message).toBe("Email is required");
  });

  it("父级字段 hidden 时子字段错误被过滤", async () => {
    const nestedSchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        address: {
          type: "object",
          properties: { city: { type: "string", title: "City" } },
          required: ["city"],
        },
      },
    };
    const ref =
      createRef<Record<string, { visible?: boolean; disabled?: boolean }>>();
    (ref as any).current = { address: { visible: false } };
    const resolver = createSchemaResolver(nestedSchema, {}, ref);
    const result = await resolver({ address: {} }, undefined, {} as any);
    expect((result.errors as any).address?.city).toBeUndefined();
  });

  it("数组父字段 hidden 时子项错误被过滤", async () => {
    const arraySchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["title"],
            properties: { title: { type: "string", title: "Title" } },
          },
        },
      },
    };
    const ref =
      createRef<Record<string, { visible?: boolean; disabled?: boolean }>>();
    (ref as any).current = { items: { visible: false } };
    const resolver = createSchemaResolver(arraySchema, {}, ref);
    const result = await resolver({ items: [{}] }, undefined, {} as any);
    expect((result.errors as any).items).toBeUndefined();
  });

  it("schema 静态 ui.hidden=true 字段的错误被过滤", async () => {
    const hiddenSchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        name: { type: "string", title: "Name" },
        internalId: {
          type: "string",
          title: "Internal ID",
          ui: { hidden: true },
        },
      },
      required: ["name", "internalId"],
    };
    const resolver = createSchemaResolver(hiddenSchema);
    const result = await resolver({ name: "Alice" }, undefined, {} as any);
    expect((result.errors as any).internalId).toBeUndefined();
    expect((result.errors as any).name).toBeUndefined();
  });

  it("schema 静态 ui.disabled=true 字段的错误被过滤", async () => {
    const disabledSchema: ExtendedJSONSchema = {
      type: "object",
      properties: {
        name: { type: "string", title: "Name" },
        readonlyCode: { type: "string", title: "Code", ui: { disabled: true } },
      },
      required: ["name", "readonlyCode"],
    };
    const resolver = createSchemaResolver(disabledSchema);
    const result = await resolver({ name: "Alice" }, undefined, {} as any);
    expect((result.errors as any).readonlyCode).toBeUndefined();
  });
});
