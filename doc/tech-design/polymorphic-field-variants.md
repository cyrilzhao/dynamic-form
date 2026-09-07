# 多类型字段与可切换 Widget 设计

> **文档状态：已实现核心运行时。** 当前 DynamicForm 已支持 `ui.variants`、VariantWidget、独立值缓存、active variant、Variant 级校验和 transform。本文件同时保留设计约束与后续扩展说明。

## 1. 背景与目标

JSON Schema 可以用 `type: ["object", "string"]`、`anyOf` 或 `oneOf` 表达一个值允许多种类型，但这些标准关键字只描述数据合法性，不能决定表单应该渲染哪个 Widget，也不能表达不同类型各自的校验、转换、默认值和切换行为。

典型场景是 `data` 字段既可以保存结构化对象，也可以保存变量字符串 `${data}`。用户希望：

- 有值时根据值自动识别模式；
- 无值时按默认模式渲染；
- 用户可以手动切换模式；
- 提交时只保存当前显示模式的值；
- 每种模式独立配置 Widget、Schema 校验、`ui.validators`、错误消息和 transform；
- 切换模式时尽量保留用户在各模式中编辑过的内容。

## 2. 设计原则与边界

1. **数据联合与 UI 模式分离**：标准 JSON Schema 负责描述数据约束，DynamicForm 扩展配置负责描述交互和渲染。
2. **单一活动模式**：字段任意时刻只有一个 active variant；校验和提交均以该模式为准。
3. **显式优先于自动**：自动识别仅用于初始化和外部值变化；用户手动切换后不应被每次输入重新识别覆盖。
4. **不猜测不可逆转换**：对象与变量字符串之间没有明确转换器时，不自动猜测业务语义。
5. **保持旧字段兼容**：没有 `ui.variants` 的字段继续沿用当前单类型解析、渲染、校验和 transform 流程。
6. **展示值与存储值分层**：Widget 编辑展示值，提交前转换为外部数据契约；校验默认针对当前模式展示值。

非目标：本方案不要求一次性支持所有 JSON Schema 组合关键字的自动 Widget 推导，也不改变现有普通字段的默认数据格式。

## 3. 方案比较

### 方案 A：仅使用 `oneOf`/`anyOf`

优点是标准化程度高；缺点是无法自然表达 Widget、模式标签、默认模式、模式缓存和 transform。最终仍需额外 UI 元数据，不能单独解决问题。

### 方案 B：直接支持 `schema.type` 数组

配置简单，符合 JSON Schema；但类型数组没有 Widget 映射和各类型独立配置。若让所有现有 Widget 处理联合类型，会扩大耦合范围，并使数组转换、默认值和路径处理复杂化。

### 方案 C：增加 `ui.variants` 模式容器（推荐）

每个 variant 拥有名称、类型、Widget、子 Schema、识别器和 transform。由统一的 `VariantWidget` 管理模式状态，现有 Widget 继续只处理单一明确类型；标准 Schema 可作为 variant 的校验来源。不同 variant 默认相互独立，不假设它们之间存在可逆的数据转换关系。

推荐方案 C，因为它兼容现有架构，能隔离多类型交互复杂度，并允许未来将 `oneOf`/`anyOf` 作为数据校验层补充。

## 4. 配置模型

建议在 `UIConfig` 中增加 `variants` 和 `defaultVariant`：

```ts
interface FieldVariant {
  name: string;
  label?: string;
  type:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "array"
    | "object"
    | "null";
  widget?: WidgetType | string;
  schema?: ExtendedJSONSchema;
  detect?: {
    type?: "template" | "predicate";
    pattern?: string;
    callback?: string;
  };
}
```

示例：

```ts
const schema: ExtendedJSONSchema = {
  type: "object",
  properties: {
    data: {
      title: "Data",
      ui: {
        widget: "variant",
        defaultVariant: "object",
        variants: [
          {
            name: "object",
            label: "Object",
            type: "object",
            widget: "nested-form",
            schema: {
              type: "object",
              properties: {
                source: { type: "string", title: "Source" },
                enabled: { type: "boolean", title: "Enabled" },
              },
              required: ["source"],
            },
          },
          {
            name: "variable",
            label: "Variable",
            type: "string",
            widget: "text",
            detect: { type: "template", pattern: "^\\$\\{[^}]+\\}$" },
            schema: {
              type: "string",
              pattern: "^\\$\\{[^}]+\\}$",
            },
          },
        ],
      },
    },
  },
};
```

`variant.schema` 是该模式的完整子 Schema，模式专属的 `ui.validators`、`ui.errorMessages` 和 `format` 均从这里读取。运行时通过统一的 `buildVariantSchema` 构造有效 Schema：公共 UI 元数据继续继承，而 `validators`、`transform`、`widget` 以及 `format`、`pattern`、`enum`、`const`、长度/数值约束、`required`、`properties`、`items` 等 Variant 专属配置采用替代语义，未声明时清除基础或上一个 Variant 的配置，防止校验规则泄漏。

### 4.1 SchemaBuilder 配置设计

SchemaBuilder 的 Variants 编辑器设计与实现见独立文档：[SchemaBuilder Variants 设计](./schema-builder/variants.md)。本文只约定运行时数据模型，不重复描述编辑器交互。

配置区分为两个层级：

```text
字段 PropertyEditor
├─ 基础信息：title、description、隐藏/禁用等公共配置
├─ Variants 配置
│  ├─ 开关：启用/移除多模式字段
│  ├─ 默认模式：defaultVariant
│  ├─ 模式列表：名称、标签、类型、Widget、识别规则
│  └─ 选中模式详情：子 Schema、校验和 transform
└─ 顶层普通校验/transform：多模式启用后提示仅适用于公共规则
```

#### 4.1.1 模式列表

用户通过列表新增、删除、排序和选择模式。每项至少编辑：

- `name`：内部唯一标识；创建后用于 `defaultVariant` 和各模式编辑内容缓存，重命名时应同步更新这些引用。
- `label`：模式选择器展示文本；未填写时回退为 `name`。
- `type`：该模式的单一 JSON Schema 类型；不允许在单个 variant 中再次配置类型数组，避免产生嵌套联合类型。
- `widget`：该类型实际使用的 Widget；默认值复用当前 `getDefaultWidget` 的单类型选择规则。
- `detect`：可选的自动识别规则。模板模式可提供正则输入；回调模式应复用现有 callback/inline script 编辑器，并明确其仅用于受信任环境。

模式列表应展示概要信息，例如 `Object · nested-form`、`Variable · text`，并标记默认模式。删除默认模式时，SchemaBuilder 必须要求先选择新的默认模式或一并清空 `defaultVariant`，不能留下悬空引用。

#### 4.1.2 选中模式详情

选中一个模式后，右侧或下方仅编辑该模式的配置：

- **子 Schema**：使用嵌入式 Schema 编辑器或复用现有 SchemaTree/PropertyEditor 能力，编辑 `variant.schema`。对象模式可新增 properties，数组模式可编辑 items；基础类型展示对应约束。
- **校验**：复用 SchemaValidationEditor 与当前字段级校验编辑能力，但读写目标限定为 `variant.schema`。`required`、`format`、`ui.errorMessages`、`ui.validators` 只作用于当前模式。
- **transform**：复用 TransformEditor，读写 `variant.schema.ui.transform`，并在说明中标明它只处理当前模式的展示值和存储值。
- **模式切换行为**：模式之间默认没有转换关系。切换时保存当前模式的编辑内容，并优先恢复目标模式此前编辑过的内容；目标模式没有内容时使用其默认值或空值。这样可以避免把没有业务依据的对象/字符串转换误认为合法数据转换。

变体子 Schema 不应进入顶层 SchemaTree 的普通字段树。它们是同一字段的替代结构，而不是同时存在的子字段；直接混入会让字段路径、required 和联动目标产生歧义。第一版使用独立的嵌入编辑器，后续再评估是否需要可切换的 SchemaTree 子视图。

#### 4.1.3 编辑期约束与提示

SchemaBuilder 保存前应执行配置期校验，不等待表单运行时才暴露问题：

- `name` 必填且在同一字段的 variants 中唯一；
- `type` 必填，且 `variant.schema.type` 缺失时由编辑器写入该 type；若两者冲突则阻止保存；
- `defaultVariant` 必须引用现有模式；只有一个模式时可自动选中它；
- 使用 `widget` 时校验该 Widget 是否支持该 variant type；自定义 Widget 允许通过现有注册机制放行；
- `detect.callback` 必须引用已注册函数或合法 inline script；多个模式的识别规则重叠时按列表顺序选择第一个匹配项；
- 启用 variants 后，顶层 `type` 数组、顶层 `ui.widget`、顶层 `ui.transform` 与 variant 专属配置同时出现时显示冲突提示，并提供“迁移到默认模式”的显式操作，不能静默覆盖。

SchemaBuilder 预览应提供模式选择器，使用户可以在设计阶段分别检查每个 Widget、默认值和错误消息；预览不应把非当前模式的校验错误混入当前模式。

## 5. 运行时架构

新增 `VariantWidget` 作为适配层：

```text
字段注册/SchemaParser
        ↓
   VariantWidget
   ├─ 模式选择器
   └─ 当前 variant 的 Widget
        ↓
现有 Text/NestedForm/Array 等 Widget
```

职责划分：

- `SchemaParser`：识别 `ui.variants`，生成 variant 字段配置，不把类型数组直接传给现有 Widget。
- `VariantWidget`：维护当前模式、自动识别和手动切换，并分别保存用户在各个模式下已经编辑的内容。这样用户从对象模式切换到变量模式后，再切回对象模式时，可以继续编辑原来的对象，而不必重新输入。
- 现有 Widget：接收单一明确类型的子 Schema，保持现有行为。
- `SchemaValidator`：只验证 active variant 的 effective Schema。
- transform 层：根据 active variant 选择正向或反向转换器。

## 6. 模式识别与切换

### 6.1 自动识别优先级

1. 值匹配 variant 的 `detect`；
2. 没有匹配时，按值的 JavaScript 类型匹配 variant 的 `type`；
3. 值为空时使用 `defaultVariant`；
4. 仍无法确定时使用第一个 variant。

自动识别只在初始化、`reset`、`setValue` 或外部值变化时运行，不能在每次键盘输入后运行，以免 Widget 抖动。

### 6.2 手动切换

模式选择器切换时：

1. 保存旧模式当前展示值；
2. 优先恢复目标模式最近一次编辑的内容；
3. 目标模式没有已编辑内容时使用目标模式默认值或空值；
4. 更新 active variant，重新渲染 Widget 并触发目标模式校验。

建议保留各模式独立的内部编辑内容，但提交时只输出 active variant 的值，其他模式的内容不得泄露到外部数据。除非未来显式引入经过业务确认的转换扩展，否则禁止在模式切换时自动转换值。

## 7. 校验流程

校验顺序建议为：

```text
读取 active variant
  → 构造 variant effective schema
  → 类型与标准 Schema 约束
  → ui.validators
  → 过滤隐藏/禁用字段错误
  → 映射为 React Hook Form 错误树
```

当前模式的子 Schema 可使用 `required`、`integer`、`minimum`、`multipleOf`、`format`、`customFormats`、`ui.errorMessages` 等已有能力。非 active variant 不参与校验，因此切换后旧模式的错误应被清除或从错误树中移除。

自定义校验回调继续接收 `{ value, formValues, helpers }`。如业务需要校验 transform 后的值，应由运行时额外提供 `transformedValue`，避免校验器自行重复调用转换逻辑。

## 8. Transform 与数据流

```text
外部存储值
  ↓ reverseCallback（按识别到的 variant）
表单展示值
  ↓ 用户编辑 / 模式切换
active variant 展示值
  ↓ callback（仅当前 variant）
提交存储值
```

模式切换不得错误复用旧模式 transform。对象与变量字符串属于两种独立表达方式，切换时不应自动把一种值转换成另一种值；运行时只恢复目标模式自己的编辑内容、默认值或空值。

### 8.1 可选的未来扩展

某些业务确实存在明确、可验证的模式转换关系，例如 JSON 对象与 JSON 文本之间的转换。此类能力不属于基础 variants 设计，未来如需支持，应单独增加显式的业务转换器，并要求：

- 由业务按来源和目标模式明确声明，而不是根据类型自动推断；
- 转换失败时产生字段错误，不得静默丢弃原值；
- 转换器必须经过可逆性或数据丢失评估；
- 没有声明转换器时继续采用模式独立的保存/恢复规则。

联动默认读取当前字段展示域的 active value。若某个联动必须依赖存储域值，应提供明确的 transformed value 访问接口，而不是隐式改变现有联动语义。

## 9. 错误处理与安全

- 未配置 `defaultVariant` 且无法识别值时，使用首个 variant，并在开发环境提示配置不完整。
- `detect.callback`、transform 和 switch transform 的异常应转换为字段错误，不得中断整个表单 resolver。
- 模式名必须唯一；重复名称、未知目标模式和非法 Schema 应在开发环境报告清晰错误。
- 变量识别默认使用严格正则，不执行变量内容；内联脚本仍遵循现有受信任环境限制。
- 非 active variant 的编辑内容只存在表单内部状态，不参与提交、联动和持久化。

## 10. 兼容性与迁移

没有 `ui.variants` 的现有 Schema 完全走旧流程。已有 `ui.transform` 继续作为单模式 transform；迁移到 variants 后，应将原有 Widget、Schema 约束和 transform 移入对应 variant，避免顶层和子模式同时配置同一规则。

不建议自动把 `type: string[]` 转换为 variants：类型数组缺少 Widget 和模式名称，自动推导可能产生不可预测的 UI。可以提供开发期诊断，提示用户改用 `ui.variants`。

## 11. 测试计划

### 单元测试

- 识别器对对象、变量字符串、空值和未知值的优先级；
- active variant 切换以及各模式独立编辑内容的保存/恢复；
- 无转换器、成功转换和转换异常；
- 每个 variant 只执行自己的 Schema、validators 和 errorMessages；
- 非 active variant 错误不会阻塞提交；
- 正向/反向 transform 的调用次数和参数。

### 集成测试

- Object ↔ Variable Widget 切换后值和错误展示；
- 当前模式提交值正确，其他模式编辑内容不出现在提交结果；
- `reset`/`setValue` 后自动识别生效，用户手动选择不会被输入事件覆盖；
- 嵌套对象和对象数组中的 variant 字段路径正确；
- 与 linkage、隐藏/禁用字段及 customFormats 同时使用。
- SchemaBuilder 可新增、删除、排序和重命名模式，并能同步维护默认模式；
- SchemaBuilder 编辑当前模式的子 Schema、校验和 transform 时，不影响其他模式或顶层公共字段配置；
- SchemaBuilder 能阻止重复模式名、无效正则、悬空默认模式和不兼容 Widget 等无效配置。

## 12. 当前实现状态

1. 已实现 `ui.variants`、`VariantWidget`、独立值缓存和 `FieldVariantContext`。
2. 已实现 active variant 优先、detect callback、默认 Variant 和类型 fallback。
3. 已将 Variant effective schema 接入 Widget、resolver、validators、transform 和表单 API。
4. 已支持嵌套对象、数组路径以及 Variant 专属 `properties/items`。
5. 已补充 Variants、resolver、validators 和数组转换测试。
6. `detect` 当前仅支持 `callback`，callback 可以是注册函数名或 inline script；旧的 `detect.type/pattern` 不属于当前 API。

## 13. 结论

DynamicForm 可以支持同一字段在对象和变量字符串之间切换，但应采用“标准 Schema 约束 + `ui.variants` UI 模式容器”的组合设计，而不是直接扩展所有现有 Widget 以理解 `type` 数组。该边界能让每种类型拥有独立校验和 transform，同时保持现有单类型字段兼容，并为后续增加更多模式留下稳定扩展点。
