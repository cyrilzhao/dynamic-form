# DynamicForm 文件选择与 multipart 提交技术设计

> **状态：提案/未实现。** 本文描述支持文件选择和 multipart 请求组装的目标设计。当前代码仅保留 `file` Widget 类型名称，尚未提供默认文件 Widget、文件值契约或 multipart 序列化实现。

## 1. 背景与目标

DynamicForm 当前的值输出以普通 JavaScript 对象为主，调用方通常可以直接通过 `JSON.stringify` 发送表单数据。文件上传具有不同的数据特征：浏览器产生的 `File`/`Blob` 不能被 JSON 正确表达，后端通常要求使用 `multipart/form-data`，同时又希望其他字段继续按原有嵌套 JSON 结构提交。

本方案的目标是：

1. 为 Schema 提供默认文件选择 Widget，支持单文件和多文件。
2. 在表单状态中保留真实的 `File` 对象，不转换为 base64、临时路径或仅包含元数据的对象。
3. 保持现有 `getValues`、`onChange` 和 `onSubmit` 的对象数据契约，不强制 DynamicForm 直接发起网络请求。
4. 提供可测试、可配置的 multipart 构造器，将文件从 JSON 数据中提取出来，并保留其他字段的嵌套 JSON 结构。
5. 兼容嵌套对象、动态数组、`asNestedForm` 和现有字段变更 metadata 机制。
6. 明确浏览器安全限制、请求头边界、文件校验和异步竞态，避免实现过程中产生隐式行为。

非目标：

- DynamicForm 不负责上传进度、断点续传、分片上传、重试队列或服务端存储。
- DynamicForm 不负责鉴权、接口 URL、后端字段命名或错误码映射。
- 不将文件内容自动编码为 base64，也不把 `File` 序列化成 JSON 字符串。
- 不在本阶段引入第三方上传 SDK。

## 2. 现状与约束

### 2.1 当前实现事实

- `WidgetType` 已包含 `file`，但 `blueprintPreset` 未注册默认文件 Widget。
- `FieldRegistry`、`WidgetsContext` 和 `FormField` 已支持通过 Widget 名称加载组件，因此文件选择可以沿用现有 Widget 扩展边界。
- `FieldWidgetProps` 是值 Widget 的统一输入输出接口，文件 Widget 应通过 `onChange` 写回 `File | File[] | null`。
- DynamicForm 的 `onSubmit` 当前接收经过 Schema 过滤和 transform 后的普通对象；改为直接接收 `FormData` 会破坏现有调用方。
- 当前 `ui.widgetProps` 会透传 Widget 专用配置，适合承载 `accept`、`multiple`、大小限制等文件选择参数。
- `FormChangeMeta` 和变更批次机制已经支持字段路径及来源追踪，文件选择应作为普通用户字段变更进入同一机制。

### 2.2 浏览器限制

浏览器禁止通过脚本把本地文件路径写入 `<input type="file">`。因此：

- `setValue`/`setValues` 可以把已有 `File` 对象写入表单状态，供提交使用，但不能让原生文件输入显示一个伪造的本地路径。
- 文件 Widget 必须把 input 的 `FileList` 转换为 `File | File[] | null`，不能把 `event.target.value` 当作文件值。
- 清空文件时必须使用 `null`（单文件）或 `[]`（多文件），并同步清空原生 input 的 value。

## 3. 推荐架构

采用三层职责：

```text
Schema + ui.widget: 'file'
        │
        ▼
FileWidget
  负责选择、清空、数量/类型/大小的本地约束
  输出 File | File[] | null
        │
        ▼
DynamicForm 值管线
  继续执行 RHF 注册、transform、过滤、联动和 change metadata
  onSubmit 仍接收普通对象
        │
        ▼
createMultipartFormData
  从对象中提取 File/Blob
  JSON 字段写入一个 JSON part
  文件按字段路径写入独立 parts
```

### 3.1 为什么不让 DynamicForm 直接提交 FormData

`DynamicForm` 是表单状态和渲染组件，不应知道请求 URL、HTTP 客户端、鉴权、重试或后端字段协议。若 `onSubmit` 的参数从对象改为 `FormData`，现有 JSON 提交调用方会被迫迁移，且表单校验和传输格式会被耦合。

因此保留现有回调契约，并提供纯函数适配器：

```ts
const handleSubmit = async (values: Record<string, unknown>) => {
  const body = createMultipartFormData(values, {
    filePaths: ['avatar', 'attachments'],
    jsonFieldName: 'data',
  })

  await ofetch('/api/profile', {
    method: 'POST',
    body,
  })
}
```

适配器只负责确定 body，不设置 `Content-Type`。浏览器或 ofetch 必须自动生成包含 boundary 的 `multipart/form-data` 请求头；调用方手动设置 `Content-Type: multipart/form-data` 会导致 boundary 缺失。

## 4. Schema 与值契约

### 4.1 单文件

```ts
const schema = {
  type: 'object',
  properties: {
    avatar: {
      type: 'string',
      format: 'binary',
      title: 'Avatar',
      ui: {
        widget: 'file',
        widgetProps: {
          accept: 'image/png,image/jpeg',
          multiple: false,
          maxSize: 5 * 1024 * 1024,
        },
      },
    },
  },
}
```

外部值类型为 `File | null`。未选择文件时使用 `null` 或 `undefined`；实现必须统一内部空值语义，并在输出时保持文档约定一致。推荐对用户提交输出使用 `null`，以便后端区分“字段存在但没有文件”和“字段未参与本次 patch”。

### 4.2 多文件

```ts
const schema = {
  type: 'object',
  properties: {
    attachments: {
      type: 'array',
      title: 'Attachments',
      items: { type: 'string', format: 'binary' },
      ui: {
        widget: 'file',
        widgetProps: {
          accept: '.pdf,.docx',
          multiple: true,
          maxFiles: 10,
          maxSize: 20 * 1024 * 1024,
        },
      },
    },
  },
}
```

外部值类型为 `File[]`。`multiple` 必须与 Schema 的数组语义一致；若 `type: 'array'` 却未启用 `multiple`，实现应在开发环境给出警告或拒绝渲染，不能静默把单个 File 包装成不可预测的数组结构。

### 4.3 `widgetProps` 配置

第一版只新增文件 Widget 必需配置，不扩张 `DynamicFormProps`：

| 配置           | 类型      | 默认值  | 说明                               |
| -------------- | --------- | ------- | ---------------------------------- |
| `accept`       | `string`  | 未限制  | 原生 input 的 MIME、扩展名或组合值 |
| `multiple`     | `boolean` | `false` | 是否允许选择多个文件               |
| `maxFiles`     | `number`  | 未限制  | 多文件最多数量                     |
| `maxSize`      | `number`  | 未限制  | 单个文件最大字节数                 |
| `maxTotalSize` | `number`  | 未限制  | 多文件总字节数                     |
| `showFileList` | `boolean` | `true`  | 是否显示已选文件名和大小           |
| `clearable`    | `boolean` | `true`  | 是否显示清空操作                   |
| `capture`      | `string`  | 未设置  | 透传移动端 capture hint            |

`accept` 只提供浏览器选择提示，不是安全边界。服务端必须再次验证 MIME、扩展名、文件签名、大小和内容。

## 5. FileWidget 设计

### 5.1 组件职责

`FileWidget` 遵循现有 `FieldWidgetProps`，只负责：

1. 渲染隐藏或可见的 `<input type="file">`。
2. 把 `FileList` 转换为单个 `File`、`File[]` 或空值。
3. 展示已选文件的名称、大小和错误状态。
4. 提供清空操作，并重置原生 input value。
5. 将浏览器选择事件通过 `onChange` 交给 Controller。

它不负责：

- 读取文件内容并转 base64。
- 调用后端上传接口。
- 修改其他字段。
- 自行触发表单提交或绕过 DynamicForm 的 change batch。

### 5.2 文件选择事件流程

```text
用户选择文件
  → input.files
  → 校验数量、单文件大小、总大小
  → 生成 File | File[] | null
  → controller.onChange(value)
  → RHF watch/change batch
  → onChange(data, meta)
```

校验失败时不应把非法文件写入表单状态。Widget 应显示英文错误信息，并调用标准字段错误通道；具体错误应包含失败文件名和约束类型，但不能暴露本地完整路径。

### 5.3 `File` 与 transform

文件字段默认不执行字符串或数字 transform。若业务确实需要生成文件元数据，应通过独立的计算字段或提交适配器完成；不能把 `File` 传给现有字符串 transform。`getValues`、`onChange` 和 `onSubmit` 应保留真实文件对象。

## 6. multipart 序列化设计

### 6.1 默认传输协议

新增纯函数 `createMultipartFormData(values, options)`，默认生成以下 parts：

| Part 名称    | 内容类型                | 内容                                                   |
| ------------ | ----------------------- | ------------------------------------------------------ |
| `data`       | `application/json` Blob | 移除文件后的完整嵌套 JSON 对象                         |
| 文件字段路径 | 原始 File/Blob 类型     | 按配置路径提取的每个文件；多文件重复使用同一 part 名称 |

例如：

```text
data = {"profile":{"name":"Ada"},"attachments":[]}
attachments = <first File>
attachments = <second File>
```

文件字段从 JSON part 中删除或替换为空数组，避免同一文件既出现在 JSON 中又被重复传输。推荐保留多文件字段为空数组、单文件字段为 `null`，这样后端可以稳定解析结构。

### 6.2 可配置项

```ts
interface MultipartFormDataOptions {
  /** 明确哪些路径被视为文件，避免误把任意 Blob 当成上传内容。 */
  filePaths: string[]
  /** JSON part 的字段名，默认 data。 */
  jsonFieldName?: string
  /** 文件 part 的命名策略，默认使用原始绝对点号路径。 */
  fileFieldName?: (path: string, index?: number) => string
  /** JSON Blob 的 MIME 类型，默认 application/json。 */
  jsonContentType?: string
}
```

默认文件命名策略使用表单绝对路径，例如 `profile.avatar`、`items.0.attachment`。后端若要求 `attachments[]`、`files` 或其他命名，可通过 `fileFieldName` 映射，不改变表单状态路径。

### 6.3 提取规则

序列化器必须支持：

- `File`、`Blob` 和浏览器 `FileList`（实现边界处统一转为 File 数组）。
- 嵌套对象路径。
- 数组元素路径，例如 `items.0.attachment`。
- 同一路径的多文件重复 append。
- 空值、未配置路径和不存在路径不生成文件 part。
- 文件字段以外的 `Date`、普通对象和数组按现有 JSON 语义序列化。

不能使用 `JSON.stringify` 后再从字符串中搜索文件；必须在结构化对象上递归克隆和提取，以保留类型和路径信息。

### 6.4 只发送 JSON 的兼容行为

调用方可以继续直接 `JSON.stringify(values)` 发送没有文件的表单。`createMultipartFormData` 仅在调用方选择 multipart 协议时使用，不改变 DynamicForm 的默认提交方式。

## 7. 校验、状态和 metadata

### 7.1 Schema 校验

第一版文件校验分为两层：

- Widget 本地约束：`accept`、`maxFiles`、`maxSize`、`maxTotalSize`，用于尽快阻止非法选择。
- 服务端约束：文件签名、真实 MIME、病毒扫描、权限、业务关联和最终大小限制。

JSON Schema 的 `required` 仍负责“是否必须有文件”；文件内容校验不应伪装成普通字符串的 `pattern`。后续如需标准化，可增加 `ui.file` 规则，但不能让 `format: binary` 单独承担大小和安全校验。

### 7.2 Change Metadata

文件选择是普通用户变更，metadata 应保持既有契约：

```ts
{
  rootSource: 'user',
  changes: [{
    path: 'avatar',
    previousValue: null,
    value: File,
    source: 'user',
  }],
}
```

metadata 不能包含文件内容快照或把 File 转为 JSON。日志、审计和调试输出应只记录文件名、大小和类型等脱敏元数据，避免把二进制对象写入日志。

### 7.3 程序化写值

`setValue`/`setValues` 接受调用方已有的 `File`/`File[]`，并按普通字段变更触发校验、联动和 `onChange`。它们不能伪造浏览器 input 的本地路径；Widget 展示层应显示“已由程序设置”或文件元数据，而不是写入 input 的 value 属性。

## 8. 嵌套表单与数组

- `asNestedForm` 继续共享根 RHF 实例、change batch 和联动运行时，文件字段不创建独立上传上下文。
- `NestedFormWidget` 中的文件字段路径必须使用绝对路径，例如 `profile.avatar`。
- 动态数组中的文件路径必须绑定当前数组索引；数组插入、删除、移动后，提交时使用最新快照重新解析路径，不能缓存旧索引。
- 删除数组项后，已删除 File 不应出现在 JSON part 或 file parts 中。
- move 操作只改变文件所在数组元素的路径顺序，不复制或重新读取文件内容。

## 9. 异步与竞态风险

文件选择本身是同步事件，但以下场景需要纳入已有批次机制：

1. 用户连续选择不同文件时，后一次选择必须覆盖同一字段的旧值。
2. 文件字段同时触发异步联动时，过期联动结果不能覆盖最新文件选择。
3. `setValues`、reset 和用户选择在相邻事件循环执行时，metadata 的来源和前后值必须保持正确。
4. 多文件选择校验失败时，不能产生“先写入后撤销”的可观察中间 onChange。
5. 文件读取预览若未来引入异步 `FileReader`，必须使用字段版本令牌；旧读取结果不得更新当前字段。

本阶段不读取文件内容，因此不新增全局文件读取队列。上传请求的取消、重试和进度属于调用方网络层。

## 10. API 草案

### 10.1 文件 Widget

```ts
export interface FileWidgetProps extends FieldWidgetProps {
  accept?: string
  multiple?: boolean
  maxFiles?: number
  maxSize?: number
  maxTotalSize?: number
  showFileList?: boolean
  clearable?: boolean
  capture?: string
}
```

### 10.2 multipart 工具

```ts
export interface MultipartFormDataOptions {
  filePaths: string[]
  jsonFieldName?: string
  fileFieldName?: (path: string, index?: number) => string
  jsonContentType?: string
}

export function createMultipartFormData(
  values: Record<string, unknown>,
  options: MultipartFormDataOptions,
): FormData
```

工具应从 `src/components/DynamicForm/utils` 导出，并通过 `src/components/DynamicForm/index.ts` 暴露公共类型和函数。它必须是无副作用的：不修改传入对象、不改变 File 引用、不发起网络请求。

## 11. 测试设计

### 11.1 FileWidget 单元测试

- 单文件选择输出一个 `File`。
- 多文件选择输出有序 `File[]`。
- 清空单文件输出 `null`，清空多文件输出 `[]`。
- `accept`、单文件大小、文件数量和总大小限制拒绝非法选择。
- 非法选择不触发字段值更新或 change metadata。
- 文件名显示不包含本地完整路径。
- disabled、readonly、hidden 状态阻止选择操作。

### 11.2 multipart 工具测试

- 只含 JSON 字段时生成正确 `data` JSON part。
- 单文件字段被提取为一个 file part。
- 多文件字段按选择顺序生成多个相同名称的 parts。
- 嵌套对象和数组索引路径正确提取。
- 删除数组元素后旧路径不会残留。
- 自定义 `jsonFieldName` 和 `fileFieldName` 生效。
- 输入对象保持不变，File 对象引用保持不变。
- `Blob`、空值、未知路径和非文件值按约定处理。

### 11.3 DynamicForm 集成测试

- 文件字段通过 `onChange` 返回 File，并生成 `source: 'user'` metadata。
- `setValue`/`setValues` 写入 File 后不伪造原生 input 路径，`getValues` 返回 File。
- 嵌套文件字段经过 `asNestedForm` 使用绝对路径。
- 动态数组增删移动后 multipart 提取使用新索引。
- 文件字段与普通字段同时变化时，onChange 仍只生成一个完整批次。
- 异步联动旧结果不能覆盖最新文件选择。
- `onSubmit` 默认仍接收普通对象，调用方显式调用 multipart 工具后可发送 FormData。

### 11.4 浏览器与网络验证

使用 Testing Library 验证 input 行为，使用真实 `File`/`Blob` 构造对象；使用 `FormData.entries()` 检查 part 名称、顺序和内容。请求集成测试必须断言调用方没有手动设置 `Content-Type`，由浏览器/HTTP 客户端生成 boundary。

## 12. 分阶段实施计划

### Phase 1：类型和默认 Widget

1. 增加 `FileWidget`、类型导出和 Blueprint 默认注册。
2. 明确单文件/多文件 Schema 与空值契约。
3. 补充 Widget 单元测试和基础 DynamicForm 集成测试。

### Phase 2：结构化 multipart 工具

1. 实现结构化递归提取和克隆，不修改输入对象。
2. 支持嵌套路径、数组索引、多文件重复 parts 和命名策略。
3. 补充工具单元测试，并在 README 增加调用方示例。

### Phase 3：现有机制闭环

1. 验证 change metadata、transform、Schema 过滤和动态数组行为。
2. 验证 `asNestedForm` 根批次共享和异步联动竞态。
3. 增加浏览器请求集成测试和文档中的风险矩阵。

每个阶段都必须先补测试，再修改实现；任何改变 `onSubmit` 参数契约的方案都需要单独的兼容性评审，不在本设计默认范围内。

## 13. 风险与决策记录

| 风险                                               | 处理决定                                            |
| -------------------------------------------------- | --------------------------------------------------- |
| 手动设置 multipart Content-Type 导致 boundary 错误 | 文档和示例明确禁止手动设置，由浏览器/客户端生成     |
| File 被 JSON.stringify 丢失                        | 文件路径显式提取，JSON part 不包含文件对象          |
| 误把任意 Blob 当上传文件                           | 第一版要求 `filePaths` 显式声明，不能全量扫描未知值 |
| 浏览器无法回显程序设置的本地路径                   | 接受平台限制，展示文件元数据，不写 input.value      |
| 数组索引缓存导致上传错误文件                       | 序列化时基于提交快照重新解析绝对路径                |
| 文件内容进入日志或 metadata                        | metadata 只保留引用；日志只允许脱敏元数据           |
| DynamicForm 被网络层耦合                           | 保留对象型 onSubmit，multipart 作为纯适配工具       |

## 14. 结论

文件选择是 DynamicForm 的一种值 Widget，multipart 是调用方选择的传输编码。两者通过真实 `File` 值和无副作用的结构化序列化器连接：表单继续遵循现有 Schema、RHF、联动、批次和 metadata 设计，调用方则可以在提交时把文件作为 multipart parts，把其余字段作为 JSON part 发送给后端。该边界满足向后兼容，也为后续上传进度、分片和服务端校验保留了扩展空间。
