import { generateCacheKey } from "../generateCacheKey";

describe("generateCacheKey", () => {
  describe("基本功能", () => {
    it("应该生成正确的缓存键格式", () => {
      const formData = { B: 1, C: 2 };
      const key = generateCacheKey("A", ["B", "C"], formData);
      expect(key).toBe("A:B=1|C=2");
    });

    it("应该对依赖字段进行排序，确保顺序一致", () => {
      const formData = { B: 1, C: 2 };
      // 不同顺序的依赖应该生成相同的键
      const key1 = generateCacheKey("A", ["B", "C"], formData);
      const key2 = generateCacheKey("A", ["C", "B"], formData);
      expect(key1).toBe(key2);
      expect(key1).toBe("A:B=1|C=2");
    });

    it("应该处理单个依赖字段", () => {
      const formData = { type: "work" };
      const key = generateCacheKey("companyName", ["type"], formData);
      expect(key).toBe('companyName:type="work"');
    });

    it("应该处理空依赖数组", () => {
      const formData = { A: 1 };
      const key = generateCacheKey("A", [], formData);
      expect(key).toBe("A:");
    });
  });

  describe("值序列化", () => {
    it("应该正确序列化字符串值", () => {
      const formData = { type: "work" };
      const key = generateCacheKey("field", ["type"], formData);
      expect(key).toBe('field:type="work"');
    });

    it("应该正确序列化数字值", () => {
      const formData = { count: 42 };
      const key = generateCacheKey("field", ["count"], formData);
      expect(key).toBe("field:count=42");
    });

    it("应该正确序列化布尔值", () => {
      const formData = { enabled: true };
      const key = generateCacheKey("field", ["enabled"], formData);
      expect(key).toBe("field:enabled=true");
    });

    it("应该正确序列化 null 值", () => {
      const formData = { value: null };
      const key = generateCacheKey("field", ["value"], formData);
      expect(key).toBe("field:value=null");
    });

    it("应该正确序列化 undefined 值", () => {
      const formData = {};
      const key = generateCacheKey("field", ["missing"], formData);
      expect(key).toContain("missing=undefined");
    });

    it("应该正确序列化对象值", () => {
      const formData = { config: { a: 1, b: 2 } };
      const key = generateCacheKey("field", ["config"], formData);
      expect(key).toBe('field:config={"a":1,"b":2}');
    });

    it("应该正确序列化数组值", () => {
      const formData = { items: [1, 2, 3] };
      const key = generateCacheKey("field", ["items"], formData);
      expect(key).toBe("field:items=[1,2,3]");
    });
  });

  describe("数组字段路径处理", () => {
    it("场景1：同级字段 - 应该移除数组索引", () => {
      const formData = {
        contacts: [{ type: "work", companyName: "Acme" }],
      };
      const key = generateCacheKey(
        "contacts.0.companyName",
        ["contacts.0.type"],
        formData,
      );
      // 字段名和依赖字段名都应该移除索引
      expect(key).toBe('contacts.companyName:contacts.type="work"');
    });

    it("场景1：不同数组元素的同级字段应该生成相同的模板键", () => {
      const formData = {
        contacts: [
          { type: "work", companyName: "Acme" },
          { type: "personal", companyName: "Home" },
        ],
      };
      const key1 = generateCacheKey(
        "contacts.0.companyName",
        ["contacts.0.type"],
        formData,
      );
      const key2 = generateCacheKey(
        "contacts.1.companyName",
        ["contacts.1.type"],
        formData,
      );
      // 模板部分相同，但值不同
      expect(key1.split(":")[0]).toBe(key2.split(":")[0]);
      expect(key1.split(":")[0]).toBe("contacts.companyName");
    });

    it("场景2：外部字段依赖 - 应该移除所有索引", () => {
      const formData = {
        enableVip: true,
        contacts: [{ vipLevel: "gold" }],
      };
      const key = generateCacheKey(
        "contacts.0.vipLevel",
        ["enableVip"],
        formData,
      );
      expect(key).toBe("contacts.vipLevel:enableVip=true");
    });

    it("场景4：父数组字段依赖 - 应该保留父数组索引", () => {
      const formData = {
        departments: [
          {
            type: "tech",
            employees: [{ techStack: "React" }],
          },
        ],
      };
      const key = generateCacheKey(
        "departments.0.employees.1.techStack",
        ["departments.0.type"],
        formData,
      );
      // 父数组索引应该保留
      expect(key).toBe(
        'departments.employees.techStack:departments.0.type="tech"',
      );
    });

    it("嵌套数组字段 - 应该正确移除所有索引", () => {
      const formData = {
        departments: [
          {
            employees: [
              { name: "Jane", role: "pm" },
              { name: "John", role: "dev" },
            ],
          },
        ],
      };
      const key = generateCacheKey(
        "departments.0.employees.1.name",
        ["departments.0.employees.1.role"],
        formData,
      );
      expect(key).toBe(
        'departments.employees.name:departments.employees.role="dev"',
      );
    });
  });

  describe("JSON Pointer 格式支持", () => {
    it("应该支持 JSON Pointer 格式的依赖路径", () => {
      const formData = { actionId: "action1" };
      const key = generateCacheKey(
        "targetField",
        ["#/properties/actionId"],
        formData,
      );
      expect(key).toBe('targetField:actionId="action1"');
    });

    it("应该支持嵌套的 JSON Pointer 路径", () => {
      const formData = { user: { profile: { name: "John" } } };
      const key = generateCacheKey(
        "targetField",
        ["#/properties/user/properties/profile/properties/name"],
        formData,
      );
      expect(key).toBe('targetField:user.profile.name="John"');
    });
  });

  describe("多依赖字段", () => {
    it("应该正确处理多个依赖字段", () => {
      const formData = { a: 1, b: "test", c: true };
      const key = generateCacheKey("target", ["a", "b", "c"], formData);
      expect(key).toBe('target:a=1|b="test"|c=true');
    });

    it("应该按字母顺序排序多个依赖字段", () => {
      const formData = { z: 1, a: 2, m: 3 };
      const key = generateCacheKey("target", ["z", "m", "a"], formData);
      expect(key).toBe("target:a=2|m=3|z=1");
    });
  });

  describe("边界情况", () => {
    it("应该处理空字符串字段名", () => {
      const formData = { dep: "value" };
      const key = generateCacheKey("", ["dep"], formData);
      expect(key).toBe(':dep="value"');
    });

    it("应该处理特殊字符值", () => {
      const formData = { field: 'value with "quotes" and |pipes|' };
      const key = generateCacheKey("target", ["field"], formData);
      expect(key).toContain("field=");
    });

    it("应该处理深层嵌套的 formData", () => {
      const formData = {
        level1: {
          level2: {
            level3: {
              value: "deep",
            },
          },
        },
      };
      const key = generateCacheKey(
        "target",
        ["level1.level2.level3.value"],
        formData,
      );
      expect(key).toBe('target:level1.level2.level3.value="deep"');
    });
  });
});
