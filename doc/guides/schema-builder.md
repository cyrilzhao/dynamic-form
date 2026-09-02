# SchemaBuilder 使用指南

SchemaBuilder 是一个可视化的 `ExtendedJSONSchema` 编辑器。你可以通过字段树和属性面板创建表单结构、配置校验和 UI 行为，并在不直接编写 JSON 的情况下实时预览结果。

本文面向两类用户：

- **终端操作用户**：在页面中创建、调整和检查 Schema。
- **集成开发者**：在 React 页面中嵌入 SchemaBuilder，并读取或保存生成的 Schema。

## 在页面中打开 SchemaBuilder

在示例应用中，打开左侧的 **Schema 构建器** 页面即可使用。页面通常包含以下区域：

1. **Schema Tree**（左侧）：显示 Root、对象属性和数组 `items` 的层级结构。
2. **Property Editor**（中间）：编辑当前选中节点的属性。
3. **Toolbar**（顶部）：切换 **Edit** / **Preview**，以及打开 **Import JSON**。
4. **Preview**（右侧或主区域）：查看 **Live Preview**、表单数据和 **JSON Schema**。

拖动树和编辑器之间的分隔线可以调整左侧宽度。某些页面会按权限或用途隐藏树、预览或部分编辑能力，这属于正常配置。

## 从零创建一个 Schema

### 1. 选择根节点

没有传入初始 Schema 时，编辑器会创建一个 `object` 根节点，并自动生成一个初始字段。根节点不能删除；选中根节点可以配置整个表单级别的设置。

如果页面已有 Schema，树中会显示它的现有结构。节点名称优先显示 `Label`，括号内显示字段名，例如 `Email (email)`。

### 2. 添加字段

1. 在树中选中一个 **object** 节点。
2. 点击节点右侧的 **…**，选择 **Add Child Node**。
3. 新字段默认类型为 `string`，选中新节点后在 **Basic** 标签页中修改名称、标签和类型。

对象节点可以继续添加子字段。数组节点不能添加多个并列字段，它只有一个 `items` 定义，用来描述数组中每一项的类型和结构；选中数组的 `items` 节点可编辑该项定义，但不能直接删除或重命名 `items`。

### 3. 添加同级字段、排序和删除

在对象属性节点的 **…** 菜单中可以使用：

- **Add Sibling Node**：在当前字段后插入一个同级字段。
- **Move Up / Move Down**：调整同一对象下的字段顺序。
- **Delete Node**：删除当前字段及其嵌套内容。

同一对象下的字段名必须唯一且不能为空。重命名会同步更新字段路径和其子节点路径。根节点不能删除；为避免表单没有字段，一级对象的最后一个字段也不能删除。

## 配置字段属性

选中对象属性或数组项后，Property Editor 会显示以下标签页。可见标签会因字段类型和页面配置而变化。

### Basic

- **Name**：对象属性的字段名。数组 `items` 和根节点没有此输入框。
- **Label**：表单中显示的标签，也会用于验证错误提示。
- **Description**：字段说明。
- **Type**：`String`、`Number`、`Integer`、`Boolean`、`Object` 或 `Array`。
- **Default Value**：按字段类型输入默认值；数组 `items` 节点不能设置默认值。
- **Required**：将字段加入父对象的 `required` 列表。
- **Options (enum)**（字符串字段）：维护可选值及其显示标签，供 `select`、`radio` 等组件使用。

切换字段类型会清理不再适用的 `properties`、`items` 和 `required` 配置，并为 `object` 或 `array` 创建可继续编辑的初始子结构。因此，切换类型前请先确认原有子字段是否还需要。

### Validation

按类型配置标准 JSON Schema 校验：

- **字符串**：`Min Length`、`Max Length`、`Pattern (Regex)`、`Format`（如 email、date、uri）及对应错误消息。
- **数字/整数**：`Minimum`、`Maximum`、`Multiple Of` 及对应错误消息。
- **数组**：`Min Items`、`Max Items`、`Unique Items`。
- **对象**：`Min Properties`、`Max Properties`。

根节点的 Validation 标签页用于 Schema 级别规则，包括 `dependencies`、`if/then/else`、`allOf`、`anyOf` 和 `oneOf`。这些规则负责数据合法性，不负责字段显示或隐藏；显示联动请使用 **Linkage**。

### UI Config

用于控制生成表单的展示和数据处理方式，常用设置包括：

- **Widget**：按字段类型选择控件，例如字符串的 `textarea`、`select`、`radio`，数字的 `range`，布尔值的 `checkbox`，数组的 `select`、`table-array`，对象的 `object-editor`。
- 输入提示：`Placeholder`、帮助文本和自定义控件属性。
- 状态：`Hidden`、`Disabled`、`Readonly`。
- 布局：`Layout`、`Label Width`、`Column Span`；根节点还可设置 `Columns Count`（1–12）。
- 对象扁平化：`Flatten Path`、`Flatten Prefix`。
- 数组行为：数组模式、添加按钮文本等。
- 高级数据处理：Transform、Validators、Callback Props（页面启用时显示）。

### Linkage

用于根据其他字段的值动态改变当前字段。创建规则时依次选择依赖字段、条件和效果；同一字段的多条规则按列表顺序执行，后面的规则可能覆盖前面的结果。

常见效果类型：

| 类型         | 用途                |
| ------------ | ------------------- |
| `visibility` | 显示或隐藏字段      |
| `disabled`   | 动态禁用字段        |
| `readonly`   | 动态设为只读        |
| `value`      | 设置固定值或计算值  |
| `options`    | 动态生成选项        |
| `schema`     | 动态修改字段 Schema |

条件支持等于、不等于、大小比较、`in`/`notIn`、`includes`/`notIncludes`、`isEmpty` 和 `isNotEmpty`，也可以组合 `AND` / `OR`。字段路径可使用字段选择器提供的 JSON Pointer（如 `#/properties/status`）；数组项内部的同级依赖可使用相对路径（如 `./type`）。

联动脚本应返回与效果类型匹配的数据。例如 `options` 需要返回 `{ label, value }` 数组。配置后务必在 Live Preview 中分别测试条件满足和不满足的情况。

### Variants

Variants 让一个字段拥有多个互斥的编辑模式，例如“文本模式”和“对象模式”。操作步骤：

1. 在 **Variants** 中点击添加，填写唯一的名称和标签。
2. 选择 Variant 类型和 Widget，点击 **Edit Schema** 编辑该模式的子 Schema。
3. 选择默认 Variant；需要时配置自动检测函数。
4. 保存当前 Variant 后，再保存字段配置。

删除默认 Variant 前应先选择新的默认项，避免留下无效引用。嵌套 SchemaBuilder 弹窗中的 **Apply** 只更新当前 Variant 草稿，外层保存后才会写回主 Schema。

## 预览和检查结果

1. 点击顶部 **Preview**。
2. 在 **Live Preview** 中像终端用户一样填写表单。
3. 在 **Data** 区域查看当前输入值（这是预览数据，不是 Schema）。
4. 切换到 **JSON Schema** 检查最终生成的完整 JSON。
5. 点击 **Edit** 返回树和属性编辑器。

预览可用于检查必填校验、控件选择、标签、布局、默认值和联动效果。修改后无需手动刷新，预览会跟随当前 Schema 更新。

## 导入已有 Schema

1. 点击 **Import JSON**。
2. 在编辑器中粘贴或修改 `ExtendedJSONSchema` JSON。
3. 点击 **Apply**。
4. 如果 JSON 格式或 Schema 结构无效，会显示 `Invalid ExtendedJSONSchema`，当前 Schema 保持不变。
5. 不想应用时点击 **Cancel**。

导入会替换当前编辑内容。应用前请确认 JSON 已包含正确的 `type`、`properties` / `items` 和字段 `title`，应用后再通过树和 JSON Schema 复核。

## 集成到 React 页面

```tsx
import { useState } from 'react'
import { SchemaBuilder } from '@/components/SchemaBuilder'
import type { ExtendedJSONSchema } from '@/components/DynamicForm'

export function SchemaEditorPage() {
  const [schema, setSchema] = useState<ExtendedJSONSchema>()

  return (
    <SchemaBuilder
      defaultValue={schema}
      onChange={setSchema}
      previewMode="both"
    />
  )
}
```

常用属性：

| 属性                  | 说明                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `defaultValue`        | 非受控初始 Schema，只在组件初始化时读取。挂载后要整体重置，可改变 React 的 `key`。                          |
| `onChange`            | 每次编辑或导入成功后回调最新 Schema，可在此保存到状态或后端。                                               |
| `initialSelectedPath` | 初始选中字段，支持路径数组或 JSON Pointer，例如 `#/properties/user/properties/name`。不能直接选中 `items`。 |
| `previewMode`         | `both`（默认）、`form`、`json` 或 `none`。                                                                  |
| `hideTree`            | 隐藏左侧树面板。                                                                                            |
| `options`             | 控制隐藏项、只读范围和嵌套编辑器的根类型。                                                                  |
| `className` / `style` | 自定义容器样式。                                                                                            |

### 受限和只读配置

`options.hidden` 可隐藏 `tree`、`preview`、`importExport`、`propertyEditor`、`rootValidation` 或 `variantsTab`。`options.readonly` 可整体只读，也可分别限制树、Schema、字段增删、排序、字段名和字段类型编辑。例如：

```tsx
<SchemaBuilder
  defaultValue={schema}
  options={{
    hidden: { importExport: true },
    readonly: { editFieldKey: true },
  }}
  previewMode="json"
/>
```

只读属性面板会显示 **Schema (Read Only)**。隐藏或只读配置只影响界面操作，不会阻止外部程序通过代码传入新的 Schema。

### 使用 Ref 读取和重置

需要从按钮或父组件主动读取、替换或重置时，可使用 `SchemaBuilderRef`：

```tsx
import { useRef } from 'react'
import type { SchemaBuilderRef } from '@/components/SchemaBuilder'

const builderRef = useRef<SchemaBuilderRef>(null)

<SchemaBuilder ref={builderRef} defaultValue={schema} />

builderRef.current?.getSchema()       // 获取当前 Schema
builderRef.current?.setSchema(schema) // 替换当前 Schema
builderRef.current?.reset()            // 恢复初始 Schema 并清除界面状态
```

`setSchema` 会尽量保留当前选中路径；如果路径已不存在，则自动选中第一个一级字段。

## 常见问题

- **看不到字段**：展开父级 object/array 节点，并确认页面没有隐藏 Schema Tree 或 Property Editor。
- **不能添加子节点**：只有 `object` 可以添加子字段；array 只能编辑唯一的 `items` 定义。
- **不能删除字段**：根节点、`items` 节点和最后一个一级字段受保护；也可能是只读配置导致。
- **改类型后字段消失**：类型切换会清理互斥的子结构，这是为了避免生成无效 Schema。
- **导入后内容没变化**：检查 JSON 是否为有效的 `ExtendedJSONSchema`；失败时组件会保留原内容。
- **联动没有效果**：确认依赖路径、条件值类型和脚本返回结构，并在 Live Preview 中改变依赖字段触发规则。

## 推荐工作流

先用树搭好 object/array 层级，再逐个字段配置 Basic、Validation 和 UI Config；随后配置 Linkage 或 Variants，最后在 Live Preview 和 JSON Schema 中各检查一次。保存时应保存 `onChange` 或 `getSchema()` 得到的 Schema，而不是 Preview 中的 Data。
