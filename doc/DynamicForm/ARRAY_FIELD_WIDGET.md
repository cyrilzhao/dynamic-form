# ArrayFieldWidget 通用数组组件设计方案

## ⚠️ 重要提示

### 基本类型数组的数据格式

由于 react-hook-form 的 `useFieldArray` 会过滤掉基本类型的空值（空字符串、0、false），ArrayFieldWidget 会将基本类型包装成对象格式：

**表单内部存储格式**：
```typescript
// 用户看到的是字符串输入框，但内部存储为：
[
  { value: 'tag1' },
  { value: 'tag2' }
]
```

**字段路径格式**：
```typescript
// 基本类型数组的字段路径会自动添加 .value 后缀
'tags.0.value'  // 第一个标签的值
'tags.1.value'  // 第二个标签的值
```

**提交时需要转换**：
```typescript
const handleSubmit = (data: any) => {
  // 方式 1: 转换为纯数组（推荐）
  const pureTags = data.tags.map((item: any) => item.value);
  console.log(pureTags); // ['tag1', 'tag2']

  // 方式 2: 在后端接收时进行解包处理
};
```

**为什么需要包装？**
- react-hook-form 的 useFieldArray 在处理基本类型时，会过滤掉"假值"
- 包装成对象后，即使 value 为空，对象本身也不会被过滤
- 这确保了数组项的稳定性和可编辑性

详见第 3.1 节和第 6.1 节。

---

## 目录

1. [概述](#1-概述)
2. [设计理念](#2-设计理念)
3. [核心特性](#3-核心特性)
4. [类型定义和接口设计](#4-类型定义和接口设计)
5. [Widget 选择逻辑](#5-widget-选择逻辑)
6. [支持的数组类型](#6-支持的数组类型)
7. [组件实现](#7-组件实现)
8. [使用示例](#8-使用示例)
9. [与现有组件的关系](#9-与现有组件的关系)
10. [实施路线图](#10-实施路线图)
11. [最佳实践](#11-最佳实践)
12. [注意事项](#12-注意事项)

---

## 1. 概述

`ArrayFieldWidget` 是一个通用的数组字段渲染组件，用于处理 JSON Schema 中所有 `type: 'array'` 类型的字段。它不仅支持对象数组，还支持基本类型数组、枚举数组等各种数组场景。

### 1.1 设计背景

在现有的动态表单系统中：

- `NestedFormWidget` 专门处理 `type: 'object'` 的字段
- 但缺少一个专门处理 `type: 'array'` 的通用组件
- 数组类型的处理逻辑分散在不同的地方，不够统一

### 1.2 设计目标

1. **统一数组处理**：所有 `type: 'array'` 字段都由 `ArrayFieldWidget` 处理
2. **智能 Widget 选择**：根据 `items` 的配置自动选择合适的子 Widget
3. **完整的数组操作**：支持增删改查、排序、拖拽等操作
4. **类型安全**：完整的 TypeScript 类型支持
5. **易于扩展**：可以轻松支持新的数组元素类型

---

## 2. 设计理念

### 2.1 核心原则

**ArrayFieldWidget 是所有数组类型的统一入口**

```
JSON Schema type: 'array'
         ↓
   ArrayFieldWidget (统一处理)
         ↓
根据 items 配置选择子 Widget
         ↓
    ┌─────┴─────┬─────────┬──────────┐
    ↓           ↓         ↓          ↓
TextWidget  NestedForm  Checkbox  CustomWidget
(基本类型)  (对象数组)  (枚举数组) (自定义)
```

### 2.2 与现有架构的对称性

```typescript
// 类型系统的对称设计
{
  'string'  → TextWidget          // 处理字符串
  'number'  → NumberWidget        // 处理数字
  'boolean' → CheckboxWidget      // 处理布尔值
  'object'  → NestedFormWidget    // 处理对象
  'array'   → ArrayFieldWidget    // 处理数组 ✨
}
```

### 2.3 职责划分

| 组件               | 职责                                  | 处理的数据类型        |
| ------------------ | ------------------------------------- | --------------------- |
| `NestedFormWidget` | 渲染单个对象                          | `{ key: value }`      |
| `ArrayFieldWidget` | 管理数组，为每个元素选择合适的 Widget | `[item1, item2, ...]` |

---

## 3. 核心特性

### 3.1 基本类型数组的数据包装（重要）

**⚠️ 关键特性**：为了避免 react-hook-form 的 `useFieldArray` 过滤掉基本类型的空值（空字符串、0、false），ArrayFieldWidget 会将基本类型包装成对象。

**内部数据结构**：

```typescript
// 用户看到的是字符串输入框
// Schema
{
  type: 'array',
  items: { type: 'string' }
}

// 但内部存储为对象数组
[
  { value: 'tag1' },
  { value: 'tag2' }
]
```

**字段路径格式**：

```typescript
// 基本类型数组的字段路径会自动添加 .value 后缀
`${arrayName}.${index}.value`

// 示例
'tags.0.value'  // 第一个标签的值
'tags.1.value'  // 第二个标签的值
```

**表单提交时的数据转换**：

```typescript
const handleSubmit = (data: any) => {
  // 方式 1: 转换为纯数组（推荐）
  const pureTags = data.tags.map((item: any) => item.value);
  console.log(pureTags); // ['tag1', 'tag2']

  // 方式 2: 在后端接收时进行解包处理
};
```

**为什么需要包装？**
- react-hook-form 的 useFieldArray 在处理基本类型时，会过滤掉"假值"（空字符串、0、false）
- 包装成对象后，即使 value 为空，对象本身也不会被过滤
- 这确保了数组项的稳定性和可编辑性

---

### 3.2 智能 Widget 选择

根据 `items` 的配置自动选择最合适的渲染方式：

```typescript
// 1. 枚举数组 → 多选框组
{ type: 'array', items: { enum: ['A', 'B', 'C'] } }
// → CheckboxGroupWidget

// 2. 对象数组 → 嵌套表单
{ type: 'array', items: { type: 'object', properties: {...} } }
// → NestedFormWidget (for each item)

// 3. 基本类型数组 → 对应的基础 Widget
{ type: 'array', items: { type: 'string' } }
// → TextWidget (for each item)

// 4. 自定义 Widget 数组
{ type: 'array', items: { type: 'string', ui: { widget: 'color' } } }
// → ColorWidget (for each item)
```

### 3.3 完整的数组操作

- ✅ 添加元素
- ✅ 删除元素
- ✅ 移动元素（上移/下移）
- ✅ 拖拽排序（可选）
- ✅ 批量操作（可选）
- ✅ 最小/最大数量限制

#### 按钮禁用状态和用户提示

为了提供更好的用户体验，当操作按钮因限制而无法使用时，不会直接隐藏按钮，而是显示为禁用状态，并通过 Tooltip 告知用户原因：

**添加按钮**：
- 当达到 `maxItems` 限制时，按钮禁用
- Tooltip 显示："已达到最大数量限制"

**删除按钮**：
- 当达到 `minItems` 限制时，按钮禁用
- Tooltip 显示："已达到最小数量限制"

**上移按钮**：
- 当项目已是第一项时，按钮禁用
- Tooltip 显示："已是第一项"

**下移按钮**：
- 当项目已是最后一项时，按钮禁用
- Tooltip 显示："已是最后一项"

**设计优势**：
- ✅ 用户可以看到所有可用的操作，即使暂时无法使用
- ✅ 通过 Tooltip 清晰地告知用户为什么按钮被禁用
- ✅ 避免按钮突然出现或消失造成的困惑
- ✅ 提供一致的用户界面体验

### 3.4 两种渲染模式

#### 模式 1：静态模式（Static Mode）

**适用场景**：

- 枚举数组（多选框组）
- 固定数量的数组项

**特点**：

- ❌ 不能添加新项
- ❌ 不能删除现有项
- ✅ 可以修改现有项的值

**示例 1：枚举数组（多选框组）**

```typescript
// Schema
{
  type: 'array',
  items: {
    type: 'string',
    enum: ['React', 'Vue', 'Angular']
  }
  // arrayMode 自动推断为 'static'
}

// 渲染效果
☑ React
☑ Vue
☐ Angular
```

**示例 2：固定数量的数组**

```typescript
// Schema
{
  type: 'array',
  items: { type: 'string' },
  ui: {
    arrayMode: 'static'  // 显式指定为 static
  }
}

// 渲染效果（假设已有 2 项）
[Item 1: ________]
[Item 2: ________]
// 没有添加/删除按钮
```

#### 模式 2：动态模式（Dynamic Mode）

**适用场景**：

- 动态列表
- 可变数量的数组

**特点**：

- ✅ 可以添加新项
- ✅ 可以删除现有项
- ✅ 可以修改现有项的值
- ✅ 可以移动项（上移/下移）

**示例**：

```typescript
// Schema
{
  type: 'array',
  items: { type: 'string' },
  ui: {
    arrayMode: 'dynamic'  // 显式指定为 dynamic
  }
}

// 渲染效果
[Item 1: ________] [删除]
[Item 2: ________] [删除]
[+ 添加]
```

#### 只读模式（Readonly）

**特点**：

- ❌ 不能添加新项
- ❌ 不能删除现有项
- ❌ 不能修改现有项的值
- 优先级高于 `arrayMode`

**示例**：

```typescript
// Schema
{
  type: 'array',
  items: { type: 'string' },
  ui: {
    arrayMode: 'dynamic'  // 即使设置为 dynamic
  }
}

// 在表单中使用
<DynamicForm
  schema={schema}
  readonly={true}  // readonly 优先级更高
/>

// 渲染效果
[Item 1: value1]  // 只读显示，无操作按钮
[Item 2: value2]
```

#### 模式对比表

| 特性     | Dynamic 模式 | Static 模式   | Readonly |
| -------- | ------------ | ------------- | -------- |
| 添加项   | ✅           | ❌            | ❌       |
| 删除项   | ✅           | ❌            | ❌       |
| 修改项   | ✅           | ✅            | ❌       |
| 移动项   | ✅           | ❌            | ❌       |
| 适用场景 | 动态列表     | 枚举/固定数量 | 完全只读 |

---

### 3.5 与 react-hook-form 深度集成

使用 `useFieldArray` hook 管理数组状态：

```typescript
const { fields, append, remove, move } = useFieldArray({
  control,
  name: fieldName,
});
```

---

### 3.6 虚拟滚动优化

**适用场景**：当数组包含大量元素（建议 50+ 项）时，启用虚拟滚动可以显著提升性能。

**核心特性**：
- ✅ 只渲染可见区域的元素
- ✅ 支持动态高度
- ✅ 流畅的滚动体验
- ✅ 基于 `react-virtuoso` 实现

#### 配置方式

通过 `ui.widgetProps` 配置虚拟滚动：

```typescript
{
  type: 'array',
  title: 'Large Dataset',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      email: { type: 'string', title: 'Email' }
    }
  },
  ui: {
    widget: 'array',
    widgetProps: {
      enableVirtualScroll: true,      // 启用虚拟滚动
      virtualScrollHeight: 400,       // 滚动容器高度（像素）
      addButtonText: 'Add Item'       // 可选：自定义添加按钮文本
    }
  }
}
```

#### 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enableVirtualScroll` | boolean | false | 是否启用虚拟滚动 |
| `virtualScrollHeight` | number | 400 | 滚动容器高度（像素） |
| `addButtonText` | string | 'Add' | 添加按钮文本 |

#### 性能对比

| 数组大小 | 不使用虚拟滚动 | 使用虚拟滚动 |
|---------|---------------|-------------|
| 50 项   | 流畅          | 流畅        |
| 100 项  | 轻微卡顿      | 流畅        |
| 500 项  | 明显卡顿      | 流畅        |
| 1000+ 项 | 严重卡顿     | 流畅        |

#### 使用建议

1. **何时启用**：
   - 数组元素超过 50 项
   - 每个元素包含复杂的表单字段
   - 用户需要频繁滚动查看数据

2. **何时不启用**：
   - 数组元素少于 30 项
   - 需要同时看到所有元素（如打印预览）
   - 元素高度变化非常频繁

3. **最佳实践**：
   - 根据实际数据量调整 `virtualScrollHeight`
   - 对于复杂表单，建议设置较大的高度（500-600px）
   - 简单列表可以使用较小的高度（300-400px）

#### 完整示例

```typescript
const schema = {
  type: 'object',
  properties: {
    users: {
      type: 'array',
      title: 'User List (1000+ items)',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', title: 'ID' },
          name: { type: 'string', title: 'Name' },
          email: { type: 'string', title: 'Email', format: 'email' },
          role: {
            type: 'string',
            title: 'Role',
            enum: ['admin', 'user', 'guest'],
            enumNames: ['Admin', 'User', 'Guest']
          }
        },
        required: ['name', 'email']
      },
      ui: {
        widget: 'array',
        widgetProps: {
          enableVirtualScroll: true,
          virtualScrollHeight: 500,
          addButtonText: 'Add User'
        }
      }
    }
  }
};

// 使用
<DynamicForm
  schema={schema}
  defaultValues={{
    users: generateLargeDataset(1000) // 1000 条数据
  }}
  onSubmit={handleSubmit}
/>
```

---

## 4. 类型定义和接口设计

### 4.1 组件 Props 定义

**重要说明**：

数组特有配置（如 `arrayMode`、`showAddButton`、`addButtonText` 等）**不是通过 Props 直接传递的**，而是通过 `schema.ui` 配置传递。ArrayFieldWidget 内部会从 `schema.ui` 中读取这些配置。

**实际的 Props 接口**：

```typescript
// src/components/DynamicForm/widgets/ArrayFieldWidget.tsx

export interface ArrayFieldWidgetProps extends FieldWidgetProps {
  // 数组 schema（必须是 array 类型）
  schema: ExtendedJSONSchema & {
    type: 'array';
    items: ExtendedJSONSchema;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
  };

  // 当前数组值
  value?: any[];

  // 值变化回调
  onChange?: (value: any[]) => void;

  // 基础配置
  disabled?: boolean;
  readonly?: boolean;

  // 布局配置（继承自父级或全局配置）
  layout?: 'vertical' | 'horizontal' | 'inline';
  labelWidth?: number | string;
}
```

**数组特有配置通过 schema.ui 传递**：

```typescript
// 使用示例
const schema = {
  type: 'array',
  items: { type: 'string' },
  minItems: 1,
  maxItems: 5,
  ui: {
    // 这些配置在 schema.ui 中定义
    arrayMode: 'dynamic',
    showAddButton: true,
    addButtonText: '添加项',
    emptyText: '暂无数据',
    // ... 其他配置
  }
};
```

### 4.2 扩展的 UIConfig 类型

```typescript
// src/types/schema.ts

export interface UIConfig {
  // ... 现有属性

  // 数组特有配置
  arrayMode?: 'dynamic' | 'static';
  showAddButton?: boolean;
  showRemoveButton?: boolean;
  showMoveButtons?: boolean;
  enableDragSort?: boolean;
  addButtonText?: string;
  removeButtonText?: string;
  emptyText?: string;
  itemLayout?: 'vertical' | 'horizontal' | 'inline';
}
```

---

## 5. Widget 选择逻辑

### 5.1 智能选择算法

```typescript
// src/components/DynamicForm/widgets/ArrayFieldWidget.tsx

/**
 * 根据 items schema 决定使用什么 widget 渲染数组元素
 */
function determineItemWidget(itemsSchema: ExtendedJSONSchema): WidgetType {
  // 优先级 1: 显式指定了 widget
  if (itemsSchema.ui?.widget) {
    return itemsSchema.ui.widget;
  }

  // 优先级 2: 对象类型 → 嵌套表单
  if (itemsSchema.type === 'object') {
    return 'nested-form';
  }

  // 优先级 3: 基本类型 → 对应的基础 widget
  switch (itemsSchema.type) {
    case 'string':
      // 根据 format 进一步判断
      if (itemsSchema.format === 'email') return 'email';
      if (itemsSchema.format === 'uri') return 'url';
      if (itemsSchema.format === 'date') return 'date';
      if (itemsSchema.format === 'date-time') return 'datetime';
      if (itemsSchema.format === 'time') return 'time';
      return 'text';

    case 'number':
    case 'integer':
      return 'number';

    case 'boolean':
      return 'checkbox';

    default:
      return 'text';
  }
}
```

**注意：** 枚举数组（items 有 enum）不在此函数中处理，而是在 ArrayFieldWidget 内部通过 `determineArrayMode()` 判断为 static 模式后，直接渲染为多选框组。

### 5.2 渲染模式判断

```typescript
/**
 * 判断应该使用哪种渲染模式
 */
function determineArrayMode(schema: ExtendedJSONSchema): 'static' | 'dynamic' {
  // 1. 显式指定了 arrayMode
  if (schema.ui?.arrayMode) {
    return schema.ui.arrayMode;
  }

  // 2. 如果 items 有 enum，默认使用 static 模式（多选框组，不可增删）
  if (schema.items && typeof schema.items === 'object') {
    const items = schema.items as ExtendedJSONSchema;
    if (items.enum && items.enum.length > 0) {
      return 'static';
    }
  }

  // 3. 默认使用 dynamic 模式（可增删的列表）
  return 'dynamic';
}
```

**模式说明**：

- **`static` 模式**：不可增删数组项，但可以修改现有项的值
  - 适用场景：枚举数组（多选框组）、固定数量的数组
  - 特点：没有添加/删除按钮，只能修改现有项

- **`dynamic` 模式**：可以增删数组项
  - 适用场景：动态列表、可变数量的数组
  - 特点：有添加/删除按钮，可以自由增删项

- **`readonly` 属性**：完全只读
  - 不可增删，也不可修改现有项的值
  - 优先级高于 `arrayMode`

---

## 6. 支持的数组类型

### 6.1 基本类型数组

#### 字符串数组

```typescript
// Schema
{
  type: 'array',
  title: '标签列表',
  items: {
    type: 'string',
    minLength: 1,
    maxLength: 20
  },
  minItems: 1,
  maxItems: 5,
  ui: {
    arrayMode: 'dynamic',  // 显式指定为动态模式（可增删）
    addButtonText: '添加标签'
  }
}

// 渲染效果
标签列表
[标签1: ________] [删除]
[标签2: ________] [删除]
[+ 添加标签]

// ⚠️ 重要：实际的内部数据结构
// 由于 react-hook-form 的 useFieldArray 会过滤掉基本类型的空值，
// ArrayFieldWidget 将基本类型包装成对象
[
  { value: 'tag1' },
  { value: 'tag2' }
]

// 如果需要纯数组格式，需要在提交时转换
const handleSubmit = (data: any) => {
  const pureTags = data.tags.map((item: any) => item.value);
  console.log(pureTags); // ['tag1', 'tag2']
};
```

#### ⚠️ 重要：基本类型数组的数据结构

由于 react-hook-form 的 `useFieldArray` 会过滤掉基本类型的空值（如空字符串、0、false），`ArrayFieldWidget` 会将基本类型包装成对象：

**内部数据结构：**
```typescript
// 用户看到的是字符串输入框，但内部存储为：
[
  { value: 'tag1' },
  { value: 'tag2' }
]
```

**表单提交时的数据转换：**
```typescript
const handleSubmit = (data: any) => {
  // 方式 1: 转换为纯数组（推荐）
  const pureTags = data.tags.map((item: any) => item.value);

  // 方式 2: 在后端接收时进行解包处理
  // 后端: tags.map(item => item.value)

  console.log(pureTags); // ['tag1', 'tag2']
};
```

**为什么需要包装？**
- react-hook-form 的 useFieldArray 在处理基本类型时，会过滤掉"假值"（空字符串、0、false）
- 包装成对象后，即使 value 为空，对象本身也不会被过滤
- 这确保了数组项的稳定性和可编辑性

#### 数字数组

```typescript
// Schema
{
  type: 'array',
  title: '分数列表',
  items: {
    type: 'number',
    minimum: 0,
    maximum: 100
  },
  ui: {
    arrayMode: 'dynamic'  // 可增删
  }
}

// 数据结构
[85, 92, 78]
```

### 6.2 枚举数组（多选）

```typescript
// Schema
{
  type: 'array',
  title: '技能',
  items: {
    type: 'string',
    enum: ['React', 'Vue', 'Angular', 'Svelte'],
    enumNames: ['React', 'Vue.js', 'Angular', 'Svelte']
  },
  uniqueItems: true
}

// 渲染效果（自动使用 static 模式）
技能
☑ React
☑ Vue.js
☐ Angular
☐ Svelte

// 数据结构
['React', 'Vue']
```

### 6.3 对象数组

```typescript
// Schema
{
  type: 'array',
  title: '联系人',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string', title: '姓名' },
      phone: { type: 'string', title: '电话' },
      email: { type: 'string', title: '邮箱', format: 'email' }
    },
    required: ['name', 'phone']
  },
  minItems: 1,
  ui: {
    arrayMode: 'dynamic',  // 可增删
    addButtonText: '添加联系人'
  }
}

// 渲染效果
联系人
┌─────────────────────────────┐
│ 姓名: [________]            │
│ 电话: [________]            │
│ 邮箱: [________]            │
│                  [删除]     │
└─────────────────────────────┘
[+ 添加联系人]

// 数据结构
[
  { name: '张三', phone: '13800138000', email: 'zhang@example.com' },
  { name: '李四', phone: '13900139000', email: 'li@example.com' }
]
```

### 6.4 自定义 Widget 数组

```typescript
// Schema
{
  type: 'array',
  title: '颜色方案',
  items: {
    type: 'string',
    ui: {
      widget: 'color-picker'
    }
  },
  ui: {
    arrayMode: 'dynamic',  // 可增删
    addButtonText: '添加颜色'
  }
}

// 渲染效果
颜色方案
[🎨 #FF5733] [删除]
[🎨 #33FF57] [删除]
[+ 添加颜色]

// 数据结构
['#FF5733', '#33FF57']
```

---

## 7. 组件实现

### 7.1 核心组件结构

```typescript
// src/components/DynamicForm/widgets/ArrayFieldWidget.tsx

import React, { forwardRef, useMemo } from 'react';
import { useFormContext, useFieldArray, Controller } from 'react-hook-form';
import { Button, Card, Tooltip } from '@blueprintjs/core';
import { FieldRegistry } from '../core/FieldRegistry';
import type { ArrayFieldWidgetProps } from './types';

export const ArrayFieldWidget = forwardRef<HTMLDivElement, ArrayFieldWidgetProps>(
  ({ name, schema, disabled, readonly }, ref) => {
    const { control } = useFormContext();

    // 使用 useFieldArray 管理数组
    const { fields, append, remove, move } = useFieldArray({
      control,
      name,
    });

    // 判断渲染模式
    const arrayMode = useMemo(() => determineArrayMode(schema), [schema]);

    // 如果是 static 模式且 items 有 enum（枚举数组），使用 CheckboxGroupWidget
    if (
      arrayMode === 'static' &&
      schema.items &&
      typeof schema.items === 'object' &&
      (schema.items as ExtendedJSONSchema).enum
    ) {
      return <CheckboxGroupWidget name={name} schema={schema} />;
    }

    // Dynamic 或 Static 模式：渲染为列表
    // - dynamic: 可增删
    // - static: 不可增删，但可修改现有项
    // - readonly: 完全只读（不可增删，也不可修改）
    // - disabled: 禁用状态（不可增删，也不可修改）
    const canAddRemove = !disabled && !readonly && arrayMode === 'dynamic';

    return (
      <div ref={ref} className="array-field-widget">
        {/* 数组项列表 */}
        {fields.map((field, index) => (
          <ArrayItem
            key={field.id}
            name={`${name}.${index}`}
            index={index}
            schema={schema.items as ExtendedJSONSchema}
            onRemove={canAddRemove ? () => remove(index) : undefined}
            onMoveUp={canAddRemove ? () => move(index, index - 1) : undefined}
            onMoveDown={canAddRemove ? () => move(index, index + 1) : undefined}
            statusMap={{
              isAtMinLimit: fields.length <= minItems,
              isFirstItem: index === 0,
              isLastItem: index === fields.length - 1,
            }}
            disabled={disabled}
            readonly={readonly}
          />
        ))}

        {/* 添加按钮 - 使用 Tooltip 显示禁用原因 */}
        {canAddRemove && (
          <Tooltip
            content={schema.maxItems && fields.length >= schema.maxItems ? '已达到最大数量限制' : ''}
            disabled={!schema.maxItems || fields.length < schema.maxItems}
          >
            <Button
              icon="add"
              intent="primary"
              onClick={() => append(getDefaultValue(schema.items))}
              disabled={schema.maxItems !== undefined && fields.length >= schema.maxItems}
            >
              {schema.ui?.addButtonText || '添加'}
            </Button>
          </Tooltip>
        )}

        {/* 空状态提示 */}
        {fields.length === 0 && schema.ui?.emptyText && (
          <div className="array-empty-text">{schema.ui.emptyText}</div>
        )}
      </div>
    );
  }
);

ArrayFieldWidget.displayName = 'ArrayFieldWidget';
```

### 7.2 ArrayItem 子组件

```typescript
// src/components/DynamicForm/widgets/ArrayFieldWidget.tsx

/**
 * ArrayItem 状态映射
 */
interface ArrayItemStatusMap {
  isAtMinLimit?: boolean; // 是否达到最小数量限制
  isFirstItem?: boolean;  // 是否是第一项
  isLastItem?: boolean;   // 是否是最后一项
}

/**
 * ArrayItem 子组件 Props
 */
interface ArrayItemProps {
  name: string;
  index: number;
  schema: ExtendedJSONSchema;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  statusMap?: ArrayItemStatusMap;  // 状态映射，用于控制按钮禁用和 tooltip
  disabled?: boolean;
  readonly?: boolean;
  layout?: 'vertical' | 'horizontal' | 'inline';
  labelWidth?: number | string;
}

const ArrayItem: React.FC<ArrayItemProps> = ({
  name,
  index,
  schema,
  onRemove,
  onMoveUp,
  onMoveDown,
  statusMap,
  disabled,
  readonly,
  layout,
  labelWidth,
}) => {
  const { control } = useFormContext();

  // 根据 schema 获取对应的 Widget
  const itemWidget = useMemo(() => determineItemWidget(schema), [schema]);
  const WidgetComponent = FieldRegistry.getWidget(itemWidget);

  if (!WidgetComponent) {
    console.error(`Widget "${itemWidget}" not found in registry`);
    return null;
  }

  // 如果是对象类型，使用特殊渲染（Card 容器）
  // ⚠️ 重要：传递 noCard={true} 给 NestedFormWidget，避免双层 Card 嵌套
  if (schema.type === 'object') {
    return (
      <Card className="array-item array-item-object">
        {/* 对象数组的渲染逻辑 */}
        <WidgetComponent
          name={name}
          schema={schema}
          disabled={disabled}
          readonly={readonly}
          noCard={true}  // 避免 NestedFormWidget 再渲染一层 Card
        />
      </Card>
    );
  }

  // 基本类型：渲染为简单的输入框 + 操作按钮
  // ⚠️ 重要：基本类型使用 `${name}.value` 作为字段路径
  return (
    <div className="array-item array-item-simple">
      <div className="array-item-content">
        {/* 索引标签 */}
        <div className="array-item-index">#{index + 1}</div>

        {/* 字段内容 */}
        <div className="array-item-field">
          <Controller
            name={`${name}.value`}  // ← 重要：添加 .value 后缀
            control={control}
            rules={validationRules}
            render={({ field: controllerField }) => (
              <WidgetComponent
                name={`${name}.value`}
                schema={schema}
                value={controllerField.value}
                onChange={controllerField.onChange}
                disabled={disabled}
                readonly={readonly}
              />
            )}
          />
        </div>
      </div>

      {/* 操作按钮 - 使用 Tooltip 显示禁用原因 */}
      {(onMoveUp || onMoveDown || onRemove) && (
        <div className="array-item-actions">
          {onMoveUp && (
            <Tooltip
              content={statusMap?.isFirstItem ? '已是第一项' : ''}
              disabled={!statusMap?.isFirstItem}
            >
              <Button
                icon="arrow-up"
                minimal
                small
                onClick={onMoveUp}
                disabled={disabled || statusMap?.isFirstItem}
                title="上移"
              />
            </Tooltip>
          )}
          {onMoveDown && (
            <Tooltip
              content={statusMap?.isLastItem ? '已是最后一项' : ''}
              disabled={!statusMap?.isLastItem}
            >
              <Button
                icon="arrow-down"
                minimal
                small
                onClick={onMoveDown}
                disabled={disabled || statusMap?.isLastItem}
                title="下移"
              />
            </Tooltip>
          )}
          {onRemove && (
            <Tooltip
              content={statusMap?.isAtMinLimit ? '已达到最小数量限制' : ''}
              disabled={!statusMap?.isAtMinLimit}
            >
              <Button
                icon="trash"
                minimal
                small
                intent="danger"
                onClick={onRemove}
                disabled={disabled || statusMap?.isAtMinLimit}
                title="删除"
              />
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
};
```

### 7.3 辅助函数

```typescript
/**
 * 获取数组元素的默认值
 */
function getDefaultValue(itemsSchema: ExtendedJSONSchema): any {
  if (itemsSchema.default !== undefined) {
    return itemsSchema.default;
  }

  switch (itemsSchema.type) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'object':
      return {};
    case 'array':
      return [];
    default:
      return null;
  }
}
```

---

## 8. 使用示例

### 8.1 基本字符串数组

```typescript
import { DynamicForm } from '@/components/DynamicForm';

const schema = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      title: '标签',
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 20,
      },
      minItems: 1,
      maxItems: 5,
      ui: {
        arrayMode: 'dynamic',  // 可增删
        addButtonText: '添加标签',
        emptyText: '暂无标签，点击下方按钮添加',
      },
    },
  },
};

function TagsForm() {
  const handleSubmit = (data: any) => {
    console.log('提交的数据:', data);
    // { tags: ['React', 'TypeScript', 'Node.js'] }
  };

  return (
    <DynamicForm
      schema={schema}
      defaultValues={{ tags: ['React'] }}
      onSubmit={handleSubmit}
    />
  );
}
```

### 8.2 枚举数组（多选框）

```typescript
const schema = {
  type: 'object',
  properties: {
    skills: {
      type: 'array',
      title: '技能',
      items: {
        type: 'string',
        enum: ['React', 'Vue', 'Angular', 'Svelte', 'Node.js', 'Python'],
        enumNames: ['React', 'Vue.js', 'Angular', 'Svelte', 'Node.js', 'Python'],
      },
      uniqueItems: true,
      minItems: 1,
    },
  },
};

// 自动渲染为多选框组
// ☑ React
// ☐ Vue.js
// ☑ Angular
// ...
```

### 8.3 对象数组（联系人列表）

```typescript
const schema = {
  type: 'object',
  properties: {
    contacts: {
      type: 'array',
      title: '联系人',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: '姓名',
            minLength: 1,
          },
          phone: {
            type: 'string',
            title: '电话',
            pattern: '^1[3-9]\\d{9}$',
          },
          email: {
            type: 'string',
            title: '邮箱',
            format: 'email',
          },
          type: {
            type: 'string',
            title: '类型',
            enum: ['personal', 'work'],
            enumNames: ['个人', '工作'],
          },
        },
        required: ['name', 'phone'],
      },
      minItems: 1,
      ui: {
        arrayMode: 'dynamic',  // 可增删
        addButtonText: '添加联系人',
        emptyText: '暂无联系人',
      },
    },
  },
};

function ContactsForm() {
  const handleSubmit = (data: any) => {
    console.log('联系人列表:', data.contacts);
  };

  return (
    <DynamicForm
      schema={schema}
      defaultValues={{
        contacts: [
          {
            name: '张三',
            phone: '13800138000',
            email: 'zhang@example.com',
            type: 'personal',
          },
        ],
      }}
      onSubmit={handleSubmit}
    />
  );
}
```

### 8.4 嵌套数组（数组中的对象包含数组）

```typescript
const schema = {
  type: 'object',
  properties: {
    departments: {
      type: 'array',
      title: '部门列表',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: '部门名称',
          },
          employees: {
            type: 'array',
            title: '员工',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', title: '姓名' },
                position: { type: 'string', title: '职位' },
              },
            },
            ui: {
              arrayMode: 'dynamic', // 员工列表可增删
              addButtonText: '添加员工',
            },
          },
        },
      },
      ui: {
        arrayMode: 'dynamic', // 部门列表可增删
        addButtonText: '添加部门',
      },
    },
  },
};

// 数据结构
{
  departments: [
    {
      name: '技术部',
      employees: [
        { name: '张三', position: '前端工程师' },
        { name: '李四', position: '后端工程师' },
      ],
    },
  ];
}
```

### 8.5 自定义 Widget 数组

```typescript
const schema = {
  type: 'object',
  properties: {
    colors: {
      type: 'array',
      title: '主题颜色',
      items: {
        type: 'string',
        ui: {
          widget: 'color-picker',
        },
      },
      minItems: 2,
      maxItems: 5,
      ui: {
        arrayMode: 'dynamic', // 可增删
        addButtonText: '添加颜色',
      },
    },
  },
};
```

---

## 9. 与现有组件的关系

### 9.1 组件层次结构

```
DynamicForm
  └─ SchemaParser (解析 schema)
      └─ FieldRegistry (获取对应的 Widget)
          ├─ TextWidget (type: 'string')
          ├─ NumberWidget (type: 'number')
          ├─ CheckboxWidget (type: 'boolean')
          ├─ NestedFormWidget (type: 'object')
          └─ ArrayFieldWidget (type: 'array') ✨
              ├─ CheckboxGroupWidget (items.enum 存在)
              └─ ArrayItem (dynamic 模式)
                  └─ 根据 items 类型选择 Widget
                      ├─ TextWidget (items.type: 'string')
                      ├─ NumberWidget (items.type: 'number')
                      ├─ NestedFormWidget (items.type: 'object')
                      └─ 其他 Widget
```

### 9.2 FieldRegistry 注册

```typescript
// src/components/DynamicForm/core/FieldRegistry.ts

import { ArrayFieldWidget } from '../widgets/ArrayFieldWidget';

// 注册 ArrayFieldWidget
FieldRegistry.register('array', ArrayFieldWidget);
```

### 9.3 SchemaParser 集成

```typescript
// src/components/DynamicForm/core/SchemaParser.ts

export class SchemaParser {
  static parseField(name: string, schema: ExtendedJSONSchema, required: boolean): FieldConfig {
    // ... 其他类型处理

    // 处理数组类型
    if (schema.type === 'array') {
      // 所有数组类型统一使用 ArrayFieldWidget
      // ArrayFieldWidget 内部会根据 items.enum 自动判断渲染模式（static/dynamic）
      // 不再需要在这里特殊处理枚举数组
      return {
        name,
        widget: 'array',
        schema,
        required,
      };
    }

    // ... 其他类型处理
  }
}
```

### 9.4 与 NestedFormWidget 的协作

当数组元素是对象类型时，`ArrayFieldWidget` 会为每个元素创建 `NestedFormWidget` 实例。

**重要**：为了避免双层 Card 嵌套（ArrayItem Card + NestedFormWidget Card），ArrayItem 在调用 NestedFormWidget 时会传递 `noCard={true}` 参数：

```typescript
// ArrayFieldWidget 内部
{fields.map((field, index) => {
  const itemSchema = schema.items as ExtendedJSONSchema;

  if (itemSchema.type === 'object') {
    return (
      <Card className="array-item array-item-object">
        {/* 使用 NestedFormWidget 渲染对象，传递 noCard 避免双层 Card */}
        <NestedFormWidget
          key={field.id}
          name={`${name}.${index}`}
          schema={itemSchema}
          noCard={true}  // 避免双层 Card 嵌套
        />
      </Card>
    );
  }

  // 其他类型使用对应的 Widget
})}
```

---

## 10. 实施路线图

### 10.1 第一阶段：基础功能（优先级：高）

**目标**：实现基本的数组渲染和操作功能

**任务清单**：

1. **创建 ArrayFieldWidget 组件**
   - [ ] 创建组件文件和类型定义
   - [ ] 实现基本的组件结构
   - [ ] 集成 react-hook-form 的 useFieldArray

2. **实现基本类型数组支持**
   - [ ] 支持字符串数组
   - [ ] 支持数字数组
   - [ ] 支持布尔数组

3. **实现基本操作**
   - [ ] 添加元素功能
   - [ ] 删除元素功能
   - [ ] 显示数组索引

4. **集成到现有系统**
   - [ ] 在 FieldRegistry 中注册
   - [ ] 更新 SchemaParser 的数组处理逻辑
   - [ ] 添加基本样式

**预计时间**：2-3 天

---

### 10.2 第二阶段：对象数组支持（优先级：高）

**目标**：支持对象数组，与 NestedFormWidget 协作

**任务清单**：

1. **实现对象数组渲染**
   - [ ] 检测 items.type === 'object'
   - [ ] 为每个数组元素创建 NestedFormWidget
   - [ ] 处理嵌套路径

2. **优化 UI 展示**
   - [ ] 为对象数组添加 Card 容器
   - [ ] 优化操作按钮布局
   - [ ] 添加折叠/展开功能（可选）

3. **测试和调试**
   - [ ] 编写单元测试
   - [ ] 测试多层嵌套场景
   - [ ] 测试数据同步

**预计时间**：2-3 天

---

### 10.3 第三阶段：枚举数组支持（优先级：中）

**目标**：支持枚举数组，自动渲染为多选框组

**任务清单**：

1. **实现渲染模式判断**
   - [ ] 实现 determineArrayMode 函数
   - [ ] 检测 items.enum 存在时使用 static 模式

2. **集成 CheckboxGroupWidget**
   - [ ] 创建或复用 CheckboxGroupWidget
   - [ ] 处理枚举值和显示名称的映射
   - [ ] 处理 uniqueItems 验证

3. **SchemaParser 优化**
   - [ ] 更新数组类型的解析逻辑
   - [ ] 支持显式指定 arrayMode

**预计时间**：1-2 天

---

### 10.4 第四阶段：高级功能（优先级：中）

**目标**：添加移动、排序等高级功能

**任务清单**：

1. **实现移动功能**
   - [ ] 添加上移/下移按钮
   - [ ] 使用 useFieldArray 的 move 方法
   - [ ] 处理边界情况（第一项、最后一项）

2. **实现拖拽排序（可选）**
   - [ ] 集成拖拽库（如 react-beautiful-dnd）
   - [ ] 实现拖拽排序逻辑
   - [ ] 添加拖拽视觉反馈

3. **添加批量操作（可选）**
   - [ ] 批量删除
   - [ ] 批量复制
   - [ ] 全选/反选

**预计时间**：2-3 天

---

### 10.5 第五阶段：验证和优化（优先级：中）

**目标**：完善验证和性能优化

**任务清单**：

1. **实现数组验证**
   - [ ] minItems 验证
   - [ ] maxItems 验证
   - [ ] uniqueItems 验证
   - [ ] 自定义验证规则

2. **性能优化**
   - [ ] 使用 React.memo 优化 ArrayItem
   - [ ] 优化大数组渲染性能
   - [ ] 添加虚拟滚动（可选）

3. **错误处理**
   - [ ] 显示数组级别的错误
   - [ ] 显示元素级别的错误
   - [ ] 优化错误提示 UI

**预计时间**：2-3 天

---

### 10.6 第六阶段：文档和测试（优先级：高）

**目标**：完善文档和测试覆盖

**任务清单**：

1. **编写文档**
   - [x] 设计方案文档
   - [ ] API 文档
   - [ ] 使用示例
   - [ ] 最佳实践指南

2. **编写测试**
   - [ ] 单元测试（组件测试）
   - [ ] 集成测试（与表单系统集成）
   - [ ] E2E 测试（用户操作流程）

3. **代码审查和优化**
   - [ ] 代码审查
   - [ ] 性能测试
   - [ ] 可访问性测试

**预计时间**：2-3 天

---

### 10.7 总体时间估算

| 阶段               | 预计时间     | 优先级 |
| ------------------ | ------------ | ------ |
| 第一阶段：基础功能 | 2-3 天       | 高     |
| 第二阶段：对象数组 | 2-3 天       | 高     |
| 第三阶段：枚举数组 | 1-2 天       | 中     |
| 第四阶段：高级功能 | 2-3 天       | 中     |
| 第五阶段：验证优化 | 2-3 天       | 中     |
| 第六阶段：文档测试 | 2-3 天       | 高     |
| **总计**           | **11-17 天** | -      |

**建议实施顺序**：

1. 第一阶段 + 第二阶段（核心功能）
2. 第六阶段（文档和基础测试）
3. 第三阶段（枚举数组）
4. 第四阶段 + 第五阶段（高级功能和优化）

---

## 11. 最佳实践

### 11.1 Schema 设计建议

#### 1. 明确数组元素类型

```typescript
// ✅ 好的做法：明确指定 items 类型
{
  type: 'array',
  items: {
    type: 'string',
    minLength: 1
  }
}

// ❌ 不好的做法：items 类型不明确
{
  type: 'array',
  items: {}
}
```

#### 2. 合理设置数组限制

```typescript
// ✅ 好的做法：设置合理的 minItems 和 maxItems
{
  type: 'array',
  items: { type: 'string' },
  minItems: 1,    // 至少一项
  maxItems: 10,   // 最多十项
  ui: {
    emptyText: '至少需要添加一项'
  }
}
```

#### 3. 为枚举数组提供 enumNames

```typescript
// ✅ 好的做法：提供友好的显示名称
{
  type: 'array',
  items: {
    type: 'string',
    enum: ['react', 'vue', 'angular'],
    enumNames: ['React', 'Vue.js', 'Angular']
  }
}
```

---

### 11.2 性能优化建议

#### 1. 使用 React.memo 优化 ArrayItem

```typescript
const ArrayItem = React.memo<ArrayItemProps>(
  ({ name, schema, index, ...props }) => {
    // 组件实现
  },
  (prevProps, nextProps) => {
    // 自定义比较逻辑
    return (
      prevProps.index === nextProps.index &&
      prevProps.disabled === nextProps.disabled &&
      isEqual(prevProps.schema, nextProps.schema)
    );
  }
);
```

#### 2. 避免在渲染中创建新对象

```typescript
// ❌ 不好的做法：每次渲染都创建新对象
<ArrayFieldWidget
  schema={schema}
  ui={{ addButtonText: '添加' }}  // 每次都是新对象
/>

// ✅ 好的做法：使用 useMemo 缓存
const uiConfig = useMemo(() => ({
  addButtonText: '添加'
}), []);

<ArrayFieldWidget schema={schema} ui={uiConfig} />
```

#### 3. 大数组使用虚拟滚动

```typescript
// 当数组元素超过 50 个时，考虑使用虚拟滚动
import { FixedSizeList } from 'react-window';

{fields.length > 50 ? (
  <FixedSizeList
    height={600}
    itemCount={fields.length}
    itemSize={80}
  >
    {({ index, style }) => (
      <div style={style}>
        <ArrayItem {...} />
      </div>
    )}
  </FixedSizeList>
) : (
  fields.map((field, index) => <ArrayItem {...} />)
)}
```

---

### 11.3 用户体验优化

#### 1. 提供清晰的空状态提示

```typescript
{
  type: 'array',
  items: { type: 'string' },
  ui: {
    emptyText: '暂无数据，点击下方按钮添加',
    addButtonText: '添加'
  }
}
```

#### 2. 为操作按钮添加确认

```typescript
const handleRemove = (index: number) => {
  if (fields.length === 1) {
    // 最后一项，提示用户
    if (!confirm('确定要删除最后一项吗？')) {
      return;
    }
  }
  remove(index);
};
```

#### 3. 显示数组索引或序号

```typescript
<div className="array-item-header">
  <span className="array-item-number">#{index + 1}</span>
  <span className="array-item-title">{schema.title}</span>
</div>
```

---

### 11.4 错误处理

#### 1. 显示数组级别的错误

```typescript
const { formState: { errors } } = useFormContext();
const arrayError = errors[name];

{arrayError && (
  <div className="array-error">
    {arrayError.message || '数组验证失败'}
  </div>
)}
```

#### 2. 显示元素级别的错误

```typescript
{fields.map((field, index) => {
  const itemError = errors[name]?.[index];

  return (
    <div key={field.id}>
      <ArrayItem {...} />
      {itemError && (
        <div className="array-item-error">
          第 {index + 1} 项有错误
        </div>
      )}
    </div>
  );
})}
```

---

## 12. 注意事项

### 12.1 数据结构注意事项

#### 1. 数组索引的稳定性

```typescript
// ⚠️ 注意：使用 useFieldArray 时，必须使用 field.id 作为 key
{fields.map((field, index) => (
  <ArrayItem
    key={field.id}  // ✅ 使用 field.id
    // key={index}  // ❌ 不要使用 index
    {...}
  />
))}
```

**原因**：使用 `field.id` 可以确保在数组元素移动或删除时，React 能正确追踪组件状态。

#### 2. 默认值的处理

```typescript
// ✅ 正确：为数组提供默认值
<DynamicForm
  schema={schema}
  defaultValues={{
    tags: []  // 空数组
  }}
/>

// ⚠️ 注意：不提供默认值可能导致 undefined 错误
<DynamicForm
  schema={schema}
  // tags 字段为 undefined
/>
```

#### 3. 嵌套路径的处理

```typescript
// 数组元素的字段名格式
`${arrayName}.${index}.${fieldName}`;

// 示例
('contacts.0.name');
('contacts.1.phone');
```

#### 4. 基本类型数组的数据包装

```typescript
// ⚠️ 重要：基本类型数组会被包装成对象
const schema = {
  type: 'array',
  items: { type: 'string' }
};

// 表单内部数据结构
{
  tags: [
    { value: 'tag1' },
    { value: 'tag2' }
  ]
}

// 如果需要纯数组格式，需要转换
const handleSubmit = (data: any) => {
  const pureTags = data.tags.map((item: any) => item.value);
  // 现在 pureTags = ['tag1', 'tag2']
};
```

**原因**：react-hook-form 的 useFieldArray 会过滤掉基本类型的空值（空字符串、0、false），为了避免这个问题，ArrayFieldWidget 将基本类型包装成对象。

**解决方案**：
1. 在表单提交时进行转换（推荐）
2. 在后端接收时进行解包处理
3. 使用对象数组代替基本类型数组

**字段路径**：
```typescript
// 基本类型数组的字段路径格式
`${arrayName}.${index}.value`;  // 注意：多了 .value 后缀

// 示例
('tags.0.value');  // 第一个标签的值
('tags.1.value');  // 第二个标签的值
```

---

### 12.2 性能注意事项

#### 1. 避免在数组中使用复杂的嵌套表单

```typescript
// ⚠️ 性能问题：三层嵌套
{
  type: 'array',
  items: {
    type: 'object',
    properties: {
      subArray: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            deepArray: {
              type: 'array',  // 三层嵌套，性能较差
              // ...
            }
          }
        }
      }
    }
  }
}

// ✅ 建议：最多两层嵌套
```

#### 2. 大数组的渲染优化

```typescript
// 当数组元素超过 100 个时：
// 1. 考虑分页
// 2. 考虑虚拟滚动
// 3. 考虑懒加载
```

---

### 12.3 验证注意事项

#### 1. uniqueItems 验证

```typescript
// ⚠️ 注意：uniqueItems 只对基本类型有效
{
  type: 'array',
  items: { type: 'string' },
  uniqueItems: true  // ✅ 对字符串数组有效
}

{
  type: 'array',
  items: { type: 'object', properties: {...} },
  uniqueItems: true  // ⚠️ 对对象数组可能无效（需要自定义验证）
}
```

#### 2. 数组元素的验证

```typescript
// 数组元素的验证规则在 items 中定义
{
  type: 'array',
  items: {
    type: 'string',
    minLength: 3,    // ✅ 每个元素至少 3 个字符
    maxLength: 20    // ✅ 每个元素最多 20 个字符
  },
  minItems: 1,       // ✅ 数组至少 1 个元素
  maxItems: 5        // ✅ 数组最多 5 个元素
}
```

---

### 12.4 与其他特性的兼容性

#### 1. 与路径透明化的兼容性

根据 `FIELD_PATH_FLATTENING.md` 文档：

```typescript
// ❌ 路径透明化不适用于数组类型
{
  type: 'array',
  ui: {
    flattenPath: true  // ❌ 无效
  }
}

// ✅ 数组应该使用 ArrayFieldWidget
{
  type: 'array',
  items: { type: 'string' }
}
```

#### 2. 与 UI 联动的兼容性

```typescript
// ✅ 数组字段可以使用 UI 联动
{
  type: 'object',
  properties: {
    enableTags: { type: 'boolean' },
    tags: {
      type: 'array',
      items: { type: 'string' },
      ui: {
        linkages: [{
          type: 'visibility',
          dependencies: ['enableTags'],
          condition: {
            field: 'enableTags',
            operator: '==',
            value: true
          }
        }]
      }
    }
  }
}
```

#### 3. 数组元素内部联动的实现方案

数组元素内部的联动需要特殊处理，因为涉及到相对路径和动态索引。

**详细设计请参考**：[数组字段联动设计方案](./ARRAY_FIELD_LINKAGE.md)

该文档详细描述了：
- 核心挑战（相对路径、动态索引、菱形依赖）
- 解决方案架构（模板依赖图方案）
- 基础场景（相对路径、绝对路径、菱形依赖）
- 复杂场景（混合依赖、跨数组依赖、嵌套数组、聚合计算）
- 完整的实现方案和最佳实践

**快速参考**：

**示例 1：相对路径依赖**

```typescript
{
  contacts: {
    type: 'array',
    items: {
      properties: {
        type: { type: 'string', enum: ['personal', 'work'] },
        companyName: {
          type: 'string',
          ui: {
            linkages: [{
              type: 'visibility',
              dependencies: ['./type'],  // 相对路径
              when: { field: './type', operator: '==', value: 'work' }
            }]
          }
        }
      }
    }
  }
}
```

**处理流程**：

1. Schema 解析：识别 `contacts.companyName` 的联动配置
2. 模板依赖：`contacts.companyName` → `contacts.type`
3. 运行时实例化：
   - `contacts.0.companyName` → `contacts.0.type`
   - `contacts.1.companyName` → `contacts.1.type`

**示例 2：绝对路径依赖（数组内依赖外部）**

```typescript
{
  enableVip: { type: 'boolean' },
  contacts: {
    type: 'array',
    items: {
      properties: {
        vipLevel: {
          type: 'string',
          ui: {
            linkages: [{
              type: 'visibility',
              dependencies: ['enableVip'],  // 绝对路径，指向外部
              when: { field: 'enableVip', operator: '==', value: true }
            }]
          }
        }
      }
    }
  }
}
```

**处理流程**：

1. Schema 解析：识别 `contacts.vipLevel` 的联动配置
2. 模板依赖：`contacts.vipLevel` → `enableVip`（外部字段）
3. 运行时实例化：
   - `contacts.0.vipLevel` → `enableVip`
   - `contacts.1.vipLevel` → `enableVip`

**示例 3：菱形依赖（复杂依赖关系）**

```typescript
{
  contacts: {
    type: 'array',
    items: {
      properties: {
        type: { type: 'string', enum: ['personal', 'work'] },
        showCompany: {
          type: 'boolean',
          ui: {
            linkages: [{
              type: 'value',
              dependencies: ['./type'],
              fulfill: { function: 'calcShowCompany' }
            }]
          }
        },
        showDepartment: {
          type: 'boolean',
          ui: {
            linkages: [{
              type: 'value',
              dependencies: ['./type'],
              fulfill: { function: 'calcShowDepartment' }
            }]
          }
        },
        workInfo: {
          type: 'string',
          ui: {
            linkages: [{
              type: 'visibility',
              dependencies: ['./showCompany', './showDepartment'],
              when: {
                and: [
                  { field: './showCompany', operator: '==', value: true },
                  { field: './showDepartment', operator: '==', value: true }
                ]
              }
            }]
          }
        }
      }
    }
  }
}
```

**依赖关系图**：

```
type (A)
    /      \
   /        \
  ↓          ↓
showCompany showDepartment
  (B)        (C)
   \        /
    \      /
     ↓    ↓
   workInfo (D)
```

**处理流程**：

1. **模板依赖图**：
   - `contacts.showCompany` → `contacts.type`
   - `contacts.showDepartment` → `contacts.type`
   - `contacts.workInfo` → `contacts.showCompany`, `contacts.showDepartment`

2. **拓扑排序**：`type` → `showCompany`, `showDepartment` → `workInfo`

3. **运行时实例化**（假设有 2 个元素）：
   - `contacts.0.type` 变化
   - 并行计算 `contacts.0.showCompany` 和 `contacts.0.showDepartment`
   - 计算 `contacts.0.workInfo`

---

### 12.5 常见问题

#### 问题 1：数组元素删除后，表单值没有更新

**原因**：没有正确使用 `useFieldArray` 的 `remove` 方法。

**解决方案**：

```typescript
// ✅ 使用 useFieldArray 的 remove 方法
const { fields, remove } = useFieldArray({ name: 'tags' });
remove(index);

// ❌ 不要直接修改 value
// setValue('tags', value.filter((_, i) => i !== index));
```

#### 问题 2：枚举数组没有渲染为多选框

**原因**：没有正确配置 `items.enum`。

**解决方案**：

```typescript
// ✅ 正确配置
{
  type: 'array',
  items: {
    type: 'string',
    enum: ['A', 'B', 'C']  // 必须有 enum
  }
}
```

#### 问题 3：对象数组的嵌套表单没有显示

**原因**：`items.type` 没有设置为 `'object'`。

**解决方案**：

```typescript
// ✅ 正确配置
{
  type: 'array',
  items: {
    type: 'object',  // 必须指定 type
    properties: {
      name: { type: 'string' }
    }
  }
}
```

---

## 总结

`ArrayFieldWidget` 是一个通用的数组字段渲染组件，具有以下核心优势：

### ✅ 核心优势

1. **统一的数组处理**：所有 `type: 'array'` 字段都由 `ArrayFieldWidget` 统一处理
2. **智能 Widget 选择**：根据 `items` 配置自动选择最合适的子 Widget
3. **完整的数组操作**：支持增删改查、排序、拖拽等操作
4. **类型安全**：完整的 TypeScript 类型支持
5. **易于扩展**：可以轻松支持新的数组元素类型
6. **与现有架构对称**：与 `NestedFormWidget` 处理对象的方式对称

### 🎯 适用场景

- ✅ 基本类型数组（字符串、数字、布尔值）
- ✅ 枚举数组（多选框组）
- ✅ 对象数组（联系人列表、地址列表等）
- ✅ 自定义 Widget 数组（颜色选择器、日期选择器等）
- ✅ 嵌套数组（数组中的对象包含数组）

### 📋 实施建议

1. **优先实施核心功能**（第一阶段 + 第二阶段）
2. **完善文档和测试**（第六阶段）
3. **逐步添加高级功能**（第三、四、五阶段）

### 🔗 相关文档

- [数组字段联动设计方案](./ARRAY_FIELD_LINKAGE.md) - 数组字段联动的详细设计
- [嵌套表单设计](./NESTED_FORM.md)
- [字段路径透明化](./FIELD_PATH_FLATTENING.md)
- [UI 联动设计](./UI_LINKAGE_DESIGN.md)
- [动态表单技术方案](./DYNAMIC_FORM_INDEX.md)

---

**文档版本**: 1.0  
**创建日期**: 2025-12-27  
**文档状态**: 已完成  
**作者**: Claude Code

