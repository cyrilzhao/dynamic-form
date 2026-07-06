import { filterValueWithNestedSchemas } from "../filterValueWithNestedSchemas";
import type { ExtendedJSONSchema } from "../../types/schema";

describe("filterValueWithNestedSchemas", () => {
  describe("基本类型处理", () => {
    it("应该处理 null 值", () => {
      const schema: ExtendedJSONSchema = { type: "string" };
      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      const result = filterValueWithNestedSchemas(null, schema, nestedSchemas);
      expect(result).toBeNull();
    });

    it("应该处理 undefined 值", () => {
      const schema: ExtendedJSONSchema = { type: "string" };
      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      const result = filterValueWithNestedSchemas(
        undefined,
        schema,
        nestedSchemas,
      );
      expect(result).toBeUndefined();
    });

    it("应该直接返回基本类型", () => {
      const schema: ExtendedJSONSchema = { type: "string" };
      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      const value = "test string";
      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toBe("test string");
    });
  });

  describe("对象类型处理（无嵌套 schema）", () => {
    it("应该过滤掉不在 schema 中定义的字段", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      const value = {
        name: "John",
        age: 30,
        extraField: "should be removed",
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({ name: "John", age: 30 });
      expect(result).not.toHaveProperty("extraField");
    });
  });

  describe("嵌套对象处理（使用注册的 schema）", () => {
    it("应该使用注册的 schema 过滤嵌套字段", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          details: {
            type: "object",
            properties: {
              // 初始 schema 定义
              field1: { type: "string" },
              field2: { type: "string" },
            },
          },
        },
      };

      // 注册的 schema（动态切换后的 schema）
      const registeredSchema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          // 只保留 field1
          field1: { type: "string" },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      nestedSchemas.set("details", registeredSchema);

      const value = {
        name: "John",
        details: {
          field1: "value1",
          field2: "value2", // 应该被过滤掉
        },
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        name: "John",
        details: {
          field1: "value1",
          // field2 被过滤掉了
        },
      });
    });

    it("应该模拟动态表单 schema 切换场景", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          userType: { type: "string" },
          details: {
            type: "object",
            properties: {
              // 初始 schema（personal）
              firstName: { type: "string" },
              lastName: { type: "string" },
            },
          },
        },
      };

      // 用户切换到 company 类型后的 schema
      const companySchema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          companyName: { type: "string" },
          taxId: { type: "string" },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      nestedSchemas.set("details", companySchema);

      // 数据包含两种类型的字段（用户切换类型时保留了所有数据）
      const value = {
        userType: "company",
        details: {
          // personal 类型的字段（应该被过滤）
          firstName: "John",
          lastName: "Doe",
          // company 类型的字段（应该保留）
          companyName: "Acme Inc",
          taxId: "123456",
        },
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        userType: "company",
        details: {
          companyName: "Acme Inc",
          taxId: "123456",
          // firstName 和 lastName 被过滤掉了
        },
      });
    });
  });

  describe("多层嵌套处理", () => {
    it("应该处理多层嵌套对象的 schema 注册", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          company: {
            type: "object",
            properties: {
              name: { type: "string" },
              details: {
                type: "object",
                properties: {
                  field1: { type: "string" },
                  field2: { type: "string" },
                },
              },
            },
          },
        },
      };

      const registeredSchema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          field1: { type: "string" },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      nestedSchemas.set("company.details", registeredSchema);

      const value = {
        company: {
          name: "Acme",
          details: {
            field1: "value1",
            field2: "value2",
          },
        },
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        company: {
          name: "Acme",
          details: {
            field1: "value1",
          },
        },
      });
    });
  });

  describe("数组类型处理", () => {
    it("应该处理数组中的对象元素", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "number" },
                name: { type: "string" },
              },
            },
          },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      const value = {
        items: [
          { id: 1, name: "Item 1", extra: "remove" },
          { id: 2, name: "Item 2", another: "remove" },
        ],
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        items: [
          { id: 1, name: "Item 1" },
          { id: 2, name: "Item 2" },
        ],
      });
    });

    it("应该处理没有 items 的数组 schema", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          data: {
            type: "array",
            // 没有定义 items
          },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      const value = {
        data: [1, 2, 3, "test", { foo: "bar" }],
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        data: [1, 2, 3, "test", { foo: "bar" }],
      });
    });
  });

  describe("多层 nested-form 嵌套处理", () => {
    it("应该正确处理真实的公司信息表单场景（完整 schema）", () => {
      // startup 类型的 details schema（从 ui.schemas.startup 中提取）
      const startupDetailsSchema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          foundedYear: {
            type: "number",
            title: "成立年份",
            minimum: 2000,
            maximum: 2025,
            ui: { placeholder: "请输入成立年份" },
          },
          funding: {
            type: "string",
            title: "融资阶段",
            enum: ["seed", "seriesA", "seriesB", "seriesC"],
            enumNames: ["种子轮", "A轮", "B轮", "C轮"],
            ui: { widget: "select", placeholder: "请选择融资阶段" },
          },
          teamSize: {
            type: "integer",
            title: "团队规模",
            minimum: 1,
            maximum: 500,
            ui: { placeholder: "请输入团队人数" },
          },
        },
        required: ["foundedYear", "funding"],
      };

      const enterpriseDetailsSchema: ExtendedJSONSchema = {
        properties: {
          employeeCount: {
            type: "number",
            title: "员工数量",
            minimum: 500,
            ui: { placeholder: "请输入员工数量" },
          },
          revenue: {
            type: "number",
            title: "年营收（万元）",
            minimum: 0,
            ui: { placeholder: "请输入年营收" },
          },
          stockCode: {
            type: "string",
            title: "股票代码",
            ui: { placeholder: "如已上市，请输入股票代码" },
          },
          branches: {
            type: "integer",
            title: "分支机构数量",
            minimum: 0,
            ui: { placeholder: "请输入分支机构数量" },
          },
        },
        required: ["employeeCount", "revenue"],
      };

      const detailsSchema: ExtendedJSONSchema = {
        type: "object",
        title: "公司详情",
        properties: {},
        ui: {
          widget: "nested-form",
        },
      };

      const companySchema: ExtendedJSONSchema = {
        type: "object",
        title: "公司信息",
        properties: {
          type: {
            type: "string",
            title: "公司类型",
            enum: ["startup", "enterprise"],
            enumNames: ["初创公司", "大型企业"],
            ui: { widget: "radio" },
          },
          name: {
            type: "string",
            title: "公司名称",
            ui: { placeholder: "请输入公司名称" },
          },
          details: detailsSchema,
        },
        required: ["type", "name"],
      };

      // 使用真实的完整 schema
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          company: companySchema,
        },
        required: ["company"],
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      nestedSchemas.set("company", companySchema);
      nestedSchemas.set("company.details", startupDetailsSchema);

      // 模拟用户从 enterprise 切换到 startup 后的数据
      // 数据中同时包含两种类型的字段
      const value = {
        company: {
          type: "startup",
          name: "Tech Startup Inc",
          details: {
            // startup 类型的字段（应该保留）
            foundedYear: 2020,
            funding: "seriesA",
            teamSize: 50,
            // enterprise 类型的字段（应该被过滤掉）
            employeeCount: 1000,
            revenue: 50000,
            stockCode: "TSI",
            branches: 5,
          },
        },
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);

      // 验证结果
      expect(result).toEqual({
        company: {
          type: "startup",
          name: "Tech Startup Inc",
          details: {
            foundedYear: 2020,
            funding: "seriesA",
            teamSize: 50,
          },
        },
      });

      // 验证 enterprise 字段被正确过滤
      expect(result.company.details).not.toHaveProperty("employeeCount");
      expect(result.company.details).not.toHaveProperty("revenue");
      expect(result.company.details).not.toHaveProperty("stockCode");
      expect(result.company.details).not.toHaveProperty("branches");
    });

    it("应该正确处理两层以上的 nested-form 嵌套场景", () => {
      // 模拟实际的多层嵌套 schema 结构
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          company: {
            type: "object",
            properties: {
              type: { type: "string" },
              name: { type: "string" },
              details: {
                type: "object",
                properties: {}, // nested-form 的初始 properties 为空
              },
            },
          },
        },
      };

      // 注册 company.details 的动态 schema（第一层 nested-form）
      const startupDetailsSchema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          foundedYear: { type: "number" },
          funding: { type: "string" },
          teamSize: { type: "integer" },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      nestedSchemas.set("company.details", startupDetailsSchema);

      const value = {
        company: {
          type: "startup",
          name: "Tech Startup",
          details: {
            foundedYear: 2020,
            funding: "seriesA",
            teamSize: 50,
            // 额外的字段应该被过滤
            extraField: "should be removed",
          },
        },
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);

      expect(result).toEqual({
        company: {
          type: "startup",
          name: "Tech Startup",
          details: {
            foundedYear: 2020,
            funding: "seriesA",
            teamSize: 50,
          },
        },
      });
      expect(result.company.details).not.toHaveProperty("extraField");
    });

    it("应该正确处理三层嵌套的 nested-form 场景", () => {
      // 三层嵌套：root -> company -> details -> subDetails
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          company: {
            type: "object",
            properties: {
              type: { type: "string" },
              details: {
                type: "object",
                properties: {}, // 第一层 nested-form
              },
            },
          },
        },
      };

      // 第一层 nested-form 的 schema，包含第二层 nested-form
      const detailsSchema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          foundedYear: { type: "number" },
          subDetails: {
            type: "object",
            properties: {}, // 第二层 nested-form
          },
        },
      };

      // 第二层 nested-form 的 schema
      const subDetailsSchema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          field1: { type: "string" },
          field2: { type: "string" },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      nestedSchemas.set("company.details", detailsSchema);
      nestedSchemas.set("company.details.subDetails", subDetailsSchema);

      const value = {
        company: {
          type: "startup",
          details: {
            foundedYear: 2020,
            extraField1: "should be removed",
            subDetails: {
              field1: "value1",
              field2: "value2",
              extraField2: "should be removed",
            },
          },
        },
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);

      // 预期：第二层的 subDetails 数据应该被正确保留
      expect(result).toEqual({
        company: {
          type: "startup",
          details: {
            foundedYear: 2020,
            subDetails: {
              field1: "value1",
              field2: "value2",
            },
          },
        },
      });
      expect(result.company.details).not.toHaveProperty("extraField1");
      expect(result.company.details.subDetails).not.toHaveProperty(
        "extraField2",
      );
    });
  });

  describe("边界情况处理", () => {
    it("应该处理没有 properties 的对象 schema", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          config: {
            type: "object",
            // 没有定义 properties
          },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      const value = {
        config: {
          key1: "value1",
          key2: "value2",
          nested: { foo: "bar" },
        },
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        config: {
          key1: "value1",
          key2: "value2",
          nested: { foo: "bar" },
        },
      });
    });

    it("应该跳过 schema 中定义但数据中不存在的字段", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          email: { type: "string" },
          phone: { type: "string" },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      const value = {
        name: "John",
        age: 30,
        // email 和 phone 不存在
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        name: "John",
        age: 30,
      });
      expect(result).not.toHaveProperty("email");
      expect(result).not.toHaveProperty("phone");
    });

    it("应该正确处理顶层数组的路径（currentPath 为空）", () => {
      const schema: ExtendedJSONSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      const value = [
        { id: 1, name: "Item 1", extra: "remove" },
        { id: 2, name: "Item 2", another: "remove" },
      ];

      // 直接传入数组作为顶层值，currentPath 为空字符串
      const result = filterValueWithNestedSchemas(
        value,
        schema,
        nestedSchemas,
        "",
      );
      expect(result).toEqual([
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ]);
    });

    it("应该跳过注册 schema 中定义但数据中不存在的字段（覆盖第 62 行）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          details: {
            type: "object",
            properties: {
              field1: { type: "string" },
            },
          },
        },
      };

      // 注册的 schema 定义了多个字段
      const registeredSchema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          field1: { type: "string" },
          field2: { type: "string" },
          field3: { type: "string" },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      nestedSchemas.set("details", registeredSchema);

      // 数据中只有 field1，没有 field2 和 field3
      const value = {
        details: {
          field1: "value1",
          // field2 和 field3 不存在于数据中
        },
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        details: {
          field1: "value1",
        },
      });
      // 验证不存在的字段没有被添加
      expect(result.details).not.toHaveProperty("field2");
      expect(result.details).not.toHaveProperty("field3");
    });

    it("应该跳过注册 schema 字段在数据中完全不存在的情况（覆盖第 62 行 false 分支）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          details: {
            type: "object",
            properties: {},
          },
        },
      };

      // 注册的 schema 定义了字段
      const registeredSchema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      nestedSchemas.set("details", registeredSchema);

      // details 存在但是空对象，name 和 age 都不存在
      const value = {
        details: {},
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        details: {},
      });
    });

    it("应该跳过注册 schema 对应的字段本身不存在于数据中的情况（覆盖第 62 行 false 分支）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string" },
          details: {
            type: "object",
            properties: {},
          },
        },
      };

      // 注册 details 的 schema
      const registeredSchema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          field1: { type: "string" },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();
      nestedSchemas.set("details", registeredSchema);

      // 数据中没有 details 字段
      const value = {
        name: "John",
        // details 字段不存在
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        name: "John",
      });
      // 验证 details 没有被添加
      expect(result).not.toHaveProperty("details");
    });

    it("应该跳过对象字段中数据不存在的字段（覆盖第 74 行）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
            },
          },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();

      // 数据中只有 name，没有 email 和 phone
      const value = {
        user: {
          name: "John",
          // email 和 phone 不存在于数据中
        },
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        user: {
          name: "John",
        },
      });
      // 验证不存在的字段没有被添加
      expect(result.user).not.toHaveProperty("email");
      expect(result.user).not.toHaveProperty("phone");
    });

    it("应该跳过嵌套对象字段在数据中完全不存在的情况（覆盖第 74 行 false 分支）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          profile: {
            type: "object",
            properties: {
              address: {
                type: "object",
                properties: {
                  city: { type: "string" },
                  country: { type: "string" },
                },
              },
              contact: {
                type: "object",
                properties: {
                  email: { type: "string" },
                },
              },
            },
          },
        },
      };

      const nestedSchemas = new Map<string, ExtendedJSONSchema>();

      // profile 存在但 address 和 contact 都不存在
      const value = {
        profile: {},
      };

      const result = filterValueWithNestedSchemas(value, schema, nestedSchemas);
      expect(result).toEqual({
        profile: {},
      });
      expect(result.profile).not.toHaveProperty("address");
      expect(result.profile).not.toHaveProperty("contact");
    });
  });
});
