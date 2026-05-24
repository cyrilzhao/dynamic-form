# 动态表单组件技术方案 - Part 5

## 使用指南和最佳实践

### 8.1 基础使用示例

#### 8.1.1 简单表单

```typescript
import React from 'react';
import { DynamicForm } from '@/components/DynamicForm';

const schema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      title: '用户名',
      minLength: 3,
      maxLength: 20,
    },
    email: {
      type: 'string',
      title: '邮箱',
      format: 'email',
    },
  },
  required: ['username', 'email'],
};

export const SimpleFormExample: React.FC = () => {
  const handleSubmit = (data: any) => {
    console.log('表单数据:', data);
  };

  return (
    <DynamicForm
      schema={schema}
      onSubmit={handleSubmit}
    />
  );
};
```

#### 8.1.2 带默认值的表单

```typescript
const defaultValues = {
  username: 'john_doe',
  email: 'john@example.com',
  age: 25,
};

<DynamicForm
  schema={schema}
  defaultValues={defaultValues}
  onSubmit={handleSubmit}
/>
```

#### 8.1.3 监听表单变化

```typescript
const handleChange = (data: any) => {
  console.log('表单变化:', data);
};

<DynamicForm
  schema={schema}
  onChange={handleChange}
  onSubmit={handleSubmit}
/>
```

### 8.2 高级使用示例

#### 8.2.1 自定义字段组件

```typescript
import React, { forwardRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import type { FieldWidgetProps } from '@/components/DynamicForm/types';

// 自定义日期选择器
export const CustomDatePicker = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, schema, disabled, readonly }, ref) => {
    const { control } = useFormContext();

    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input
            {...field}
            ref={ref}
            type="date"
            disabled={disabled}
            readOnly={readonly}
            className="custom-date-picker"
          />
        )}
      />
    );
  }
);

CustomDatePicker.displayName = 'CustomDatePicker';

// 注册自定义组件
import { FieldRegistry } from '@/components/DynamicForm/core/FieldRegistry';
FieldRegistry.register('custom-date', CustomDatePicker);

// 在 Schema 中使用
const schema = {
  type: 'object',
  properties: {
    birthDate: {
      type: 'string',
      title: '出生日期',
      ui: {
        widget: 'custom-date'
      }
    }
  }
};

<DynamicForm
  schema={schema}
  onSubmit={handleSubmit}
/>
```

**说明**：
- 使用 `forwardRef` 正确定义 Widget 组件
- 使用 `Controller` 集成 react-hook-form
- 通过 `FieldRegistry.register()` 注册自定义组件

**更多自定义 Widget 开发指南，请参考**：[Widget 开发文档](./WIDGET_DEVELOPMENT.md)（待补充）

#### 8.2.2 嵌套表单

```typescript
// 简单的嵌套对象
const schema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      title: '用户信息',
      properties: {
        name: { type: 'string', title: '姓名' },
        email: { type: 'string', title: '邮箱', format: 'email' },
      },
    },
  },
};

// 对象数组
const arraySchema = {
  type: 'object',
  properties: {
    contacts: {
      type: 'array',
      title: '联系人',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', title: '姓名' },
          phone: { type: 'string', title: '电话' },
        },
      },
    },
  },
};
```

**说明**：
- `type: 'object'` 的字段会自动使用 `nested-form` widget
- 数组中的对象也会自动渲染为嵌套表单

**更多嵌套表单场景，请参考**：
- [嵌套表单设计](./NESTED_FORM.md) - 动态 Schema、异步加载等高级特性
- [数组字段 Widget](./ARRAY_FIELD_WIDGET.md) - 数组操作、验证等详细说明

#### 8.2.3 布局配置

```typescript
// 全局配置布局方式
<DynamicForm
  schema={schema}
  layout="vertical"  // 可选: vertical | horizontal | inline
  labelWidth={120}   // 水平布局时的标签宽度
  onSubmit={handleSubmit}
/>

// 字段级配置（会继承到嵌套字段）
const schema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      title: '用户信息',
      ui: {
        layout: 'horizontal',  // 该对象下的字段使用水平布局
        labelWidth: 100
      },
      properties: {
        name: { type: 'string', title: '姓名' },
        email: { type: 'string', title: '邮箱' }
      }
    }
  }
};
```

**说明**：
- 支持 `vertical`（垂直）、`horizontal`（水平）、`inline`（内联）三种布局
- 布局配置会自动继承到嵌套字段
- 子字段可以覆盖父级的布局配置

#### 8.2.4 字段联动

```typescript
// 基础的显示/隐藏联动
const schema = {
  type: 'object',
  properties: {
    hasAddress: {
      type: 'boolean',
      title: '是否填写地址',
    },
    address: {
      type: 'string',
      title: '详细地址',
      ui: {
        linkages: [
          {
            type: 'visibility',
            dependencies: ['#/properties/hasAddress'],
            when: {
              field: '#/properties/hasAddress',
              operator: '==',
              value: true
            }
          }
        ]
      }
    },
  },
};

// 值联动（自动计算）
const calcSchema = {
  type: 'object',
  properties: {
    price: { type: 'number', title: '单价' },
    quantity: { type: 'number', title: '数量' },
    total: {
      type: 'number',
      title: '总价',
      ui: {
        readonly: true,
        linkages: [
          {
            type: 'value',
            dependencies: ['#/properties/price', '#/properties/quantity'],
            fulfill: {
              function: 'calculateTotal'
            }
          }
        ]
      }
    }
  }
};

const linkageFunctions = {
  calculateTotal: (formData: any) => {
    return (formData.price || 0) * (formData.quantity || 0);
  }
};

<DynamicForm
  schema={calcSchema}
  linkageFunctions={linkageFunctions}
  onSubmit={handleSubmit}
/>
```

**说明**：
- 支持显示/隐藏、禁用/启用、只读、值联动、动态选项等多种联动类型
- 使用 JSON Pointer 格式引用字段（`#/properties/fieldName`）

**更多联动场景，请参考**：
- [UI 联动设计](./UI_LINKAGE_DESIGN.md) - 完整的联动配置和高级场景
- [数组字段联动](./ARRAY_FIELD_LINKAGE.md) - 数组元素内部的联动处理

### 8.3 集成到项目

#### 8.3.1 安装依赖

```bash
npm install react-hook-form
npm install ajv ajv-formats
npm install @types/json-schema
```

#### 8.3.2 项目配置

```typescript
// src/config/formConfig.ts

export const formConfig = {
  // 默认验证模式
  validateMode: 'onSubmit' as const,

  // 是否显示错误列表
  showErrorList: true,

  // 默认布局
  layout: 'vertical' as const,
};
```

#### 8.3.3 全局注册自定义组件

```typescript
// src/components/DynamicForm/setup.ts

import { FieldRegistry } from './core/FieldRegistry';
import { CustomDatePicker } from './widgets/CustomDatePicker';
import { CustomUpload } from './widgets/CustomUpload';

export function setupDynamicForm() {
  // 注册自定义组件
  FieldRegistry.registerBatch({
    'custom-date': CustomDatePicker,
    'custom-upload': CustomUpload,
  });
}

// 在应用入口调用
// src/main.tsx
import { setupDynamicForm } from '@/components/DynamicForm/setup';

setupDynamicForm();
```

### 8.4 最佳实践

#### 8.4.1 Schema 设计原则

**1. 保持简单**
```typescript
// ✅ 好的做法
{
  type: 'string',
  title: '用户名',
  minLength: 3
}

// ❌ 避免过度复杂
{
  type: 'string',
  title: '用户名',
  minLength: 3,
  maxLength: 20,
  pattern: '^[a-zA-Z0-9_]+$',
  allOf: [...],
  anyOf: [...]
}
```

**2. 使用有意义的字段名**
```typescript
// ✅ 好的做法
properties: {
  firstName: { type: 'string' },
  lastName: { type: 'string' }
}

// ❌ 避免无意义的名称
properties: {
  field1: { type: 'string' },
  field2: { type: 'string' }
}
```

**3. 提供清晰的标题和描述**
```typescript
{
  type: 'string',
  title: '邮箱地址',
  description: '用于接收通知和找回密码',
  ui: {
    placeholder: 'example@email.com'
  }
}
```

#### 8.4.2 性能优化

**1. 使用 useMemo 缓存 Schema**
```typescript
const schema = useMemo(() => ({
  type: 'object',
  properties: {
    // ...
  }
}), []);
```

**2. 避免频繁的 onChange 回调**
```typescript
// ✅ 使用防抖
const debouncedOnChange = useMemo(
  () => debounce((data) => {
    console.log('表单变化:', data);
  }, 300),
  []
);

<DynamicForm
  schema={schema}
  onChange={debouncedOnChange}
/>
```

**3. 大型表单分步处理**
```typescript
// 将大型表单拆分为多个步骤
const step1Schema = { /* ... */ };
const step2Schema = { /* ... */ };
const step3Schema = { /* ... */ };
```

#### 8.4.3 错误处理

**1. 提供友好的错误提示**
```typescript
{
  type: 'string',
  minLength: 6,
  ui: {
    errorMessages: {
      minLength: '密码至少需要6个字符'
    }
  }
}
```

**2. 全局错误处理**
```typescript
const handleSubmit = async (data: any) => {
  try {
    await api.submitForm(data);
  } catch (error) {
    // 显示错误提示
    toast.error('提交失败，请重试');
  }
};
```

#### 8.4.4 类型安全

**1. 定义表单数据类型**
```typescript
interface UserFormData {
  username: string;
  email: string;
  age: number;
}

const handleSubmit = (data: UserFormData) => {
  // TypeScript 会提供类型检查
  console.log(data.username);
};
```

**2. 使用 Schema 生成类型**
```typescript
import { FromSchema } from 'json-schema-to-ts';

const schema = {
  type: 'object',
  properties: {
    username: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['username'],
} as const;

type FormData = FromSchema<typeof schema>;
// { username: string; age?: number }
```

---

## 文档修订记录

**版本**: 2.0
**最后更新**: 2025-12-30
**文档状态**: 已优化

### 主要修订内容

本次修订主要目的是将文档从技术深度文档转变为简洁的使用指南，避免与专题文档重复。

#### 1. 修正代码示例（8.2.1 节）
- **问题**: 自定义 Widget 示例中 `forwardRef` 使用不正确，缺少 `Controller` 集成
- **修复**: 重写示例，使用正确的 TypeScript 类型定义，添加 `Controller` 集成和 `FieldRegistry` 注册

#### 2. 简化嵌套表单内容（8.2.2 节）
- **删除**: 复杂的嵌套表单示例（对象数组、动态 Schema 等）
- **保留**: 基础的嵌套对象示例
- **添加**: 指向专题文档的引用链接
  - [嵌套表单设计](./NESTED_FORM.md) - 动态 Schema、异步加载等高级特性
  - [数组字段 Widget](./ARRAY_FIELD_WIDGET.md) - 数组操作、验证等详细说明

#### 3. 整合布局配置（8.2.3 节）
- **合并**: 将布局和标签宽度配置整合到一个章节
- **简化**: 删除过于详细的配置说明，保留基础示例

#### 4. 简化字段联动内容（8.2.4 节）
- **删除**: 重复的 8.2.4 节（原有两个同编号章节）
- **简化**: 只保留基础的显示/隐藏联动和值联动示例
- **添加**: 指向专题文档的引用链接
  - [UI 联动设计](./UI_LINKAGE_DESIGN.md) - 完整的联动配置和高级场景
  - [数组字段联动](./ARRAY_FIELD_LINKAGE.md) - 数组元素内部的联动处理

#### 5. 保留实用内容（8.3-8.4 节）
- **8.3 集成到项目**: 保留安装依赖、项目配置、全局注册等基础集成步骤
- **8.4 最佳实践**: 保留 Schema 设计原则、性能优化、错误处理、类型安全等实用建议

### 文档定位

本文档现在专注于：
- ✅ 基础使用示例和快速入门
- ✅ 常见场景的简单示例
- ✅ 项目集成步骤
- ✅ 最佳实践建议
- ✅ 指向专题文档的引用

不再包含：
- ❌ 深入的技术实现细节
- ❌ 复杂的高级场景示例
- ❌ 与专题文档重复的内容

---

**下一部分**: 常见问题和实施建议
