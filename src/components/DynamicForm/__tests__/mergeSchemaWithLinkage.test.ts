import type { ExtendedJSONSchema } from "../types/schema";

/**
 * 合并原始 schema 和联动 schema
 *
 * 这是从 DynamicForm.tsx 中提取出来用于测试的函数
 * 实际项目中，这个函数在 DynamicForm.tsx 内部定义
 */
function mergeSchemaWithLinkage(
  originalSchema: ExtendedJSONSchema,
  linkageSchema: Partial<ExtendedJSONSchema>,
): ExtendedJSONSchema {
  const validationProps = [
    "pattern",
    "format",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "enum",
    "enumNames",
    "const",
    "minItems",
    "maxItems",
    "uniqueItems",
    "minProperties",
    "maxProperties",
    "required",
    "allOf",
    "anyOf",
    "oneOf",
    "not",
    "if",
    "then",
    "else",
    "dependencies",
  ];

  const merged: ExtendedJSONSchema = { ...originalSchema };

  // 1. 覆盖校验属性
  validationProps.forEach((prop) => {
    if (prop in linkageSchema) {
      merged[prop] = linkageSchema[prop];
    }
  });

  // 2. 覆盖 title, description
  if (linkageSchema.title !== undefined) {
    merged.title = linkageSchema.title;
  }
  if (linkageSchema.description !== undefined) {
    merged.description = linkageSchema.description;
  }

  // 3. 合并 ui 配置（保留原始的 linkages）
  if (linkageSchema.ui) {
    const originalLinkages = originalSchema.ui?.linkages;
    merged.ui = {
      ...originalSchema.ui,
      ...linkageSchema.ui,
      linkages: originalLinkages,
    };
  }

  // 4. 对于 object 类型，替换 properties
  if (originalSchema.type === "object" && linkageSchema.properties) {
    merged.properties = linkageSchema.properties;
  }

  return merged;
}

describe("mergeSchemaWithLinkage", () => {
  describe("校验属性覆盖", () => {
    it("应该覆盖 pattern 属性", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        pattern: "^[a-z]+$",
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        pattern: "^[A-Z]+$",
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.pattern).toBe("^[A-Z]+$");
    });

    it("应该覆盖 minLength 和 maxLength", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        minLength: 5,
        maxLength: 10,
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        minLength: 10,
        maxLength: 20,
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.minLength).toBe(10);
      expect(result.maxLength).toBe(20);
    });

    it("应该覆盖 enum 和 enumNames", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        enum: ["a", "b", "c"],
        enumNames: ["Option A", "Option B", "Option C"],
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        enum: ["x", "y"],
        enumNames: ["Option X", "Option Y"],
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.enum).toEqual(["x", "y"]);
      expect(result.enumNames).toEqual(["Option X", "Option Y"]);
    });

    it("应该覆盖数字类型的校验属性", () => {
      const original: ExtendedJSONSchema = {
        type: "number",
        minimum: 0,
        maximum: 100,
        multipleOf: 5,
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        minimum: 10,
        maximum: 50,
        multipleOf: 10,
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.minimum).toBe(10);
      expect(result.maximum).toBe(50);
      expect(result.multipleOf).toBe(10);
    });

    it("应该覆盖复杂的条件校验属性", () => {
      const original: ExtendedJSONSchema = {
        type: "object",
        if: { properties: { type: { const: "A" } } },
        then: { required: ["fieldA"] },
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        if: { properties: { type: { const: "B" } } },
        then: { required: ["fieldB"] },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.if).toEqual({ properties: { type: { const: "B" } } });
      expect(result.then).toEqual({ required: ["fieldB"] });
    });

    it("应该保留未被覆盖的原始校验属性", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        pattern: "^[a-z]+$",
        minLength: 5,
        maxLength: 10,
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        pattern: "^[A-Z]+$",
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.pattern).toBe("^[A-Z]+$");
      expect(result.minLength).toBe(5); // 保留原始值
      expect(result.maxLength).toBe(10); // 保留原始值
    });
  });

  describe("title 和 description 覆盖", () => {
    it("应该覆盖 title", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        title: "Original Title",
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        title: "New Title",
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.title).toBe("New Title");
    });

    it("应该覆盖 description", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        description: "Original description",
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        description: "New description",
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.description).toBe("New description");
    });

    it("应该同时覆盖 title 和 description", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        title: "Original Title",
        description: "Original description",
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        title: "New Title",
        description: "New description",
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.title).toBe("New Title");
      expect(result.description).toBe("New description");
    });
  });

  describe("ui 配置合并", () => {
    it("应该浅层合并 ui 配置", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        ui: {
          widget: "input",
          placeholder: "Original placeholder",
        },
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        ui: {
          placeholder: "New placeholder",
        },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.ui?.widget).toBe("input"); // 保留原始
      expect(result.ui?.placeholder).toBe("New placeholder"); // 覆盖
    });

    it("应该保留原始的 linkages 配置", () => {
      const originalLinkages = [
        {
          type: "visibility" as const,
          dependencies: ["field1"],
          when: { field: "field1", operator: "==" as const, value: true },
          fulfill: { state: { visible: true } },
        },
      ];

      const original: ExtendedJSONSchema = {
        type: "string",
        ui: {
          widget: "input",
          linkages: originalLinkages,
        },
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        ui: {
          widget: "textarea",
          placeholder: "New placeholder",
        },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.ui?.widget).toBe("textarea"); // 覆盖
      expect(result.ui?.placeholder).toBe("New placeholder");
      expect(result.ui?.linkages).toBe(originalLinkages); // 保留原始引用
    });

    it("当原始 schema 没有 linkages 时，不应添加 linkages", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        ui: {
          widget: "input",
        },
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        ui: {
          placeholder: "New placeholder",
        },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.ui?.linkages).toBeUndefined();
    });

    it("应该覆盖所有 ui 配置但保留 linkages", () => {
      const originalLinkages = [
        {
          type: "value" as const,
          dependencies: ["field1"],
          fulfill: { value: "computed" },
        },
      ];

      const original: ExtendedJSONSchema = {
        type: "string",
        ui: {
          widget: "input",
          placeholder: "Old",
          errorMessages: { required: "Old error" },
          linkages: originalLinkages,
        },
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        ui: {
          widget: "textarea",
          placeholder: "New",
          help: "This is help text",
        },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.ui?.widget).toBe("textarea");
      expect(result.ui?.placeholder).toBe("New");
      expect(result.ui?.help).toBe("This is help text");
      expect(result.ui?.errorMessages).toEqual({ required: "Old error" }); // 保留
      expect(result.ui?.linkages).toBe(originalLinkages); // 保留
    });
  });

  describe("object 类型的 properties 替换", () => {
    it("应该替换 object 类型的 properties", () => {
      const original: ExtendedJSONSchema = {
        type: "object",
        properties: {
          firstName: { type: "string", title: "First Name" },
          lastName: { type: "string", title: "Last Name" },
        },
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        properties: {
          companyName: { type: "string", title: "Company Name" },
          taxId: { type: "string", title: "Tax ID" },
        },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.properties).toEqual(linkage.properties);
      expect(result.properties?.firstName).toBeUndefined();
      expect(result.properties?.companyName).toBeDefined();
    });

    it("对于非 object 类型，不应替换 properties", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        properties: {
          newField: { type: "string" },
        },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.properties).toBeUndefined();
    });

    it("应该保留 object 类型的其他属性", () => {
      const original: ExtendedJSONSchema = {
        type: "object",
        title: "Original Object",
        required: ["field1"],
        properties: {
          field1: { type: "string" },
        },
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        properties: {
          field2: { type: "number" },
        },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.type).toBe("object");
      expect(result.title).toBe("Original Object");
      expect(result.required).toEqual(["field1"]);
      expect(result.properties).toEqual(linkage.properties);
    });
  });

  describe("边界情况", () => {
    it("应该处理空的 linkageSchema", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        pattern: "^[a-z]+$",
        title: "Original Title",
      };

      const linkage: Partial<ExtendedJSONSchema> = {};

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result).toEqual(original);
    });

    it("应该处理 linkageSchema 中的 undefined 值", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        title: "Original Title",
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        title: undefined,
        description: "New description",
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.title).toBe("Original Title"); // 保留原始
      expect(result.description).toBe("New description");
    });

    it("应该处理原始 schema 没有 ui 配置的情况", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        ui: {
          placeholder: "New placeholder",
        },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.ui?.placeholder).toBe("New placeholder");
      expect(result.ui?.linkages).toBeUndefined();
    });

    it("应该处理两者都有 ui 配置但原始没有 linkages 的情况", () => {
      const original: ExtendedJSONSchema = {
        type: "string",
        ui: {
          widget: "input",
        },
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        ui: {
          placeholder: "New placeholder",
        },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      expect(result.ui?.widget).toBe("input");
      expect(result.ui?.placeholder).toBe("New placeholder");
      expect(result.ui?.linkages).toBeUndefined();
    });
  });

  describe("综合场景", () => {
    it("应该同时处理多种属性的合并", () => {
      const originalLinkages = [
        {
          type: "visibility" as const,
          dependencies: ["field1"],
          fulfill: { state: { visible: true } },
        },
      ];

      const original: ExtendedJSONSchema = {
        type: "string",
        title: "Original Title",
        pattern: "^[a-z]+$",
        minLength: 5,
        ui: {
          widget: "input",
          placeholder: "Original",
          linkages: originalLinkages,
        },
      };

      const linkage: Partial<ExtendedJSONSchema> = {
        title: "New Title",
        pattern: "^[A-Z]+$",
        ui: {
          widget: "textarea",
          help: "New help text",
        },
      };

      const result = mergeSchemaWithLinkage(original, linkage);

      // 验证校验属性
      expect(result.pattern).toBe("^[A-Z]+$"); // 覆盖
      expect(result.minLength).toBe(5); // 保留

      // 验证 title
      expect(result.title).toBe("New Title"); // 覆盖

      // 验证 ui 配置
      expect(result.ui?.widget).toBe("textarea"); // 覆盖
      expect(result.ui?.help).toBe("New help text"); // 新增
      expect(result.ui?.placeholder).toBe("Original"); // 保留
      expect(result.ui?.linkages).toBe(originalLinkages); // 保留
    });
  });
});
