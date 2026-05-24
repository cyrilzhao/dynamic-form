import { toTemplatePath, toTemplatePathForCache } from './pathTransformer';
import { PathResolver } from './pathResolver';

/**
 * 生成联动缓存键
 * 基于字段名和依赖字段的名称-值映射生成唯一键
 *
 * 示例：
 * - 字段 A 依赖 B 和 C，联动关系是 A = B + C * 2
 * - dependencies: ['B', 'C'], B=1, C=2 生成键：A:B=1|C=2
 * - dependencies: ['C', 'B'], B=1, C=2 生成键：A:B=1|C=2
 * - 两个键相同，命中相同的缓存结果 ✅
 *
 * 数组字段优化：
 * - 场景1（同级字段）：contacts.0.companyName 依赖 contacts.0.type="work"
 *   生成键：contacts.companyName:contacts.type="work" ✅
 * - 场景4（父数组字段）：departments.0.employees.1.techStack 依赖 departments.0.type="tech"
 *   生成键：departments.employees.techStack:departments.0.type="tech" ✅
 *   保留父数组索引，确保不同父元素的缓存独立
 *
 * 关键优化：
 * 1. 对依赖字段排序，确保顺序一致
 * 2. 使用 "字段名=值" 格式，简洁且可读
 * 3. 智能移除数组索引：同级/外部字段移除所有索引，父数组字段保留父级索引
 */
export function generateCacheKey(
  fieldName: string,
  dependencies: string[],
  formData: Record<string, any>
): string {
  // 移除字段名中的数组索引，获取模板字段名
  // 例如：departments.0.employees.1.techStack -> departments.employees.techStack
  const templateFieldName = toTemplatePath(fieldName);

  // 对依赖字段排序，确保顺序一致
  const sortedDeps = [...dependencies].sort();

  // 构建依赖字段的名称-值映射
  const depPairs = sortedDeps.map(dep => {
    // 将 JSON Pointer 格式转换为字段路径格式
    // 例如：'#/properties/actionId' -> 'actionId'
    const fieldPath = PathResolver.toFieldPath(dep);
    // 使用 PathResolver.resolve 获取值，支持嵌套路径
    const value = PathResolver.resolve(dep, formData);
    // 处理复杂类型（对象、数组）
    const serializedValue = JSON.stringify(value);

    // 智能移除依赖字段名中的数组索引
    // 场景1-3、5：移除所有索引
    // 场景4（父数组字段）：保留父数组索引
    const templateDepName = toTemplatePathForCache(fieldPath, fieldName);

    // 返回 "字段名=值" 的格式
    return `${templateDepName}=${serializedValue}`;
  });

  // 组合成缓存键：模板字段名:依赖1=值1|依赖2=值2|...
  return `${templateFieldName}:${depPairs.join('|')}`;
}
