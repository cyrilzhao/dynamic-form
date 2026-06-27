import type { LinkageConfig } from '../types/linkage'
import type { ExtendedJSONSchema } from '../types/schema'
import { resolveRelativePath } from './pathTransformer'

/**
 * 数组联动辅助工具
 * 用于处理数组元素内部的相对路径联动和 JSON Pointer 路径解析
 *
 * 新方案（v3.0）：
 * - 使用标准的 . 分隔符
 * - 简化路径处理逻辑
 */

/**
 * 将路径按层级分割（使用标准的 . 分隔符）
 * @example
 * splitPath('contacts.0.name')
 * // => ['contacts', '0', 'name']
 */
function splitPath(path: string): string[] {
  return path.split('.')
}

/**
 * 检查路径是否是数组元素路径
 * @example
 * isArrayElementPath('contacts.0.name') // true
 * isArrayElementPath('contacts.name') // false
 */
export function isArrayElementPath(path: string): boolean {
  const parts = splitPath(path)
  return parts.some((part) => /^\d+$/.test(part))
}

/**
 * 从数组元素路径中提取数组路径和索引
 *
 * 新方案（v3.0）：使用标准的 . 分隔符
 *
 * @example
 * extractArrayInfo('contacts.0.name') // { arrayPath: 'contacts', index: 0, fieldPath: 'name' }
 */
export function extractArrayInfo(path: string): {
  arrayPath: string
  index: number
  fieldPath: string
} | null {
  const parts = splitPath(path)
  const indexPos = parts.findIndex((part) => /^\d+$/.test(part))

  if (indexPos === -1) {
    return null
  }

  const arrayPath = parts.slice(0, indexPos).join('.')
  const index = parseInt(parts[indexPos], 10)
  const fieldPath = parts.slice(indexPos + 1).join('.')

  return { arrayPath, index, fieldPath }
}

/**
 * 解析 JSON Pointer 为逻辑路径
 * @param pointer - JSON Pointer（如 '#/properties/contacts/items/properties/type'）
 * @returns 逻辑路径（如 'contacts.type'）
 */
export function parseJsonPointer(pointer: string): string {
  if (!pointer.startsWith('#/')) {
    throw new Error(`无效的 JSON Pointer: ${pointer}`)
  }

  // 移除 '#/' 前缀
  const segments = pointer.slice(2).split('/')

  // 过滤掉 'properties' 和 'items' 标记
  const logicalSegments = segments.filter(
    (s) => s !== 'properties' && s !== 'items'
  )

  return logicalSegments.join('.')
}

/**
 * 路径关系类型
 *
 * 注意：'same-level' 类型已移除，因为 analyzePathRelationship 函数
 * 在路径长度相等时返回 'other' 类型，不会产生 'same-level'
 */
interface PathRelationship {
  type: 'child-to-parent' | 'parent-to-child' | 'other'
  commonPrefix?: string[]
}

/**
 * 分析路径关系
 */
function analyzePathRelationship(
  depLogicalPath: string,
  currentPath: string
): PathRelationship {
  const depSegments = splitPath(depLogicalPath)
  const currentSegments = splitPath(currentPath)

  // 找到共同前缀
  const commonPrefix: string[] = []
  for (
    let i = 0;
    i < Math.min(depSegments.length, currentSegments.length);
    i++
  ) {
    if (depSegments[i] === currentSegments[i]) {
      commonPrefix.push(depSegments[i])
    } else {
      break
    }
  }

  // 判断是否是子数组到父数组的关系
  if (currentSegments.length > depSegments.length && commonPrefix.length > 0) {
    return { type: 'child-to-parent', commonPrefix }
  }

  // 判断是否是父数组到子数组的关系
  if (depSegments.length > currentSegments.length && commonPrefix.length > 0) {
    return { type: 'parent-to-child', commonPrefix }
  }

  return { type: 'other', commonPrefix }
}

/**
 * 解析子数组到父数组的依赖
 *
 * 新方案（v3.0）：使用标准的 . 分隔符
 *
 * @example
 * depPath: 'departments.type'
 * currentPath: 'departments.0.employees.1.techStack'
 * 返回: 'departments.0.type'
 */
function resolveChildToParent(
  depLogicalPath: string,
  currentPath: string,
  _relationship: PathRelationship
): string {
  const depSegments = splitPath(depLogicalPath)
  const currentSegments = splitPath(currentPath)

  // 找到父数组的索引位置（第一个数字索引）
  const parentArrayIndexPos = currentSegments.findIndex((seg) =>
    /^\d+$/.test(seg)
  )

  if (parentArrayIndexPos === -1) {
    return depLogicalPath
  }

  // 插入索引到依赖路径中
  const result = [
    ...depSegments.slice(0, depSegments.length - 1),
    currentSegments[parentArrayIndexPos],
    depSegments[depSegments.length - 1],
  ].join('.')

  return result
}

/**
 * 解析父数组到子数组的依赖
 *
 * 新方案（v3.0）：使用标准的 . 分隔符
 *
 * @example
 * depPath: 'departments.employees'
 * currentPath: 'departments.0.totalSalary'
 * 返回: 'departments.0.employees'
 */
function resolveParentToChild(
  depLogicalPath: string,
  currentPath: string,
  _relationship: PathRelationship
): string {
  const depSegments = splitPath(depLogicalPath)
  const currentSegments = splitPath(currentPath)

  // 找到当前元素的索引
  const arrayIndexPos = currentSegments.findIndex((seg) => /^\d+$/.test(seg))

  if (arrayIndexPos === -1) {
    return depLogicalPath
  }

  const arrayIndex = currentSegments[arrayIndexPos]

  // 在依赖路径中插入索引
  const result = [
    ...depSegments.slice(0, depSegments.length - 1),
    arrayIndex,
    depSegments[depSegments.length - 1],
  ].join('.')

  return result
}

/**
 * 解析 JSON Pointer 依赖路径
 */
function resolveJsonPointerDependency(
  pointer: string,
  currentPath: string
): string {
  // 1. 解析 JSON Pointer 为逻辑路径
  const logicalPath = parseJsonPointer(pointer)

  // 2. 检查是否需要索引匹配
  const needsIndexMatching = pointer.includes('/items/')

  if (!needsIndexMatching) {
    // 顶层字段，直接返回
    return logicalPath
  }

  // 3. 分析依赖路径和当前路径的关系
  const relationship = analyzePathRelationship(logicalPath, currentPath)

  switch (relationship.type) {
    case 'child-to-parent':
      // 子数组元素依赖父数组元素字段
      return resolveChildToParent(logicalPath, currentPath, relationship)

    case 'parent-to-child':
      // 父数组元素依赖子数组
      return resolveParentToChild(logicalPath, currentPath, relationship)

    default:
      // 'other' 类型：路径没有共同前缀或长度相等，直接返回逻辑路径
      return logicalPath
  }
}

/**
 * 解析依赖路径为运行时绝对路径（核心算法）
 * @param depPath - 依赖路径（相对路径或 JSON Pointer）
 * @param currentPath - 当前字段的完整路径（如 'contacts.0.companyName'）
 * @param schema - Schema 对象（用于识别数组字段）
 * @returns 解析后的绝对路径
 */
export function resolveDependencyPath({
  depPath,
  currentPath,
}: {
  depPath: string
  currentPath: string
}): string {
  // 1. 相对路径：同级字段
  if (depPath.startsWith('./')) {
    return resolveRelativePath(depPath, currentPath)
  }

  // 2. JSON Pointer：绝对路径
  if (depPath.startsWith('#/')) {
    return resolveJsonPointerDependency(depPath, currentPath)
  }

  // 3. 已经是运行时的绝对路径（如 contacts.0.type），直接返回
  // 这种情况发生在联动配置已经被实例化后再次调用 resolveArrayElementLinkage 时
  return depPath
}

/**
 * 为数组元素的联动配置解析路径
 * @param linkage - 原始联动配置
 * @param currentPath - 当前字段的完整路径
 * @param schema - Schema 对象（可选，当 depPath 为绝对路径时必填）
 * @returns 解析后的联动配置
 */
export function resolveArrayElementLinkage(
  linkage: LinkageConfig,
  currentPath: string
): LinkageConfig {
  const resolved = { ...linkage }

  // 解析 dependencies 中的路径
  // 注意：LinkageConfig 类型保证 dependencies 是必填字段，无需检查
  resolved.dependencies = resolved.dependencies.map((depPath) => {
    return resolveDependencyPath({
      depPath,
      currentPath,
    })
  })

  // 解析 when 条件中的路径
  if (resolved.when && typeof resolved.when === 'object') {
    resolved.when = resolveConditionPaths(resolved.when, currentPath)
  }

  return resolved
}

/**
 * 递归解析条件表达式中的路径
 */
function resolveConditionPaths(
  condition: any,
  currentPath: string
): any {
  const resolved = { ...condition }

  if (resolved.field) {
    resolved.field = resolveDependencyPath({
      depPath: resolved.field,
      currentPath,
    })
  }

  if (resolved.and) {
    resolved.and = resolved.and.map((c: any) =>
      resolveConditionPaths(c, currentPath)
    )
  }
  if (resolved.or) {
    resolved.or = resolved.or.map((c: any) =>
      resolveConditionPaths(c, currentPath)
    )
  }

  return resolved
}

/**
 * 从联动配置路径中提取数组信息（基于 schema 解析）
 *
 * 新方案（v3.0）：使用标准的 . 分隔符
 *
 * @param fieldPath - 联动配置的字段路径（如 'contacts.category.group.vipLevel'）
 * @param schema - Schema 定义
 * @returns 数组信息，如果路径中包含数组则返回相关信息，否则返回 null
 *
 * @example
 * // 输入: 'contacts.category.group.vipLevel'
 * // 输出: { arrayPath: 'contacts', fieldPathInArray: 'category.group.vipLevel' }
 */
export function findArrayInPath(
  fieldPath: string,
  schema: ExtendedJSONSchema
): { arrayPath: string; fieldPathInArray: string } | null {
  // 递归遍历 schema，找到路径中的数组字段
  return findArrayInPathRecursive(fieldPath, schema, '')
}

/**
 * 递归查找路径中的数组字段
 *
 * 新方案（v3.0）：使用标准的 . 分隔符
 */
function findArrayInPathRecursive(
  targetPath: string,
  schema: ExtendedJSONSchema,
  currentLogicalPath: string
): { arrayPath: string; fieldPathInArray: string } | null {
  if (!schema.properties) {
    return null
  }

  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    if (typeof fieldSchema === 'boolean') continue

    const typedSchema = fieldSchema as ExtendedJSONSchema

    // 使用标准的 . 分隔符计算当前字段的逻辑路径
    const newLogicalPath = currentLogicalPath
      ? `${currentLogicalPath}.${fieldName}`
      : fieldName

    // 检查目标路径是否以当前逻辑路径开头
    if (!targetPath.startsWith(newLogicalPath)) {
      continue
    }

    // 如果是数组类型，检查是否匹配
    if (typedSchema.type === 'array') {
      const arrayPathWithDot = newLogicalPath + '.'

      if (targetPath.startsWith(arrayPathWithDot)) {
        const fieldPathInArray = targetPath.slice(arrayPathWithDot.length)
        return { arrayPath: newLogicalPath, fieldPathInArray }
      }
    }

    // 递归处理嵌套对象
    if (typedSchema.type === 'object' && typedSchema.properties) {
      const result = findArrayInPathRecursive(
        targetPath,
        typedSchema,
        newLogicalPath
      )
      if (result) return result
    }

    // 注意：当 targetPath 以数组字段路径开头时，第 380 行会匹配并返回结果。
    // 只有当 targetPath === newLogicalPath（目标路径恰好等于数组字段名）时才会到达这里，
    // 但此时递归进入 items 后不会找到匹配（因为 targetPath 不包含 items 内部的字段路径），
    // 所以这里的递归调用总是返回 null，无需处理返回值。
    // 保留这段代码是为了处理未来可能的边界情况。
  }

  return null
}
