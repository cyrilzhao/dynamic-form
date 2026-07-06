import { PathResolver } from "../pathResolver";

describe("PathResolver", () => {
  describe("resolve - 简单字段名", () => {
    it("应该解析简单字段名", () => {
      const formData = { age: 18, name: "John" };
      const result = PathResolver.resolve("age", formData);
      expect(result).toBe(18);
    });

    it("应该解析嵌套字段（点号路径）", () => {
      const formData = { user: { age: 18, name: "John" } };
      const result = PathResolver.resolve("user.age", formData);
      expect(result).toBe(18);
    });

    it("应该解析多层嵌套字段", () => {
      const formData = {
        company: {
          department: {
            team: {
              leader: "Alice",
            },
          },
        },
      };
      const result = PathResolver.resolve(
        "company.department.team.leader",
        formData,
      );
      expect(result).toBe("Alice");
    });

    it("应该处理不存在的字段", () => {
      const formData = { age: 18 };
      const result = PathResolver.resolve("name", formData);
      expect(result).toBeUndefined();
    });

    it("应该处理不存在的嵌套字段", () => {
      const formData = { user: { age: 18 } };
      const result = PathResolver.resolve("user.name", formData);
      expect(result).toBeUndefined();
    });

    it("应该处理中间路径为 null 的情况", () => {
      const formData = { user: null };
      const result = PathResolver.resolve("user.age", formData);
      expect(result).toBeUndefined();
    });

    it("应该处理中间路径为 undefined 的情况", () => {
      const formData = { user: undefined };
      const result = PathResolver.resolve("user.age", formData);
      expect(result).toBeUndefined();
    });
  });

  describe("resolve - JSON Pointer 格式", () => {
    it("应该解析标准 JSON Pointer 格式", () => {
      const formData = { user: { age: 18 } };
      const result = PathResolver.resolve("#/properties/user/age", formData);
      expect(result).toBe(18);
    });

    it("应该跳过 properties 关键字", () => {
      const formData = { user: { profile: { name: "John" } } };
      const result = PathResolver.resolve(
        "#/properties/user/properties/profile/properties/name",
        formData,
      );
      expect(result).toBe("John");
    });

    it("应该处理简单的 JSON Pointer 路径", () => {
      const formData = { age: 25 };
      const result = PathResolver.resolve("#/properties/age", formData);
      expect(result).toBe(25);
    });

    it("应该处理不存在的 JSON Pointer 路径", () => {
      const formData = { age: 25 };
      const result = PathResolver.resolve("#/properties/name", formData);
      expect(result).toBeUndefined();
    });

    it("应该处理 JSON Pointer 路径中的 null 值", () => {
      const formData = { user: null };
      const result = PathResolver.resolve("#/properties/user/age", formData);
      expect(result).toBeUndefined();
    });

    it("应该处理 JSON Pointer 路径中的 undefined 值", () => {
      const formData = { user: undefined };
      const result = PathResolver.resolve("#/properties/user/age", formData);
      expect(result).toBeUndefined();
    });
  });

  describe("resolve - JSON Pointer 转义字符", () => {
    it("应该解码 ~1 为 /", () => {
      const formData = { "a/b": "value" };
      const result = PathResolver.resolve("#/a~1b", formData);
      expect(result).toBe("value");
    });

    it("应该解码 ~0 为 ~", () => {
      const formData = { "a~b": "value" };
      const result = PathResolver.resolve("#/a~0b", formData);
      expect(result).toBe("value");
    });

    it("应该按正确顺序解码转义字符", () => {
      const formData = { "a~b/c": "value" };
      const result = PathResolver.resolve("#/a~0b~1c", formData);
      expect(result).toBe("value");
    });

    it("应该处理复杂的转义字符组合", () => {
      const formData = { "~/test": { "key/name": "value" } };
      const result = PathResolver.resolve("#/~0~1test/key~1name", formData);
      expect(result).toBe("value");
    });
  });

  describe("normalize - 路径标准化", () => {
    it("应该标准化简单字段名", () => {
      const result = PathResolver.normalize("age");
      expect(result).toBe("#/properties/age");
    });

    it("应该标准化嵌套路径（点号分隔）", () => {
      const result = PathResolver.normalize("user.age");
      expect(result).toBe("#/properties/user/properties/age");
    });

    it("应该标准化多层嵌套路径", () => {
      const result = PathResolver.normalize("company.department.team");
      expect(result).toBe(
        "#/properties/company/properties/department/properties/team",
      );
    });

    it("应该保持已标准化的路径不变", () => {
      const path = "#/properties/age";
      const result = PathResolver.normalize(path);
      expect(result).toBe(path);
    });

    it("应该保持复杂 JSON Pointer 路径不变", () => {
      const path = "#/properties/user/properties/profile/properties/name";
      const result = PathResolver.normalize(path);
      expect(result).toBe(path);
    });
  });

  describe("toFieldPath - 提取字段路径", () => {
    it("应该从 JSON Pointer 提取简单字段名", () => {
      const result = PathResolver.toFieldPath("#/properties/age");
      expect(result).toBe("age");
    });

    it("应该从 JSON Pointer 提取嵌套字段路径", () => {
      const result = PathResolver.toFieldPath(
        "#/properties/user/properties/age",
      );
      expect(result).toBe("user.age");
    });

    it("应该从 JSON Pointer 提取多层嵌套路径", () => {
      const result = PathResolver.toFieldPath(
        "#/properties/user/properties/profile/properties/name",
      );
      expect(result).toBe("user.profile.name");
    });

    it("应该保持简单字段名不变", () => {
      const result = PathResolver.toFieldPath("age");
      expect(result).toBe("age");
    });

    it("应该保持点号路径不变", () => {
      const result = PathResolver.toFieldPath("user.age");
      expect(result).toBe("user.age");
    });

    it("应该处理只有 properties 的路径", () => {
      const result = PathResolver.toFieldPath("#/properties");
      expect(result).toBe("");
    });

    it("字段名为 items 时应正确提取", () => {
      const result = PathResolver.toFieldPath("#/properties/items");
      expect(result).toBe("items");
    });

    it("数组字段内嵌套字段时应跳过 items 关键字", () => {
      const result = PathResolver.toFieldPath(
        "#/properties/arr/items/properties/name",
      );
      expect(result).toBe("arr.name");
    });

    it("字段名为 properties 时应正确提取", () => {
      const result = PathResolver.toFieldPath(
        "#/properties/properties/properties",
      );
      expect(result).toBe("properties");
    });
  });

  describe("encodePointerSegment - 编码转义字符", () => {
    it("应该编码 ~ 为 ~0", () => {
      const result = PathResolver.encodePointerSegment("a~b");
      expect(result).toBe("a~0b");
    });

    it("应该编码 / 为 ~1", () => {
      const result = PathResolver.encodePointerSegment("a/b");
      expect(result).toBe("a~1b");
    });

    it("应该按正确顺序编码（先 ~ 后 /）", () => {
      const result = PathResolver.encodePointerSegment("a~/b");
      expect(result).toBe("a~0~1b");
    });

    it("应该处理多个转义字符", () => {
      const result = PathResolver.encodePointerSegment("a~b/c~d/e");
      expect(result).toBe("a~0b~1c~0d~1e");
    });

    it("应该处理不需要转义的字符串", () => {
      const result = PathResolver.encodePointerSegment("normalString");
      expect(result).toBe("normalString");
    });
  });

  describe("综合场景测试", () => {
    it("应该支持完整的路径转换流程", () => {
      // 标准化路径
      const normalized = PathResolver.normalize("user.profile.name");
      expect(normalized).toBe(
        "#/properties/user/properties/profile/properties/name",
      );

      // 从标准化路径提取字段路径
      const fieldPath = PathResolver.toFieldPath(normalized);
      expect(fieldPath).toBe("user.profile.name");

      // 使用字段路径解析数据
      const formData = {
        user: {
          profile: {
            name: "Alice",
            age: 30,
          },
        },
      };
      const value = PathResolver.resolve(fieldPath, formData);
      expect(value).toBe("Alice");
    });

    it("应该处理包含特殊字符的字段名", () => {
      const segment = "field/with~special";
      const encoded = PathResolver.encodePointerSegment(segment);
      expect(encoded).toBe("field~1with~0special");

      const formData = { [segment]: "test value" };
      const result = PathResolver.resolve(`#/${encoded}`, formData);
      expect(result).toBe("test value");
    });

    it("应该在实际表单场景中正确工作", () => {
      const formData = {
        personalInfo: {
          firstName: "John",
          lastName: "Doe",
        },
        contactInfo: {
          email: "john@example.com",
          phone: "123-456-7890",
        },
      };

      // 使用简单路径
      expect(PathResolver.resolve("personalInfo.firstName", formData)).toBe(
        "John",
      );

      // 使用 JSON Pointer
      expect(
        PathResolver.resolve("#/properties/contactInfo/email", formData),
      ).toBe("john@example.com");

      // 路径转换
      const jsonPointer = PathResolver.normalize("contactInfo.phone");
      expect(PathResolver.toFieldPath(jsonPointer)).toBe("contactInfo.phone");
    });

    it("应该处理包含点号的完整 key 匹配", () => {
      // 构造一个对象，其 key 包含点号，且完整匹配路径
      const formData = {
        "group.category": "test value",
      };
      // 当路径 'group.category' 作为完整 key 存在时，应该直接返回
      const result = PathResolver.resolve("group.category", formData);
      expect(result).toBe("test value");
    });
  });
});
