import { SchemaValidator } from "../SchemaValidator";
import type { ExtendedJSONSchema } from "../../types/schema";

describe("SchemaValidator", () => {
  describe("validate 方法基础测试", () => {
    it("验证 required 字段（覆盖 validate 方法的 required 验证逻辑）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          username: { type: "string", title: "Username" },
          email: { type: "string", title: "Email" },
        },
        required: ["username", "email"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        username: "",
        email: "",
      });

      expect(errors.username).toBe("Username is required");
      expect(errors.email).toBe("Email is required");
    });

    it("验证 properties 中的字段约束（覆盖 validate 方法的 properties 验证逻辑）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          age: { type: "number", title: "Age", minimum: 18 },
          name: { type: "string", title: "Name", minLength: 2 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        age: 16,
        name: "A",
      });

      expect(errors.age).toBe("Age minimum value is 18");
      expect(errors.name).toBe("Name minimum length is 2 characters");
    });

    it("处理没有 required 字段的 schema（覆盖 35-39 行的 else 分支）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string", title: "Name", minLength: 2 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        name: "A",
      });

      expect(errors.name).toBe("Name minimum length is 2 characters");
    });

    it("处理没有 properties 字段的 schema（覆盖 42 行的 else 分支）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        required: ["name"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        name: "",
      });

      expect(errors.name).toBe("name is required");
    });

    it("验证 required 字段有值时不报错（覆盖 35 行的 else 分支）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          username: { type: "string", title: "Username" },
          email: { type: "string", title: "Email" },
        },
        required: ["username", "email"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        username: "john",
        email: "john@example.com",
      });

      expect(Object.keys(errors).length).toBe(0);
    });
  });

  describe("required 幻象字段过滤测试", () => {
    it("顶层 required 包含 properties 中不存在的字段时应跳过", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          username: { type: "string", title: "Username" },
        },
        required: ["username", "nonExistentField"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({ username: "" });

      expect(errors.username).toBe("Username is required");
      expect(errors.nonExistentField).toBeUndefined(); // 幻象字段被跳过
    });

    it("顶层 required 同时包含存在和不存在的字段时只对存在字段报错", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
        },
        required: ["name", "phantom1", "phantom2"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({ name: "" });

      expect(errors.name).toBe("Name is required");
      expect(Object.keys(errors)).toEqual(["name"]); // 仅 name 报错
    });

    it("oneOf 子 schema 的 required 引用父 schema 同级字段（不在子 schema properties 中）应正常验证", () => {
      // 场景：accountType 和 idCard 定义在父 schema，oneOf 子 schema 只有 accountType 的 const 约束
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          accountType: { type: "string", title: "Account Type" },
          idCard: { type: "string", title: "ID Card" },
        },
        oneOf: [
          {
            properties: { accountType: { const: "personal" } },
            required: ["idCard"], // idCard 在父 schema 中，不在子 schema properties 中
          },
          {
            properties: { accountType: { const: "business" } },
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        accountType: "personal",
        idCard: "",
      });

      expect(errors.idCard).toBe("ID Card is required"); // 父 schema 同级字段应被验证
    });

    it("oneOf 子 schema 的 required 引用子 schema 自身 properties 的字段（不在父 schema 中）应正常验证", () => {
      // 场景：email 仅定义在 oneOf 子 schema 的 properties 中，父 schema 中没有
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
        },
        oneOf: [
          {
            properties: {
              email: { type: "string", title: "Email" },
            },
            required: ["email"], // email 在子 schema properties 中，不在父 schema 中
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({ name: "John", email: "" });

      expect(errors.email).toBe("Email is required"); // 子 schema 自身字段应被验证
    });

    it("anyOf 子 schema 的 required 引用父 schema 同级字段应正常验证", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          type: { type: "string", title: "Type" },
          cardNumber: { type: "string", title: "Card Number" },
          bankAccount: { type: "string", title: "Bank Account" },
        },
        anyOf: [
          {
            properties: { type: { const: "card" } },
            required: ["cardNumber"],
          },
          {
            properties: { type: { const: "bank" } },
            required: ["bankAccount"],
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      // 两个子 schema 均不匹配时，anyOf 会聚合错误
      const errors = validator.validate({
        type: "other",
        cardNumber: "",
        bankAccount: "",
      });

      // 至少有一个 required 错误被触发（anyOf 无匹配时返回合并错误）
      expect(errors.cardNumber ?? errors.bankAccount).toBeDefined();
    });

    it("allOf 子 schema 的 required 字段应正常验证", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          age: { type: "number", title: "Age" },
          license: { type: "string", title: "License" },
        },
        allOf: [{ required: ["age"] }, { required: ["license"] }],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({ age: undefined, license: "" });

      expect(errors.age).toBe("Age is required");
      expect(errors.license).toBe("License is required");
    });

    it("嵌套对象验证时 required 包含不存在字段应跳过", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string", title: "Name" },
            },
            required: ["name", "phantomField"], // phantomField 不在 user.properties 中
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({ user: { name: "" } });

      expect(errors["user.name"]).toBe("Name is required");
      expect(errors["user.phantomField"]).toBeUndefined(); // 幻象字段被跳过
    });

    it("嵌套对象验证时 required 包含存在字段应正常报错", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          address: {
            type: "object",
            properties: {
              city: { type: "string", title: "City" },
              street: { type: "string", title: "Street" },
            },
            required: ["city", "street"],
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({ address: { city: "", street: "" } });

      expect(errors["address.city"]).toBe("City is required");
      expect(errors["address.street"]).toBe("Street is required");
    });
  });

  describe("dependencies 验证", () => {
    describe("简单依赖（数组形式）", () => {
      it("当触发字段有值时，依赖字段必填", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            creditCard: { type: "string", title: "Card Number" },
            billingAddress: { type: "string", title: "Billing Address" },
          },
          dependencies: {
            creditCard: ["billingAddress"],
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          creditCard: "1234567890123456",
          billingAddress: "",
        });

        expect(errors.billingAddress).toBe(
          "Billing Address is required when Card Number is provided",
        );
      });

      it("当触发字段无值时，依赖字段不必填", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            creditCard: { type: "string", title: "Card Number" },
            billingAddress: { type: "string", title: "Billing Address" },
          },
          dependencies: {
            creditCard: ["billingAddress"],
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          creditCard: "",
          billingAddress: "",
        });

        expect(errors.billingAddress).toBeUndefined();
      });

      it("当触发字段和依赖字段都有值时，验证通过", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            creditCard: { type: "string", title: "Card Number" },
            billingAddress: { type: "string", title: "Billing Address" },
          },
          dependencies: {
            creditCard: ["billingAddress"],
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          creditCard: "1234567890123456",
          billingAddress: "123 Main St",
        });

        expect(Object.keys(errors).length).toBe(0);
      });
    });

    describe("Schema 依赖（对象形式）", () => {
      it("当触发字段有值时，验证依赖 schema", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            paymentMethod: {
              type: "string",
              enum: ["credit_card", "bank_transfer"],
            },
            cardNumber: { type: "string", title: "Card Number" },
            bankAccount: { type: "string", title: "Bank Account" },
          },
          dependencies: {
            paymentMethod: {
              oneOf: [
                {
                  properties: {
                    paymentMethod: { const: "credit_card" },
                    cardNumber: { pattern: "^[0-9]{16}$" },
                  },
                  required: ["cardNumber"],
                },
                {
                  properties: {
                    paymentMethod: { const: "bank_transfer" },
                    bankAccount: { pattern: "^[0-9]{10,20}$" },
                  },
                  required: ["bankAccount"],
                },
              ],
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          paymentMethod: "credit_card",
          cardNumber: "",
          bankAccount: "",
        });

        expect(errors.cardNumber).toBeDefined();
      });
    });
  });

  describe("if/then/else 条件分支验证", () => {
    it("当 if 条件满足时，应用 then schema", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          country: { type: "string", enum: ["china", "usa"], title: "Country" },
          idCard: { type: "string", title: "ID Card" },
          ssn: { type: "string", title: "SSN" },
        },
        if: {
          properties: { country: { const: "china" } },
        },
        then: {
          required: ["idCard"],
          properties: {
            idCard: { pattern: "^[1-9]\\d{17}$" },
          },
        },
        else: {
          required: ["ssn"],
          properties: {
            ssn: { pattern: "^\\d{3}-\\d{2}-\\d{4}$" },
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        country: "china",
        idCard: "",
        ssn: "",
      });

      expect(errors.idCard).toBe("ID Card is required");
      expect(errors.ssn).toBeUndefined();
    });

    it("当 if 条件不满足时，应用 else schema", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          country: { type: "string", enum: ["china", "usa"], title: "Country" },
          idCard: { type: "string", title: "ID Card" },
          ssn: { type: "string", title: "SSN" },
        },
        if: {
          properties: { country: { const: "china" } },
        },
        then: {
          required: ["idCard"],
          properties: {
            idCard: { pattern: "^[1-9]\\d{17}$" },
          },
        },
        else: {
          required: ["ssn"],
          properties: {
            ssn: { pattern: "^\\d{3}-\\d{2}-\\d{4}$" },
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        country: "usa",
        idCard: "",
        ssn: "",
      });

      expect(errors.ssn).toBe("SSN is required");
      expect(errors.idCard).toBeUndefined();
    });

    it("验证 pattern 格式", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          country: { type: "string", enum: ["china", "usa"], title: "Country" },
          idCard: { type: "string", title: "ID Card" },
        },
        if: {
          properties: { country: { const: "china" } },
        },
        then: {
          required: ["idCard"],
          properties: {
            idCard: { pattern: "^[1-9]\\d{17}$" },
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        country: "china",
        idCard: "123",
      });

      expect(errors.idCard).toBe("ID Card invalid format");
    });
  });

  describe("allOf 逻辑与验证", () => {
    it("必须满足所有子 schema", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          isStudent: { type: "boolean", title: "是否学生" },
          age: { type: "integer", title: "年龄" },
          studentId: { type: "string", title: "学号" },
          school: { type: "string", title: "学校" },
          guardianPhone: { type: "string", title: "监护人电话" },
        },
        allOf: [
          {
            if: { properties: { isStudent: { const: true } } },
            then: { required: ["studentId", "school"] },
          },
          {
            if: { properties: { age: { maximum: 17 } } },
            then: { required: ["guardianPhone"] },
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        isStudent: true,
        age: 16,
        studentId: "",
        school: "",
        guardianPhone: "",
      });

      expect(errors.studentId).toBe("学号 is required");
      expect(errors.school).toBe("学校 is required");
      expect(errors.guardianPhone).toBe("监护人电话 is required");
    });
  });

  describe("anyOf 逻辑或验证", () => {
    it("至少满足一个子 schema 时验证通过", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          email: { type: "string", title: "Email", format: "email" },
          phone: { type: "string", title: "Phone" },
          wechat: { type: "string", title: "WeChat" },
        },
        anyOf: [
          { required: ["email"] },
          { required: ["phone"] },
          { required: ["wechat"] },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        email: "test@example.com",
        phone: "",
        wechat: "",
      });

      expect(Object.keys(errors).length).toBe(0);
    });

    it("没有任何 schema 匹配时返回错误", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          email: { type: "string", title: "Email", format: "email" },
          phone: { type: "string", title: "Phone" },
          wechat: { type: "string", title: "WeChat" },
        },
        anyOf: [
          { required: ["email"] },
          { required: ["phone"] },
          { required: ["wechat"] },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        email: "",
        phone: "",
        wechat: "",
      });

      expect(errors.email).toContain(
        "Must satisfy at least one of the following conditions",
      );
    });
  });

  describe("oneOf 逻辑异或验证", () => {
    it("有且仅有一个 schema 匹配时验证通过", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          accountType: {
            type: "string",
            enum: ["personal", "business"],
            title: "Account Type",
          },
          idCard: { type: "string", title: "ID Card" },
          businessLicense: { type: "string", title: "营业执照号" },
        },
        oneOf: [
          {
            properties: { accountType: { const: "personal" } },
            required: ["idCard"],
          },
          {
            properties: { accountType: { const: "business" } },
            required: ["businessLicense"],
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        accountType: "personal",
        idCard: "123456789012345678",
        businessLicense: "",
      });

      expect(Object.keys(errors).length).toBe(0);
    });

    it("没有任何 schema 匹配时返回错误", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          accountType: {
            type: "string",
            enum: ["personal", "business"],
            title: "Account Type",
          },
          idCard: { type: "string", title: "ID Card" },
          businessLicense: { type: "string", title: "营业执照号" },
        },
        oneOf: [
          {
            properties: { accountType: { const: "personal" } },
            required: ["idCard"],
          },
          {
            properties: { accountType: { const: "business" } },
            required: ["businessLicense"],
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        accountType: "personal",
        idCard: "",
        businessLicense: "",
      });

      expect(errors.idCard).toBe("ID Card is required");
    });

    it("多个 schema 匹配时返回错误", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          accountType: {
            type: "string",
            enum: ["personal", "business"],
            title: "Account Type",
          },
          idCard: { type: "string", title: "ID Card" },
          businessLicense: { type: "string", title: "营业执照号" },
        },
        oneOf: [
          {
            // 第一个 schema：只要求 idCard 必填，不限制 accountType
            required: ["idCard"],
          },
          {
            // 第二个 schema：只要求 businessLicense 必填，不限制 accountType
            required: ["businessLicense"],
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        accountType: "personal",
        idCard: "123456789012345678",
        businessLicense: "123456789",
      });

      expect(errors._schema).toBe(
        "Data matches multiple mutually exclusive conditions",
      );
    });
  });

  describe("字符串类型验证", () => {
    it("验证 minLength 最小长度", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          username: { type: "string", title: "Username", minLength: 3 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        username: "ab",
      });

      expect(errors.username).toBe("Username minimum length is 3 characters");
    });

    it("验证 maxLength 最大长度", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          username: { type: "string", title: "Username", maxLength: 10 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        username: "verylongusername",
      });

      expect(errors.username).toBe("Username maximum length is 10 characters");
    });

    it("验证 pattern 正则表达式", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          phone: { type: "string", title: "Phone", pattern: "^\\d{11}$" },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        phone: "123",
      });

      expect(errors.phone).toBe("Phone invalid format");
    });

    it("验证 pattern 通过", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          phone: { type: "string", title: "Phone", pattern: "^\\d{11}$" },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        phone: "13800138000",
      });

      expect(Object.keys(errors).length).toBe(0);
    });
  });

  describe("数字类型验证", () => {
    it("验证 minimum 最小值", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          age: { type: "number", title: "Age", minimum: 18 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        age: 16,
      });

      expect(errors.age).toBe("Age minimum value is 18");
    });

    it("验证 maximum 最大值", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          age: { type: "number", title: "Age", maximum: 100 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        age: 120,
      });

      expect(errors.age).toBe("Age maximum value is 100");
    });

    it("验证 exclusiveMinimum 排他最小值", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          score: { type: "number", title: "Score", exclusiveMinimum: 0 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        score: 0,
      });

      expect(errors.score).toBe("Score must be greater than 0");
    });

    it("验证 exclusiveMaximum 排他最大值", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          score: { type: "number", title: "Score", exclusiveMaximum: 100 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        score: 100,
      });

      expect(errors.score).toBe("Score must be less than 100");
    });

    it("验证 multipleOf 倍数", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          quantity: { type: "number", title: "Quantity", multipleOf: 5 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        quantity: 7,
      });

      expect(errors.quantity).toBe("Quantity must be a multiple of 5");
    });

    it("验证 multipleOf 通过", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          quantity: { type: "number", title: "Quantity", multipleOf: 5 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        quantity: 15,
      });

      expect(Object.keys(errors).length).toBe(0);
    });

    it("integer 类型应拒绝小数", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          quantity: { type: "integer", title: "Quantity", minimum: 1 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({ quantity: 1.5 });

      expect(errors.quantity).toBe("Quantity must be an integer");
    });

    it("integer 类型应遵循 minimum 约束", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          quantity: { type: "integer", title: "Quantity", minimum: 1 },
        },
      };

      const validator = new SchemaValidator(schema);

      expect(validator.validate({ quantity: 0 }).quantity).toBe(
        "Quantity minimum value is 1",
      );
      expect(validator.validate({ quantity: 1 })).toEqual({});
    });
  });

  describe("数组类型验证", () => {
    it("验证 minItems 最小项数", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          tags: { type: "array", title: "Tags", minItems: 2 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        tags: ["tag1"],
      });

      expect(errors.tags).toBe("Tags requires at least 2 items");
    });

    it("验证 maxItems 最大项数", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          tags: { type: "array", title: "Tags", maxItems: 3 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        tags: ["tag1", "tag2", "tag3", "tag4"],
      });

      expect(errors.tags).toBe("Tags allows at most 3 items");
    });

    it("验证 uniqueItems 唯一性", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          tags: { type: "array", title: "Tags", uniqueItems: true },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        tags: ["tag1", "tag2", "tag1"],
      });

      expect(errors.tags).toBe("Tags must not contain duplicate items");
    });

    it("验证 uniqueItems 通过", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          tags: { type: "array", title: "Tags", uniqueItems: true },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        tags: ["tag1", "tag2", "tag3"],
      });

      expect(Object.keys(errors).length).toBe(0);
    });
  });

  describe("对象类型验证", () => {
    it("验证 minProperties 最小属性数", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          metadata: { type: "object", title: "Metadata", minProperties: 2 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        metadata: { key1: "value1" },
      });

      expect(errors.metadata).toBe("Metadata requires at least 2 properties");
    });

    it("验证 maxProperties 最大属性数", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          metadata: { type: "object", title: "Metadata", maxProperties: 2 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        metadata: { key1: "value1", key2: "value2", key3: "value3" },
      });

      expect(errors.metadata).toBe("Metadata allows at most 2 properties");
    });

    it("验证对象字段的 minProperties（通过 validateObject 方法）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          config: { type: "object", title: "Config", minProperties: 2 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        config: { key1: "value1" },
      });

      expect(errors.config).toBe("Config requires at least 2 properties");
    });

    it("验证对象字段的 maxProperties（通过 validateObject 方法）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          config: { type: "object", title: "Config", maxProperties: 2 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        config: { key1: "value1", key2: "value2", key3: "value3" },
      });

      expect(errors.config).toBe("Config allows at most 2 properties");
    });

    it("通过 validateFieldValue 触发 validateObject 的 minProperties 分支（覆盖 647 行）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          settings: {
            type: "object",
            title: "Settings",
            minProperties: 3,
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        settings: { a: 1, b: 2 },
      });

      expect(errors.settings).toBe("Settings requires at least 3 properties");
    });

    it("通过 validateFieldValue 触发 validateObject 的 maxProperties 分支（覆盖 656 行）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          settings: {
            type: "object",
            title: "Settings",
            maxProperties: 1,
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        settings: { a: 1, b: 2 },
      });

      expect(errors.settings).toBe("Settings allows at most 1 properties");
    });

    it("验证对象属性数满足 minProperties 要求（覆盖 647 行的 else 分支）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          config: { type: "object", title: "Config", minProperties: 2 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        config: { key1: "value1", key2: "value2" },
      });

      expect(Object.keys(errors).length).toBe(0);
    });

    it("验证对象属性数满足 maxProperties 要求（覆盖 656 行的 else 分支）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          config: { type: "object", title: "Config", maxProperties: 3 },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        config: { key1: "value1", key2: "value2" },
      });

      expect(Object.keys(errors).length).toBe(0);
    });
  });

  describe("const 常量值验证", () => {
    it("验证 const 值不匹配", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          status: { const: "active", title: "Status" },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        status: "inactive",
      });

      expect(errors.status).toBe("Status must be active");
    });

    it("验证 const 值匹配", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          status: { const: "active", title: "Status" },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        status: "active",
      });

      expect(Object.keys(errors).length).toBe(0);
    });
  });

  describe("enum 枚举值验证", () => {
    it("验证 enum 值不在枚举列表中", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          color: {
            type: "string",
            title: "Color",
            enum: ["red", "green", "blue"],
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        color: "yellow",
      });

      expect(errors.color).toBe("Color must be one of: red, green, blue");
    });

    it("验证 enum 值在枚举列表中", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          color: {
            type: "string",
            title: "Color",
            enum: ["red", "green", "blue"],
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        color: "red",
      });

      expect(Object.keys(errors).length).toBe(0);
    });
  });

  describe("format 格式验证", () => {
    it("验证 email 格式错误", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          email: { type: "string", title: "Email", format: "email" },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        email: "invalid-email",
      });

      expect(errors.email).toBe("Email invalid format (expected: email)");
    });

    it("验证 email 格式正确", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          email: { type: "string", title: "Email", format: "email" },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        email: "test@example.com",
      });

      expect(Object.keys(errors).length).toBe(0);
    });

    it("验证 uri 格式错误", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          website: { type: "string", title: "Website", format: "uri" },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        website: "not-a-url",
      });

      expect(errors.website).toBe("Website invalid format (expected: uri)");
    });

    it("验证 uri 格式正确", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          website: { type: "string", title: "Website", format: "uri" },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        website: "https://example.com",
      });

      expect(Object.keys(errors).length).toBe(0);
    });

    it("验证 date 格式错误", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          birthDate: { type: "string", title: "Birth Date", format: "date" },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        birthDate: "2024/01/01",
      });

      expect(errors.birthDate).toBe(
        "Birth Date invalid format (expected: date)",
      );
    });

    it("验证 date 格式正确", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          birthDate: { type: "string", title: "Birth Date", format: "date" },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        birthDate: "2024-01-01",
      });

      expect(Object.keys(errors).length).toBe(0);
    });
  });

  describe("嵌套条件分支验证", () => {
    it("验证嵌套的 if/then/else（三层条件）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          country: {
            type: "string",
            title: "Country",
            enum: ["china", "usa", "other"],
          },
          idCard: { type: "string", title: "ID Card" },
          ssn: { type: "string", title: "SSN" },
          passport: { type: "string", title: "Passport" },
        },
        if: {
          properties: { country: { const: "china" } },
        },
        then: {
          required: ["idCard"],
          properties: {
            idCard: { pattern: "^[1-9]\\d{17}$" },
          },
        },
        else: {
          if: {
            properties: { country: { const: "usa" } },
          },
          then: {
            required: ["ssn"],
            properties: {
              ssn: { pattern: "^\\d{3}-\\d{2}-\\d{4}$" },
            },
          },
          else: {
            required: ["passport"],
            properties: {
              passport: { pattern: "^[A-Z]\\d{8}$" },
            },
          },
        },
      };

      const validator = new SchemaValidator(schema);

      // 测试第一层条件：china
      const errors1 = validator.validate({
        country: "china",
        idCard: "",
        ssn: "",
        passport: "",
      });
      expect(errors1.idCard).toBe("ID Card is required");
      expect(errors1.ssn).toBeUndefined();
      expect(errors1.passport).toBeUndefined();

      // 测试第二层条件：usa
      const errors2 = validator.validate({
        country: "usa",
        idCard: "",
        ssn: "",
        passport: "",
      });
      expect(errors2.ssn).toBe("SSN is required");
      expect(errors2.idCard).toBeUndefined();
      expect(errors2.passport).toBeUndefined();

      // 测试第三层条件：other
      const errors3 = validator.validate({
        country: "other",
        idCard: "",
        ssn: "",
        passport: "",
      });
      expect(errors3.passport).toBe("Passport is required");
      expect(errors3.idCard).toBeUndefined();
      expect(errors3.ssn).toBeUndefined();
    });
  });

  describe("Schema 特殊类型处理", () => {
    it("跳过 boolean 类型的 fieldSchema（validate 方法）", () => {
      const schema: any = {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
          // boolean 类型的 schema 应该被跳过
          enabled: true,
        },
        required: ["name"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        name: "",
        enabled: true,
      });

      expect(errors.name).toBe("Name is required");
      expect(errors.enabled).toBeUndefined();
    });

    it("跳过 boolean 类型的 fieldSchema（validateAgainstSchema 方法）", () => {
      const schema: any = {
        type: "object",
        properties: {
          email: { type: "string", title: "Email" },
          active: false,
        },
        oneOf: [
          {
            properties: {
              email: { type: "string", format: "email" },
              active: true,
            },
            required: ["email"],
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        email: "",
        active: true,
      });

      expect(errors.email).toBe("Email is required");
    });
  });

  describe("anyOf 错误信息合并", () => {
    it("多个字段都不满足 anyOf 条件时，合并所有错误信息", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          email: { type: "string", title: "Email", format: "email" },
          phone: { type: "string", title: "Phone", pattern: "^\\d{11}$" },
          wechat: { type: "string", title: "WeChat", minLength: 5 },
        },
        anyOf: [
          { required: ["email"] },
          { required: ["phone"] },
          { required: ["wechat"] },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        email: "",
        phone: "",
        wechat: "",
      });

      // 验证错误信息包含 "Must satisfy at least one of the following conditions"
      expect(errors.email).toContain(
        "Must satisfy at least one of the following conditions",
      );
      expect(errors.phone).toContain(
        "Must satisfy at least one of the following conditions",
      );
      expect(errors.wechat).toContain(
        "Must satisfy at least one of the following conditions",
      );
    });

    it("anyOf 错误合并时，同一字段在多个 schema 中都有错误（覆盖 264 行）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          value: { type: "number", title: "Value" },
        },
        anyOf: [
          {
            properties: {
              value: { minimum: 10 },
            },
          },
          {
            properties: {
              value: { maximum: 5 },
            },
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        value: 7,
      });

      // 验证错误信息合并了多个条件
      expect(errors.value).toContain(
        "Must satisfy at least one of the following conditions",
      );
    });
  });

  describe("dependencies Schema 依赖验证", () => {
    it("验证 Schema 依赖（对象形式）触发 178 行的 else if 分支", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          paymentMethod: {
            type: "string",
            enum: ["credit_card", "bank_transfer"],
            title: "Payment Method",
          },
          cardNumber: { type: "string", title: "Card Number" },
          bankAccount: { type: "string", title: "Bank Account" },
        },
        dependencies: {
          paymentMethod: {
            oneOf: [
              {
                properties: {
                  paymentMethod: { const: "credit_card" },
                },
                required: ["cardNumber"],
              },
              {
                properties: {
                  paymentMethod: { const: "bank_transfer" },
                },
                required: ["bankAccount"],
              },
            ],
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        paymentMethod: "credit_card",
        cardNumber: "",
        bankAccount: "",
      });

      expect(errors.cardNumber).toBe("Card Number is required");
    });

    it("验证 Schema 依赖（对象形式）不是数组的情况（覆盖 178 行）", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          country: { type: "string", title: "Country" },
          state: { type: "string", title: "State" },
        },
        dependencies: {
          country: {
            properties: {
              state: { type: "string", minLength: 2 },
            },
            required: ["state"],
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        country: "USA",
        state: "",
      });

      expect(errors.state).toBe("State is required");
    });
  });

  describe("getFieldTitle 方法测试", () => {
    it("从传入的 schema 参数中查找字段 title", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
        },
        // 使用 oneOf 来触发 validateAgainstSchema，其中包含根 schema 中不存在的字段
        oneOf: [
          {
            properties: {
              email: {
                type: "string",
                title: "Email in OneOf",
                format: "email",
              },
            },
            required: ["email"],
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        name: "John",
        email: "",
      });

      // 验证能够从传入的 schema 中找到 title（因为根 schema 中没有 email 字段）
      expect(errors.email).toBe("Email in OneOf is required");
    });

    it("处理 title 不是字符串类型的情况", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: {
            type: "string",
            // @ts-ignore - 故意使用非字符串类型的 title 来测试边界情况
            title: 123,
          },
        },
        required: ["name"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        name: "",
      });

      // 当 title 不是字符串时，应该使用字段名
      expect(errors.name).toBe("name is required");
    });

    it("findFieldTitle 方法处理没有 properties 的 schema", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          data: { type: "string", title: "Data" },
        },
        // 使用 oneOf 包含没有 properties 的 schema
        oneOf: [
          {
            required: ["data"],
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        data: "",
      });

      expect(errors.data).toBe("Data is required");
    });
  });

  describe("边界情况测试", () => {
    it("空值处理：null 值应被视为无值", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
        },
        required: ["name"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        name: null,
      });

      expect(errors.name).toBe("Name is required");
    });

    it("空值处理：undefined 值应被视为无值", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
        },
        required: ["name"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        name: undefined,
      });

      expect(errors.name).toBe("Name is required");
    });

    it("空值处理：空字符串应被视为无值", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
        },
        required: ["name"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        name: "",
      });

      expect(errors.name).toBe("Name is required");
    });

    it("空值处理：空数组应被视为无值", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          tags: { type: "array", title: "Tags" },
        },
        required: ["tags"],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        tags: [],
      });

      expect(errors.tags).toBe("Tags is required");
    });

    it("嵌套对象字段的 title 查找", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          user: {
            type: "object",
            title: "User",
            properties: {
              name: { type: "string", title: "User Name" },
            },
          },
          profile: {
            type: "object",
            title: "Profile",
            properties: {
              bio: { type: "string", title: "Biography" },
            },
          },
        },
        // 使用 oneOf 来触发 validateAgainstSchema，其中包含对嵌套字段的验证
        // 这会触发 findFieldTitle 的递归查找逻辑（132-133行）
        oneOf: [
          {
            required: ["bio"],
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        user: { name: "John" },
        profile: {},
      });

      // 验证能够递归找到嵌套对象中的字段 title
      expect(errors.bio).toBe("Biography is required");
    });

    it("嵌套条件验证中的 dependencies", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          city: { type: "string", title: "City" },
          street: { type: "string", title: "Street" },
        },
        // 使用 oneOf 同时包含 dependencies 和 if 来触发 validateAgainstSchema 中的 dependencies 分支（367行）
        oneOf: [
          {
            if: {
              properties: { city: { type: "string", minLength: 1 } },
            },
            dependencies: {
              city: ["street"],
            },
          },
        ],
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        city: "Beijing",
        street: "",
      });

      expect(errors.street).toBe("Street is required when City is provided");
    });

    it("嵌套条件验证中的 allOf", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          isActive: { type: "boolean" },
          email: { type: "string", title: "Email" },
          phone: { type: "string", title: "Phone" },
        },
        // 使用 if/then 包含 allOf 来触发嵌套验证
        if: {
          properties: { isActive: { const: true } },
        },
        then: {
          allOf: [{ required: ["email"] }, { required: ["phone"] }],
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        isActive: true,
        email: "",
        phone: "",
      });

      expect(errors.email).toBe("Email is required");
      expect(errors.phone).toBe("Phone is required");
    });

    it("嵌套条件验证中的 anyOf", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          needContact: { type: "boolean" },
          email: { type: "string", title: "Email" },
          phone: { type: "string", title: "Phone" },
        },
        // 使用 if/then 包含 anyOf 来触发嵌套验证
        if: {
          properties: { needContact: { const: true } },
        },
        then: {
          anyOf: [{ required: ["email"] }, { required: ["phone"] }],
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        needContact: true,
        email: "",
        phone: "",
      });

      expect(errors.email).toContain(
        "Must satisfy at least one of the following conditions",
      );
    });

    it("类型推断：通过 minItems 推断为 array 类型", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          items: {
            title: "Items",
            minItems: 2,
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        items: ["item1"],
      });

      expect(errors.items).toBe("Items requires at least 2 items");
    });

    it("类型推断：通过 minProperties 推断为 object 类型", () => {
      const schema: ExtendedJSONSchema = {
        type: "object",
        properties: {
          config: {
            title: "Config",
            minProperties: 1,
          },
        },
      };

      const validator = new SchemaValidator(schema);
      const errors = validator.validate({
        config: {},
      });

      expect(errors.config).toBe("Config requires at least 1 properties");
    });
  });

  describe("递归验证（嵌套字段验证）", () => {
    describe("数组递归验证", () => {
      it("递归验证数组中对象元素的 required 字段", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            users: {
              type: "array",
              title: "Users",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", title: "Name" },
                  email: { type: "string", title: "Email" },
                },
                required: ["name", "email"],
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          users: [
            { name: "", email: "" },
            { name: "John", email: "" },
          ],
        });

        expect(errors["users[0].name"]).toBe("Name is required");
        expect(errors["users[0].email"]).toBe("Email is required");
        expect(errors["users[1].name"]).toBeUndefined();
        expect(errors["users[1].email"]).toBe("Email is required");
      });

      it("递归验证数组中对象元素的 properties 约束", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            products: {
              type: "array",
              title: "Products",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", title: "Product Name", minLength: 3 },
                  price: { type: "number", title: "Price", minimum: 0 },
                },
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          products: [
            { name: "AB", price: -10 },
            { name: "Valid Product", price: 100 },
          ],
        });

        expect(errors["products[0].name"]).toBeDefined();
        expect(errors["products[0].price"]).toBeDefined();
        expect(errors["products[1].name"]).toBeUndefined();
        expect(errors["products[1].price"]).toBeUndefined();
      });

      it("递归验证非对象类型的数组元素", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            scores: {
              type: "array",
              title: "Scores",
              items: {
                type: "number",
                title: "Score",
                minimum: 0,
                maximum: 100,
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          scores: [-5, 50, 150],
        });

        expect(errors["scores[0]"]).toBeDefined();
        expect(errors["scores[1]"]).toBeUndefined();
        expect(errors["scores[2]"]).toBeDefined();
      });

      it("递归验证字符串类型的数组元素", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            emails: {
              type: "array",
              title: "Emails",
              items: {
                type: "string",
                title: "Email",
                format: "email",
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          emails: ["invalid", "test@example.com", "also-invalid"],
        });

        expect(errors["emails[0]"]).toBeDefined();
        expect(errors["emails[1]"]).toBeUndefined();
        expect(errors["emails[2]"]).toBeDefined();
      });

      it("跳过数组元素中 boolean 类型的 propSchema", () => {
        const schema: any = {
          type: "object",
          properties: {
            items: {
              type: "array",
              title: "Items",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", title: "Name", minLength: 2 },
                  enabled: true,
                },
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          items: [{ name: "A", enabled: true }],
        });

        expect(errors["items[0].name"]).toBeDefined();
        expect(errors["items[0].enabled"]).toBeUndefined();
      });
    });

    describe("对象递归验证", () => {
      it("递归验证嵌套对象的 required 字段", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            address: {
              type: "object",
              title: "Address",
              properties: {
                city: { type: "string", title: "City" },
                street: { type: "string", title: "Street" },
              },
              required: ["city", "street"],
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          address: { city: "", street: "" },
        });

        // 递归验证时，错误信息使用字段路径作为 key
        expect(errors["address.city"]).toBeDefined();
        expect(errors["address.street"]).toBeDefined();
      });

      it("递归验证嵌套对象的 properties 约束", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            profile: {
              type: "object",
              title: "Profile",
              properties: {
                age: { type: "number", title: "Age", minimum: 18 },
                bio: { type: "string", title: "Bio", maxLength: 100 },
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          profile: {
            age: 15,
            bio: "A".repeat(150),
          },
        });

        // 递归验证时，错误信息使用字段路径作为 key
        expect(errors["profile.age"]).toBeDefined();
        expect(errors["profile.bio"]).toBeDefined();
      });

      it("跳过嵌套对象中 boolean 类型的 propSchema", () => {
        const schema: any = {
          type: "object",
          properties: {
            settings: {
              type: "object",
              title: "Settings",
              properties: {
                theme: { type: "string", title: "Theme", minLength: 3 },
                enabled: true,
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          settings: { theme: "AB", enabled: true },
        });

        expect(errors["settings.theme"]).toBeDefined();
        expect(errors["settings.enabled"]).toBeUndefined();
      });

      it("递归验证多层嵌套对象", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            company: {
              type: "object",
              title: "Company",
              properties: {
                name: { type: "string", title: "Company Name" },
                address: {
                  type: "object",
                  title: "Company Address",
                  properties: {
                    country: { type: "string", title: "Country", minLength: 2 },
                  },
                  required: ["country"],
                },
              },
              required: ["name"],
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          company: {
            name: "",
            address: { country: "A" },
          },
        });

        expect(errors["company.name"]).toBeDefined();
        expect(errors["company.address.country"]).toBeDefined();
      });
    });
  });

  describe("条件验证中的 recursive 参数", () => {
    describe("validateDependencies 中的 recursive", () => {
      it("Schema 依赖验证应该传递 recursive 参数", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            hasAddress: { type: "boolean", title: "Has Address" },
            address: {
              type: "object",
              title: "Address",
              properties: {
                city: { type: "string", title: "City", minLength: 2 },
                street: { type: "string", title: "Street" },
              },
              required: ["city"],
            },
          },
          dependencies: {
            hasAddress: {
              properties: {
                address: {
                  type: "object",
                  properties: {
                    city: { type: "string", minLength: 2 },
                  },
                  required: ["city"],
                },
              },
              required: ["address"],
            },
          },
        };

        const validator = new SchemaValidator(schema);

        // 使用 recursive=true 验证
        const errorsWithRecursive = validator.validate({
          hasAddress: true,
          address: { city: "A", street: "" },
        });

        // 应该验证嵌套的 address 对象
        expect(errorsWithRecursive["address.city"]).toBeDefined();
      });
    });

    describe("validateConditional 中的 recursive", () => {
      it("if/then/else 验证应该传递 recursive 参数", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            userType: { type: "string", title: "User Type" },
            profile: {
              type: "object",
              title: "Profile",
              properties: {
                name: { type: "string", title: "Name", minLength: 2 },
              },
            },
          },
          if: {
            properties: { userType: { const: "premium" } },
          },
          then: {
            properties: {
              profile: {
                type: "object",
                properties: {
                  name: { type: "string", minLength: 5 },
                },
                required: ["name"],
              },
            },
            required: ["profile"],
          },
        };

        const validator = new SchemaValidator(schema);

        // 使用 recursive=true 验证
        const errors = validator.validate({
          userType: "premium",
          profile: { name: "AB" },
        });

        // 应该验证嵌套的 profile 对象
        expect(Object.keys(errors).length).toBeGreaterThan(0);
      });

      it("else 分支验证应该传递 recursive 参数", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            userType: { type: "string", title: "User Type" },
            basicInfo: {
              type: "object",
              title: "Basic Info",
              properties: {
                nickname: { type: "string", title: "Nickname", minLength: 2 },
              },
            },
          },
          if: {
            properties: { userType: { const: "premium" } },
          },
          then: {
            required: ["profile"],
          },
          else: {
            properties: {
              basicInfo: {
                type: "object",
                properties: {
                  nickname: { type: "string", minLength: 3 },
                },
                required: ["nickname"],
              },
            },
            required: ["basicInfo"],
          },
        };

        const validator = new SchemaValidator(schema);

        // userType 不是 premium，应该走 else 分支
        const errors = validator.validate({
          userType: "basic",
          basicInfo: { nickname: "A" },
        });

        // 应该验证 else 分支中的 basicInfo
        expect(Object.keys(errors).length).toBeGreaterThan(0);
      });
    });

    describe("validateAllOf 中的 recursive", () => {
      it("allOf 验证应该传递 recursive 参数", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            data: {
              type: "object",
              title: "Data",
              properties: {
                value: { type: "string", title: "Value" },
              },
            },
          },
          allOf: [
            {
              properties: {
                data: {
                  type: "object",
                  properties: {
                    value: { type: "string", minLength: 3 },
                  },
                  required: ["value"],
                },
              },
              required: ["data"],
            },
          ],
        };

        const validator = new SchemaValidator(schema);

        const errors = validator.validate({
          data: { value: "AB" },
        });

        // 应该验证 allOf 中的嵌套对象
        expect(Object.keys(errors).length).toBeGreaterThan(0);
      });
    });

    describe("validateAnyOf 中的 recursive", () => {
      it("anyOf 验证应该传递 recursive 参数", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            contact: {
              type: "object",
              title: "Contact",
              properties: {
                email: { type: "string", title: "Email" },
                phone: { type: "string", title: "Phone" },
              },
            },
          },
          anyOf: [
            {
              properties: {
                contact: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                  },
                  required: ["email"],
                },
              },
            },
            {
              properties: {
                contact: {
                  type: "object",
                  properties: {
                    phone: { type: "string", minLength: 10 },
                  },
                  required: ["phone"],
                },
              },
            },
          ],
        };

        const validator = new SchemaValidator(schema);

        // 两个条件都不满足
        const errors = validator.validate({
          contact: { email: "invalid", phone: "123" },
        });

        // 应该有错误
        expect(Object.keys(errors).length).toBeGreaterThan(0);
      });
    });

    describe("validateOneOf 中的 recursive", () => {
      it("oneOf 验证应该传递 recursive 参数", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            payment: {
              type: "object",
              title: "Payment",
              properties: {
                method: { type: "string", title: "Method" },
              },
            },
          },
          oneOf: [
            {
              properties: {
                payment: {
                  type: "object",
                  properties: {
                    method: { const: "credit_card" },
                    cardNumber: { type: "string", minLength: 16 },
                  },
                  required: ["method", "cardNumber"],
                },
              },
            },
            {
              properties: {
                payment: {
                  type: "object",
                  properties: {
                    method: { const: "paypal" },
                    email: { type: "string", format: "email" },
                  },
                  required: ["method", "email"],
                },
              },
            },
          ],
        };

        const validator = new SchemaValidator(schema);

        // 不满足任何一个条件
        const errors = validator.validate({
          payment: { method: "unknown" },
        });

        // 应该有错误
        expect(Object.keys(errors).length).toBeGreaterThan(0);
      });
    });

    describe("validateFieldValue 中的 recursive", () => {
      it("字段值验证应该使用 recursive 参数", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            nested: {
              type: "object",
              title: "Nested",
              properties: {
                deep: {
                  type: "object",
                  title: "Deep",
                  properties: {
                    value: { type: "string", title: "Value", minLength: 5 },
                  },
                  required: ["value"],
                },
              },
              required: ["deep"],
            },
          },
        };

        const validator = new SchemaValidator(schema);

        const errors = validator.validate({
          nested: {
            deep: { value: "AB" },
          },
        });

        // 应该递归验证到最深层
        expect(errors["nested.deep.value"]).toBeDefined();
      });
    });

    describe("validateArray 中的 recursive", () => {
      it("数组验证应该使用 recursive 参数验证嵌套对象", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            items: {
              type: "array",
              title: "Items",
              items: {
                type: "object",
                properties: {
                  nested: {
                    type: "object",
                    title: "Nested",
                    properties: {
                      value: { type: "string", title: "Value", minLength: 3 },
                    },
                    required: ["value"],
                  },
                },
                required: ["nested"],
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);

        const errors = validator.validate({
          items: [{ nested: { value: "A" } }],
        });

        // 应该递归验证数组中的嵌套对象
        expect(errors["items[0].nested.value"]).toBeDefined();
      });
    });

    describe("validateObject 中的 recursive", () => {
      it("对象验证应该使用 recursive 参数验证嵌套属性", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            config: {
              type: "object",
              title: "Config",
              properties: {
                settings: {
                  type: "object",
                  title: "Settings",
                  properties: {
                    option: { type: "string", title: "Option", minLength: 2 },
                  },
                  required: ["option"],
                },
              },
              required: ["settings"],
            },
          },
        };

        const validator = new SchemaValidator(schema);

        const errors = validator.validate({
          config: {
            settings: { option: "A" },
          },
        });

        // 应该递归验证嵌套的 settings 对象
        expect(errors["config.settings.option"]).toBeDefined();
      });
    });
  });

  describe("未覆盖分支补充测试", () => {
    describe("Line 182: Schema 依赖（对象形式）直接触发", () => {
      it("当触发字段有值时，应该验证依赖的 schema（简单 required）", () => {
        // 这个测试直接使用对象形式的 dependencies，不嵌套 oneOf
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            hasAddress: { type: "boolean", title: "Has Address" },
            street: { type: "string", title: "Street" },
            city: { type: "string", title: "City" },
          },
          dependencies: {
            // 对象形式的依赖：当 hasAddress 有值时，验证这个 schema
            hasAddress: {
              required: ["street", "city"],
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          hasAddress: true,
          street: "",
          city: "",
        });

        // 应该触发 line 182 的 else if 分支
        expect(errors.street).toBe("Street is required");
        expect(errors.city).toBe("City is required");
      });

      it("当触发字段无值时，不验证依赖的 schema", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            hasAddress: { type: "boolean", title: "Has Address" },
            street: { type: "string", title: "Street" },
          },
          dependencies: {
            hasAddress: {
              required: ["street"],
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          hasAddress: false, // falsy 但不是空值
          street: "",
        });

        // hasAddress 为 false 时仍然有值，所以会触发依赖验证
        expect(errors.street).toBe("Street is required");
      });

      it("Schema 依赖验证 properties 约束", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            enableValidation: { type: "boolean", title: "Enable Validation" },
            code: { type: "string", title: "Code" },
          },
          dependencies: {
            enableValidation: {
              properties: {
                code: { minLength: 6 },
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          enableValidation: true,
          code: "ABC", // 太短
        });

        expect(errors.code).toBe("Code minimum length is 6 characters");
      });
    });

    describe("Line 689: 数组元素 properties 递归验证", () => {
      it("递归验证数组元素的 properties 字段约束", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            users: {
              type: "array",
              title: "Users",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", title: "Name", minLength: 2 },
                  age: { type: "number", title: "Age", minimum: 18 },
                },
                // 注意：这里不设置 required，让测试专门触发 line 689 的 properties 验证
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          users: [
            { name: "A", age: 16 }, // name 太短，age 太小
          ],
        });

        // 应该触发 line 689 的 if (itemsSchema.properties) 分支
        expect(errors["users[0].name"]).toBe(
          "users[0].name minimum length is 2 characters",
        );
        expect(errors["users[0].age"]).toBe("users[0].age minimum value is 18");
      });

      it("递归验证多个数组元素的 properties", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            items: {
              type: "array",
              title: "Items",
              items: {
                type: "object",
                properties: {
                  value: {
                    type: "string",
                    title: "Value",
                    pattern: "^[A-Z]+$",
                  },
                },
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          items: [
            { value: "abc" }, // 不匹配 pattern
            { value: "ABC" }, // 匹配
            { value: "123" }, // 不匹配 pattern
          ],
        });

        expect(errors["items[0].value"]).toBe("items[0].value invalid format");
        expect(errors["items[1].value"]).toBeUndefined();
        expect(errors["items[2].value"]).toBe("items[2].value invalid format");
      });
    });

    describe("Line 774: 对象 properties 递归验证", () => {
      it("递归验证嵌套对象的 properties 字段约束", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            profile: {
              type: "object",
              title: "Profile",
              properties: {
                bio: { type: "string", title: "Bio", maxLength: 100 },
                website: { type: "string", title: "Website", format: "uri" },
              },
              // 注意：这里不设置 required，让测试专门触发 line 774 的 properties 验证
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          profile: {
            bio: "A".repeat(150), // 超过 maxLength
            website: "not-a-url", // 不是有效的 URI
          },
        });

        // 应该触发 line 774 的 if (schema.properties) 分支
        expect(errors["profile.bio"]).toBe(
          "profile.bio maximum length is 100 characters",
        );
        expect(errors["profile.website"]).toBe(
          "profile.website invalid format (expected: uri)",
        );
      });

      it("递归验证深层嵌套对象的 properties", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            level1: {
              type: "object",
              title: "Level 1",
              properties: {
                level2: {
                  type: "object",
                  title: "Level 2",
                  properties: {
                    value: { type: "number", title: "Value", maximum: 100 },
                  },
                },
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          level1: {
            level2: {
              value: 150, // 超过 maximum
            },
          },
        });

        expect(errors["level1.level2.value"]).toBe(
          "level1.level2.value maximum value is 100",
        );
      });

      it("对象 properties 中包含 boolean schema 时应跳过", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            config: {
              type: "object",
              title: "Config",
              properties: {
                enabled: true as any, // boolean schema，应该被跳过
                name: { type: "string", title: "Name", minLength: 3 },
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          config: {
            enabled: "anything",
            name: "AB", // 太短
          },
        });

        // boolean schema 应该被跳过，只验证 name
        expect(errors["config.enabled"]).toBeUndefined();
        expect(errors["config.name"]).toBe(
          "config.name minimum length is 3 characters",
        );
      });
    });

    describe("Line 182 false 分支: dependencies 既不是数组也不是对象", () => {
      it("当 dependencies 值为数字时应跳过（覆盖 else if false 分支）", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            trigger: { type: "string", title: "Trigger" },
            dependent: { type: "string", title: "Dependent" },
          },
          dependencies: {
            trigger: 123 as any, // 数字既不是数组也不是对象
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          trigger: "has value",
          dependent: "",
        });

        // 数字不是数组也不是对象，所以不会触发任何依赖验证
        expect(errors.dependent).toBeUndefined();
      });

      it("当 dependencies 值为 undefined 时应跳过", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            trigger: { type: "string", title: "Trigger" },
          },
          dependencies: {
            trigger: undefined as any,
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          trigger: "has value",
        });

        expect(Object.keys(errors)).toHaveLength(0);
      });

      it("当 dependencies 值为字符串时应跳过", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            trigger: { type: "string", title: "Trigger" },
          },
          dependencies: {
            trigger: "invalid string value" as any, // 字符串不是数组也不是对象
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          trigger: "has value",
        });

        expect(Object.keys(errors)).toHaveLength(0);
      });

      it("当 dependencies 值为 boolean 时应跳过", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            trigger: { type: "string", title: "Trigger" },
          },
          dependencies: {
            trigger: true as any, // boolean 不是数组也不是对象
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          trigger: "has value",
        });

        expect(Object.keys(errors)).toHaveLength(0);
      });
    });

    describe("Line 689 false 分支: 数组 items 没有 properties", () => {
      it("递归验证数组元素时，items 没有 properties 应跳过 properties 验证", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            items: {
              type: "array",
              title: "Items",
              items: {
                type: "object",
                // 没有 properties，只有 required
                required: ["name"],
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          items: [
            { name: "" }, // required 但为空
            { name: "valid" },
          ],
        });

        // 应该只验证 required，不验证 properties（因为没有）
        expect(errors["items[0].name"]).toBe("name is required");
        expect(errors["items[1].name"]).toBeUndefined();
      });

      it("数组 items 为对象类型但没有 properties 时只验证 required", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            users: {
              type: "array",
              title: "Users",
              items: {
                type: "object",
                required: ["id", "email"],
                // 故意不设置 properties
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          users: [
            { id: "", email: "" },
            { id: "123", email: "" },
          ],
        });

        expect(errors["users[0].id"]).toBe("id is required");
        expect(errors["users[0].email"]).toBe("email is required");
        expect(errors["users[1].id"]).toBeUndefined();
        expect(errors["users[1].email"]).toBe("email is required");
      });
    });

    describe("Line 774 false 分支: 嵌套对象没有 properties", () => {
      it("递归验证嵌套对象时，schema 没有 properties 应跳过 properties 验证", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            config: {
              type: "object",
              title: "Config",
              // 没有 properties，只有 required
              required: ["name"],
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          config: {
            name: "", // required 但为空
            extra: "value",
          },
        });

        // 应该只验证 required，不验证 properties（因为没有）
        expect(errors["config.name"]).toBe("name is required");
      });

      it("嵌套对象只有 required 没有 properties 时只验证 required", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            settings: {
              type: "object",
              title: "Settings",
              required: ["apiKey", "endpoint"],
              // 故意不设置 properties
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          settings: {
            apiKey: "",
            endpoint: "https://api.example.com",
          },
        });

        expect(errors["settings.apiKey"]).toBe("apiKey is required");
        expect(errors["settings.endpoint"]).toBeUndefined();
      });

      it("深层嵌套对象没有 properties 时只验证 required", () => {
        const schema: ExtendedJSONSchema = {
          type: "object",
          properties: {
            level1: {
              type: "object",
              title: "Level 1",
              properties: {
                level2: {
                  type: "object",
                  title: "Level 2",
                  required: ["value"],
                  // 没有 properties
                },
              },
            },
          },
        };

        const validator = new SchemaValidator(schema);
        const errors = validator.validate({
          level1: {
            level2: {
              value: "",
            },
          },
        });

        expect(errors["level1.level2.value"]).toBe("value is required");
      });
    });
  });
});
