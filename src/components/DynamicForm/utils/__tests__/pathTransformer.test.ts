import {
  resolveRelativePath,
  toTemplatePath,
  extractArrayLevels,
  toTemplatePathForCache,
} from "../pathTransformer";

describe("pathTransformer (v3.0)", () => {
  describe("resolveRelativePath", () => {
    it("应该正确解析顶层字段的相对路径", () => {
      expect(resolveRelativePath("./age", "user")).toBe("age");
    });

    it("应该正确解析嵌套字段的相对路径", () => {
      expect(resolveRelativePath("./city", "user.address.street")).toBe(
        "user.address.city",
      );
    });

    it("应该正确解析数组元素字段的相对路径", () => {
      expect(resolveRelativePath("./type", "contacts.0.companyName")).toBe(
        "contacts.0.type",
      );
      expect(resolveRelativePath("./type", "contacts.1.companyName")).toBe(
        "contacts.1.type",
      );
    });

    it("应该正确解析嵌套数组字段的相对路径", () => {
      expect(
        resolveRelativePath("./techStack", "departments.0.employees.1.name"),
      ).toBe("departments.0.employees.1.techStack");
    });

    it("应该正确解析深层嵌套字段的相对路径", () => {
      expect(resolveRelativePath("./key", "auth.content.secret.value")).toBe(
        "auth.content.secret.key",
      );
    });

    it("应该在相对路径格式错误时抛出异常", () => {
      expect(() =>
        resolveRelativePath("type", "contacts.0.companyName"),
      ).toThrow("不支持的相对路径格式");
      expect(() =>
        resolveRelativePath("../type", "contacts.0.companyName"),
      ).toThrow("不支持的相对路径格式");
      expect(() =>
        resolveRelativePath("../../type", "contacts.0.companyName"),
      ).toThrow("不支持的相对路径格式");
    });

    it("应该处理包含特殊字符的字段名", () => {
      expect(resolveRelativePath("./field-name", "parent.child-field")).toBe(
        "parent.field-name",
      );
      expect(resolveRelativePath("./field_name", "parent.child_field")).toBe(
        "parent.field_name",
      );
    });
  });

  describe("extractArrayLevels", () => {
    it("应该正确提取简单数组路径的层级信息", () => {
      const levels = extractArrayLevels("contacts.0.name");
      expect(levels).toEqual([
        { arrayPath: "contacts", index: 0, position: 1 },
      ]);
    });

    it("应该正确提取嵌套数组路径的层级信息", () => {
      const levels = extractArrayLevels("departments.0.employees.1.name");
      expect(levels).toEqual([
        { arrayPath: "departments", index: 0, position: 1 },
        { arrayPath: "departments.employees", index: 1, position: 2 },
      ]);
    });

    it("应该处理没有数组索引的路径", () => {
      const levels = extractArrayLevels("user.name");
      expect(levels).toEqual([]);
    });

    it("应该处理深层嵌套的数组路径", () => {
      const levels = extractArrayLevels("a.0.b.1.c.2.d");
      expect(levels).toEqual([
        { arrayPath: "a", index: 0, position: 1 },
        { arrayPath: "a.b", index: 1, position: 2 },
        { arrayPath: "a.b.c", index: 2, position: 3 },
      ]);
    });
  });

  describe("toTemplatePath", () => {
    it("应该正确移除简单数组路径中的索引", () => {
      expect(toTemplatePath("contacts.0.name")).toBe("contacts.name");
      expect(toTemplatePath("contacts.1.type")).toBe("contacts.type");
      expect(toTemplatePath("contacts.2.companyName")).toBe(
        "contacts.companyName",
      );
    });

    it("应该正确移除嵌套数组路径中的所有索引", () => {
      expect(toTemplatePath("departments.0.employees.1.name")).toBe(
        "departments.employees.name",
      );
      expect(toTemplatePath("departments.2.employees.0.techStack")).toBe(
        "departments.employees.techStack",
      );
    });

    it("应该正确处理非数组字段路径", () => {
      expect(toTemplatePath("user.name")).toBe("user.name");
      expect(toTemplatePath("user.address.city")).toBe("user.address.city");
      expect(toTemplatePath("age")).toBe("age");
    });

    it("应该正确处理空字符串和特殊情况", () => {
      expect(toTemplatePath("")).toBe("");
      expect(toTemplatePath("0")).toBe("");
      expect(toTemplatePath("contacts.0")).toBe("contacts");
    });

    it("应该正确处理深层嵌套的数组路径", () => {
      expect(toTemplatePath("a.0.b.1.c.2.d")).toBe("a.b.c.d");
      expect(toTemplatePath("region.0.market.1.contacts.2.auth.apiKey")).toBe(
        "region.market.contacts.auth.apiKey",
      );
    });

    it("应该正确处理混合数组和对象的路径", () => {
      expect(toTemplatePath("contacts.0.auth.apiKey")).toBe(
        "contacts.auth.apiKey",
      );
      expect(toTemplatePath("departments.0.config.employees.1.name")).toBe(
        "departments.config.employees.name",
      );
    });
  });

  describe("toTemplatePathForCache", () => {
    it("场景1：同级字段应该移除所有索引", () => {
      expect(
        toTemplatePathForCache("contacts.0.type", "contacts.0.companyName"),
      ).toBe("contacts.type");
      expect(
        toTemplatePathForCache("contacts.1.type", "contacts.1.companyName"),
      ).toBe("contacts.type");
    });

    it("场景2：外部字段应该移除所有索引", () => {
      expect(toTemplatePathForCache("enableVip", "contacts.0.vipLevel")).toBe(
        "enableVip",
      );
      expect(
        toTemplatePathForCache("enableAdvanced", "contacts.1.advancedInfo"),
      ).toBe("enableAdvanced");
    });

    it("场景4：父数组字段应该保留父数组索引", () => {
      // 关键测试：departments.0 和 departments.1 应该有不同的缓存键
      expect(
        toTemplatePathForCache(
          "departments.0.type",
          "departments.0.employees.1.techStack",
        ),
      ).toBe("departments.0.type");

      expect(
        toTemplatePathForCache(
          "departments.1.type",
          "departments.1.employees.0.techStack",
        ),
      ).toBe("departments.1.type");

      // 验证不同父元素的缓存键不同
      const key1 = toTemplatePathForCache(
        "departments.0.type",
        "departments.0.employees.1.techStack",
      );
      const key2 = toTemplatePathForCache(
        "departments.1.type",
        "departments.1.employees.0.techStack",
      );
      expect(key1).not.toBe(key2);
    });

    it("场景5：当前字段无数组索引时应移除依赖字段的所有索引（覆盖第 157 行）", () => {
      // 当前字段没有数组索引，但依赖字段有数组索引
      // 应该移除依赖字段的所有索引
      expect(toTemplatePathForCache("contacts.0.type", "globalSetting")).toBe(
        "contacts.type",
      );
      expect(
        toTemplatePathForCache("departments.0.employees.1.name", "config"),
      ).toBe("departments.employees.name");
    });
  });
});
