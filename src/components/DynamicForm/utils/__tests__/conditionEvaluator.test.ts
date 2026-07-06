import { ConditionEvaluator } from "../conditionEvaluator";
import type { ConditionExpression } from "../../types/linkage";

describe("ConditionEvaluator", () => {
  describe("基本比较操作符", () => {
    describe("== 操作符", () => {
      it("应该正确判断相等", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: "==",
          value: 18,
        };
        const formData = { age: 18 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断不相等", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: "==",
          value: 18,
        };
        const formData = { age: 20 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该支持字符串比较", () => {
        const condition: ConditionExpression = {
          field: "name",
          operator: "==",
          value: "John",
        };
        const formData = { name: "John" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该支持布尔值比较", () => {
        const condition: ConditionExpression = {
          field: "isActive",
          operator: "==",
          value: true,
        };
        const formData = { isActive: true };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });
    });

    describe("!= 操作符", () => {
      it("应该正确判断不相等", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: "!=",
          value: 18,
        };
        const formData = { age: 20 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断相等", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: "!=",
          value: 18,
        };
        const formData = { age: 18 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });
    });

    describe("> 操作符", () => {
      it("应该正确判断大于", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: ">",
          value: 18,
        };
        const formData = { age: 20 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断不大于", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: ">",
          value: 18,
        };
        const formData = { age: 15 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该正确判断等于的情况", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: ">",
          value: 18,
        };
        const formData = { age: 18 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });
    });

    describe("< 操作符", () => {
      it("应该正确判断小于", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: "<",
          value: 18,
        };
        const formData = { age: 15 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断不小于", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: "<",
          value: 18,
        };
        const formData = { age: 20 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });
    });

    describe(">= 操作符", () => {
      it("应该正确判断大于等于（大于）", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: ">=",
          value: 18,
        };
        const formData = { age: 20 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断大于等于（等于）", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: ">=",
          value: 18,
        };
        const formData = { age: 18 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断不满足大于等于", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: ">=",
          value: 18,
        };
        const formData = { age: 15 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });
    });

    describe("<= 操作符", () => {
      it("应该正确判断小于等于（小于）", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: "<=",
          value: 18,
        };
        const formData = { age: 15 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断小于等于（等于）", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: "<=",
          value: 18,
        };
        const formData = { age: 18 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断不满足小于等于", () => {
        const condition: ConditionExpression = {
          field: "age",
          operator: "<=",
          value: 18,
        };
        const formData = { age: 20 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });
    });
  });

  describe("数组操作符", () => {
    describe("in 操作符", () => {
      it("应该正确判断值在数组中", () => {
        const condition: ConditionExpression = {
          field: "status",
          operator: "in",
          value: ["active", "pending", "completed"],
        };
        const formData = { status: "active" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断值不在数组中", () => {
        const condition: ConditionExpression = {
          field: "status",
          operator: "in",
          value: ["active", "pending"],
        };
        const formData = { status: "completed" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该处理数字数组", () => {
        const condition: ConditionExpression = {
          field: "score",
          operator: "in",
          value: [90, 95, 100],
        };
        const formData = { score: 95 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });
    });

    describe("notIn 操作符", () => {
      it("应该正确判断值不在数组中", () => {
        const condition: ConditionExpression = {
          field: "status",
          operator: "notIn",
          value: ["deleted", "archived"],
        };
        const formData = { status: "active" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断值在数组中", () => {
        const condition: ConditionExpression = {
          field: "status",
          operator: "notIn",
          value: ["deleted", "archived"],
        };
        const formData = { status: "deleted" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });
    });

    describe("includes 操作符", () => {
      it("应该正确判断数组包含值", () => {
        const condition: ConditionExpression = {
          field: "tags",
          operator: "includes",
          value: "javascript",
        };
        const formData = { tags: ["javascript", "typescript", "react"] };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断数组不包含值", () => {
        const condition: ConditionExpression = {
          field: "tags",
          operator: "includes",
          value: "python",
        };
        const formData = { tags: ["javascript", "typescript"] };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该处理空数组", () => {
        const condition: ConditionExpression = {
          field: "tags",
          operator: "includes",
          value: "javascript",
        };
        const formData = { tags: [] };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });
    });

    describe("notIncludes 操作符", () => {
      it("应该正确判断数组不包含值", () => {
        const condition: ConditionExpression = {
          field: "tags",
          operator: "notIncludes",
          value: "python",
        };
        const formData = { tags: ["javascript", "typescript"] };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确判断数组包含值", () => {
        const condition: ConditionExpression = {
          field: "tags",
          operator: "notIncludes",
          value: "javascript",
        };
        const formData = { tags: ["javascript", "typescript"] };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });
    });
  });

  describe("空值判断操作符", () => {
    describe("isEmpty 操作符", () => {
      it("应该判断 null 为空", () => {
        const condition: ConditionExpression = {
          field: "name",
          operator: "isEmpty",
        };
        const formData = { name: null };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该判断 undefined 为空", () => {
        const condition: ConditionExpression = {
          field: "name",
          operator: "isEmpty",
        };
        const formData = { name: undefined };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该判断空字符串为空", () => {
        const condition: ConditionExpression = {
          field: "name",
          operator: "isEmpty",
        };
        const formData = { name: "" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该判断空数组为空", () => {
        const condition: ConditionExpression = {
          field: "tags",
          operator: "isEmpty",
        };
        const formData = { tags: [] };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该判断非空字符串不为空", () => {
        const condition: ConditionExpression = {
          field: "name",
          operator: "isEmpty",
        };
        const formData = { name: "John" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该判断非空数组不为空", () => {
        const condition: ConditionExpression = {
          field: "tags",
          operator: "isEmpty",
        };
        const formData = { tags: ["javascript"] };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该判断数字 0 不为空", () => {
        const condition: ConditionExpression = {
          field: "count",
          operator: "isEmpty",
        };
        const formData = { count: 0 };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该判断布尔值 false 不为空", () => {
        const condition: ConditionExpression = {
          field: "isActive",
          operator: "isEmpty",
        };
        const formData = { isActive: false };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });
    });

    describe("isNotEmpty 操作符", () => {
      it("应该判断非空字符串不为空", () => {
        const condition: ConditionExpression = {
          field: "name",
          operator: "isNotEmpty",
        };
        const formData = { name: "John" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该判断非空数组不为空", () => {
        const condition: ConditionExpression = {
          field: "tags",
          operator: "isNotEmpty",
        };
        const formData = { tags: ["javascript"] };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该判断 null 为空", () => {
        const condition: ConditionExpression = {
          field: "name",
          operator: "isNotEmpty",
        };
        const formData = { name: null };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该判断 undefined 为空", () => {
        const condition: ConditionExpression = {
          field: "name",
          operator: "isNotEmpty",
        };
        const formData = { name: undefined };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该判断空字符串为空", () => {
        const condition: ConditionExpression = {
          field: "name",
          operator: "isNotEmpty",
        };
        const formData = { name: "" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该判断空数组为空", () => {
        const condition: ConditionExpression = {
          field: "tags",
          operator: "isNotEmpty",
        };
        const formData = { tags: [] };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });
    });
  });

  describe("逻辑组合", () => {
    describe("and 逻辑", () => {
      it("应该正确处理所有条件都满足的情况", () => {
        const condition: ConditionExpression = {
          field: "",
          operator: "==",
          and: [
            { field: "age", operator: ">=", value: 18 },
            { field: "status", operator: "==", value: "active" },
          ],
        };
        const formData = { age: 20, status: "active" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确处理部分条件不满足的情况", () => {
        const condition: ConditionExpression = {
          field: "",
          operator: "==",
          and: [
            { field: "age", operator: ">=", value: 18 },
            { field: "status", operator: "==", value: "active" },
          ],
        };
        const formData = { age: 20, status: "inactive" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该正确处理多个条件的 and 组合", () => {
        const condition: ConditionExpression = {
          field: "",
          operator: "==",
          and: [
            { field: "age", operator: ">=", value: 18 },
            { field: "age", operator: "<=", value: 65 },
            { field: "status", operator: "==", value: "active" },
          ],
        };
        const formData = { age: 30, status: "active" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });
    });

    describe("or 逻辑", () => {
      it("应该正确处理至少一个条件满足的情况", () => {
        const condition: ConditionExpression = {
          field: "",
          operator: "==",
          or: [
            { field: "role", operator: "==", value: "admin" },
            { field: "role", operator: "==", value: "moderator" },
          ],
        };
        const formData = { role: "admin" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确处理所有条件都不满足的情况", () => {
        const condition: ConditionExpression = {
          field: "",
          operator: "==",
          or: [
            { field: "role", operator: "==", value: "admin" },
            { field: "role", operator: "==", value: "moderator" },
          ],
        };
        const formData = { role: "user" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
      });

      it("应该正确处理多个条件的 or 组合", () => {
        const condition: ConditionExpression = {
          field: "",
          operator: "==",
          or: [
            { field: "status", operator: "==", value: "active" },
            { field: "status", operator: "==", value: "pending" },
            { field: "status", operator: "==", value: "trial" },
          ],
        };
        const formData = { status: "pending" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });
    });

    describe("嵌套逻辑组合", () => {
      it("应该正确处理 and 中嵌套 or", () => {
        const condition: ConditionExpression = {
          field: "",
          operator: "==",
          and: [
            { field: "age", operator: ">=", value: 18 },
            {
              field: "",
              operator: "==",
              or: [
                { field: "role", operator: "==", value: "admin" },
                { field: "role", operator: "==", value: "moderator" },
              ],
            },
          ],
        };
        const formData = { age: 25, role: "admin" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });

      it("应该正确处理 or 中嵌套 and", () => {
        const condition: ConditionExpression = {
          field: "",
          operator: "==",
          or: [
            {
              field: "",
              operator: "==",
              and: [
                { field: "age", operator: ">=", value: 18 },
                { field: "status", operator: "==", value: "active" },
              ],
            },
            { field: "role", operator: "==", value: "admin" },
          ],
        };
        const formData = { age: 25, status: "active", role: "user" };
        expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
      });
    });
  });

  describe("嵌套路径支持", () => {
    it("应该支持点号路径访问嵌套字段", () => {
      const condition: ConditionExpression = {
        field: "user.age",
        operator: ">=",
        value: 18,
      };
      const formData = {
        user: {
          age: 25,
          name: "John",
        },
      };
      expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
    });

    it("应该支持多层嵌套路径", () => {
      const condition: ConditionExpression = {
        field: "company.department.team.size",
        operator: ">",
        value: 5,
      };
      const formData = {
        company: {
          department: {
            team: {
              size: 10,
            },
          },
        },
      };
      expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
    });

    it("应该支持 JSON Pointer 格式路径", () => {
      const condition: ConditionExpression = {
        field: "#/properties/user/age",
        operator: ">=",
        value: 18,
      };
      const formData = {
        user: {
          age: 25,
        },
      };
      expect(ConditionEvaluator.evaluate(condition, formData)).toBe(true);
    });

    it("应该处理嵌套路径中的 null 值", () => {
      const condition: ConditionExpression = {
        field: "user.profile.age",
        operator: ">=",
        value: 18,
      };
      const formData = {
        user: {
          profile: null,
        },
      };
      expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
    });
  });

  describe("实际应用场景", () => {
    it("应该支持表单字段显示/隐藏联动", () => {
      // 场景：当用户类型为"企业"时，显示企业相关字段
      const condition: ConditionExpression = {
        field: "userType",
        operator: "==",
        value: "enterprise",
      };

      const formData1 = { userType: "enterprise" };
      expect(ConditionEvaluator.evaluate(condition, formData1)).toBe(true);

      const formData2 = { userType: "individual" };
      expect(ConditionEvaluator.evaluate(condition, formData2)).toBe(false);
    });

    it("应该支持复杂的权限判断", () => {
      // 场景：管理员或年龄>=18且状态为active的用户可以访问
      const condition: ConditionExpression = {
        field: "",
        operator: "==",
        or: [
          { field: "role", operator: "==", value: "admin" },
          {
            field: "",
            operator: "==",
            and: [
              { field: "age", operator: ">=", value: 18 },
              { field: "status", operator: "==", value: "active" },
            ],
          },
        ],
      };

      // 管理员可以访问
      expect(
        ConditionEvaluator.evaluate(condition, {
          role: "admin",
          age: 16,
          status: "inactive",
        }),
      ).toBe(true);

      // 成年且活跃的用户可以访问
      expect(
        ConditionEvaluator.evaluate(condition, {
          role: "user",
          age: 20,
          status: "active",
        }),
      ).toBe(true);

      // 未成年用户不能访问
      expect(
        ConditionEvaluator.evaluate(condition, {
          role: "user",
          age: 16,
          status: "active",
        }),
      ).toBe(false);

      // 非活跃用户不能访问
      expect(
        ConditionEvaluator.evaluate(condition, {
          role: "user",
          age: 20,
          status: "inactive",
        }),
      ).toBe(false);
    });

    it("应该支持动态表单字段联动", () => {
      // 场景：根据选择的国家显示不同的省份选项
      const condition: ConditionExpression = {
        field: "country",
        operator: "in",
        value: ["China", "USA", "Canada"],
      };

      expect(ConditionEvaluator.evaluate(condition, { country: "China" })).toBe(
        true,
      );
      expect(ConditionEvaluator.evaluate(condition, { country: "Japan" })).toBe(
        false,
      );
    });

    it("应该支持必填字段的条件判断", () => {
      // 场景：当邮寄地址不为空时，邮编字段必填
      const condition: ConditionExpression = {
        field: "shippingAddress",
        operator: "isNotEmpty",
      };

      expect(
        ConditionEvaluator.evaluate(condition, {
          shippingAddress: "123 Main St",
        }),
      ).toBe(true);
      expect(
        ConditionEvaluator.evaluate(condition, { shippingAddress: "" }),
      ).toBe(false);
    });
  });

  describe("边界情况和错误处理", () => {
    it("应该处理未知操作符", () => {
      const condition: ConditionExpression = {
        field: "age",
        operator: "unknownOperator" as any,
        value: 18,
      };
      const formData = { age: 20 };
      expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
    });

    it("应该处理字段不存在的情况", () => {
      const condition: ConditionExpression = {
        field: "nonExistentField",
        operator: "==",
        value: "test",
      };
      const formData = { age: 20 };
      expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
    });

    it("应该处理空表单数据", () => {
      const condition: ConditionExpression = {
        field: "age",
        operator: ">=",
        value: 18,
      };
      const formData = {};
      expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
    });

    it("应该对无效的条件表达式返回 false（覆盖第 35 行）", () => {
      // 当条件表达式既没有 and、or，也没有 field 属性时，返回 false
      const condition = {} as ConditionExpression;
      const formData = { age: 20 };
      expect(ConditionEvaluator.evaluate(condition, formData)).toBe(false);
    });
  });
});
