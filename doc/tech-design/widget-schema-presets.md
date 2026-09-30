# Widget Schema 与参数表单设计

> **状态：已实现并持续演进。** 本文同时约定结构化 Widget 与内置选择类 Widget 的 SchemaBuilder 配置方式。

## 1. 背景与问题

部分 Widget 返回固定结构的对象，而不是单一标量值。例如 `upload-input` 返回：

```ts
{
  fileId: 'xxx',
  fileName: 'xxx',
}
```

当前 SchemaBuilder 中，用户必须先把字段类型改为 `object`，再手动创建 `fileId` 和 `fileName` 子字段。这要求用户理解 Widget 的内部数据契约，操作成本高，也容易产生不完整或不一致的 Schema。

目标是：用户选择结构化 Widget 后，SchemaBuilder 自动识别其输出结构，并在 Schema Tree 中生成对应的子字段，同时保护用户已经配置的内容。

## 2. 设计目标与非目标

### 2.1 目标

- Widget 能声明自己的输出值 Schema 和 Props Schema。
- Widget Props 使用 DynamicForm 根据 `propsSchema` 渲染参数表单。
- SchemaBuilder 选择 Widget 时自动创建或补全对象/数组结构。
- 已有用户配置优先于 Widget 模板配置。
- 类型冲突或复杂已有内容不会被静默覆盖。
- 自动生成的契约字段可继续修改展示和业务配置，但不能删除、重命名或修改基础类型。
- DynamicForm、SchemaBuilder 和 Widget 注册体系共享同一份契约。

### 2.2 非目标

- 不通过运行时第一次返回值推断 Schema。
- 不把每个 Widget 的特殊逻辑硬编码到 SchemaBuilder。
- 不强制所有 Widget 都提供完整 Schema。
- 不在本阶段自动转换不同 Variant 之间的数据。

## 3. 总体架构

```text
Widget Definition
      |
      | valueSchema / valueType / propsSchema
      v
Widget Registry ----> Widget Selector
      |                     |
      |                     v
      +---------------> SchemaBuilder
                              |
                              v
                    Schema merge + confirmation
                              |
                              v
                       Schema Tree / Preview
```

Widget 注册项扩展为包含输出值 Schema 和 Props Schema 的定义。SchemaBuilder 读取该定义，保留字段本身的通用配置并按 `valueSchema` 重建 Widget 子树；DynamicForm 继续使用同一注册项渲染 Widget。`valueSchema` 与 `propsSchema` 是两套职责不同的 Schema，不能混用。

## 4. Widget 元数据模型

建议将 Widget 注册项抽象为：

```ts
interface WidgetDefinition {
  name: string
  component: React.ComponentType<FieldWidgetProps>
  /** Widget 提交值的 Schema */
  valueSchema?: ExtendedJSONSchema
  valueType?: SchemaNodeType | 'null'
  /** Widget 静态 Props 的 Schema，默认值定义在其中的 properties.*.default */
  propsSchema?: ExtendedJSONSchema
  supports?: {
    schemaTypes?: Array<SchemaNodeType | 'null'>
  }
}
```

`valueSchema` 是 Widget 输出值的完整契约，优先级高于单独的 `valueType`。`valueType` 适用于只需要声明标量类型的 Widget。二者都不存在时，Widget 保持当前行为，不自动生成字段。

`propsSchema` 描述 Widget 的静态、可序列化参数，包括类型、校验、说明和默认值。默认 Props 的唯一来源是 `propsSchema.properties.*.default`，不再额外提供 `defaultProps`，避免出现两套默认值冲突。已保存的 `ui.widgetProps` 优先于 `propsSchema` 中的默认值；缺失的 Props 使用 Schema 默认值补齐。函数 Props 不进入 `propsSchema`，继续通过 `callbackProps` 单独配置。内置 `select`、`radio`、`checkbox-group` 与 custom widget 一样可以声明 `propsSchema`，其中选择类 Widget 的 `options`、`multiple` 等参数通过 Props 表单配置。

切换 Widget 时，`ui.widgetProps` 只保存当前 Widget 的配置，避免把上一个 Widget 的参数继续传给新的 Widget。SchemaBuilder 在 `ui.__schemaBuilder.widgetPropsByWidget` 中按 Widget 名称缓存已经编辑过的配置：切换到已有缓存时恢复缓存，首次切换到该 Widget 时使用其 `propsSchema` 默认值；没有 `propsSchema` 的 Widget 不产生运行时 Props。该缓存是编辑器内部元数据，不应被 DynamicForm 展开传递给 Widget，提交到后端前可按项目边界清理。

内置 Widget 与 custom Widget 使用相同的 `propsSchema` 机制，但只为具有稳定业务配置的控件声明参数。例如 `textarea` 暴露 `rows`、`maxLength`，`text` 暴露 `maxLength`、`autoComplete`；字段通用的 `placeholder`、`disabled` 等仍由字段 UI 配置管理，不重复放入 Widget Props。

### 4.1 upload-input 示例

```ts
const uploadInputDefinition: WidgetDefinition = {
  name: 'upload-input',
  component: UploadInput,
  valueSchema: {
    type: 'object',
    title: 'Uploaded File',
    properties: {
      fileId: { type: 'string', title: 'File ID' },
      fileName: { type: 'string', title: 'File Name' },
    },
    required: ['fileId', 'fileName'],
  },
}
```

Widget Schema 同时定义值结构和子字段配置；选择 Widget 后，子字段配置由 `valueSchema` 统一提供，不允许再通过 PropertyEditor 覆盖。需要用户调整的 Widget 行为必须放入 `propsSchema`。

### 4.2 Props Schema 示例

```ts
const uploadInputDefinition: WidgetDefinition = {
  name: 'upload-input',
  component: UploadInput,
  valueSchema: {
    type: 'object',
    properties: {
      fileId: { type: 'string', title: 'File ID' },
      fileName: { type: 'string', title: 'File Name' },
    },
    required: ['fileId', 'fileName'],
  },
  propsSchema: {
    type: 'object',
    properties: {
      accept: {
        type: 'array',
        items: { type: 'string' },
        default: [],
      },
      maxSize: { type: 'number', default: 10 * 1024 * 1024 },
      multiple: { type: 'boolean', default: false },
    },
  },
}
```

SchemaBuilder 中的 Widget Props 编辑器使用 `propsSchema` 作为 DynamicForm 的 Schema，隐藏独立 Submit 按钮并在每次 Change 时写入 `ui.widgetProps`；它不能修改字段的 `valueSchema`。DynamicForm 渲染 Widget 时，Props 合并规则为：

```text
propsSchema 中的 default < 已保存的 ui.widgetProps
```

### 4.3 enum 与选择类 Widget options

`enum/enumNames` 是 Schema 的校验表示，`ui.widgetProps.options` 是 Widget 的展示表示。编辑器打开选择类 Widget 的 Props 时，将两者按值和 JSON 类型去重合并：保留 `enum` 顺序，追加仅存在于 `widgetProps.options` 的值；重复值的 label、disabled 等展示属性以 `widgetProps.options` 为准。仅打开或切换标签不会写回 Schema。

用户实际修改 options 后，从最终列表同时重建：

- `enum`：选项值列表；
- `enumNames`：选项标签列表；
- `ui.widgetProps.options`：包含 `value`、`label` 和 `disabled` 的展示配置。

这样既兼容历史上只有 `enum` 的隐式 Widget（`string + enum` 的默认 Widget 仍为 `select`），又保证控件可选值与 Schema 校验保持一致。选项值保留原始 JSON 标量类型；数字、布尔值不能静默转换为字符串。数组 `items.enum` 属于数组元素约束，不能写入父数组字段的 Widget Props。

## 5. Widget 选择与 Schema 更新流程

### 5.1 空字段

当用户选择 Widget 时，字段没有有意义的自定义结构：

1. 读取 Widget 的 `valueSchema`。
2. 将字段类型切换为 `valueSchema.type`。
3. 保留当前字段本身的通用配置，例如父级字段标题、描述和布局。
4. 使用 `valueSchema` 重建完整的子字段和 required 配置，不保留历史额外子字段。
5. 在 Schema Tree 中展开生成的结构。
6. 保持父字段选中，避免用户选择 Widget 后失去操作上下文。

### 5.2 已有兼容结构

如果字段已经是对象或数组，并且类型与 Widget 输出兼容，仍按 Widget 的完整 `valueSchema` 重建子树，而不是保留旧的子字段配置：

- 当前字段本身的通用配置保留。
- 同名子字段的结构和配置以 `valueSchema` 为准。
- `valueSchema` 未声明的历史额外字段移除。
- `required`、`items` 和嵌套结构以 `valueSchema` 为准。

字段本身的通用配置与 Widget 子字段配置分开处理：

```text
当前字段通用配置 > Widget valueSchema（字段本身）
Widget valueSchema（子字段结构与配置）为唯一来源
```

### 5.3 类型冲突或复杂内容

如果 Widget 输出类型与当前字段冲突，或当前字段已有明显业务结构，必须显示确认对话框。对话框应说明：

- Widget 返回的数据类型。
- 将新增哪些字段。
- 已有字段会被保留还是可能受影响。

选择 Widget 时可以自动把字段类型同步为 Widget 声明的类型；但如果已有复杂结构，仍需先确认合并影响。

如果用户手动修改字段类型，导致其与当前 Widget 的 `valueSchema.type` 或 `valueType` 冲突，则冲突可以暂时存在于编辑草稿中，但不得保存、应用或导出。保存前必须弹出阻断式确认对话框，且用户必须二选一：

- **Use object**：将字段类型改回 Widget 声明的类型，保留 Widget，并按合并规则补全其 Schema。
- **Remove widget**：保留用户当前字段类型，移除 `ui.widget`；同时清除与该 Widget 绑定的静态 `ui.widgetProps`。

不提供 **Keep conflict** 选项。用户关闭弹窗或取消选择时，Schema 不得提交，编辑器继续显示冲突状态。

## 6. 合并算法与来源标记

建议提供独立的纯函数：

```ts
mergeWidgetValueSchema({
  currentSchema,
  widgetSchema,
}): {
  schema: ExtendedJSONSchema
  addedPaths: string[]
  changedType: boolean
  compatibility: {
    compatible: boolean
    expectedType?: SchemaNodeType | 'null'
    actualType?: SchemaNodeType | 'null'
  }
}
```

合并函数不得直接修改输入对象，应返回深拷贝后的新 Schema。`valueSchema` 是 Widget 的完整输出结构：选择 Widget 时以它重建结构字段（`type`、`properties`、`required`、`items`）及所有子字段配置，移除历史遗留或额外字段；同名契约节点也不得保留标题、描述、布局、校验或 UI 配置。手写或导入场景如果缺失契约字段、字段类型冲突、包含额外字段或子字段配置不一致，必须由配置期校验报告错误。兼容性结果只描述数据，不直接决定 UI 行为；保存流程负责根据 `compatible: false` 打开二选一对话框。

所有声明 `valueSchema` 的 Widget 都将其输出视为完整契约。对于 object Widget，其子字段不能新增、删除、重命名、修改或排序；对于 array Widget，`items` 及其递归子字段同样不能执行这些操作。Widget 根字段本身仍可在其父级中移动或删除。完整契约区域在 PropertyEditor 中以只读 Schema 展示，Schema Tree 不应提供空白操作菜单；否则会出现 Schema 允许额外字段或不一致配置但 Widget 运行时不会遵循它们的无效配置。

为支持该行为，建议在 `ui` 下保留 SchemaBuilder 内部来源信息：

```ts
ui: {
  widget: 'upload-input',
  __schemaBuilder: {
    generatedBy: 'upload-input',
    generatedFields: ['fileId', 'fileName'],
  },
}
```

该元数据仅用于编辑器管理，提交给后端前应按项目边界决定是否清理。它不能参与 DynamicForm 的业务校验或提交值计算。

## 7. 用户界面设计

### 7.1 Widget 选择器

选择器应展示输出摘要，而不只显示 Widget 名称：

```text
Upload Input
Returns: object { fileId, fileName }
Changes field type: string -> object
```

custom widget 不应因为当前字段类型不匹配而从列表中隐藏。选择器应展示所有已注册的 custom widget，并通过摘要和提示标明其输出类型及可能的类型变化。`supports.schemaTypes` 用于兼容性判断、推荐排序和提示，不作为隐藏 custom widget 的唯一条件。内置 Widget 可以继续按字段类型筛选。

### 7.2 Schema Tree

`valueSchema` 覆盖的完整子树属于 Widget 输出契约。选择 `upload-input` 后，字段结构恰好是 `fileId` 和 `fileName`，不能新增其他子字段；这两个字段及其所有配置都以 `valueSchema` 为准，不能删除、重命名、改类型、改标题、改描述、改默认值、改校验规则、改联动或改 UI 配置。Widget 专属可配置项应通过 `propsSchema` 提供。Schema Tree 可以通过图标、标签或 Tooltip 标明来源，例如 `Required by upload-input`。

### 7.3 Property Editor

选择结构化 Widget 后，可显示提示：

> This widget provides a structured value. Its output fields and child field configuration are fixed by the widget schema.

提示用于解释结构限制；Widget 参数应通过 Props Schema 配置。

## 8. 无元数据 Widget 的降级策略

- 没有 `valueSchema` 或 `valueType`：保持当前行为，用户手动配置子字段；如果存在 `propsSchema`，仍可使用 DynamicForm 配置 Props。
- 只有 `valueType`：仅执行类型兼容检查，不生成子字段。
- 返回动态或不稳定结构：必须由 Widget 作者提供稳定 Schema，不能依赖运行时推断。
- 类型不匹配：允许暂存在编辑草稿中，但保存、应用和导出前必须通过“Use object”或“Remove widget”解决，不允许持久化冲突配置。
- 导入或手写 Schema 缺少 `valueSchema` 契约字段、包含额外字段，或将契约字段改为不兼容类型时，配置期校验必须返回明确错误；UI 限制不能替代校验。

## 9. Variants 支持

每个 Variant 独立执行 Widget Schema 合并。`variant.widget` 与 `variant.schema` 必须保持一致：

- 只更新当前 Variant，不污染其他 Variant。
- 每个 Variant 保留自己的字段本身配置；选择带 `valueSchema` 的 Widget 后，其子树仍完全由该 Widget 契约重建。
- 切换 Variant 不自动转换对象和标量值。
- `variant.type` 是 Variant 根类型的持久化来源；选择带类型声明的 Widget 时可以同步更新它。
- 如果用户手动修改 `variant.type` 导致与 Widget 冲突，保存前必须使用“Use object”或“Remove widget”解决，不允许保留冲突。

## 10. 错误处理与兼容性

- Widget 元数据 Schema 无效时，记录开发者可见错误并忽略自动生成，不能阻塞普通 Widget 使用。
- 模板字段名重复或 required 引用不存在字段时，注册阶段应校验并拒绝该元数据。
- `propsSchema` 必须是根类型为 `object` 的有效 Schema；其默认值通过 Schema 字段的 `default` 声明，不能再配置独立的 `defaultProps`。
- 旧注册项没有元数据时保持完全兼容。
- 导入已有 Schema 后，只有用户主动选择 Widget 才触发自动合并。
- `readonly` 模式禁止自动修改 Schema；选择 Widget 的控件应禁用或仅允许查看摘要。

## 11. 测试计划

### 单元测试

- 标量 Widget 不生成子字段。
- `upload-input` 将空字段转换为对象并生成两个子字段。
- object Widget 合并后仅保留 `valueSchema` 声明的字段，并移除历史遗留字段。
- 同名契约字段的结构与所有配置均以模板为准。
- 类型冲突正确返回 `compatible: false` 及期望类型、实际类型。
- `propsSchema` 默认值能通过 DynamicForm 初始化，并由已保存的 `ui.widgetProps` 覆盖。
- Widget 契约字段不能通过 Tree 删除、字段重命名或类型选择破坏。
- Widget 契约校验能报告缺失字段、额外字段和字段基础类型冲突。
- object Widget 的子字段，以及 array Widget 的 `items` 及其子字段，在 PropertyEditor 中均以只读 Schema 展示。两类契约区域在 Schema Tree 中均不显示新增、删除或排序操作入口。
- 输入对象不被原地修改。

### 集成测试

- 选择 Widget 后 Schema Tree 自动展开并展示生成字段。
- 取消或关闭类型冲突弹窗不会提交 Schema；必须选择“Use object”或“Remove widget”。
- “Use object”保留 Widget 并修正字段类型；“Remove widget”保留字段类型并清除 Widget 及其静态 Props。
- 确认后 `onChange` 收到完整 Schema。
- Preview 使用生成后的 Schema 正确渲染和提交。
- Variants 只更新当前模式。
- readonly 和 hidden 配置下不产生意外修改。

## 12. 实施计划

1. 梳理现有 Widget 注册入口，统一 `WidgetDefinition` 类型。
2. 为结构化 Widget 增加 `valueSchema` 和 `propsSchema`，先实现 `upload-input`。
3. 实现 Props Schema 到 DynamicForm 参数表单的映射及默认值提取。
4. 实现纯函数形式的兼容检查和 Schema 合并器。
5. 在 SchemaBuilder 的 Widget 选择和保存流程中接入类型同步、合并器和阻断式确认对话框。
6. 增加 Tree 来源提示、完整 custom widget 列表、选择器输出摘要和 Property Editor 提示。
7. 补充 DynamicForm、SchemaBuilder、Variants 的单元测试和集成测试。
8. 评估内部来源元数据的持久化与清理策略。

## 13. 设计结论

采用 Widget 元数据声明输出值 Schema 和 Props Schema、按 `valueSchema` 重建完整子树、类型同步以及保存前阻断式冲突处理的方案。`propsSchema` 是 Widget 静态参数表单和默认值的唯一声明来源；custom widget 始终完整展示，类型不匹配时必须通过“Use object”或“Remove widget”解决，不能持久化冲突配置。该方案将 Widget 的值结构和配置参数从隐含约定提升为可复用契约，解决 `upload-input` 的配置负担，同时为地址选择器、用户选择器、金额输入和日期范围等结构化 Widget 提供统一扩展机制。
