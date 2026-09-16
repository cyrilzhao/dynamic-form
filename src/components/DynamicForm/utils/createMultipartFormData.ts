import { isBinaryFileValue } from './fileValue'

/** JSON 中用于关联二进制 part 的文件引用。 */
export interface MultipartFileReference {
  $file: string
  fileName: string
}

export interface MultipartFormDataOptions {
  /** JSON part 的字段名，默认 payload。 */
  jsonFieldName?: string
  /** 文件 part 的命名策略，默认 files.<path>。 */
  fileFieldName?: (path: string) => string
  /** JSON Blob 的 MIME 类型，默认 application/json。 */
  jsonContentType?: string
  /** 自定义单个文件值判断。 */
  isFileValue?: (value: unknown) => value is File | Blob
}

const isFileList = (value: unknown): value is FileList => {
  const FileListConstructor = (globalThis as { FileList?: typeof FileList })
    .FileList
  return Boolean(FileListConstructor && value instanceof FileListConstructor)
}

const fileNameOf = (value: File | Blob): string => {
  if ('name' in value && typeof value.name === 'string' && value.name) {
    return value.name
  }
  return 'blob'
}

/**
 * 递归提取 File/Blob，构造 multipart FormData。
 * 输入对象和其中的文件引用不会被修改。
 */
export function createMultipartFormData(
  values: Record<string, unknown>,
  options: MultipartFormDataOptions = {},
): FormData {
  const {
    jsonFieldName = 'payload',
    fileFieldName = (path: string) => `files.${path}`,
    jsonContentType = 'application/json',
    isFileValue = isBinaryFileValue,
  } = options
  const formData = new FormData()

  const clone = (value: unknown, path: string): unknown => {
    if (isFileList(value)) {
      return Array.from(value, (file, index) => clone(file, `${path}.${index}`))
    }
    if (isFileValue(value)) {
      const partName = fileFieldName(path)
      if ('name' in value && typeof value.name === 'string') {
        formData.append(partName, value, value.name)
      } else {
        formData.append(partName, value)
      }
      const reference: MultipartFileReference = {
        $file: partName,
        fileName: fileNameOf(value),
      }
      return reference
    }
    if (value instanceof Date) {
      return value
    }
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        clone(item, path ? `${path}.${index}` : String(index)),
      )
    }
    if (value && typeof value === 'object') {
      const result: Record<string, unknown> = {}
      Object.entries(value as Record<string, unknown>).forEach(
        ([key, item]) => {
          result[key] = clone(item, path ? `${path}.${key}` : key)
        },
      )
      return result
    }
    return value
  }

  const payload = clone(values, '')
  formData.append(
    jsonFieldName,
    new Blob([JSON.stringify(payload)], { type: jsonContentType }),
  )
  return formData
}
