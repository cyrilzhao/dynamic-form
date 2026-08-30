import { describe, expect, it } from "@jest/globals";
import { buildVariantSchema } from "../resolveVariant";
import type { ExtendedJSONSchema, FieldVariant } from "../../types/schema";

describe("buildVariantSchema", () => {
  it("应清除未声明的旧 Variant 约束和业务配置", () => {
    const base: ExtendedJSONSchema = {
      type: "string",
      minLength: 11,
      pattern: "^phone$",
      ui: {
        validators: [{ type: "script", callback: "phoneValidator" }],
        transform: { callback: "phoneTransform" },
        placeholder: "shared",
      },
    };
    const variant: FieldVariant = {
      name: "object",
      type: "object",
      schema: { properties: { id: { type: "string" } } },
    };

    const result = buildVariantSchema(base, variant);

    expect(result.type).toBe("object");
    expect(result.minLength).toBeUndefined();
    expect(result.pattern).toBeUndefined();
    expect(result.ui?.validators).toBeUndefined();
    expect(result.ui?.transform).toBeUndefined();
    expect(result.ui?.placeholder).toBe("shared");
    expect(result.properties).toEqual({ id: { type: "string" } });
  });

  it("应允许 Variant 显式覆盖 transform、validators 和嵌套 schema", () => {
    const base: ExtendedJSONSchema = {
      type: "string",
      ui: { validators: [], transform: { callback: "old" } },
      items: { type: "string" },
    };
    const variant: FieldVariant = {
      name: "array",
      type: "array",
      schema: {
        items: { type: "number" },
        ui: {
          validators: [{ type: "script", callback: "newValidator" }],
          transform: { callback: "new" },
        },
      },
    };

    const result = buildVariantSchema(base, variant);

    expect(result.items).toEqual({ type: "number" });
    expect(result.ui?.transform).toEqual({ callback: "new" });
    expect(result.ui?.validators).toEqual([
      { type: "script", callback: "newValidator" },
    ]);
  });
});
