# Helpers 系统设计文档

## 1. 背景和动机

### 1.1 当前问题

DynamicForm 目前支持 inline script 功能，允许用户在以下场景使用内联 JavaScript 代码：

- **ui.transform**：字段值转换
- **ui.callbackProps**：Widget 回调函数
- **ui.validators**：自定义验证器
- **ui.linkages.fulfill/otherwise**：联动规则的效果函数

但是，这些 inline script 存在以下局限性：

1. **无法进行异步操作**：无法调用 API 获取数据（如动态 options）
2. **缺少工具函数**：无法使用 lodash、dayjs 等常用工具库
3. **无法访问外部依赖**：无法使用验证库、格式化库等第三方依赖
4. **业务逻辑受限**：无法调用应用级工具函数或业务逻辑

### 1.2 典型场景

#### 场景 1：异步获取 options

```typescript
// 当前无法实现
{
  type: 'options',
  fulfill: {
    type: 'script',
    code: `async function(formData) {
      // ❌ 无法调用 API
      const cities = await fetch('/api/cities?country=' + formData.country);
      return cities.json();
    }`
  }
}
```

#### 场景 2：使用工具库处理数据

```typescript
// 当前无法实现
{
  type: 'value',
  fulfill: {
    type: 'script',
    code: `function(formData) {
   // ❌ 无法使用 lodash
   return _.sumBy(formData.items, 'price');
}`
  }
}
```

#### 场景 3：异步验证

```typescript
// 当前无法实现
{
  type: 'script',
  callback: {
    type: 'script',
    code: `async function(value) {
      // ❌ 无法调用验证 API
      const available = await checkUsername(value);
      return available ? null : 'Username already taken';
    }`
  }
}
```

## 2. 设计目标

### 2.1 核心目标

1. 支持异步操作：允许 inline script 和 callbacks 调用异步 API
2. 提供工具能力：内置常用工具库、请求工具和校验工具（ofetch、lodash、Zod 等）
3. 支持自定义扩展：允许用户注入自定义依赖和业务逻辑
4. 保持向后兼容：不破坏现有 API 和使用方式
5. 类型安全：提供完整的 TypeScript 类型定义
6. 边界清晰：明确 helpers 是依赖注入机制，不是安全沙箱

2.2 非目标

1. ❌ 不提供完整的沙箱环境（inline script 仍在浏览器环境执行）
2. ❌ 不支持 Node.js 环境的依赖（如 fs、path 等）
3. ❌ 不支持动态加载远程脚本（安全风险）

## 3. 整体架构

### 3.1 架构图

┌─────────────────────────────────────────────────────────────┐
│ DynamicForm Props │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ helpers?: { │ │
│ │ // 用户自定义依赖 │ │
│ │ \_: lodash,│ │
│ │ dayjs: dayjs, │ │
│ │ myUtils: customUtils │ │
│ │ } │ │
│ └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────┐
│ Helpers 合并层 │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ mergedHelpers = { │ │
│ │ ...builtInHelpers, // 内置 helpers │ │
│ │ ...userHelpers // 用户 helpers（优先级更高） │ │
│ │ } │ │
│ └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
↓
┌─────────────────────────────────────────────────────────────┐
│ HelpersContext │
│ (通过 React Context 传递) │
└─────────────────────────────────────────────────────────────┘
↓
┌───────────────────┴───────────────────┐↓ ↓
┌──────────────────┐ ┌──────────────────┐
│ Linkage Manager │ │ Validator │
│ - 获取 helpers │ │ - 获取 helpers │
│ - 传递给函数 │ │ - 传递给函数 │
└──────────────────┘ └──────────────────┘
↓ ↓
┌──────────────────┐ ┌──────────────────┐
│ Transform │ │ Callback Props │
│ - 获取 helpers │ │ - 获取 helpers │
│ - 传递给函数 │ │ - 传递给函数 │
└──────────────────┘ └──────────────────┘

### 3.2 数据流

```
用户配置 helpers
↓
合并内置和用户 helpers
↓
通过 Context 传递
↓
各模块获取 helpers
↓
执行函数时注入 helpers
↓
函数内部使用 helpers
```

## 4. 核心设计

### 4.1 Helpers Props

在 DynamicForm 组件中新增 helpers 属性：

```typescript
interface DynamicFormProps {
  // ... 现有 props

  /**
   * 帮助函数和工具库，可在 inline script 和 callbacks 中使用
   *
   * 内置 helpers:
   * - ofetch: 跨浏览器和 Node.js 环境的请求能力
   * - _: lodash 完整功能
   * - v: Zod 校验工具
   *
   * 用户可以注入自定义 helpers，会与内置 helpers 合并
   *
   * @example
   * ```tsx
   * import _ from 'lodash';
   * import dayjs from 'dayjs';
   * <DynamicForm
   *   schema={schema}
   *   helpers={{
   *     dayjs,        // 日期处理库
   *     myUtils,      // 自定义工具函数
   *   }}
   * />
   * ```
   */
  helpers?: Record<string, any>;
}
```

### 4.2 内置 Helpers

DynamicForm 内部默认提供以下 helpers：

```typescript
import { ofetch } from 'ofetch';
import _ from 'lodash';
import * as v from 'zod';

// 内置 helpers
const builtInHelpers = {
  /**
   * 异步请求能力（基于 ofetch）
   *
   * ofetch 提供跨浏览器和 Node.js 环境的一致请求 API。
   * DynamicForm 不额外封装业务请求策略；如需 baseURL、鉴权、
   * 重试或拦截逻辑，可由用户通过 ofetch.create(...) 后覆盖注入。
   *
   * @example
   * ```typescript
   * const data = await helpers.ofetch('/api/users');
   * const result = await helpers.ofetch('/api/users', {
   *   method: 'POST',
   *   body: JSON.stringify({ name: 'John' })
   * });
   * ```
   */
  ofetch,

  /**
   * lodash 完整功能
   * 提供数据处理、数组操作、对象操作等工具函数
   *
   * @example
   * ```typescript
   * helpers._.get(obj, 'a.b.c', defaultValue)
   * helpers._.map(array, 'name')
   * helpers._.groupBy(array, 'category')
   * ```
   */
  _,

  /**
   * Zod 校验工具
   * 提供轻量、类型友好的运行时校验能力
   *
   * @example
   * ```typescript
   * const emailSchema = helpers.z.pipe(
   *   helpers.z.string(),
   *   helpers.z.email()
   * );
   * helpers.z.safeParse(emailSchema, 'test@example.com')
   * ```
   */
  v,
};
```

### 4.3 Helpers 合并策略

```typescript
const DynamicForm = ({ helpers: userHelpers, ...otherProps }: DynamicFormProps) => {
  // 合并内置和用户提供的 helpers
  // 用户提供的 helpers 优先级更高，可以覆盖内置 helpers
  const mergedHelpers = useMemo(() => ({
    ...builtInHelpers,
    ...userHelpers,
  }), [userHelpers]);

  // 通过 Context 传递给需要的地方
  return (
    <HelpersContext.Provider value={mergedHelpers}>
      {/* ... */}
    </HelpersContext.Provider>
  );
};
```

## 5. 函数签名设计

### 5.1 设计原则

根据项目 CLAUDE.md 中的编码规范：

▎ 规则：当函数参数超过 2 个时，必须使用对象解构的方式传递参数。

因此，所有涉及 helpers 的函数签名统一采用对象参数形式。

### 5.2 Linkage Functions

**现有签名**

```typescript
type LinkageFunction = (formData: any, context: LinkageContext) => any;
```

**新签名（对象参数）**

```typescript
type LinkageFunction = (params: {
  formData: any;
  context: LinkageContext;
  helpers: Record<string, any>;
}) => any | Promise<any>;
```

**使用示例**

```typescript
// callbacks registry 中的函数
const linkageFunctions = {
  // ✅ 使用对象参数
  calculateTotal: ({ formData, context, helpers }) => {
    return helpers._.sumBy(formData.items || [], item =>
      (item.price || 0) * (item.quantity || 0)
    );
  },

  // ✅ 支持异步
  loadCityOptions: async ({ formData, context, helpers }) => {
    const cities = await helpers.ofetch(`/api/cities?country=${formData.country}`);
    return helpers._.map(cities, city => ({
      label: city.name,
      value: city.id
    }));
  },
};

// inline script 中的函数
{
  type: 'value',
  fulfill: {
    type: 'script',
    code: `function({ formData, context, helpers }) {
      return helpers._.sum(helpers._.map(formData.items, 'price'));
    }`
  }
}
```

### 5.3 Validators

**现有签名**

```typescript
type ValidatorFunction = (value: any, formValues: Record<string, any>) => string | null;
```

**新签名（对象参数）**

```typescript
type ValidatorFunction = (params: {
  value: any;
  formValues: Record<string, any>;
  helpers: Record<string, any>;
}) => string | null | Promise<string | null>;
```

**使用示例**

```typescript
// callbacks registry 中的函数
const callbacks = {
  // ✅ 使用对象参数
  validateUsername: async ({ value, formValues, helpers }) => {
    if (!value) return 'Username is required';
    // 使用 Zod 验证格式
    const usernameSchema = helpers.z.pipe(
      helpers.z.string(),
      helpers.z.regex(/^[a-zA-Z0-9]+$/)
    );
    const usernameResult = helpers.z.safeParse(usernameSchema, value);
    if (!usernameResult.success) {
      return 'Username must contain only letters and numbers';
    }

    // 调用 API 检查可用性
    const result = await helpers.ofetch('/api/check-username', {
      method: 'POST',
      body: JSON.stringify({ username: value })
    });

    return result.available ? null : 'Username already taken';
  },
};

// inline script 中的函数
{
  type: 'script',
  callback: {
    type: 'script',
    code: `async function({ value, formValues, helpers }) {
      if (!value) return null;

      const result = await helpers.ofetch('/api/validate', {
        method: 'POST',
        body: JSON.stringify({ value })
      });

      return result.valid ? null : result.error;
    }`
  }
}
```

### 5.4 Transform Functions

**现有签名**

```typescript
type TransformFunction = (value: any) => any;
```

**新签名（对象参数）**

```typescript
type TransformFunction = (params: {
  value: any;
  helpers: Record<string, any>;
}) => any;
```

**使用示例**

```typescript
// callbacks registry 中的函数
const callbacks = {
  // ✅ 使用对象参数
  normalizePrice: ({ value, helpers }) => {
    // 移除非数字字符
    const numericValue = value.replace(/[^0-9.]/g, '');
    return helpers._.toNumber(numericValue);
  },

  // ✅ 同步转换：适合格式化、标准化、单位换算等本地计算
  centsToDollars: ({ value, helpers }) => {
    return helpers._.round(value / 100, 2);
  },
};

// inline script 中的函数
{
  callback: {
    type: 'script',
    code: `function({ value, helpers }) {
      return helpers._.round(value / 100, 2);
    }`
  }
}
```

### 5.5 Callback Props

**现有签名**

```typescript
type CallbackFunction = (...args: any[]) => any;
```

**新签名（对象参数）**

```typescript
type CallbackFunction = (params: {
  args: any[]; // 原始参数数组
  helpers: Record<string, any>;
}) => any | Promise<any>;
```

**使用示例**

```typescript
// callbacks registry 中的函数
const callbacks = {
  // ✅ 使用对象参数
  handleUpload: async ({ args, helpers }) => {
    const [file] = args; // 解构原始参数

    // 验证文件
    const imageMimeSchema = helpers.z.pipe(
      helpers.z.string(),
      helpers.z.regex(/^image\//)
    );
    const mimeResult = helpers.z.safeParse(imageMimeSchema, file.type);
    if (!mimeResult.success) {
      throw new Error('Only images are allowed');
    }

    // 上传文件
    const formData = new FormData();
    formData.append('file', file);

    const result = await helpers.ofetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    return result.url;
  },
};

// inline script 中的函数
{
  callbackProps: {
    onUpload: {
      type: 'script',
      code: `async function({ args, helpers }) {
        const [file] = args;
        const formData = new FormData();
        formData.append('file', file);

        const result = await helpers.ofetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        return result.url;
      }`
    }
  }
}
```

## 6. 实现细节

### 6.1 HelpersContext

创建一个 React Context 用于传递 helpers：

```typescript
// contexts/HelpersContext.tsx
import { createContext, useContext } from 'react';

export interface HelpersContextValue {
  helpers: Record<string, any>;
}

export const HelpersContext = createContext<HelpersContextValue>({
  helpers: {},
});

export const useHelpers = () => {
  const context = useContext(HelpersContext);
  if (!context) {
    throw new Error('useHelpers must be used within HelpersProvider');
  }
  return context.helpers;
};
```

### 6.2 Inline Script 执行机制

更新 executeInlineScript 工具函数：

```typescript
// utils/executeInlineScript.ts

/**
 * 执行 inline script
 *
 * @param code - JavaScript 函数代码
 * @param params - 参数对象
 * @param helpers - helpers 对象
 * @returns 执行结果（可能是 Promise）
 */
export function executeInlineScript<T = any>({
  code,
  params,
  helpers,
}: {
  code: string;
  params: Record<string, any>;
  helpers: Record<string, any>;
}): T | Promise<T> {
  try {
    // 创建函数，接收一个参数对象
    const func = new Function(
      'params',
      'helpers',
      `return (${code})({ ...params, helpers })`
    );

    // 执行函数
    const result = func(params, helpers);

    return result;

  } catch (error) {
    console.error('Inline script execution error:', error);
    console.error('Code:', code);
    console.error('Params:', params);
    throw error;
  }
}
```

### 6.3 Linkage Manager 更新

更新 LinkageManager 以支持 helpers：

```typescript
// core/LinkageManager.ts

export class LinkageManager {
  private helpers: Record<string, any>;

  constructor({
    schema,
    linkageFunctions,
    linkageContext,
    helpers,  // 新增
  }: {
    schema: ExtendedJSONSchema;
    linkageFunctions: Record<string, Function>;
    linkageContext?: any;
    helpers: Record<string, any>;  // 新增
  }) {
    this.helpers = helpers;
    // ...
  }

  private async executeLinkageFunction({
    func,
    formData,
    context,
  }: {
    func: string | InlineScript;
    formData: Record<string, any>;
    context: LinkageContext;
  }): Promise<any> {
    if (typeof func === 'string') {
      // 函数名引用
      const linkageFunc = this.linkageFunctions[func];
      if (!linkageFunc) {
        console.warn(`Linkage function "${func}" not found`);
        return undefined;
      }

      // ✅ 使用对象参数调用
      return linkageFunc({ formData, context, helpers: this.helpers });
    } else {
      // inline script
      return executeInlineScript({
        code: func.code,
        params: { formData, context },
        helpers: this.helpers,
      });
    }
  }
}
```

### 6.4 Schema Validator 更新

更新 SchemaValidator 以支持 helpers：

```typescript
// core/SchemaValidator.ts

export class SchemaValidator {
  private helpers: Record<string, any>;

  constructor({
    schema,
    callbacks,
    helpers,  // 新增
  }: {
    schema: ExtendedJSONSchema;
    callbacks: Record<string, Function>;
    helpers: Record<string, any>;  // 新增
  }) {
    this.helpers = helpers;
    // ...
  }

  private async executeValidator({
    validator,
    value,
    formValues,
  }: {
    validator: ScriptValidator;
    value: any;
    formValues: Record<string, any>;
  }): Promise<string | null> {
    const { callback } = validator;

    if (typeof callback === 'string') {
      // 函数名引用
      const validatorFunc = this.callbacks[callback];
      if (!validatorFunc) {
        console.warn(`Validator function "${callback}" not found`);
        return null;
      }

      // ✅ 使用对象参数调用
      return validatorFunc({ value, formValues, helpers: this.helpers });
    } else {
      // inline script
      return executeInlineScript({
        code: callback.code,
        params: { value, formValues },
        helpers: this.helpers,
      });
    }
  }
}
```

## 7. 完整使用示例

### 7.1 基础示例

```typescript
import React from 'react';
import { DynamicForm } from './components/DynamicForm';
import _ from 'lodash';
import dayjs from 'dayjs';

const schema = {
  type: 'object',
  properties: {
    country: {
      type: 'string',
      title: 'Country',
      enum: ['china', 'usa'],
      enumNames: ['China', 'USA'],
    },
    city: {
      type: 'string',
      title: 'City',
      ui: {
        linkages: [{
          type: 'options',
          dependencies: ['#/properties/country'],
          fulfill: {
            type: 'script',
            code: `async function({ formData, context, helpers }) {
              // 使用内置 ofetch 获取数据
              const cities = await helpers.ofetch(
                '/api/cities?country=' + formData.country
              );

              // 使用 lodash 处理数据
              return helpers._.map(cities, city => ({
                label: city.name,
                value: city.id
              }));
            }`
          }
        }]
      }
    },
    username: {
      type: 'string',
      title: 'Username',
      ui: {
        validators: [{
          type: 'script',
          callback: {
            type: 'script',
            code: `async function({ value, formValues, helpers }) {
              if (!value) return null;

              // 使用 Zod 验证格式
              const usernameSchema = helpers.z.pipe(
                helpers.z.string(),
                helpers.z.regex(/^[a-zA-Z0-9]+$/)
              );
              const usernameResult = helpers.z.safeParse(usernameSchema, value);
              if (!usernameResult.success) {
                return 'Username must contain only letters and numbers';
              }

              // 调用 API 验证可用性
              const result = await helpers.ofetch('/api/check-username', {
                method: 'POST',
                body: JSON.stringify({ username: value })
              });

              return result.available ? null : 'Username already taken';
            }`
          }
        }]
      }
    }
  }
};

function App() {
  return (
    <DynamicForm
      schema={schema}
      helpers={{
        dayjs,  // 注入 dayjs（可选）
      }}
      onSubmit={handleSubmit}
    />
  );
}
```

### 7.2 使用自定义 Helpers

```typescript
import React, { useMemo } from 'react';
import { DynamicForm } from './components/DynamicForm';
import _ from 'lodash';
import dayjs from 'dayjs';

// 自定义工具函数
const customUtils = {
  formatCurrency: (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  },

  validatePhone: (phone: string) => {
    return /^\d{3}-\d{3}-\d{4}$/.test(phone);
  },
};

function App() {
  // ✅ 使用 useMemo 稳定 helpers 引用
  const helpers = useMemo(() => ({
    dayjs,
    customUtils,
  }), []);

  return (
    <DynamicForm
      schema={schema}
      helpers={helpers}
      onSubmit={handleSubmit}
    />
  );
}
```

### 7.3 使用 callbacks registry

```typescript
import React, { useMemo } from 'react';
import { DynamicForm } from './components/DynamicForm';

const schema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      title: 'Items',
      items: {
        type: 'object',
        properties: {
          price: { type: 'number', title: 'Price' },
          quantity: { type: 'number', title: 'Quantity' },
        }
      }
    },
    total: {
      type: 'number',
      title: 'Total',
      ui: {
        readonly: true,
        linkages: [{
          type: 'value',
          dependencies: ['#/properties/items'],
          fulfill: { function: 'calculateTotal' }
        }]
      }
    }
  }
};

function App() {
  // ✅ 使用 useMemo 稳定 callbacks 引用
  const callbacks = useMemo(() => ({
    // ✅ 使用对象参数
    calculateTotal: ({ formData, context, helpers }) => {
      return helpers._.sumBy(formData.items || [], item =>
        (item.price || 0) * (item.quantity || 0)
      );
    },
  }), []);

  // ✅ 使用 useMemo 稳定 linkageFunctions 引用
  const linkageFunctions = useMemo(() => callbacks, [callbacks]);

  return (
    <DynamicForm
      schema={schema}
      linkageFunctions={linkageFunctions}
      onSubmit={handleSubmit}
    />
  );
}
```

## 8. 安全性考虑

### 8.1 安全措施

1. **依赖注入限制**
   - ✅ 只有通过 helpers 显式注入的依赖才能访问
   - ✅ 默认只内置 ofetch、lodash、Zod 等明确依赖
   - ✅ 用户可以通过覆盖 helpers 控制具体暴露哪些能力

2. **执行边界**
   - ✅ helpers 采用显式依赖注入，业务侧可以控制暴露哪些工具
   - ✅ inline script 仅适用于受信任的 schema
   - ❌ helpers 不是安全沙箱，不能阻止脚本访问浏览器运行时允许的全局对象
   - ❌ 如果需要执行不可信脚本，应另行设计 sandbox iframe、Web Worker、SES 等隔离执行器

3. **错误处理**
   - ✅ 脚本执行错误会被捕获并记录
   - ✅ 提供详细的错误信息（代码、参数、错误堆栈）
   - ✅ 不会中断整个表单的运行

4. **类型安全**
   - ✅ 提供完整的 TypeScript 类型定义
   - ✅ 编译时检查函数签名
   - ✅ 运行时参数验证

### 8.2 安全最佳实践

**❌ 不安全的做法**

```typescript
// ❌ 不要注入危险的全局对象
<DynamicForm
  helpers={{
    window: window,     // 危险，扩大脚本可访问能力
    document: document, // 危险，扩大脚本可访问能力
    eval: eval,         // 危险，扩大脚本可访问能力
  }}
/>
```

**✅ 安全的做法**

```typescript
// ✅ 只注入必要的工具函数
<DynamicForm
  helpers={{
    ofetch: ofetch.create({ baseURL: '/api' }),
    _: lodash,
    dayjs: dayjs,
    myUtils: {
      formatDate: (date) => dayjs(date).format('YYYY-MM-DD'),
      formatCurrency: (value) => new Intl.NumberFormat().format(value),
    },
  }}
/>
```

## 9. 实现计划

### 9.1 Phase 1：核心基础设施（第 1-2 周）

**目标**：搭建 Helpers 系统的基础架构

**任务**：
1. ✅ **创建 HelpersContext**
   - 实现 `contexts/HelpersContext.tsx`
   - 提供 `useHelpers` hook
   - 添加类型定义

2. ✅ **定义内置 Helpers**
   - 集成 lodash
   - 集成 Zod
   - 集成 ofetch，提供跨浏览器和 Node.js 环境的一致请求能力
   - 添加完整的 TypeScript 类型定义

3. ✅ **更新 DynamicForm Props**
   - 添加 `helpers` prop
   - 实现 helpers 合并逻辑
   - 通过 Context 传递 helpers

4. ✅ **更新 executeInlineScript**
   - 支持 helpers 参数注入
   - 改进错误处理
   - 添加类型安全

**验收标准**：
- HelpersContext 正常工作
- 可以通过 DynamicForm props 注入自定义 helpers
- 内置 helpers 可以在 Context 中访问
- 单元测试覆盖率 > 80%

### 9.2 Phase 2：函数签名更新（第 3-4 周）

**目标**：更新所有相关函数签名以支持 helpers

**任务**：
1. ✅ **更新 Linkage Functions**
   - 修改 LinkageManager 构造函数
   - 更新 executeLinkageFunction 方法
   - 支持对象参数形式

2. ✅ **更新 Validators**
   - 修改 SchemaValidator 构造函数
   - 更新 executeValidator 方法
   - 支持异步验证

3. ✅ **更新 Transform Functions**
   - 修改 transform 执行逻辑
   - 支持对象参数形式
   - 保持同步转换，不支持异步 transform

4. ✅ **更新 Callback Props**
   - 修改 callbackProps 执行逻辑
   - 支持对象参数形式
   - 支持异步回调

**验收标准**：
- 所有函数类型支持新签名（对象参数）
- 所有相关测试用例更新完成
- 集成测试通过

### 9.3 Phase 3：文档和示例（第 5 周）

**目标**：完善文档和使用示例

**任务**：
1. ✅ **更新 README**
   - 添加 Helpers 系统说明
   - 提供基础使用示例
   - 说明内置 helpers
   - 说明如何注入自定义 helpers

2. ✅ **编写 API 文档**
   - 完整的类型定义文档
   - 函数签名说明
   - 参数说明
   - 返回值说明

3. ✅ **创建使用示例**
   - 基础示例（使用内置 helpers）
   - 自定义 helpers 示例
   - 异步操作示例
   - 完整应用示例

**验收标准**：
- 文档完整清晰
- 示例代码可运行
- 开发者可以快速上手

### 9.4 Phase 4：测试和优化（第 6 周）

**目标**：全面测试和性能优化

**任务**：
1. ✅ **单元测试**
   - HelpersContext 测试
   - executeInlineScript 测试
   - 各个函数类型的测试

2. ✅ **集成测试**
   - 完整表单场景测试
   - 异步操作测试
   - 错误处理测试
   - 边界情况测试

3. ✅ **性能测试**
   - helpers 注入性能
   - 函数执行性能
   - 内存占用测试
   - 优化建议

4. ✅ **安全性审计**
   - 代码注入风险评估
   - 依赖安全性检查
   - 错误处理安全性
   - 最佳实践指南

**验收标准**：
- 单元测试覆盖率 > 90%
- 集成测试覆盖主要场景
- 无明显性能瓶颈
- 通过安全性审计

### 9.5 关键里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1: 核心基础设施完成 | 第 2 周 | HelpersContext、内置 helpers、基础类型定义 |
| M2: 函数签名更新完成 | 第 4 周 | 所有函数类型支持新签名 |
| M3: 文档和示例完成 | 第 5 周 | 完整文档、使用示例 |
| M4: 测试和优化完成 | 第 6 周 | 测试覆盖、性能优化、安全审计 |
| 正式发布 | 第 6 周末 | 正式版本发布 |

### 9.6 风险和应对

**风险 1：性能影响**
- **影响**：helpers 注入可能影响性能
- **应对**：
  - 使用 useMemo 缓存 helpers
  - 优化 Context 传递
  - 进行性能测试和优化
  - 提供性能最佳实践

**风险 2：安全性问题**
- **影响**：不当使用可能导致安全漏洞
- **应对**：
  - 限制可访问的全局对象
  - 提供安全最佳实践指南
  - 进行安全性审计
  - 在文档中明确安全注意事项

**风险 3：学习成本**
- **影响**：开发者需要学习新的 API
- **应对**：
  - 提供详细的文档和示例
  - 提供快速上手指南
  - 在社区中推广最佳实践

## 10. 总结

Helpers 系统为 DynamicForm 提供了强大的扩展能力，使得 inline script 和 callbacks 可以：

1. **异步操作**：调用 API、执行异步验证等
2. **工具库支持**：使用 ofetch、lodash、Zod 等常用库
3. **自定义扩展**：注入业务逻辑和自定义工具函数
4. **类型安全**：完整的 TypeScript 类型定义
5. **向后兼容**：不破坏现有代码

**核心优势**：
- ✅ 提升开发效率（内置常用工具）
- ✅ 增强灵活性（支持自定义扩展）
- ✅ 明确执行边界（依赖注入机制，不提供安全沙箱）
- ✅ 易于维护（统一的函数签名）
- ✅ 向后兼容（平滑升级路径）

**下一步行动**：
1. 按照实现计划分阶段推进
2. 关注向后兼容性和性能
3. 完善文档和示例
4. 收集社区反馈并持续改进

---

**文档版本**：v1.0  
**最后更新**：2026-08-07  
**维护者**：DynamicForm 团队
