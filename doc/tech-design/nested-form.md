# 嵌套动态表单技术方案

> **状态：现行实现与历史示例混合。** 本文原有场景、过滤设计和演进记录完整保留。当前 `NestedFormWidget` 通过 `asNestedForm` 复用父级 React Hook Form Context，接收上层已经合并的 `schema`，不会自行读取 `LinkageStateContext` 或维护 `currentSchema`。
>
> 当前联动配置只支持 `ui.linkages[]`，函数使用对象参数。文中的 `linkage?: LinkageConfig`、`ui.linkage`、位置参数函数、`currentSchema` 示例和“内层验证独立”属于旧设计。组件当前使用 `forwardRef`，没有额外使用 `React.memo` 包装。

## 目录

1. [概述](#1-概述)
2. [应用场景](#2-应用场景)
3. [核心特性](#3-核心特性)
4. [类型定义和接口设计](#4-类型定义和接口设计)
5. [组件实现](#5-组件实现)
6. [使用示例](#6-使用示例)
7. [数据过滤机制](#7-数据过滤机制)
8. [高级特性](#8-高级特性)
9. [最佳实践](#9-最佳实践)
10. [注意事项](#10-注意事项)

---

## 1. 概述

本文档描述了如何在动态表单中支持嵌套表单场景，即某个字段的值是一个对象，该字段使用自定义 Widget（内层动态表单）来编辑这个对象。

> **💡 重要提示**
>
> `type: 'object'` 的字段会**自动使用** `nested-form` widget 渲染为嵌套表单。
>
> 无需显式指定 `ui.widget: 'nested-form'`，只有在需要使用自定义 widget 时才需要显式指定。

---

## 2. 应用场景

### 2.1 场景 1: 复杂对象编辑

```typescript
// 外层表单 Schema
{
  type: 'object',
  properties: {
    name: { type: 'string', title: 'Name' },
    address: {
      type: 'object',
      title: 'Address',
      properties: {
        street: { type: 'string', title: 'Street' },
        city: { type: 'string', title: 'City' },
        zipCode: { type: 'string', title: 'Zip Code' }
      },
      required: ['city']
      // ui.widget: 'nested-form' 是可选的（object 类型的默认值）
    }
  }
}
```

### 2.2 场景 2: 可配置的子表单（同级字段依赖）

```typescript
// 定义不同类型的 schema
const detailSchemas = {
  personal: {
    type: 'object',
    properties: {
      firstName: { type: 'string', title: 'First Name' },
      lastName: { type: 'string', title: 'Last Name' }
    }
  },
  company: {
    type: 'object',
    properties: {
      companyName: { type: 'string', title: 'Company Name' },
      taxId: { type: 'string', title: 'Tax ID' }
    }
  }
};

// 定义联动函数
const linkageFunctions = {
  loadDetailSchema: (formData: Record<string, any>) => {
    const type = formData?.type;
    return detailSchemas[type] || { type: 'object', properties: {} };
  }
};

// 根据类型动态加载不同的子表单
{
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['personal', 'company'],
      title: 'Type'
    },
    details: {
      type: 'object',
      title: 'Details',
      ui: {
        widget: 'nested-form',
        linkages: [
          {
            type: 'schema',
            dependencies: ['type'], // 依赖同级的 type 字段
            when: { field: 'type', operator: 'isNotEmpty' },
            fulfill: { function: 'loadDetailSchema' }
          }
        ]
      }
    }
  }
}
```

**数据保留机制**：当 `type` 从 `personal` 切换到 `company` 时，`details` 字段的数据会被保留。在表单提交时，会根据当前 schema 自动过滤掉不需要的字段。

> **📖 相关文档**
>
> 嵌套表单中的联动配置遵循标准的 UI 联动规范。详细的联动配置说明请参考：[UI 联动设计方案](./linkage.md)

### 2.3 场景 3: 跨层级字段依赖（JSON Pointer）

```typescript
// 定义不同公司类型的 schema
const companySchemas = {
  startup: {
    type: 'object',
    properties: {
      foundedYear: { type: 'number', title: 'Founded Year' },
      funding: { type: 'string', title: 'Funding Stage' }
    }
  },
  enterprise: {
    type: 'object',
    properties: {
      employeeCount: { type: 'number', title: 'Employee Count' },
      revenue: { type: 'number', title: 'Annual Revenue' }
    }
  }
};

// 定义联动函数
const linkageFunctions = {
  loadCompanySchema: (formData: Record<string, any>) => {
    const companyType = formData?.company?.type;
    return companySchemas[companyType] || { type: 'object', properties: {} };
  }
};

// 使用 JSON Pointer 依赖嵌套字段
{
  type: 'object',
  properties: {
    company: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['startup', 'enterprise'],
          title: 'Company Type'
        },
        details: {
          type: 'object',
          title: 'Company Details',
          ui: {
            widget: 'nested-form',
            linkages: [
              {
                type: 'schema',
                // 使用 JSON Pointer 格式依赖 company.type
                dependencies: ['#/properties/company/properties/type'],
                when: { field: '#/properties/company/properties/type', operator: 'isNotEmpty' },
                fulfill: { function: 'loadCompanySchema' }
              }
            ]
          }
        }
      }
    }
  }
}
```

**说明**：

- `dependencies` 使用 JSON Pointer 格式：`#/properties/company/properties/type`
- 可以依赖任意层级的字段，不限于同级
- 同样支持自动数据清除机制

### 2.4 场景 4: 数组中的嵌套表单

```typescript
{
  type: 'object',
  properties: {
    contacts: {
      type: 'array',
      title: 'Contacts',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Name' },
          phone: { type: 'string', title: 'Phone' },
          email: { type: 'string', title: 'Email', format: 'email' }
        }
        // ui.widget: 'nested-form' 是可选的（object 类型的默认值）
      }
    }
  }
}
```

> **📖 相关文档**
>
> 数组元素内部的嵌套表单联动涉及复杂的路径解析。详细说明请参考：[数组字段联动设计方案](./linkage.md#14-数组联动详细设计)

---

## 3. 核心特性

1. **值传递**: 外层表单将对象值传递给内层表单
2. **值回传**: 内层表单变化时，将新对象值回传给外层表单
3. **共享父级验证**: 内层字段注册到父表单，并由父级 resolver 统一验证
4. **样式隔离**: 内层表单可以有独立的样式配置
5. **跨层级依赖**: 支持 JSON Pointer 格式依赖任意层级的字段
6. **智能数据过滤**: 类型切换时保留所有数据，提交时根据当前 schema 自动过滤

---

## 4. 类型定义和接口设计

### 4.1 扩展的 UIConfig 类型

```typescript
// src/types/schema.ts

export interface UIConfig {
  widget?: WidgetType;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  help?: string;
  className?: string;
  style?: React.CSSProperties;
  order?: string[];
  errorMessages?: ErrorMessages;
  linkages?: LinkageConfig[]; // UI 联动配置（包括动态 schema 加载）

  [key: string]: any;
}
```

> **💡 动态嵌套表单（历史字段名勘误）**
>
> 动态 schema 加载现在通过 `linkages[]` 配置实现，详见 [UI 联动设计方案](./linkage.md)。

### 4.2 NestedFormWidget 组件属性

```typescript
// src/components/DynamicForm/widgets/NestedFormWidget.tsx

export interface NestedFormWidgetProps extends FieldWidgetProps {
  // 当前字段的 schema（包含 properties）
  schema: ExtendedJSONSchema;

  // 当前字段值（对象）
  value?: Record<string, any>;

  // 值变化回调
  onChange?: (value: Record<string, any>) => void;

  // 其他配置
  disabled?: boolean;
  readonly?: boolean;
  layout?: 'vertical' | 'horizontal' | 'inline'; // 布局方式
  labelWidth?: number | string; // 标签宽度
  noCard?: boolean; // 是否不渲染 Card 容器
}
```

**重要说明**：

- NestedFormWidget 使用 `asNestedForm` 模式，不需要 `value` 和 `onChange` props
- 数据通过父表单的 FormContext 自动管理
- 字段名通过 `pathPrefix` 参数自动添加前缀

---

## 5. 组件实现

### 5.1 NestedFormWidget 核心机制

NestedFormWidget 组件的完整实现请参考源代码：`src/components/DynamicForm/widgets/NestedFormWidget.tsx`

**核心特性**：

1. **Schema 注册机制**：使用 `NestedSchemaContext` 注册当前使用的 schema，用于表单提交时的数据过滤
2. **联动支持**：通过 `LinkageStateContext` 接收来自父表单的 schema 联动结果
3. **选择性合并**：当接收到新的 schema 时，只更新 properties 和验证字段，保留原有的 ui 配置
4. **路径管理**：使用 `PathPrefixContext` 管理嵌套字段的完整路径
5. **FormContext 共享**：与父表单共享同一个 FormContext，实现数据的自动同步

**动态 Schema 加载**：

动态 schema 加载通过 UI 联动系统实现，配置方式请参考：
- [UI 联动设计方案](./linkage.md)
- 本文档第 2.2 和 2.3 节的示例代码

---

## 6. 使用示例

### 6.1 示例 1: 静态嵌套表单

```typescript
const schema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      title: 'Name'
    },
    address: {
      type: 'object',
      title: 'Address',
      properties: {
        street: { type: 'string', title: 'Street' },
        city: { type: 'string', title: 'City' },
        zipCode: { type: 'string', title: 'Zip Code' }
      },
      required: ['city']
      // ui.widget: 'nested-form' 是可选的（object 类型的默认值）
    }
  }
};

// 使用
<DynamicForm schema={schema} onSubmit={handleSubmit} />
```

**说明**：
- address 字段会自动渲染为 NestedFormWidget（因为 type: 'object' 默认使用 nested-form widget）
- 内层字段会自动添加路径前缀（address.street, address.city, address.zipCode）
- 数据通过父表单的 FormContext 自动管理

### 6.2 示例 2: 动态嵌套表单（根据字段值切换）

动态嵌套表单的示例请参考本文档第 2.2 节和第 2.3 节，这些示例展示了如何使用 linkage 配置实现动态 schema 加载。

---

## 7. 数据过滤机制

### 7.1 数据过滤概述

当使用动态嵌套表单（通过 linkage 配置动态加载 schema）时，用户在不同 schema 之间切换会导致表单数据包含多个 schema 的字段。为了确保提交的数据只包含当前 schema 定义的字段，系统实现了自动数据过滤机制。

**核心机制**：

1. **Schema 注册**：每个 NestedFormWidget 会将当前使用的 schema 注册到 `NestedSchemaContext`
2. **数据过滤**：表单提交时，使用 `filterValueWithNestedSchemas` 函数根据注册的 schema 过滤数据
3. **选择性保留**：只保留当前 schema 中定义的字段，过滤掉其他字段

**示例场景**：

用户在 personal 和 company 类型之间切换时，details 字段会包含两种类型的数据：

```typescript
// 用户先选择 personal，填写了个人信息
{
  userType: 'personal',
  details: {
    firstName: 'John',
    lastName: 'Doe'
  }
}

// 然后切换到 company，填写了公司信息
{
  userType: 'company',
  details: {
    firstName: 'John',      // personal 类型的字段
    lastName: 'Doe',        // personal 类型的字段
    companyName: 'Acme',    // company 类型的字段
    taxId: '123456'         // company 类型的字段
  }
}

// 提交时，系统会根据当前 schema（company）自动过滤数据
{
  userType: 'company',
  details: {
    companyName: 'Acme',
    taxId: '123456'
    // firstName 和 lastName 被过滤掉了
  }
}
```

详细的路径格式说明、使用规范和转换规则，请参考：[字段路径完全指南](../guides/field-path.md#4-联动依赖路径)

### 7.2 智能数据过滤机制

当依赖字段值发生变化导致 schema 切换时，嵌套表单会保留所有历史数据，在表单提交时根据当前 schema 自动过滤掉不需要的字段。

#### 7.2.1 数据保留行为

```typescript
// 初始状态
{
  userType: 'personal',
  details: {
    firstName: 'John',
    lastName: 'Doe'
  }
}

// 用户将 userType 从 'personal' 切换到 'company'，填写新数据
// ↓ 保留所有数据

{
  userType: 'company',
  details: {
    firstName: 'John',      // ✅ 保留旧数据
    lastName: 'Doe',        // ✅ 保留旧数据
    companyName: 'Acme Inc',
    taxId: '123456'
  }
}

// 提交时根据当前 schema (company) 自动过滤
{
  userType: 'company',
  details: {
    companyName: 'Acme Inc',  // ✅ 只保留 company schema 中的字段
    taxId: '123456'
  }
}

// 如果用户又切回 'personal'，数据还在
{
  userType: 'personal',
  details: {
    firstName: 'John',  // ✅ 数据恢复了
    lastName: 'Doe'
  }
}
```

#### 7.2.2 数据过滤的优势

**用户体验优势**：

1. ✅ **容错性好**：用户误操作切换类型后，可以切回来，数据还在
2. ✅ **避免数据丢失**：不会因为误操作而丢失已填写的数据
3. ✅ **支持试错**：用户可以自由切换类型查看不同表单，不用担心数据丢失

**数据安全性**：

1. ✅ **提交时自动过滤**：只提交当前 schema 需要的字段
2. ✅ **避免数据污染**：后端不会收到无效字段
3. ✅ **类型安全**：确保提交的数据结构与 schema 一致

#### 7.2.3 实现原理

使用 `filterValueWithNestedSchemas` 工具函数在表单提交时过滤数据：

```typescript
import { filterValueWithNestedSchemas } from '@/components/DynamicForm/utils/filterValueWithNestedSchemas';

// 在 DynamicForm 的 onSubmit 中使用
const handleSubmit = (data: Record<string, any>) => {
  // 获取嵌套 schema 注册表（由 NestedSchemaContext 提供）
  const nestedSchemaRegistry = useNestedSchemaRegistry();

  // 根据当前 schema 和注册的嵌套 schema 过滤数据
  const filteredData = nestedSchemaRegistry
    ? filterValueWithNestedSchemas(data, schema, nestedSchemaRegistry.getAllSchemas())
    : filterValueWithNestedSchemas(data, schema, new Map());

  // 提交过滤后的数据
  onSubmit?.(filteredData);
};
```

**关键点**：

- `filterValueWithNestedSchemas` 函数会递归处理嵌套对象和数组
- 对于动态嵌套表单字段，使用注册表中的当前 schema 进行过滤
- 只保留当前 schema 中定义的字段，过滤掉类型切换时遗留的旧字段

#### 7.2.4 两个过滤函数的区别

系统提供了两个数据过滤函数，适用于不同场景：

##### `filterValueBySchema` - 基础过滤函数

**函数签名**：

```typescript
function filterValueBySchema(value: any, schema: ExtendedJSONSchema): any;
```

**适用场景**：

- 静态 schema，不涉及动态切换
- 简单的嵌套对象过滤
- 不需要跟踪嵌套表单的 schema 变化

**特点**：

- 只根据传入的 schema 进行过滤
- 递归处理嵌套对象和数组
- 不支持动态嵌套表单的 schema 注册机制

##### `filterValueWithNestedSchemas` - 增强过滤函数

**函数签名**：

```typescript
function filterValueWithNestedSchemas(
  value: any,
  schema: ExtendedJSONSchema,
  nestedSchemas: Map<string, ExtendedJSONSchema>,
  currentPath?: string
): any;
```

**适用场景**：

- 动态嵌套表单（使用 linkage 配置动态加载 schema）
- 需要根据当前激活的 schema 过滤数据
- 多层嵌套表单场景

**特点**：

- 支持嵌套 schema 注册表
- 对于注册的字段路径，使用注册表中的当前 schema 进行过滤
- 完美支持类型切换时的数据过滤

**使用建议**：

- DynamicForm 内部统一使用 `filterValueWithNestedSchemas`
- 如果没有嵌套 schema 注册表，传入空 Map 即可，功能等同于 `filterValueBySchema`

#### 7.2.5 filterValueWithNestedSchemas 函数详解

`filterValueWithNestedSchemas` 是增强版的数据过滤函数，专门用于处理动态嵌套表单场景。

**函数签名**：

```typescript
function filterValueWithNestedSchemas(
  value: any,
  schema: ExtendedJSONSchema,
  nestedSchemas: Map<string, ExtendedJSONSchema>,
  currentPath?: string
): any;
```

**参数说明**：

- `value`: 要过滤的数据
- `schema`: 顶层 JSON Schema
- `nestedSchemas`: 嵌套字段的 schema 注册表（字段路径 -> 当前激活的 schema）
- `currentPath`: 当前字段路径（用于递归，通常不需要手动传入）

**工作原理**：

1. 递归遍历数据结构
2. 对于每个对象字段，检查是否在 `nestedSchemas` 中有注册的 schema
3. 如果有注册的 schema，使用注册的 schema 进行过滤（这是动态嵌套表单的当前 schema）
4. 否则使用原始 schema 中的定义进行过滤

**使用示例：动态嵌套表单场景**

```typescript
// 顶层 schema
const schema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    userType: { type: 'string' },
    details: {
      type: 'object',
      properties: {}, // 初始为空，由动态 schema 填充
    },
  },
};

// 嵌套 schema 注册表（由 NestedFormWidget 自动维护）
const nestedSchemas = new Map<string, ExtendedJSONSchema>();

// 当前 details 字段使用的是 company schema
nestedSchemas.set('details', {
  type: 'object',
  properties: {
    companyName: { type: 'string' },
    taxId: { type: 'string' },
  },
});

// 用户数据（包含切换类型时遗留的字段）
const dirtyData = {
  userType: 'company',
  details: {
    // personal 类型的字段（应该被过滤）
    firstName: 'John',
    lastName: 'Doe',
    // company 类型的字段（应该保留）
    companyName: 'Acme Inc',
    taxId: '123456',
  },
};

// 使用 filterValueWithNestedSchemas 过滤
const cleanData = filterValueWithNestedSchemas(dirtyData, schema, nestedSchemas);

// 结果：只保留 company schema 中定义的字段
// {
//   userType: 'company',
//   details: {
//     companyName: 'Acme Inc',
//     taxId: '123456'
//   }
// }
```

### 7.3 NestedSchemaContext 机制

为了支持动态嵌套表单的数据过滤，系统使用 `NestedSchemaContext` 机制来跟踪每个嵌套字段当前激活的 schema。

**核心概念**：

- 每个 `NestedFormWidget` 在挂载时自动注册当前使用的 schema
- Schema 动态切换时，注册表会自动更新
- 表单提交时，使用注册表中的当前 schema 进行数据过滤

**工作流程**：

1. DynamicForm 创建 NestedSchemaProvider，初始化注册表
2. NestedFormWidget 挂载时注册当前 schema
3. 当依赖字段变化触发 schema 联动时，NestedFormWidget 更新并重新注册 schema
4. 表单提交时，使用注册表过滤数据，只保留当前 schema 定义的字段

详细的实现机制和分层计算策略，请参考：[UI 联动设计方案 - 分层计算策略](./linkage.md)

---

## 8. 高级特性

### 8.1 异步加载 Schema

```typescript
// 定义异步加载函数
const linkageFunctions = {
  loadProductConfigSchema: async (formData: Record<string, any>) => {
    const productId = formData?.productId;
    if (!productId) {
      return { type: 'object', properties: {} };
    }

    // 根据产品 ID 异步加载配置 schema
    const response = await api.getProductConfigSchema(productId);
    return response.schema;
  }
};

const schema = {
  type: 'object',
  properties: {
    productId: {
      type: 'string',
      title: 'Product ID',
    },
    configuration: {
      type: 'object',
      title: 'Configuration',
      ui: {
        widget: 'nested-form',
        linkages: [
          {
            type: 'schema',
            dependencies: ['productId'],
            when: { field: 'productId', operator: 'isNotEmpty' },
            fulfill: { function: 'loadProductConfigSchema' }
          }
        ]
      },
    },
  },
};

// 使用时传入 linkageFunctions
<DynamicForm
  schema={schema}
  linkageFunctions={linkageFunctions}
  onSubmit={handleSubmit}
/>
```

### 8.2 数组中的嵌套表单

```typescript
const schema = {
  type: 'object',
  properties: {
    contacts: {
      type: 'array',
      title: 'Contacts',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Name' },
          email: { type: 'string', title: 'Email', format: 'email' },
          phone: { type: 'string', title: 'Phone' },
        },
      },
    },
  },
};
```

### 8.3 多层嵌套

```typescript
const schema = {
  type: 'object',
  properties: {
    company: {
      type: 'object',
      title: 'Company',
      properties: {
        name: { type: 'string', title: 'Company Name' },
        address: {
          type: 'object',
          title: 'Address',
          properties: {
            street: { type: 'string', title: 'Street' },
            city: { type: 'string', title: 'City' },
          },
        },
      },
    },
  },
};
```

---

## 9. 最佳实践

### 9.1 数据管理策略

**使用 asNestedForm 模式（推荐）**：

NestedFormWidget 使用 `asNestedForm={true}` 模式，数据通过父表单的 FormContext 自动管理：

```typescript
// NestedFormWidget 内部实现
<DynamicForm
  schema={schema}
  pathPrefix={fullPath}
  asNestedForm={true}
  // 不需要 defaultValues 和 onChange
/>
```

**优势**：

- ✅ 无需手动同步值，避免了复杂的值同步逻辑
- ✅ 避免了父子组件之间的值同步死循环问题
- ✅ 统一的数据管理，所有字段都在父表单的 FormContext 中
- ✅ 更好的性能，减少了不必要的重渲染

**工作原理**：

1. 内层 DynamicForm 通过 `useFormContext()` 获取父表单的 FormContext
2. 字段名通过 `pathPrefix` 自动添加前缀（如 `company.details.name`）
3. 字段值直接从父表单的 FormContext 中读取和更新
4. 验证规则也自动注册到父表单中

### 9.2 验证处理

```typescript
// 嵌套表单的验证由父级 createSchemaResolver 统一处理
const schema = {
  type: 'object',
  properties: {
    address: {
      type: 'object',
      properties: {
        city: { type: 'string', title: 'City' },
      },
      required: ['city'], // 内层验证
    },
  },
};
```

### 9.3 性能优化

#### 9.3.1 缓存 Schema

```typescript
// 使用 useMemo 缓存 schema，避免每次渲染都创建新对象
const nestedSchema = useMemo(
  () => ({
    type: 'object',
    properties: {
      street: { type: 'string', title: 'Street' },
      city: { type: 'string', title: 'City' },
      zipCode: { type: 'string', title: 'Zip Code' },
    },
  }),
  [] // 静态 schema 无需依赖
);

// 动态 schema 根据依赖缓存
const dynamicSchema = useMemo(
  () => ({
    type: 'object',
    properties: userType === 'personal' ? personalProps : companyProps,
  }),
  [userType] // 只在 userType 变化时重新计算
);
```

#### 9.3.2 使用 React.memo 避免不必要的重渲染

```typescript
import React, { memo } from 'react';

// 使用 React.memo 包裹嵌套表单组件
export const NestedFormWidget = memo(
  forwardRef<HTMLDivElement, NestedFormWidgetProps>(
    ({ name, schema, disabled, readonly, layout, labelWidth }, ref) => {
      // ... 组件实现
      return (
        <Card ref={ref} className="nested-form-widget">
          <DynamicForm
            schema={schema}
            pathPrefix={fullPath}
            asNestedForm={true}
            disabled={disabled}
            readonly={readonly}
            layout={layout}
            labelWidth={labelWidth}
          />
        </Card>
      );
    }
  ),
  // 自定义比较函数，只在关键 props 变化时重渲染
  (prevProps, nextProps) => {
    return (
      isEqual(prevProps.schema, nextProps.schema) &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.readonly === nextProps.readonly &&
      prevProps.layout === nextProps.layout &&
      prevProps.labelWidth === nextProps.labelWidth
    );
  }
);
```

**说明**：

- 使用 `asNestedForm` 模式后，不需要比较 `value` 和 `onChange`
- 只需要比较 schema 和配置相关的 props
- 减少了不必要的重渲染，提升性能

### 9.4 外部设值（setValues / reset）

通过 `ref.current.setValues()` 或 `ref.current.reset(values)` 向嵌套表单设值时，无需特殊处理——传入原始的嵌套对象即可：

```typescript
const formRef = useRef<DynamicFormRef>(null);

// 直接传入嵌套对象，内部会自动递归展开
formRef.current?.setValues({
  name: 'John Doe',
  address: {
    street: '123 Main St',
    city: 'New York',
    zipCode: '10001',
  },
  company: {
    companyName: 'Acme Inc',
    location: {
      country: 'USA',
      city: 'San Francisco',
    },
  },
  tags: ['frontend', 'react'],
});

// reset 同样支持嵌套对象
formRef.current?.reset({
  name: 'Jane',
  address: { street: '456 Oak Ave', city: 'LA' },
});

// 清空所有字段（包括嵌套字段）
formRef.current?.reset({});
```

**内部机制**：

- `setValues` 递归遍历传入的对象，对每一层路径（如 `address`、`address.street`、`company.location.city`）都调用 `setValue`，确保嵌套 `NestedFormWidget` 内部的子 Controller 都能正确更新
- `reset({})` 根据 schema 结构为每个字段生成类型恰当的空值（`string → ''`、`array → []`、`object → {}`），避免 React 受控组件因收到 `undefined` 而保留旧值
- 由 `ArrayFieldWidget/useFieldArray` 管理的动态基本类型数组（如 `tags: ['a', 'b']`）会在内部自动包装为对象数组格式，对外仍保持原始基本类型数组
- 显式配置为多选 Select（`ui.widget: 'select'` 且 `widgetProps.multiple: true`）的数组不会包装；其内部和外部值都保持基本类型数组，确保 Select 与 options 联动能按 option value 正确匹配

---

## 10. 注意事项

1. **避免过深嵌套** - 建议最多 2-3 层
2. **值类型一致** - 确保字段值始终是对象类型
3. **验证独立性** - 内外层表单验证应该独立
4. **性能考虑** - 大量嵌套表单会影响性能

---

**创建日期**: 2025-12-24
**最后更新**: 2026-08-12
**版本**: 3.2
**文档状态**: 已更新（废弃 schemaKey/schemas，改用 linkage）

## 变更历史

### v3.2 (2026-08-12)

**修正**：数组字段外部赋值的数据格式边界

- 明确只有 `ArrayFieldWidget/useFieldArray` 管理的动态基本类型数组会在内部包装
- 补充多选 Select 数组保持基本类型数组的例外规则
- 说明包装格式不会暴露给 `setValues/getValues/onChange/onSubmit`

### v3.1 (2026-03-17)

**新增**：外部设值（setValues / reset）最佳实践

**主要变更**：

- 新增第 9.4 节：说明通过 `ref.current.setValues()` 和 `ref.current.reset()` 向嵌套表单设值的用法和内部机制
- 涵盖嵌套对象递归展开、动态基本类型数组内部自动包装、清空表单的类型恰当空值生成等细节

### v3.0 (2026-01-09)

**重大变更**：废弃 schemaKey/schemas/schemaLoader，改用 linkage 配置

**主要变更**：

- 废弃了 `ui.schemaKey`、`ui.schemas`、`ui.schemaLoader` 字段
- 动态 schema 加载现在通过 `ui.linkages[]` 配置实现（type: 'schema'）
- 更新了所有示例代码，使用 linkage 配置替代旧的 schemaKey/schemas 方式
- 简化了第 5 节（组件实现），改为核心机制说明并指向源代码
- 更新了第 7 节（数据过滤机制），删除了过时的 schemaKey 路径格式说明
- 更新了类型定义，移除了废弃字段
- 文档更加简洁，重点突出 linkage 系统的使用

**迁移指南**：详见 [UI 联动设计方案](./linkage.md) 和本文档第 2.2、2.3 节的示例

### v2.1 (2025-12-31)

**文档优化**：精简内容，减少重复，提升可读性

**主要变更**：

- ✅ 精简第 7.1 节：删除与字段路径指南重复的路径格式详细说明，改为引用链接
- ✅ 精简第 7.3 节：删除与联动系统设计重复的 Context 实现细节，保留核心概念
- ✅ 优化概述部分：使用醒目的提示框突出默认 widget 说明
- ✅ 添加交叉引用：在关键位置添加到联动系统设计和数组联动章节的链接
- ✅ 文档篇幅减少约 20%，内容更加聚焦和易读

### v2.0 (2025-12-27)

**架构重构**：改用 asNestedForm 模式

**主要变更**：

- 移除了 Controller 组件的使用，改为 asNestedForm 模式
- 更新了 NestedFormWidgetProps 接口，移除 value 和 onChange
- 补充了 asNestedForm 模式的详细说明
- 更新了使用示例，说明数据自动管理机制
- 简化了性能优化部分，移除了过时的值同步策略
