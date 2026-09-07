# Widget 输出 Schema 自动生成设计

> **状态：提案/未实现。** 本文设计用于解决结构化 Widget（例如 `upload-input`）与 SchemaBuilder 之间的值结构配置问题。当前代码尚未实现 Widget 元数据驱动的 Schema 自动生成。

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

- Widget 能声明自己的输出类型和默认值 Schema。
- SchemaBuilder 选择 Widget 时自动创建或补全对象/数组结构。
- 已有用户配置优先于 Widget 模板配置。
- 类型冲突或复杂已有内容不会被静默覆盖。
- 自动生成的字段可继续被用户编辑、删除和重命名。
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
      | valueSchema / valueType
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

Widget 注册项扩展为包含输出 Schema 的定义。SchemaBuilder 读取该定义，执行类型兼容检查和非破坏性合并；DynamicForm 继续使用同一注册项渲染 Widget。

## 4. Widget 元数据模型

建议将 Widget 注册项抽象为：

```ts
interface WidgetDefinition {
  name: string
  component: React.ComponentType<FieldWidgetProps>
  valueSchema?: ExtendedJSONSchema
  valueType?: SchemaNodeType | 'null'
  defaultProps?: Record<string, unknown>
  supports?: {
    schemaTypes?: Array<SchemaNodeType | 'null'>
  }
}
```

`valueSchema` 是完整契约，优先级高于单独的 `valueType`。`valueType` 适用于只需要声明标量类型的 Widget。二者都不存在时，Widget 保持当前行为，不自动生成字段。

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

Widget Schema 只描述值结构和合理的默认字段配置，不应覆盖业务字段的标题、校验、联动或布局配置。

## 5. Widget 选择与 Schema 更新流程

### 5.1 空字段

当用户选择 Widget 时，字段没有有意义的自定义结构：

1. 读取 Widget 的 `valueSchema`。
2. 将字段类型切换为 `valueSchema.type`。
3. 保留当前字段的通用配置，例如字段标题、描述、布局和非 Widget 专属 UI 配置。
4. 合并 `valueSchema` 中的子字段和 required 配置。
5. 在 Schema Tree 中展开生成的结构。
6. 保持父字段选中，避免用户选择 Widget 后失去操作上下文。

### 5.2 已有兼容结构

如果字段已经是对象或数组，并且类型与 Widget 输出兼容，则执行补全而不是重建：

- 已存在的同名子字段完全保留。
- 模板中缺失的子字段自动新增。
- 用户自定义的额外字段保留。
- 当前 `required` 状态优先于模板中的 required。

合并优先级为：

```text
用户已有配置 > Widget valueSchema > 系统默认配置
```

### 5.3 类型冲突或复杂内容

如果 Widget 输出类型与当前字段冲突，或当前字段已有明显业务结构，必须显示确认对话框。对话框应说明：

- Widget 返回的数据类型。
- 将新增哪些字段。
- 已有字段会被保留还是可能受影响。

推荐操作：**Apply widget schema**、**Keep current schema**、**Cancel**。未经确认不得静默改变类型或删除现有结构。

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
  requiresConfirmation: boolean
}
```

合并函数不得直接修改输入对象，应返回深拷贝后的新 Schema。对于对象属性，按字段名合并；对于数组，合并 `items` Schema。模板字段被用户删除后，不应在普通属性编辑时自动恢复。

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

类型过滤优先使用 `supports.schemaTypes`。如果选择某 Widget 会改变字段类型，应明确标记。

### 7.2 Schema Tree

自动生成的字段应与普通字段一样可编辑，但可以通过图标、标签或 Tooltip 标明来源，例如 `Added by upload-input`。用户删除生成字段后不应自动恢复，除非再次确认应用 Widget Schema。

### 7.3 Property Editor

选择结构化 Widget 后，可显示提示：

> This widget provides a structured value. Child fields were initialized from the widget schema and can be customized.

提示用于解释行为，不应阻止用户修改子字段。

## 8. 无元数据 Widget 的降级策略

- 没有 `valueSchema` 或 `valueType`：保持当前行为，用户手动配置子字段。
- 只有 `valueType`：仅执行类型兼容检查，不生成子字段。
- 返回动态或不稳定结构：必须由 Widget 作者提供稳定 Schema，不能依赖运行时推断。
- 类型不匹配：保留当前 Schema，等待用户确认后再应用。

## 9. Variants 支持

每个 Variant 独立执行 Widget Schema 合并。`variant.widget` 与 `variant.schema` 必须保持一致：

- 只更新当前 Variant，不污染其他 Variant。
- 每个 Variant 保留自己的子字段编辑结果。
- 切换 Variant 不自动转换对象和标量值。
- Variant 的根类型以 `variant.type` 为准，Widget Schema 用于补全其内部结构。

## 10. 错误处理与兼容性

- Widget 元数据 Schema 无效时，记录开发者可见错误并忽略自动生成，不能阻塞普通 Widget 使用。
- 模板字段名重复或 required 引用不存在字段时，注册阶段应校验并拒绝该元数据。
- 旧注册项没有元数据时保持完全兼容。
- 导入已有 Schema 后，只有用户主动选择 Widget 才触发自动合并。
- `readonly` 模式禁止自动修改 Schema；选择 Widget 的控件应禁用或仅允许查看摘要。

## 11. 测试计划

### 单元测试

- 标量 Widget 不生成子字段。
- `upload-input` 将空字段转换为对象并生成两个子字段。
- 兼容对象只补全缺失字段。
- 用户已有字段配置优先于模板。
- 类型冲突正确返回 `requiresConfirmation`。
- 删除生成字段后普通更新不会自动恢复。
- 输入对象不被原地修改。

### 集成测试

- 选择 Widget 后 Schema Tree 自动展开并展示生成字段。
- 取消确认不会修改 Schema。
- 确认后 `onChange` 收到完整 Schema。
- Preview 使用生成后的 Schema 正确渲染和提交。
- Variants 只更新当前模式。
- readonly 和 hidden 配置下不产生意外修改。

## 12. 实施计划

1. 梳理现有 Widget 注册入口，统一 `WidgetDefinition` 类型。
2. 为结构化 Widget 增加 `valueSchema`，先实现 `upload-input`。
3. 实现纯函数形式的兼容检查和 Schema 合并器。
4. 在 SchemaBuilder 的 Widget 选择流程中接入合并器和确认对话框。
5. 增加 Tree 来源提示、选择器输出摘要和 Property Editor 提示。
6. 补充 DynamicForm、SchemaBuilder、Variants 的单元测试和集成测试。
7. 评估内部来源元数据的持久化与清理策略。

## 13. 设计结论

采用 Widget 元数据声明输出 Schema、SchemaBuilder 非破坏性合并、冲突时显式确认的方案。该方案将 Widget 的值结构从隐含约定提升为可复用契约，解决 `upload-input` 的配置负担，同时为地址选择器、用户选择器、金额输入和日期范围等结构化 Widget 提供统一扩展机制。
