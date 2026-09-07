const activeVariants = new Map<string, string>()

/** 保存用户手动选择的 active Variant，供渲染、校验和提交流程共享。 */
export function setActiveVariant(path: string, variantName: string): void {
  activeVariants.set(path, variantName)
}

/** 读取字段当前手动选择的 Variant。 */
export function getActiveVariant(path: string): string | undefined {
  return activeVariants.get(path)
}

/** 清除字段的手动选择，使下一次外部值变化可以重新自动识别。 */
export function clearActiveVariant(path: string): void {
  activeVariants.delete(path)
}
