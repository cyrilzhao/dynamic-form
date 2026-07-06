import {
  parseSchemaLinkages,
  transformToAbsolutePaths,
} from "../schemaLinkageParser";
import type { ExtendedJSONSchema, LinkageConfig } from "../../types/schema";

describe("parseSchemaLinkages", () => {
  describe("基本功能", () => {
    it("应该从 schema 中解析出联动配置", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          country: {
            type: "string",
            title: "国家",
          },
          province: {
            type: "string",
            title: "省份",
            ui: {
              linkages: [
                {
                  type: "visibility",
                  dependencies: ["country"],
                  when: {
                    field: "country",
                    operator: "==",
                    value: "China",
                  },
                  fulfill: {
                    state: { visible: true },
                  },
                },
              ],
            },
          },
        },
      };

      const result = parseSchemaLinkages(schema);

      expect(result.linkages).toHaveProperty("province");
      expect(result.linkages.province).toBeInstanceOf(Array);
      expect(result.linkages.province).toHaveLength(1);
      expect(result.linkages.province[0].type).toBe("visibility");
      expect(result.linkages.province[0].dependencies).toEqual(["country"]);
    });

    it("应该返回空对象当 schema 没有 properties", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
      };

      const result = parseSchemaLinkages(schema);

      expect(result.linkages).toEqual({});
    });

    it("应该忽略没有联动配置的字段", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: {
            type: "string",
            title: "姓名",
          },
          age: {
            type: "number",
            title: "年龄",
          },
        },
      };

      const result = parseSchemaLinkages(schema);

      expect(result.linkages).toEqual({});
    });
  });

  describe("不同类型的联动配置", () => {
    it("应该解析 value 类型联动", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          price: {
            type: "number",
          },
          quantity: {
            type: "number",
          },
          total: {
            type: "number",
            ui: {
              linkages: [
                {
                  type: "value",
                  dependencies: ["price", "quantity"],
                  fulfill: {
                    function: "calculateTotal",
                  },
                },
              ],
            },
          },
        },
      };

      const result = parseSchemaLinkages(schema);

      expect(result.linkages.total).toBeInstanceOf(Array);
      expect(result.linkages.total).toHaveLength(1);
      expect(result.linkages.total[0].type).toBe("value");
      expect(result.linkages.total[0].fulfill?.function).toBe("calculateTotal");
    });
  });

  describe("嵌套对象解析", () => {
    it("应该递归解析嵌套对象中的联动配置", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              country: {
                type: "string",
              },
              city: {
                type: "string",
                ui: {
                  linkages: [
                    {
                      type: "options",
                      dependencies: ["./country"],
                      fulfill: {
                        function: "getCities",
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      };

      const result = parseSchemaLinkages(schema);

      expect(result.linkages["user.city"]).toBeDefined();
      expect(result.linkages["user.city"]).toHaveLength(1);
    });
  });

  describe("数组字段处理", () => {
    it("应该在遇到数组字段时停止递归", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          contacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  ui: {
                    linkages: [
                      {
                        type: "value",
                        dependencies: ["./type"],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      };

      const result = parseSchemaLinkages(schema);

      // 数组内部的联动不应该被解析
      expect(result.linkages).not.toHaveProperty("contacts.name");
    });
  });

  describe("布尔类型 schema 处理", () => {
    it("应该跳过布尔类型的 fieldSchema", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: true as any,
          age: {
            type: "number",
          },
        },
      };

      const result = parseSchemaLinkages(schema);
      expect(result.linkages).toEqual({});
    });
  });
});

describe("transformToAbsolutePaths", () => {
  describe("基本功能", () => {
    it("应该在没有 pathPrefix 时直接返回原始 linkages", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        name: [{ type: "value", dependencies: ["./type"] }],
      };

      const result = transformToAbsolutePaths(linkages, "");
      expect(result).toBe(linkages);
    });

    it("应该将字段路径转换为绝对路径", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        companyName: [{ type: "value", dependencies: ["#/properties/type"] }],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      expect(result["contacts.0.companyName"]).toBeDefined();
    });

    it("应该处理空字段路径", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        "": [{ type: "value", dependencies: ["./type"] }],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      expect(result["contacts.0"]).toBeDefined();
    });
  });

  describe("相对路径转换", () => {
    it("应该转换 dependencies 中的相对路径", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        companyName: [{ type: "value", dependencies: ["./type"] }],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      expect(result["contacts.0.companyName"][0].dependencies).toContain(
        "contacts.0.type",
      );
    });

    it("应该保留绝对路径不变", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        companyName: [
          { type: "value", dependencies: ["#/properties/globalType"] },
        ],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      expect(result["contacts.0.companyName"][0].dependencies).toContain(
        "#/properties/globalType",
      );
    });
  });

  describe("when 条件转换", () => {
    it("应该转换 when 条件中的相对路径", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        companyName: [
          {
            type: "visibility",
            dependencies: ["./type"],
            when: { field: "./type", operator: "==", value: "company" },
          },
        ],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      const when = result["contacts.0.companyName"][0].when as any;
      expect(when.field).toBe("contacts.0.type");
    });

    it("应该保留 when 条件中的绝对路径", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        companyName: [
          {
            type: "visibility",
            dependencies: ["#/properties/globalType"],
            when: {
              field: "#/properties/globalType",
              operator: "==",
              value: "company",
            },
          },
        ],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      const when = result["contacts.0.companyName"][0].when as any;
      expect(when.field).toBe("#/properties/globalType");
    });

    it("应该递归转换 and 条件中的路径", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        companyName: [
          {
            type: "visibility",
            dependencies: ["./type", "./status"],
            when: {
              and: [
                { field: "./type", operator: "==", value: "company" },
                { field: "./status", operator: "==", value: "active" },
              ],
            },
          },
        ],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      const when = result["contacts.0.companyName"][0].when as any;
      expect(when.and[0].field).toBe("contacts.0.type");
      expect(when.and[1].field).toBe("contacts.0.status");
    });

    it("应该递归转换 or 条件中的路径", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        companyName: [
          {
            type: "visibility",
            dependencies: ["./type", "./category"],
            when: {
              or: [
                { field: "./type", operator: "==", value: "company" },
                { field: "./category", operator: "==", value: "business" },
              ],
            },
          },
        ],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      const when = result["contacts.0.companyName"][0].when as any;
      expect(when.or[0].field).toBe("contacts.0.type");
      expect(when.or[1].field).toBe("contacts.0.category");
    });
  });

  describe("无 dependencies 和 when 的情况", () => {
    it("应该处理没有 when 的联动配置", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        companyName: [{ type: "value", dependencies: ["./type"] }],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      expect(result["contacts.0.companyName"][0].when).toBeUndefined();
    });

    it("应该处理没有 dependencies 的联动配置（覆盖第 204 行）", () => {
      // 使用类型断言绕过 TypeScript 检查，模拟运行时可能出现的情况
      const linkages: Record<string, LinkageConfig[]> = {
        companyName: [
          {
            type: "visibility",
            when: { field: "./type", operator: "==", value: "company" },
            fulfill: { state: { visible: true } },
          } as LinkageConfig, // 类型断言：模拟没有 dependencies 的情况
        ],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      // 验证没有 dependencies 时不会报错
      expect(result["contacts.0.companyName"][0].dependencies).toBeUndefined();
      // when 条件中的路径仍然会被转换
      const when = result["contacts.0.companyName"][0].when as any;
      expect(when.field).toBe("contacts.0.type");
    });

    it("应该处理 dependencies 为空数组的联动配置", () => {
      const linkages: Record<string, LinkageConfig[]> = {
        companyName: [
          {
            type: "visibility",
            dependencies: [], // 空数组
            when: { field: "./type", operator: "==", value: "company" },
            fulfill: { state: { visible: true } },
          },
        ],
      };

      const result = transformToAbsolutePaths(linkages, "contacts.0");
      expect(result["contacts.0.companyName"][0].dependencies).toEqual([]);
    });
  });
});
