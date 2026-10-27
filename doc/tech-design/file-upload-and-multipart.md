# DynamicForm 文件选择与 multipart 提交技术设计

> **状态：已实现（第一版）。** 本文描述并约束文件选择和 multipart 请求组装；当前代码已提供默认文件 Widget、文件值契约及 multipart 序列化实现。

## 1. 背景与目标

DynamicForm 当前的值输出以普通 JavaScript 对象为主，调用方通常可以直接通过 `JSON.stringify` 发送表单数据。文件上传具有不同的数据特征：浏览器产生的 `File`/`Blob` 不能被 JSON 正确表达，后端通常要求使用 `multipart/form-data`，同时又希望其他字段继续按原有嵌套 JSON 结构提交。

本方案的目标是：

1. 为 Schema 提供默认文件选择 Widget，支持单文件和多文件。
2. 在表单状态中保留真实的 `File` 对象，不转换为 base64、临时路径或仅包含元数据的对象。
3. 保持现有 `getValues`、`onChange` 和 `onSubmit` 的对象数据契约，不强制 DynamicForm 直接发起网络请求。
4. 提供可测试、可配置的 multipart 构造器，递归识别文件并在 JSON 中写入文件引用，同时保留完整的嵌套 JSON 结构。
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
- `FieldWidgetProps` 是值 Widget 的统一输入输出接口，文件 Widget 应通过 `onChange` 写回 `File | File[] | null`；已有远程文件值只用于编辑态，不能伪装成浏览器 `File`。
- 当前 `SchemaValidator` 会按 JSON Schema 的 `type: 'string'` 严格校验 `typeof value === 'string'`，因此不能直接把 `File` 写入普通 string 字段；文件功能必须先加入由 `ui.widget: 'file'` 触发的文件语义校验分支。
- 当前 reset 空值构造会把所有 `string` 字段设为 `''`，基本类型数组转换也会包装 `items.type === 'string'` 的数组；二者都必须识别文件 Schema，分别输出 `null`/`[]` 和保持 `File[]` 原样。
- 当前 transform、Variant 检测、联动快照和变更比较都按通用 JavaScript/JSON 值处理；其中 transform 会直接调用回调，Variant 会把 `File` 视为 `object`，JSON 字符串化的快照/比较会丢失或混淆文件对象，因此需要文件专用兼容逻辑。
- DynamicForm 的 `onSubmit` 当前接收经过 Schema 过滤和 transform 后的普通对象；改为直接接收 `FormData` 会破坏现有调用方。
- 当前 `ui.widgetProps` 会透传 Widget 专用配置，适合承载 `accept`、单文件大小限制等文件选择参数。
- `FormChangeMeta` 和变更批次机制已经支持字段路径及来源追踪，文件选择应作为普通用户字段变更进入同一机制。

### 2.2 浏览器限制

浏览器禁止通过脚本把本地文件路径写入 `<input type="file">`。因此：

- `setValue`/`setValues` 可以把已有 `File` 对象写入表单状态，供提交使用，但不能让原生文件输入显示一个伪造的本地路径。
- 文件 Widget 必须从 input 的 `FileList` 取出单个 `File` 或 `null`，不能把 `event.target.value` 当作文件值；多文件由数组字段的多个 FileWidget 分别提供。
- 清空文件时必须使用 `null`（单文件）或 `[]`（多文件），并同步清空原生 input 的 value。

## 3. 推荐架构

采用三层职责：

```text
Schema + ui.widget: 'file'
        │
        ▼
FileWidget
  负责选择、清空、数量/类型/大小的本地约束
  输出 File | null
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
  const body = createMultipartFormData(values)

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
      title: 'Avatar',
      ui: {
        widget: 'file',
        widgetProps: {
          accept: 'image/png,image/jpeg',
          maxSize: 5 * 1024 * 1024,
        },
      },
    },
  },
}
```

外部值类型为 `File | null`。未选择文件时唯一使用 `null`；`undefined` 不属于文件字段的空值契约。这样可以明确区分“字段存在但没有文件”和“字段未参与本次 patch”。

### 4.2 多文件

```ts
const schema = {
  type: 'object',
  properties: {
    attachments: {
      type: 'array',
      title: 'Attachments',
      items: { type: 'string' },
      ui: {
        widget: 'file',
        widgetProps: {
          accept: '.pdf,.docx',
          maxSize: 20 * 1024 * 1024,
        },
      },
    },
  },
}
```

外部值类型为 `File[]`。第一版只支持动态文件数组：字段使用 `type: 'array'`，外层 ArrayWidget 负责增删、移动、`minItems`/`maxItems` 等数量约束，`items` 配置 `ui.widget: 'file'`。每个数组元素都是一个 `File | null`，整体值为 `File[]`。

第一版 FileWidget 不提供 `multiple`。这避免自由编辑 `widgetProps` 时把 `File[]` 作为数组元素写入而形成 `File[][]`。需要一次选择多个文件的交互，留待 SchemaBuilder 提供结构化配置界面后单独评审。

### 4.3 编辑态已有文件

编辑已有数据时，服务端返回的文件记录不应建模为 `File`，也不应被 multipart 序列化器识别为二进制 part。统一使用以下值类型：

```ts
interface ExistingFileValue {
  fieldId: string
  fileName: string
}
```

`ExistingFileValue` 在 JSON 中原样保留。需要同时保留已有文件并追加新文件时，字段必须使用数组，元素类型为 `ExistingFileValue | File`；删除已有文件的语义由调用方根据 `fieldId` 另行约定，不能通过伪造 `File` 实现。

### 4.4 `widgetProps` 配置

第一版只新增文件 Widget 必需配置，不扩张 `DynamicFormProps`：

| 配置           | 类型      | 默认值 | 说明                               |
| -------------- | --------- | ------ | ---------------------------------- |
| `accept`       | `string`  | 未限制 | 原生 input 的 MIME、扩展名或组合值 |
| `maxSize`      | `number`  | 未限制 | 单个文件最大字节数                 |
| `showFileList` | `boolean` | `true` | 是否显示已选文件名和大小           |
| `clearable`    | `boolean` | `true` | 是否显示清空操作                   |
| `capture`      | `string`  | 未设置 | 透传移动端 capture hint            |

`accept` 只提供浏览器选择提示，不是安全边界。服务端必须再次验证 MIME、扩展名、文件签名、大小和内容。

## 5. FileWidget 设计

### 5.1 组件职责

`FileWidget` 遵循现有 `FieldWidgetProps`，只负责：

1. 渲染隐藏或可见的 `<input type="file">`。
2. 把 `FileList` 转换为单个 `File` 或空值；多文件由数组字段的多个 FileWidget 元素表达。
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
  → 校验单文件大小
  → 生成 File | null
  → controller.onChange(value)
  → RHF watch/change batch
  → onChange(data, meta)
```

校验失败时不应把非法文件写入表单状态。Widget 应显示英文错误信息，并调用标准字段错误通道；具体错误应包含失败文件名和约束类型，但不能暴露本地完整路径。

### 5.3 `File` 与 transform

文件字段默认不执行字符串或数字 transform。实现必须在 `applyFieldTransforms`、`reverseFieldTransforms`、`setValue`、`setValues`、`getValues`、`onChange` 和 `onSubmit` 的统一值管线中，根据有效 Schema 跳过 `ui.transform.callback` 与 `reverseCallback`；不能把 `File`、`Blob`、`File[]` 或包含它们的编辑态文件数组传给现有字符串/数字 transform。

若业务确实需要生成文件元数据，应通过独立的计算字段或提交适配器完成；`getValues`、`onChange` 和 `onSubmit` 应保留真实文件对象。自定义 `ui.validators` 可以接收文件值以实施业务规则，但必须自行按 `File`/`Blob`/数组类型编写，不能假定值是字符串。

## 6. multipart 序列化设计

### 6.1 默认传输协议

新增纯函数 `createMultipartFormData(values, options)`，默认生成以下 parts：

| Part 名称      | 内容类型                | 内容                                         |
| -------------- | ----------------------- | -------------------------------------------- |
| `payload`      | `application/json` Blob | 保留完整结构，文件值替换为引用对象           |
| `files.<path>` | 原始 File/Blob 类型     | 递归发现的每个文件；数组元素路径包含当前索引 |

例如：

```text
payload = {"profile":{"name":"Ada"},"attachments":[{"$file":"files.attachments.0","fileName":"a.pdf"},{"$file":"files.attachments.1","fileName":"b.pdf"}]}
files.attachments.0 = <first File>
files.attachments.1 = <second File>
```

序列化器递归遍历提交值，遇到 `File`/`Blob` 时，在 JSON 的相同位置替换为 `{ $file, fileName }` 引用对象，并用同一个 `$file` 值作为真实文件 part 的名称。动态数组元素使用包含当前索引的字段路径，因此每个文件都有唯一 part 名，例如 `files.attachments.0`。`fileName` 对 `File` 取 `File.name`，对没有名称的 `Blob` 使用稳定的 `blob` 回退值。JSON 不删除文件字段，也不把文件置空，因此后端可以在完整结构中区分文件位置；真实二进制只出现在对应的 `files.<path>` part 中。

### 6.1.1 文件引用对象（`$file`）

`$file` 是 multipart 协议中的保留字段，用于把 JSON 中的文件位置与同一个 `FormData` 文件 part 关联起来。它不是文件内容，也不是服务端文件 ID；服务端应使用该字符串查找对应的二进制 part。

文件值替换后的引用对象格式固定为：

```ts
interface MultipartFileReference {
  /** 对应 FormData 文件 part 的完整名称，例如 files.attachments。 */
  $file: string
  /** 原始文件名；Blob 没有名称时使用约定的回退值。 */
  fileName: string
}
```

协议约束：

- `$file` 必须与实际 `FormData.append($file, file)` 使用的 key 完全一致。
- 单文件引用位于原字段位置；多文件数组中的每个元素都生成一个引用对象，并使用带当前索引的唯一 `$file` part 名。
- 动态数组中的 `$file` 必须基于提交时的当前路径生成，例如 `files.items.0.attachment`；不得复用增删移动前缓存的路径。
- 每个引用对象必须对应一个真实文件 part；没有对应 part 的 `$file`，或一个 part 被多个引用使用，均属于无效 payload。
- `ExistingFileValue` 不包含 `$file`，保持普通 JSON 对象，不追加二进制 part。

### 6.2 可配置项

```ts
interface MultipartFormDataOptions {
  /** JSON part 的字段名，默认 payload。 */
  jsonFieldName?: string
  /** 文件 part 的命名策略，默认 `files.${path}`。 */
  fileFieldName?: (path: string) => string
  /** JSON Blob 的 MIME 类型，默认 application/json。 */
  jsonContentType?: string
  /** 自定义单个文件值判断；默认识别 File 和 Blob。 */
  isFileValue?: (value: unknown) => value is File | Blob
}
```

默认文件 part 命名为 `files.<path>`，例如 `files.profile.avatar`、`files.items.0.attachment`。后端若要求其他命名，可通过 `fileFieldName` 映射，不改变表单状态路径。`filePaths` 不再由调用方维护；递归快照保证动态数组增删移动后不会残留旧索引。

### 6.3 提取规则

序列化器必须支持：

- `File`、`Blob` 和浏览器 `FileList`；`FileList` 在遍历边界处转为 `File[]`，`isFileValue` 只负责判断单个 `File`/`Blob` 值。
- 嵌套对象路径。
- 数组元素路径，例如 `items.0.attachment`。
- 数组元素按当前索引生成独立的文件 part。
- `null`、空数组和不存在值不生成文件 part；`undefined` 仅按普通 JSON 缺省语义处理。
- 文件字段以外的 `Date`、普通对象和数组按现有 JSON 语义序列化。
- `ExistingFileValue` 按普通 JSON 对象处理，不生成文件 part。

不能使用 `JSON.stringify` 后再从字符串中搜索文件；必须在结构化对象上递归克隆和提取，以保留类型和路径信息。

### 6.4 只发送 JSON 的兼容行为

调用方可以继续直接 `JSON.stringify(values)` 发送没有文件的表单。`createMultipartFormData` 仅在调用方选择 multipart 协议时使用，不改变 DynamicForm 的默认提交方式。

## 7. 校验、状态和 metadata

### 7.1 Schema 校验

第一版文件校验分为两层：

- Widget 本地约束：`accept`、`maxSize`，用于尽快阻止非法选择；数组的数量约束由外层 `minItems`、`maxItems` 负责。
- 服务端约束：文件签名、真实 MIME、病毒扫描、权限、业务关联和最终大小限制。

在表单运行时，`ui.widget: 'file'` 是文件字段的唯一判别依据；`type: 'string'` 仅用于保持 JSON Schema 的基础结构兼容，不能决定表单内存值必须是字符串。`format: 'binary'` 不是用户必填配置，仅作为导出 OpenAPI/标准 JSON Schema 时可选的互操作标记。解析到 `ui.widget: 'file'` 的有效 Schema 后，`SchemaValidator` 必须进入文件校验分支：

- 单文件值仅允许 `File | Blob | null`；多文件值仅允许 `File[]`，以及编辑态允许的 `ExistingFileValue | File | Blob` 混合数组；每个 FileWidget 一次只写入一个文件值。
- 文件分支必须跳过通用的 `string` 类型、`minLength`、`maxLength`、`pattern` 和字符串 `format` 校验，避免 `File` 被误报为 “must be of type string”。文件大小、数量和 MIME 提示由 FileWidget 本地校验，服务端仍是安全边界。
- `required`、对象/数组的结构约束，以及 `dependencies`、`if/then/else`、`allOf`、`anyOf`、`oneOf` 仍按文件值的“是否存在”语义运行：单文件 `null` 和多文件 `[]` 均视为缺失，已存在的 `ExistingFileValue` 视为已存在文件。
- 不允许在文件 Schema 上配置字符串专用 `enum`、`const`、`pattern`、长度或普通 format。开发环境应给出明确警告；实现不得静默把文件转换成字符串来通过校验。

`format: 'binary'` 仅用于与 OpenAPI/后端 schema 互操作，不能单独触发文件值管线，也不能承担大小和安全校验。没有 `ui.widget: 'file'` 时，即使存在 `format: 'binary'`，运行时仍按普通 string 字段处理并拒绝 `File` 值。

文件 Widget 不限制为 `type: 'object'`，也不因用户选择文件 Widget 就把 Schema 强制改成 `type: 'object'`。`File` 在 JavaScript 中虽然是对象，但 `type: object` 在 JSON Schema 中表示可递归校验的结构化对象；采用该类型会误导 `properties`、`required`、Variant 和后端 OpenAPI 生成逻辑，也无法自然表达多文件字段的 `array` 结构。正确做法是让 `ui.widget: 'file'` 作为语义标记，由校验器覆盖基础 `type` 的字符串检查，并由 Builder 根据单文件/多文件模式保留 `type: 'string'` 或 `type: 'array'` 的互操作外形。

### 7.1.1 SchemaBuilder 配置简化

SchemaBuilder 面向用户只提供一个“文件”字段类型/Widget 选项，不要求用户同时理解或填写 `type`、`format` 和 `ui.widget` 的对应关系。选择文件后，Builder 应自动规范化为以下内部配置：

```ts
{
  type: 'string',
  ui: {
    widget: 'file',
  },
}
```

多文件字段内部规范化为 `type: 'array'`，其 `items` 使用 `type: 'string'`，并在 `items.ui.widget` 设置为 `file`；这两个 `string` 只描述导出 schema 的兼容外形。每个 items FileWidget 只产生一个文件元素，运行时文件语义由当前字段或当前 `items` 的 `isFileSchema(schema)` 触发专用校验。

导出 OpenAPI schema 或后端协议 schema 时，可由序列化器派生 `format: 'binary'`；导入旧 schema 时兼容读取该 format，但运行时仍以 `ui.widget: 'file'` 为准。Builder 应在用户切换文件/普通字段时同步清理冲突的字符串约束，并在手写 schema 出现以下不一致时给出开发期警告：

- `ui.widget: 'file'` 缺少或冲突的 `type`：自动规范化为 `type: 'string'`，不改变文件内存值契约。
- 文件 Widget 配置 `multiple`、`maxFiles` 或 `maxTotalSize`：第一版不支持；Builder 不输出这些键，导入或手写出现时在保存前拒绝或清理。
- `ui.widget: 'file'` 且用户填写 `type: 'object'`：Builder 应提示并规范化为单文件 `type: 'string'` 或多文件 `type: 'array'`，不得把 File 当作结构化 object 校验。
- `format: 'binary'` 但没有 `ui.widget: 'file'`：按普通 string 处理并提示应选择文件 Widget。
- 文件字段配置 `pattern`、长度、字符串 `enum`/`const` 或非 `binary` format：提示这些约束不会应用于 File 值，应改用文件 Widget 配置或自定义文件 validator。

这样用户只需选择文件 Widget 并配置 `accept`、数量和大小限制，运行时校验、transform、Variant、过滤和 multipart 均可共享同一个 `isFileSchema(schema) = schema.ui?.widget === 'file'` 判别规则。

### 7.2 默认值、reset、过滤与数组转换

- `buildEmptyValues` 必须先识别文件 Widget：单文件清空为 `null`，多文件清空为 `[]`，不得因 Schema 写作 `string` 而写入 `''`。
- Schema 默认值不得包含浏览器 `File`；编辑态可提供 `ExistingFileValue` 或其数组作为 `defaultValues`，FileWidget 只展示其元数据，不能尝试回填原生 input。
- `wrapPrimitiveArrays` 与 `unwrapPrimitiveArrays` 必须把多文件 Widget 的数组视为不可包装的值数组，保持 `File[]` 或 `(ExistingFileValue | File | Blob)[]` 的元素和顺序；不得转换为 `{ value: File }[]`。
- `filterValueBySchema`、`filterValueWithNestedSchemas` 和嵌套 Schema 过滤必须把 `File`/`Blob` 作为叶子值原样保留，且使用当前有效 Variant Schema 后再过滤，不能因基础 `string` Schema 或 Variant 切换丢弃文件字段。

### 7.3 Variant 兼容

文件字段可作为 Variant 的一个 Widget 模式，但 Variant 的有效 Schema 必须保留 `ui.widget: 'file'`；`format: 'binary'` 可选且不参与运行时判别。通用 `typeof value` 检测会把 `File` 识别成 `object`，不能据此选择普通 object Variant 或回退到错误的默认模式。

- File Variant 必须通过显式 `detect` 回调、当前活跃 Variant，或文件专用值谓词识别；文件专用谓词应同时识别 `File`、`Blob`、`File[]` 与编辑态 `ExistingFileValue`。
- 切换离开 File Variant 时必须清空或由调用方显式迁移文件值；不得把 `File` 交给目标 Variant 的字符串、对象或数字 transform/validator。
- resolver、`getValues`、`setValue`、`setValues`、`onChange`、`onSubmit` 必须对同一份有效 Variant Schema 应用文件校验、过滤和 transform 跳过规则，避免渲染、校验与提交使用不同契约。

### 7.4 Change Metadata、联动与快照

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

现有联动运行时需要保存表单快照并比较新旧值，因此必须提供保留文件引用的深克隆与比较策略：优先保留 `File`/`Blob` 实例引用，递归克隆容器；禁止以 `JSON.stringify` 作为 fallback。比较文件时先比较引用，再比较 `name`、`size`、`type`、`lastModified` 等脱敏元数据，避免不同文件都被序列化为 `{}` 而误判为未变化。联动条件若直接依赖文件值，应只支持存在性、数组长度或明确的文件元数据；不得读取二进制内容。

### 7.5 程序化写值

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
4. 文件数组项选择校验失败时，不能产生“先写入后撤销”的可观察中间 onChange。
5. 文件读取预览若未来引入异步 `FileReader`，必须使用字段版本令牌；旧读取结果不得更新当前字段。

本阶段不读取文件内容，因此不新增全局文件读取队列。上传请求的取消、重试和进度属于调用方网络层。

## 10. API 草案

### 10.1 文件 Widget

```ts
export interface FileWidgetProps extends FieldWidgetProps {
  accept?: string
  maxSize?: number
  showFileList?: boolean
  clearable?: boolean
  capture?: string
}
```

### 10.2 multipart 工具

```ts
export interface MultipartFormDataOptions {
  jsonFieldName?: string
  fileFieldName?: (path: string) => string
  jsonContentType?: string
  isFileValue?: (value: unknown) => value is File | Blob
}

export function createMultipartFormData(
  values: Record<string, unknown>,
  options?: MultipartFormDataOptions,
): FormData
```

工具应从 `src/components/DynamicForm/utils` 导出，并通过 `src/components/DynamicForm/index.ts` 暴露公共类型和函数。它必须是无副作用的：不修改传入对象、不改变 File 引用、不发起网络请求。

## 11. 测试设计

### 11.1 FileWidget 单元测试

- 单文件选择输出一个 `File`。
- 动态文件数组中每个 `items` FileWidget 输出一个 `File`，数组顺序与用户操作一致。
- 清空单文件输出 `null`，清空文件数组项输出 `null`，移除数组项由 ArrayWidget 完成。
- `accept` 和单文件大小限制拒绝非法选择；数组数量由 `minItems`/`maxItems` 控制。
- 非法选择不触发字段值更新或 change metadata。
- 文件名显示不包含本地完整路径。
- disabled、readonly、hidden 状态阻止选择操作。

### 11.2 值管线兼容测试

- `type: 'string', ui.widget: 'file'`（无 `format`）写入 `File` 后，resolver 不产生字符串类型、`format`、`pattern` 或长度错误；同一 Schema 仅配置 `format: 'binary'` 而未配置 file Widget 时仍保持原有严格字符串校验。
- SchemaBuilder 选择 file Widget 时，单文件输出 `type: 'string'`；多文件输出 `type: 'array'` 并将 FileWidget 放到 `items`，不会输出 `type: 'object'`。
- `multiple`、`maxFiles`、`maxTotalSize` 应被视为未知/不支持配置并在保存时拒绝或清理，避免产生 `File[][]` 或与外层数组重复承担数量约束。
- 单文件 `null`、多文件 `[]` 的 `required` 校验失败；`File`、`Blob` 和 `ExistingFileValue`（编辑态）按约定通过存在性校验。
- 文件 Schema 配置字符串专用约束时产生开发期配置告警，不把 `File` 强制转换为字符串。
- `getValues`、`onChange`、`onSubmit` 不调用文件字段的 transform；`setValue`、`setValues`、reset 不调用 reverse transform，真实 File 引用保持不变。
- reset 后单文件为 `null`、多文件为 `[]`；`defaultValues` 中的 `ExistingFileValue` 可展示，不能写入原生 file input。
- 多文件数组不会被包装为 `{ value: File }[]`，解包、过滤、嵌套 Schema 和 `asNestedForm` 后仍保留原始文件/已有文件元素及其顺序。
- File Variant 被正确选中且沿用文件校验规则；切换到非文件 Variant 后不会执行不匹配的 transform 或 validator。
- 联动快照的克隆与比较不使用 JSON 序列化；连续选择不同文件能被识别为变更，异步联动不能覆盖最新选择。

### 11.3 multipart 工具测试

- 只含 JSON 字段时生成正确 `payload` JSON part。
- 单文件字段被提取为一个 file part。
- 文件数组按当前索引生成独立 part，数组顺序与 payload 中的引用顺序一致。
- JSON 中保留文件所在结构，并包含 `$file`、`fileName` 引用；引用值与真实 part 名称完全一致。
- 文件数组每个 `$file` 都有唯一的 `FormData` key，且 payload 引用与数组索引一一对应。
- 嵌套对象和数组索引路径正确提取。
- 动态数组增删移动后按提交快照生成 `files.<path>`，旧索引不会残留。
- `ExistingFileValue` 保持原样进入 `payload`，不会被识别为二进制 part。
- 自定义 `jsonFieldName` 和 `fileFieldName` 生效。
- 输入对象保持不变，File 对象引用保持不变。
- `Blob`、空值、未知路径和非文件值按约定处理。

### 11.4 DynamicForm 集成测试

- 文件字段通过 `onChange` 返回 File，并生成 `source: 'user'` metadata。
- `setValue`/`setValues` 写入 File 后不伪造原生 input 路径，`getValues` 返回 File。
- 嵌套文件字段经过 `asNestedForm` 使用绝对路径。
- 动态数组增删移动后 multipart 提取使用新索引。
- 文件字段与普通字段同时变化时，onChange 仍只生成一个完整批次。
- 异步联动旧结果不能覆盖最新文件选择。
- `onSubmit` 默认仍接收普通对象，调用方显式调用 multipart 工具后可发送 FormData。

### 11.5 浏览器与网络验证

使用 Testing Library 验证 input 行为，使用真实 `File`/`Blob` 构造对象；使用 `FormData.entries()` 检查 part 名称、顺序和内容。请求集成测试必须断言调用方没有手动设置 `Content-Type`，由浏览器/HTTP 客户端生成 boundary。

## 12. 分阶段实施计划

### Phase 1：类型和默认 Widget

1. 增加 `FileWidget`、类型导出和 Blueprint 默认注册。
2. 增加文件 Schema 识别谓词，并适配 `SchemaValidator`、resolver、required、默认值/reset、数组包装和 schema 过滤。
3. 明确单文件/多文件/ExistingFileValue 的值与空值契约。
4. 补充 Widget、值管线和基础 DynamicForm 集成测试。

### Phase 2：结构化 multipart 工具

1. 实现结构化递归提取和克隆，不修改输入对象。
2. 支持嵌套路径、数组索引、文件数组独立 parts 和命名策略。
3. 补充工具单元测试，并在 README 增加调用方示例。

### Phase 3：现有机制闭环

1. 适配 Variant 的文件识别与有效 Schema，并验证 transform、Schema 过滤和动态数组行为。
2. 使用保留 File/Blob 引用的克隆和比较替换 JSON 快照 fallback，验证 change metadata、根批次共享和异步联动竞态。
3. 增加浏览器请求集成测试和文档中的风险矩阵。

每个阶段都必须先补测试，再修改实现；任何改变 `onSubmit` 参数契约的方案都需要单独的兼容性评审，不在本设计默认范围内。

## 13. 风险与决策记录

| 风险                                               | 处理决定                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| 手动设置 multipart Content-Type 导致 boundary 错误 | 文档和示例明确禁止手动设置，由浏览器/客户端生成                            |
| File 被 JSON.stringify 丢失                        | 递归替换为 `$file`/`fileName` 引用，并追加对应 part                        |
| 误把任意 Blob 当上传文件                           | 默认识别标准文件值，允许通过 `isFileValue` 定制边界                        |
| `string` Schema 拒绝 File                          | `ui.widget: file` 进入文件校验分支，`format: binary` 仅作可选互操作标记    |
| transform 将 File 当作普通值处理                   | 文件有效 Schema 统一跳过正反 transform；元数据改由独立字段或提交适配器生成 |
| reset/数组包装改变文件值形态                       | 文件字段分别使用 `null`/`[]`，多文件数组保持原始元素，不包装为 `{ value }` |
| Variant 将 File 误判为 object                      | 文件 Variant 使用显式检测或文件谓词，并在整条值管线共享有效 Schema         |
| JSON 快照丢失或混淆 File                           | 联动和 change metadata 使用保留文件引用的克隆与比较，不使用 JSON fallback  |
| 浏览器无法回显程序设置的本地路径                   | 接受平台限制，展示文件元数据，不写 input.value                             |
| 数组索引缓存导致上传错误文件                       | 序列化时基于提交快照重新解析绝对路径                                       |
| 文件内容进入日志或 metadata                        | metadata 只保留引用；日志只允许脱敏元数据                                  |
| DynamicForm 被网络层耦合                           | 保留对象型 onSubmit，multipart 作为纯适配工具                              |

## 14. 结论

评审结论：递归发现文件并在 JSON 中保留引用的建议成立；移除必填 `filePaths` 可以避免调用方维护动态路径清单；单文件 `null`、多文件 `[]` 的唯一空值契约以及 `ExistingFileValue` 编辑态模型也纳入本设计。评审中出现的 `fiels` 拼写不采用，统一使用 `files`。API 继续命名为 `createMultipartFormData`，不为同义命名变化引入不必要的兼容成本。

本次补充决策：`format: 'binary'` 不再是用户配置文件字段的必要条件，也不是运行时文件值管线的触发条件；`ui.widget: 'file'` 是唯一的文件 Schema 判别依据。SchemaBuilder 只需让用户选择文件 Widget，并自动生成兼容的单文件 `type: 'string'` 或多文件 `type: 'array'` + `items.ui.widget: 'file'` 外形；第一版不提供 `multiple`、`maxFiles`、`maxTotalSize`。导出 OpenAPI 或后端协议时再派生 `format: 'binary'`。实现前还必须完成 Schema 校验、transform、Variant、reset、数组转换、过滤、联动快照与 change metadata 的文件值兼容；仅增加 Widget 和 multipart 工具不构成可用方案。

文件选择是 DynamicForm 的一种值 Widget，multipart 是调用方选择的传输编码。两者通过真实 `File` 值和无副作用的结构化序列化器连接：表单继续遵循现有 Schema、RHF、联动、批次和 metadata 设计，调用方则可以在提交时把文件作为 `files.<path>` parts，把包含引用对象的完整结构作为 `payload` JSON part 发送给后端。该边界满足向后兼容，也为后续上传进度、分片和服务端校验保留了扩展空间。
