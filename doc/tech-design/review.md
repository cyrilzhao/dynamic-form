# DynamicForm multipart 文件提交设计审查报告

## 1. multipart 协议定义需要修改

当前方案问题：把文件从 JSON part 删除/置空，并依赖外部 `filePaths` 指定文件字段。

应改为：

1. 递归遍历提交值，遇到 `File/Blob` 时在 JSON 中替换为引用对象：

```ts
{
  $file: 'files.<path>',
  fileName: '<original-name>'
}
```

2. 同时追加真实二进制 part: `FormData.append('files.<path>', file)`。
3. JSON part 保留完整结构，不做“删字段式提取”。

## 2. createMultipartFormData API 需要修改

当前方案问题：`filePaths` 必填，导致调用方维护路径清单，且动态数据易失配。

应改为：

```ts
export interface MultipartFormDataOptions {
  jsonFieldName?: string // 默认 payload
  fileFieldName?: (path: string) => string // 默认 path => `files.${path}`
  jsonContentType?: string // 默认 'application/json'
  isFileValue?: (value: unknown) => value is File | Blob
}

export function createMultipartFormData(
  values: Record<string, unknown>
  options?: MultipartFormDataOptions
): FormData
```

修订要点：

1. 移除必填 `filePaths`
2. 默认 `jsonFieldName` 改为 `payload`
3. 默认文件 part 命名改为 `files.<path>`
4. 增加 `isFileValue` 扩展点

## 3. 文件空值契约需要修改

当前方案问题：单文件允许 `null` 或 `undefined`

应改为唯一语义：

1. 单文件：`File | null` （空值只能是 `null`）；
2. 多文件：`File[]`（空值只能是 []）；
3. 删除文档中所有 `undefined` 作为文件空值的描述

## 4. 编辑态 ExistingFileValue 契约需要补充

当前方案问题：未完整定义“已有远程文件 + 新选文件”的共存语义。

应补充：

1. 定义已有远程文件值：

```ts
type ExistingFileValue = {
  fieldId: string
  fileName: string
}
```

2. `ExistingFileValue` 在 JSON 中原样保留，不转为 `$file`
3. 同字段需要新旧文件共存时，建模为数组，元素类型为 `ExistingFileValue | File`

## 5. 默认命名与示例需要统一

当前方案问题：文档默认使用 `data` 和“字段名直传”文件 part，与目标协议不一致。

应改为：

1. JSON part 默认名： `payload`
2. 文件 part 默认名： `files.<path>`
3. 示例、伪代码、测试断言全部按上述默认值同步更新。

## 6. 测试项需要补充/调整

应新增或改写以下断言：

1. JSON 中出现 `$file` 与 `fileName` 引用对象，而不是删除文件字段；
2. `$file` 指向的 part 名与真实 `FormData.append` 的 key 完全一致；
3. 动态数组增删移动后，`files.<path>` 路径按提交快照重新生成，不残留旧索引；
4. `ExistingFileValue` 保持原样进入 payload，不被识别为二进制 part。
