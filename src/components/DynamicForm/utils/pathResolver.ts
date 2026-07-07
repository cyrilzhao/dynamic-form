/**
 * JSON Pointer 路径解析器
 * 支持标准的 JSON Pointer 格式和简单字段名
 */
export class PathResolver {
  /**
   * 解析 JSON Pointer 路径获取值
   * @param path - 字段路径，支持简单字段名或 JSON Pointer 格式
   * @param formData - 表单数据
   * @returns 字段值
   *
   * @example
   * // 简单字段名
   * PathResolver.resolve('age', { age: 18 }) // 18
   *
   * // JSON Pointer 格式
   * PathResolver.resolve('#/properties/user/age', { user: { age: 18 } }) // 18
   */
  static resolve(path: string, formData: Record<string, any>): any {
    // 如果不是 JSON Pointer 格式，直接返回字段值
    if (!path.startsWith("#/")) {
      return this.getNestedValue(formData, path);
    }

    // 移除 #/ 前缀
    const cleanPath = path.replace(/^#\//, "");

    // 分割路径
    const segments = cleanPath.split("/");

    let value = formData;
    for (const segment of segments) {
      // 跳过 "properties" 和 "items" 关键字
      if (segment === "properties" || segment === "items") {
        continue;
      }

      if (value === null || value === undefined) {
        return undefined;
      }

      // 解码 JSON Pointer 转义字符
      const decodedSegment = this.decodePointerSegment(segment);
      value = value[decodedSegment];
    }

    return value;
  }

  /**
   * 标准化路径格式
   * @param path - 原始路径
   * @returns 标准化的 JSON Pointer 路径
   *
   * @example
   * PathResolver.normalize('age') // '#/properties/age'
   * PathResolver.normalize('#/properties/age') // '#/properties/age'
   */
  static normalize(path: string): string {
    if (path.startsWith("#/")) {
      return path;
    }

    // 处理嵌套路径 (如 'user.age')
    if (path.includes(".")) {
      const parts = path.split(".");
      return `#/properties/${parts.join("/properties/")}`;
    }

    return `#/properties/${path}`;
  }

  /**
   * 从 JSON Pointer 路径提取字段名
   * @param path - JSON Pointer 路径
   * @returns 实际的字段路径（用于 react-hook-form）
   *
   * @example
   * PathResolver.toFieldPath('#/properties/user/age') // 'user.age'
   * PathResolver.toFieldPath('#/properties/items') // 'items'（字段名）
   * PathResolver.toFieldPath('#/properties/arr/items/properties/name') // 'arr.name'
   * PathResolver.toFieldPath('#/properties/properties/properties') // 'properties'（字段名）
   */
  static toFieldPath(path: string): string {
    if (!path.startsWith("#/")) {
      return path;
    }

    const segments = path.replace(/^#\//, "").split("/");
    const result: string[] = [];
    let expectField = false;

    for (const segment of segments) {
      if (!expectField) {
        if (segment === "properties") {
          expectField = true;
        }
        // items 后仍是关键字（如 /items/properties/name），保持状态不变
      } else {
        result.push(segment);
        expectField = false;
      }
    }

    return result.join(".");
  }

  /**
   * 获取嵌套对象的值（支持点号路径和扁平化 key）
   *
   * 对于扁平化的 formData（如 { "group~~category.contacts": [...] }），
   * 会智能匹配最长的 key 前缀，然后继续解析剩余路径。
   */
  static getNestedValue(obj: Record<string, any>, path: string): any {
    if (!obj || !path) {
      return undefined;
    }

    // 首先尝试直接匹配完整路径（最常见的情况）
    if (path in obj) {
      return obj[path];
    }

    // 尝试找到最长匹配的 key 前缀
    // 例如：path = "group~~category.contacts.0.category~~group.type"
    // obj 可能有 key = "group~~category.contacts"
    const keys = path.split(".");

    // 从最长前缀开始尝试匹配，直到单个 key（i = 1 时 prefix = keys[0]）。
    // 从长到短的原因：优先匹配最具体的 key，避免将 "a.b" 错误地匹配到 "a" 后再
    // 尝试在 obj["a"] 上查找 "b"，当 obj 中同时存在 "a" 和 "a.b" 两个 key 时，
    // 应优先匹配更精确的 "a.b"。
    for (let i = keys.length - 1; i >= 1; i--) {
      const prefix = keys.slice(0, i).join(".");
      if (prefix in obj) {
        const value = obj[prefix];
        const remainingPath = keys.slice(i).join(".");
        return this.getNestedValue(value, remainingPath);
      }
    }

    return undefined;
  }

  /**
   * 设置嵌套对象的值（支持点号路径）
   *
   * 与 getNestedValue 的直接 key 兼容不同，这里始终按嵌套结构写入，
   * 用于让联动计算的中间快照保持和 RHF 表单数据一致的结构。
   */
  static setNestedValue(
    obj: Record<string, any>,
    path: string,
    value: any,
  ): void {
    if (!obj || !path) {
      return;
    }

    const keys = path.split(".");
    let current: any = obj;

    keys.forEach((key, index) => {
      const isLast = index === keys.length - 1;
      if (isLast) {
        current[key] = value;
        return;
      }

      const nextKey = keys[index + 1];
      // 下一个路径片段是数字时创建数组，否则创建普通对象。
      // 这让 items.0.enabled 这类路径能生成 { items: [{ enabled: true }] }，
      // 与 React Hook Form 和联动函数读取的嵌套数据结构保持一致。
      const shouldCreateArray = !Number.isNaN(Number(nextKey));

      if (current[key] === null || current[key] === undefined) {
        current[key] = shouldCreateArray ? [] : {};
      }

      current = current[key];
    });
  }

  /**
   * 解码 JSON Pointer 转义字符
   * 根据 RFC 6901 规范：
   * - ~1 表示 /
   * - ~0 表示 ~
   */
  private static decodePointerSegment(segment: string): string {
    return segment.replace(/~1/g, "/").replace(/~0/g, "~");
  }

  /**
   * 编码 JSON Pointer 转义字符
   */
  static encodePointerSegment(segment: string): string {
    return segment.replace(/~/g, "~0").replace(/\//g, "~1");
  }
}
