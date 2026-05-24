# Schema Builder 组件设计文档

## 1. 概述

`SchemaBuilder` 是一个可视化编辑器组件，旨在创建和修改 `ExtendedJSONSchema` 对象。它允许用户直观地构建复杂的表单 Schema，无需编写原始 JSON，涵盖了标准 JSON Schema 验证规则以及项目特有的 UI 扩展（Widget、布局、路径扁平化等）。

## 2. 组件接口

```typescript
import { ExtendedJSONSchema } from '../../src/components/DynamicForm/types/schema';

interface SchemaBuilderProps {
  /**
   * 初始编辑的 Schema
   */
  defaultValue?: ExtendedJSONSchema;

  /**
   * Schema 变更时的回调函数
   */
  onChange?: (schema: ExtendedJSONSchema) => void;

  /**
   * 可选的自定义类名
   */
  className?: string;

  /**
   * 可选的自定义样式
   */
  style?: React.CSSProperties;
}
```

## 3. 架构设计

组件将采用**分屏布局**：

1.  **左侧面板（Schema 树）**：
    - 可视化 Schema 的层级结构。
    - 处理节点的添加、删除和选择。
    - 支持嵌套结构（对象、数组）。
2.  **右侧面板（属性编辑器）**：
    - 提供表单以编辑当前选中节点的属性。
    - 更新全局 Schema 状态中选中节点的数据。
3.  **预览/输出区域**：
    - 显示生成的 JSON。
    - （可选）实时预览渲染后的 `DynamicForm`。

## 4. 状态管理

组件将维护 Schema 的内部状态。

- **`schema`**：根 `ExtendedJSONSchema` 对象。
- **`selectedPath`**：表示当前选中节点路径的字符串或字符串数组（例如 `properties.user.properties.name`）。
- **`expandedPaths`**：在树状视图中展开的路径集合。

## 5. 详细组件设计

### 5.1 SchemaTree（左侧面板）

- **结构可视化**：
  - **Root**：主对象。
  - **对象属性**：对象节点的子节点（源自 `properties`）。
  - **数组项**：数组节点的子节点（源自 `items`）。
- **交互**：
  - **选择**：点击节点以填充右侧面板。
  - **添加字段**：在对象节点上点击按钮添加新属性。
  - **删除**：点击按钮删除节点（Root 除外）。
- **展示**：
  - 显示 `title`（如果缺失则显示 `key`）。
  - 显示 `type`（图标或文本）。
  - 标识 `required` 必填状态。

### 5.2 PropertyEditor（右侧面板）

编辑器根据选中节点的 `type` 动态变化。内容组织为标签页：

#### Tab 1: 基础信息 (Basic)

- **字段键名 (Field Key)**：（仅当父级为对象时可编辑）属性名称。
- **标题 (Title)**：`title` 输入框。
- **描述 (Description)**：`description` 文本域。
- **类型 (Type)**：下拉选择（`string`, `number`, `integer`, `boolean`, `object`, `array`）。更改类型会重置特定类型的验证规则。
- **默认值 (Default Value)**：`default` 输入框（感知类型）。
- **必填 (Required)**：开关（切换在父级 `required` 数组中的存在状态）。

#### Tab 2: 验证规则 (Validation) - 特定类型

- **String**:
  - `minLength`, `maxLength`（数字输入）
  - `pattern`（正则字符串输入）
  - `format`（下拉选择：email, date, uri 等）
- **Number/Integer**:
  - `minimum`, `maximum`（数字输入）
  - `multipleOf`（数字输入）
- **Array**:
  - `minItems`, `maxItems`（数字输入）
  - `uniqueItems`（开关）
- **Object**:
  - `minProperties`, `maxProperties`（数字输入）

#### Tab 3: UI 配置 (UI Configuration)

对应 `src/components/DynamicForm/types/schema.ts` -> `UIConfig`。

- **组件选择 (Widget)**：基于 `type` 的下拉选择。
  - _String_: text, textarea, password, email, url, date, time, color, file...
  - _Boolean_: switch, checkbox.
  - _Number_: number, range.
  - _Array_: checkboxes (如果是枚举), nested-form (如果是对象).
- **显示选项**:
  - `placeholder`（输入框）
  - `help`（输入框）
  - `hidden`, `disabled`, `readonly`（开关）
- **布局 (Layout)**:
  - `width`（栅格列跨度，如果布局系统支持）
  - `layout`: `vertical` | `horizontal` | `inline`
  - `labelWidth`: 输入框
- **高级 UI**:
  - `flattenPath`（开关） - 参见 `FIELD_PATH_FLATTENING.md`
  - `flattenPrefix`（开关）

#### Tab 4: 数据选项 (Data Options) - 仅枚举/数组

- **枚举配置**:
  - 值/标签对列表。填充 `enum` 和 `enumNames`。
- **数组配置**:
  - `arrayMode`: `dynamic` | `static`
  - 按钮文本 (`addButtonText`, `removeButtonText`)。

#### Tab 5: 联动配置 (Linkage Configuration)

对应 `src/components/DynamicForm/types/linkage.ts` 中的 `LinkageConfig` 类型。

##### 5.1 联动类型 (Linkage Type)

支持以下联动类型：

| 类型 | 说明 | 效果配置 |
|------|------|----------|
| `visibility` | 控制字段显示/隐藏 | `state.visible: boolean` |
| `disabled` | 控制字段禁用状态 | `state.disabled: boolean` |
| `readonly` | 控制字段只读状态 | `state.readonly: boolean` |
| `value` | 动态计算字段值 | `value` 或 `function` |
| `options` | 动态生成选项列表 | `options` 或 `function` |
| `schema` | 动态修改字段 Schema | `schema: ExtendedJSONSchema` |

##### 5.2 依赖字段配置 (Dependencies)

支持两种路径格式：

- **JSON Pointer 绝对路径**：`#/properties/fieldName`
  - 用于引用顶层字段或跨层级字段
  - 数组元素字段：`#/properties/arrayName/items/properties/fieldName`
- **相对路径**：`./fieldName`
  - 用于引用同级字段（特别适用于数组元素内部的联动）

##### 5.3 条件表达式 (Condition Expression)

条件表达式支持单条件和逻辑组合：

**单条件 (SingleCondition)**：
```typescript
interface SingleCondition {
  field: string;      // 字段路径
  operator: ConditionOperator;
  value?: any;        // 比较值（部分操作符不需要）
}
```

**条件操作符 (ConditionOperator)**：
| 操作符 | 说明 | 需要 value |
|--------|------|------------|
| `==` | 等于 | 是 |
| `!=` | 不等于 | 是 |
| `>` | 大于 | 是 |
| `<` | 小于 | 是 |
| `>=` | 大于等于 | 是 |
| `<=` | 小于等于 | 是 |
| `in` | 值在数组中 | 是（数组） |
| `notIn` | 值不在数组中 | 是（数组） |
| `includes` | 数组包含值 | 是 |
| `notIncludes` | 数组不包含值 | 是 |
| `isEmpty` | 值为空 | 否 |
| `isNotEmpty` | 值不为空 | 否 |

**逻辑组合 (LogicalCondition)**：
```typescript
interface LogicalCondition {
  and?: ConditionExpression[];  // 所有条件都满足
  or?: ConditionExpression[];   // 任一条件满足
}
```

支持最多 5 层嵌套的逻辑组合。

##### 5.4 效果配置 (LinkageEffect)

根据联动类型配置不同的效果：

```typescript
interface LinkageEffect {
  // 状态效果（visibility/disabled/readonly）
  state?: {
    visible?: boolean;
    disabled?: boolean;
    readonly?: boolean;
  };

  // 值效果（value 类型）
  value?: any;              // 固定值
  function?: string;        // 计算函数名

  // 选项效果（options 类型）
  options?: Array<{ label: string; value: any }>;

  // Schema 效果（schema 类型）
  schema?: ExtendedJSONSchema;
}
```

##### 5.5 异步联动支持 (Async Linkage)

- **enableCache**：开关，启用异步结果缓存
  - 适用于 `value`、`options`、`schema` 类型
  - 避免重复请求相同参数的异步操作

##### 5.6 多联动规则支持 (Multiple Linkages)

单个字段可配置多个联动规则：

```typescript
// 单个联动（向后兼容）
ui: {
  linkage: LinkageConfig
}

// 多个联动
ui: {
  linkages: LinkageConfig[]
}
```

多联动规则按数组顺序依次执行，后执行的规则可能覆盖先执行的效果。

##### 5.7 UI 编辑器设计

**LinkageEditor 组件结构**：

1. **启用/禁用开关**：控制是否启用联动
2. **联动类型选择**：下拉选择联动类型
3. **依赖字段配置**：
   - 字段路径选择器（支持从 Schema 树中选择）
   - 支持添加多个依赖字段
4. **条件编辑器 (ConditionEditor)**：
   - 单条件：字段选择 + 操作符选择 + 值输入
   - 逻辑组合：AND/OR 分组，支持嵌套
   - 可视化条件树结构
5. **效果编辑器 (EffectEditor)**：
   - Fulfill 效果：条件满足时的效果
   - Otherwise 效果：条件不满足时的效果（可选）
6. **高级选项**：
   - enableCache 开关（异步联动）

**多联动管理**：
- 联动规则列表视图
- 添加/删除/排序联动规则
- 每个规则可独立展开编辑

## 6. 实现策略

### 6.1 工具库

- **React Hook Form**：用于管理属性编辑器表单。
- **BlueprintJS**：用于 Tree 组件、Tabs 和基础输入组件。
- **Lodash**：使用 `get`, `set`, `cloneDeep`, `unset` 进行类不可变 Schema 更新。

### 6.2 关键挑战与解决方案

1.  **重命名键名**：当用户更改对象中属性的“字段键名”时，必须更新父级的 `properties` 对象。
    - _解决方案_：PropertyEditor 中的“字段键名”输入框将触发特殊操作：创建一个具有新键名的新属性，复制原值，并删除旧键名，尽可能保持顺序。
2.  **更改类型**：从“String”切换到“Object”。
    - _解决方案_：警告用户验证规则将丢失。使用安全默认值初始化新类型（例如，Object 初始化为空 `properties`）。

## 7. 交付物

- `src/components/DynamicForm/SchemaBuilder/SchemaBuilder.tsx`：主组件。
- `src/components/DynamicForm/SchemaBuilder/SchemaTree.tsx`：左侧面板。
- `src/components/DynamicForm/SchemaBuilder/PropertyEditor.tsx`：右侧面板。
- `src/components/DynamicForm/SchemaBuilder/types.ts`：内部类型定义。
