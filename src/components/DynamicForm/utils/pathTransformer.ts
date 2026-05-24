/**
 * 解析相对路径为绝对路径（仅支持同级字段）
 *
 * 新方案（v3.0）：
 * - 使用标准的 . 分隔符
 * - 简化路径解析逻辑
 *
 * @param relativePath - 相对路径（如 './type'）
 * @param currentPath - 当前字段的完整路径（如 'contacts.0.companyName'）
 * @returns 解析后的绝对路径（如 'contacts.0.type'）
 */
export function resolveRelativePath(relativePath: string, currentPath: string): string {
  if (!relativePath.startsWith('./')) {
    throw new Error(`不支持的相对路径格式: ${relativePath}。只允许使用 './fieldName' 引用同级字段`);
  }

  const fieldName = relativePath.slice(2);

  // 使用标准的 . 分隔符查找最后一个分隔符
  const lastSeparatorPos = currentPath.lastIndexOf('.');

  if (lastSeparatorPos === -1) {
    return fieldName;
  }

  // 获取父路径
  const parentPath = currentPath.substring(0, lastSeparatorPos);

  // 使用标准的 . 分隔符构建路径
  return `${parentPath}.${fieldName}`;
}

/**
 * 数组层级信息
 */
interface ArrayLevel {
  /** 数组路径（不含索引），如 'contacts' 或 'departments.employees' */
  arrayPath: string;
  /** 数组索引 */
  index: number;
  /** 在完整路径中的位置（从0开始） */
  position: number;
}

/**
 * 提取路径中的数组层级信息
 *
 * @param path - 完整路径，如 'departments.0.employees.1.name'
 * @returns 数组层级信息数组
 *
 * @example
 * extractArrayLevels('departments.0.employees.1.name')
 * // 返回：[
 * //   { arrayPath: 'departments', index: 0, position: 0 },
 * //   { arrayPath: 'departments.employees', index: 1, position: 2 }
 * // ]
 */
export function extractArrayLevels(path: string): ArrayLevel[] {
  const parts = path.split('.');
  const levels: ArrayLevel[] = [];
  const pathParts: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // 检查是否是数组索引
    if (/^\d+$/.test(part)) {
      const index = parseInt(part, 10);
      const arrayPath = pathParts.join('.');

      levels.push({
        arrayPath,
        index,
        position: pathParts.length,
      });
    } else {
      pathParts.push(part);
    }
  }

  return levels;
}

/**
 * 将运行时路径转换为模板路径（移除数组索引）
 *
 * 用于缓存键生成，使得不同数组元素的相同字段可以共享缓存。
 *
 * @param runtimePath - 运行时路径（包含数组索引）
 * @returns 模板路径（不含数组索引）
 *
 * @example
 * // 简单数组字段
 * toTemplatePath('contacts.0.name') // 'contacts.name'
 * toTemplatePath('contacts.1.type') // 'contacts.type'
 *
 * // 嵌套数组字段
 * toTemplatePath('departments.0.employees.1.name') // 'departments.employees.name'
 *
 * // 非数组字段
 * toTemplatePath('user.name') // 'user.name'
 * toTemplatePath('age') // 'age'
 */
export function toTemplatePath(runtimePath: string): string {
  if (!runtimePath) {
    return runtimePath;
  }

  const parts = runtimePath.split('.');
  // 过滤掉数字索引，只保留字段名
  const templateParts = parts.filter(part => !/^\d+$/.test(part));

  return templateParts.join('.');
}

/**
 * 智能移除数组索引，用于生成缓存键
 *
 * 根据当前字段和依赖字段的数组层级关系，决定保留哪些索引：
 * - 场景1（同级字段）：移除所有索引
 * - 场景2（外部字段）：移除所有索引
 * - 场景4（父数组字段）：保留父数组索引，移除当前数组及更深层的索引
 *
 * @param depPath - 依赖字段路径
 * @param currentFieldPath - 当前字段路径
 * @returns 处理后的依赖字段路径
 *
 * @example
 * // 场景1：同级字段（移除所有索引）
 * toTemplatePathForCache('contacts.0.type', 'contacts.0.companyName')
 * // → 'contacts.type'
 *
 * // 场景2：外部字段（移除所有索引）
 * toTemplatePathForCache('enableVip', 'contacts.0.vipLevel')
 * // → 'enableVip'
 *
 * // 场景4：父数组字段（保留父数组索引）
 * toTemplatePathForCache('departments.0.type', 'departments.0.employees.1.techStack')
 * // → 'departments.0.type'
 */
export function toTemplatePathForCache(depPath: string, currentFieldPath: string): string {
  if (!depPath || !currentFieldPath) {
    return depPath;
  }

  // 提取两个路径的数组层级信息
  const depLevels = extractArrayLevels(depPath);
  const currentLevels = extractArrayLevels(currentFieldPath);

  // 如果依赖字段没有数组索引，直接返回
  if (depLevels.length === 0) {
    return depPath;
  }

  // 如果当前字段没有数组索引，移除依赖字段的所有索引
  if (currentLevels.length === 0) {
    return toTemplatePath(depPath);
  }

  // 判断是否是父数组字段依赖
  // 条件：依赖字段的数组层级少于当前字段，且依赖字段的路径是当前字段路径的前缀
  const isParentArrayDep =
    depLevels.length < currentLevels.length &&
    currentFieldPath.startsWith(depPath.substring(0, depPath.lastIndexOf('.')));

  if (isParentArrayDep) {
    // 场景4：父数组字段依赖
    // 保留依赖字段的所有索引（因为它们都是父级索引）
    return depPath;
  } else {
    // 场景1、2、3、5：移除所有索引
    return toTemplatePath(depPath);
  }
}
