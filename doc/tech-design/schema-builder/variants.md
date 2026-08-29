# SchemaBuilder 多类型字段（Variants）设计

> **状态：部分实现。** 当前 SchemaBuilder 已提供 `Variants` 最后 Tab、Card 列表、独立编辑态、`Select` Widget 选择、Schema 预览和嵌套 SchemaBuilder 弹窗；DynamicForm 运行时尚未消费 `ui.variants`。稳定名称对象结构、完整类型约束编辑和运行时接入仍属于后续工作。

## 1. 目标与问题

同一字段可能需要用不同的数据表达方式编辑，例如 `data` 既可以是对象，也可以是变量字符串 `${data}`。标准 JSON Schema 的 `oneOf`、`anyOf` 或 `type` 数组只能描述数据约束，不能完整表达 Widget、默认模式、自动识别和各模式独立的校验与 transform。

Variants 将一个字段拆成多个互斥编辑模式。用户可以在 SchemaBuilder 中配置这些模式，运行时由 DynamicForm 选择一个 active variant。

## 2. 数据模型

第一版保留 `variant.type`，因为 SchemaBuilder 根节点固定按 object 编辑，primitive variant 不能直接依赖嵌套 SchemaBuilder 推导根类型。

```ts
interface FieldVariant {
  name: string
  label?: string
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'
  widget?: string
  schema?: ExtendedJSONSchema
  detect?: {
    type?: 'template' | 'predicate'
    pattern?: string
    callback?: string
  }
  transform?: UIConfig['transform']
}
```

`variant.type` 是根类型和渲染类型的唯一 UI 来源；`variant.schema` 保存该类型的约束。运行时构造 effective schema 时强制写入：

```ts
const effectiveSchema = { ...variant.schema, type: variant.type }
```

`variant.schema.type` 不作为独立可编辑来源，避免与 `variant.type` 产生冲突。后续若要去除重复字段，必须先让 SchemaBuilder 支持固定类型的根编辑器，再进行数据迁移。

## 3. Variant 名称与稳定标识

Variant 名称是同一字段内的稳定标识，不能使用数组下标作为业务身份。数组下标只允许表示当前显示顺序；新增、删除和排序不能改变其他模式的身份。

当前实现仍使用数组结构：

```ts
ui: {
  variants: [
    { name: 'object', label: 'Object', type: 'object', schema: { type: 'object', properties: {} } },
    { name: 'variable', label: 'Variable', type: 'string', schema: { type: 'string', pattern: '^\\$\\{[^}]+\\}$' } },
  ],
  defaultVariant: 'object',
}
```

未来推荐迁移为稳定名称对象结构：

```ts
ui: {
  variants: {
    order: ['object', 'variable'],
    items: {
      object: { label: 'Object', type: 'object', schema: { properties: {} } },
      variable: { label: 'Variable', type: 'string', schema: { pattern: '^\\$\\{[^}]+\\}$' } },
    },
  },
  defaultVariant: 'object',
}
```

目标对象结构中的 `items` key 才是唯一 `name`，不再重复保存 `name` 字段。当前数组实现尚未完成该迁移；现阶段新增、重命名和删除仍需通过保存时校验保证名称唯一，并维护 `defaultVariant` 不悬空。

## 4. Widget 层级边界

Variant Widget 与子字段 Widget 不重复：

```text
data
└── variant.widget: nested-form
    ├── variant.schema.properties.source.ui.widget: text
    └── variant.schema.properties.enabled.ui.widget: checkbox
```

- `variant.widget` 只负责当前 variant 根字段的整体编辑器；
- `variant.schema.properties.*.ui.widget` 只负责对象或数组内部子字段；
- primitive variant 不应在 Schema 中配置 `properties`；
- object variant 可编辑子字段；array variant 可编辑 `items`；
- Variant 根 Schema 不应再次配置 `ui.variants`；
- Variant 根 Widget 不应同时从 `variant.widget` 和 `variant.schema.ui.widget` 读取，根 Widget 以 `variant.widget` 为唯一覆盖来源。

## 5. SchemaBuilder 交互设计

### 5.1 Variants Tab

Variants 作为最后一个 Tab，避免影响普通字段的常用编辑流程。该 Tab 分为默认模式配置和模式列表两部分：

- `Default Variant` 使用项目 `Select`；
- 列表以 Card 展示每个模式的 label、name、type 和 Widget 摘要；
- 列表态提供新增、删除和选择编辑；
- 默认 Widget 显示为 `Default (当前类型默认 Widget)`；与默认值相同的具体 Widget 不重复列出；
- Widget 选项使用项目 `src/components/Select`，不能让用户直接输入内部 Widget 名称。

### 5.2 预览态与编辑态

交互应参考 `LinkagesEditor` 与 `LinkageEditor`：

- 预览态只显示摘要，不直接修改外层 Schema；
- 点击编辑或新增后进入单个 Variant 编辑态；
- 编辑态修改临时副本；
- 底部提供 `Cancel` 和 `Save`；
- `Cancel` 丢弃当前副本，`Save` 才写回对应模式；
- 同一字段内 Variant 名称必须唯一，保存时阻止重复名称。

### 5.3 Variant Schema 编辑

点击 `Edit Schema` 打开宽尺寸 Dialog，在 Dialog 内使用嵌套 SchemaBuilder。嵌套实例通过 `options` 限制能力：

```tsx
<SchemaBuilder
  defaultValue={variant.schema}
  previewMode="none"
  options={{
    hidden: {
      preview: true,
      importExport: true,
      variantsTab: true,
      rootValidation: true,
    },
  }}
  onChange={setDraftSchema}
/>
```

嵌套 SchemaBuilder 的 `Cancel/Apply` 与外层 Variant 编辑态分离：弹窗 Apply 只更新 Variant 临时副本，外层 Save 才更新字段 Schema。这样可以避免取消外层编辑时已经污染主 Schema。

当前实现通过 `options.rootType` 固定嵌套 SchemaBuilder 根节点类型，并将根节点按字段编辑，因此 primitive variant 也能显示 UI Config；根类型选择被禁用。后续仍应为 primitive variant 提供更聚焦的约束编辑器，减少不必要的结构编辑入口。

## 6. options 能力边界

SchemaBuilder 的扩展统一放在 `options`：

```ts
interface SchemaBuilderOptions {
  rootType?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'
  hidden?: {
    tree?: boolean
    preview?: boolean
    importExport?: boolean
    propertyEditor?: boolean
    rootValidation?: boolean
    variantsTab?: boolean
  }
  readonly?: {
    all?: boolean
    schema?: boolean
    propertyEditor?: boolean
    tree?: boolean
    addFieldActions?: boolean
    deleteFieldActions?: boolean
    reorderFieldActions?: boolean
    editFieldKey?: boolean
    editFieldType?: boolean
  }
}
```

规则：

- 未配置时全部显示且可编辑；
- `hidden` 控制是否渲染；
- `readonly` 保留查看能力并隐藏对应编辑入口；
- `readonly.all` 或 `readonly.schema` 作为整体只读开关；
- `readonly.tree` 隐藏树上的编辑动作，但保留选择和查看；
- `readonly.addFieldActions`、`deleteFieldActions`、`reorderFieldActions` 分别控制新增、删除、移动；
- `readonly.editFieldKey` 控制字段重命名；
- `readonly.editFieldType` 控制字段类型选择；
- `hidden` 优先于 `readonly`；
- 配置只影响 SchemaBuilder UI，不阻止外部程序化 `setSchema`。

## 7. 运行时生效方式

当前配置编辑能力已部分实现，但 DynamicForm 运行时接入仍属于后续工作。目标数据流为：

```text
外部值
  ↓ detect/type/defaultVariant
active variant
  ↓ variant.widget + variant.schema
当前 Widget 与校验
  ↓ variant.transform
提交值
```

模式之间默认相互独立，不自动转换对象和变量字符串。每个模式分别保存自己的编辑内容；提交时只输出 active variant，其他模式内容不得参与校验、联动或提交。

## 8. 测试要求

- 新增、删除、排序和重命名保持名称唯一；
- 默认模式删除后正确选择或清空默认值；
- 预览态不直接修改 Schema；
- Cancel 不写回，Save 才写回；
- Widget 默认项和显式覆盖项不重复；
- 弹窗 Apply/Cancel 与外层 Save 状态隔离；
- 嵌套 SchemaBuilder 隐藏 Variants、预览、导入导出和根级校验；
- 各 readonly 配置分别隐藏对应入口；
- object/array 子字段 Widget 与 Variant 根 Widget 互不覆盖。

## 9. 实施顺序

1. 统一 `ui.variants` 稳定标识结构和迁移兼容层；
2. 完善 SchemaBuilder 的 Variants 列表、编辑态和校验；
3. 为 primitive/object/array 实现受限的 Variant Schema 编辑器；
4. 在 DynamicForm 中接入 active variant、Widget、校验和 transform；
5. 补充嵌套、数组、联动和错误树集成测试；
6. 更新 README 和 SchemaBuilder 使用指南。

## 10. 结论

Variants 应作为 SchemaBuilder 中独立的模式编排能力，而不是简单把 `type` 数组传给现有 Widget。保留 `variant.type` 解决根类型编辑边界，使用稳定名称解决顺序变化问题，使用 `variant.widget` 与子字段 `ui.widget` 的层级划分解决配置重复问题，并通过 `options.hidden` / `options.readonly` 控制嵌套编辑器能力范围。
