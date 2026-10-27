import type { ExtendedJSONSchema } from '../types/schema'

/** 判断 Schema 是否声明文件值语义。 */
export function isFileSchema(schema: ExtendedJSONSchema | undefined): boolean {
  return schema?.ui?.widget === 'file'
}

/** 判断值是否为浏览器二进制文件值，兼容跨 realm 场景。 */
export function isBinaryFileValue(value: unknown): value is File | Blob {
  const BlobConstructor = (globalThis as { Blob?: typeof Blob }).Blob
  const FileConstructor = (globalThis as { File?: typeof File }).File
  return Boolean(
    (BlobConstructor && value instanceof BlobConstructor) ||
    (FileConstructor && value instanceof FileConstructor),
  )
}

/** 文件数组保持原始元素，不经过 useFieldArray 的 value 包装。 */
export function isFileArraySchema(
  schema: ExtendedJSONSchema | undefined,
): boolean {
  return Boolean(
    schema?.type === 'array' &&
    !Array.isArray(schema.items) &&
    isFileSchema(schema.items as ExtendedJSONSchema | undefined),
  )
}
