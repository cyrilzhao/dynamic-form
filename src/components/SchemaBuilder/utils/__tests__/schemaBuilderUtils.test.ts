import {
  defaultSchema,
  ensureHasFirstLevelNode,
  generateRandomKey,
  parseJsonPointer,
  validatePath,
  normalizeSchemaNumericValues,
} from "../schemaBuilderUtils";

describe("schemaBuilderUtils", () => {
  it("为缺少一级字段的 Schema 创建占位字段", () => {
    const schema = ensureHasFirstLevelNode(defaultSchema);
    expect(Object.keys(schema.properties ?? {})).toHaveLength(1);
  });

  it("为非 object Schema 创建 object 根节点", () => {
    const schema = ensureHasFirstLevelNode({
      type: "string",
      title: "Example",
    });
    expect(schema.type).toBe("object");
    expect(schema.title).toBe("Example");
  });

  it("解析 JSON Pointer 并校验路径", () => {
    const schema = {
      type: "object" as const,
      properties: { name: { type: "string" as const } },
    };
    expect(parseJsonPointer("#/properties/name")).toEqual([
      "properties",
      "name",
    ]);
    expect(validatePath(schema, ["properties", "name"])).toBe(true);
    expect(validatePath(schema, ["properties", "name", "items"])).toBe(false);
  });

  it("生成不重复的字段 key", () => {
    expect(generateRandomKey({})).toMatch(/^field_[a-z]{4}$/);
  });

  it("将所有 JSON Schema 数字关键字规范化为 number", () => {
    const schema = normalizeSchemaNumericValues({
      type: "object",
      minLength: "2",
      maxLength: "10",
      minimum: "0.5",
      maximum: "9",
      exclusiveMinimum: "1",
      exclusiveMaximum: "8",
      multipleOf: "0.5",
      minItems: "1",
      maxItems: "5",
      minProperties: "2",
      maxProperties: "6",
      minContains: "1",
      maxContains: "4",
      properties: {
        nested: { type: "string", minLength: "3" },
      },
      if: { properties: { age: { minimum: "18" } } },
    } as any);

    expect(schema).toMatchObject({
      minLength: 2,
      maxLength: 10,
      minimum: 0.5,
      maximum: 9,
      exclusiveMinimum: 1,
      exclusiveMaximum: 8,
      multipleOf: 0.5,
      minItems: 1,
      maxItems: 5,
      minProperties: 2,
      maxProperties: 6,
      minContains: 1,
      maxContains: 4,
      properties: { nested: { minLength: 3 } },
      if: { properties: { age: { minimum: 18 } } },
    });
    expect(typeof schema.minimum).toBe("number");
  });
});
