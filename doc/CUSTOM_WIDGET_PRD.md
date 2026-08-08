# 自定义 Widget 管理系统 - 产品需求文档 (PRD)

## 文档信息

- **版本**：v1.0
- **创建日期**：2026-08-08
- **产品**：Dynamic Form - 自定义 Widget 管理系统
- **状态**：待评审

---

## 1. 产品概述

### 1.1 背景

目前 DynamicForm 支持的所有 widget 都是内置的，当需要新的 widget 类型时，必须修改代码、重新编译和部署。这种方式存在以下问题：

- **灵活性不足**：无法快速响应业务需求
- **开发成本高**：每次新增 widget 都需要走完整的开发流程
- **维护困难**：widget 代码散落在各个项目中，难以统一管理
- **复用性差**：其他项目无法直接使用已有的 widget

### 1.2 产品目标

构建一个**独立的 Widget 管理系统**，允许用户通过可视化界面创建、编辑和管理自定义 widget，实现以下目标：

1. **降低开发门槛**：业务开发者可以通过编写代码快速创建 widget
2. **提高复用性**：自定义 widget 保存在数据库中，所有项目共享
3. **实时生效**：widget 修改后无需重新部署即可在所有使用的页面生效
4. **独立管理**：Widget 管理系统与 DynamicForm 解耦，可独立维护和扩展

### 1.3 核心价值

- **For 业务开发者**：快速创建满足特定业务需求的表单组件
- **For 前端团队**：统一管理和维护组件库，提高代码复用率
- **For 产品团队**：缩短需求响应时间，快速验证产品想法

---

## 2. 用户角色与权限

### 2.1 用户角色

| 角色              | 描述                         | 典型用户                      |
| ----------------- | ---------------------------- | ----------------------------- |
| **Widget 开发者** | 创建和编辑自定义 widget      | 前端开发工程师、全栈工程师    |
| **Widget 管理员** | 审核、发布和下架 widget      | 技术负责人、架构师            |
| **Widget 使用者** | 在 DynamicForm 中使用 widget | 所有使用 DynamicForm 的开发者 |

### 2.2 权限矩阵

| 操作                      | Widget 开发者 | Widget 管理员 | Widget 使用者 |
| ------------------------- | ------------- | ------------- | ------------- |
| 查看 widget 列表          | ✅            | ✅            | ✅            |
| 创建 widget               | ✅            | ✅            | ❌            |
| 编辑自己的 widget 代码    | ✅            | ✅            | ❌            |
| 编辑他人的 widget 代码    | ❌            | ✅            | ❌            |
| 重命名自己的 widget       | ✅            | ✅            | ❌            |
| 重命名他人的 widget       | ❌            | ✅            | ❌            |
| 删除 widget               | ❌            | ✅            | ❌            |
| 发布 widget               | ❌            | ✅            | ❌            |
| 下架 widget               | ❌            | ✅            | ❌            |
| 使用 widget               | ✅            | ✅            | ✅            |

**说明**：
- **编辑代码**：修改 Widget 的实现代码，涉及版本管理，影响功能
- **重命名**：修改 Widget 的唯一标识名称，不影响功能，但会影响引用

---

## 3. 功能需求

### 3.1 Widget 管理列表页

#### 3.1.1 页面布局

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  自定义 Widget 管理                                      [+ 创建 Widget]      │
├─────────────────────────────────────────────────────────────────────────────┤
│  🔍 按名称搜索  | 👤 创建人筛选 | ⚙️ 状态筛选                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Widget 名称  │ 创建人 │ 状态   │ 创建时间      │ 最后修改时间 │ 操作 │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │  data-table   │ 张三   │ 已发布 │ 2026-08-01   │ 2026-08-05  │ ...  │   │
│  │  color-picker │ 李四   │ 草稿   │ 2026-08-03   │ 2026-08-06  │ ...  │   │
│  │  date-range   │ 王五   │ 已发布 │ 2026-08-02   │ 2026-08-07  │ ...  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                             [< 上一页]  [下一页 >]           │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3.1.2 核心功能

**搜索与筛选**：

- 按 widget 名称搜索
- 按创建人筛选
- 按状态筛选（草稿、已发布、已下架）

**列表展示**：

- Widget 名称
- 创建人
- 状态（带颜色标识：草稿-灰色、已发布-绿色、已下架-红色）
- 创建时间
- 最后修改时间
- 操作按钮：
  - **编辑代码**：跳转到编辑器页面修改 Widget 代码
  - **重命名**：直接在列表页修改 Widget 名称（弹窗输入）
  - **删除**：删除 Widget（需确认）
  - **发布/下架**：改变 Widget 状态（仅管理员）

**批量操作**：

- 批量删除（仅管理员）
- 批量发布（仅管理员）
- 批量下架（仅管理员）

**排序**：

- 按创建时间排序（默认降序）
- 按最后修改时间排序
- 按名称排序

#### 3.1.3 Widget 状态流转

```
草稿 (Draft) → 已发布 (Published) → 已下架 (Archived)
     ↑              ↓                      ↓
     └──────────────┴──────────────────────┘
```

- **草稿**：刚创建或编辑中的 widget，仅创建者和管理员可见
- **已发布**：经过审核的 widget，所有用户可用
- **已下架**：不再推荐使用的 widget，已使用的页面仍可正常工作

### 3.2 Widget 编辑器页面

#### 3.2.1 页面布局（所见即所得）

```
┌─────────────────────────────────────────────────────────────────┐
│  [widget-name]  [状态：草稿]         [保存草稿] [提交审核] [返回] │
├───────────────────────────────┬─────────────────────────────────┤
│                               │                                 │
│  代码编辑区 (CodeEditor)       │       实时预览区域               │
│                               │                                 │
│  export const MyWidget = (    │   根据左侧代码和配置的 Props      │
│    { value, onChange }        │   实时渲染 Widget 效果           │
│  ) => {                       │                                 │
│    // Widget 实现代码         │                                 │
│    return <Input              │                                 │
│      value={value}            │                                 │
│      onChange={onChange}      │                                 │
│      {...props}               │                                 │
│    />;                        │                                 │
│  };                           │   [⚙️ 配置 Props]                │
│                               │                                 │
│  [📋 代码模板 ▼]               │                                 │
│                               │                                 │
└───────────────────────────────┴─────────────────────────────────┘
```

**Props 配置弹窗**：

点击"⚙️ 配置 Props"按钮后弹出：

```
┌─────────────────────────────────────────────────┐
│  配置 Widget Props                    [×]       │
├─────────────────────────────────────────────────┤
│  在下方编辑器中以 JavaScript 对象字面量形式     │
│  配置 Widget 的 props（支持函数）               │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ {                                       │   │
│  │   value: "test value",                  │   │
│  │   placeholder: "Enter text...",         │   │
│  │   error: "This is an error",            │   │
│  │   readonly: true,                       │   │
│  │   onChange: (val) => {                  │   │
│  │     console.log('Value changed:', val); │   │
│  │   },                                    │   │
│  │   options: [                            │   │
│  │     { label: 'Option 1', value: '1' },  │   │
│  │     { label: 'Option 2', value: '2' },  │   │
│  │   ]                                     │   │
│  │ }                                       │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│                          [取消]  [应用]         │
└─────────────────────────────────────────────────┘
```

**说明**：
- 弹窗中使用 `CodeEditor` 组件（`language="javascript"`）
- 用户可以直接编写 JavaScript 对象字面量
- 支持编写函数（如 `onChange` 回调）
- 点击"应用"后，配置的 props 会实时传递给预览区的 Widget
- 编译错误和运行时错误会直接在预览区域以红色背景显示
- 开发者可以打开浏览器控制台查看详细的 console 输出

#### 3.2.2 核心功能

**Widget 元信息**（在顶部栏显示和编辑）：

- **Widget 名称**：唯一标识（kebab-case，例如：`my-data-table`）
- **状态标识**：当前 widget 的状态（草稿/已发布/已下架）

**代码编辑区**：

- 使用 CodeMirror 6 直接在页面上编辑代码
- 语言设置：`javascript`（支持 JSX/TSX 语法）
- 支持语法高亮、代码补全、括号匹配
- 支持搜索、折叠、历史记录等基础功能
- 实时编译预览（防抖 500ms）

**实时预览区**：

- 根据代码编辑区的内容实时编译并渲染 widget
- 通过"⚙️ 配置 Props"按钮打开 Props 配置弹窗
- 编译错误和运行时错误直接在预览区显示（红色背景提示）

**Props 配置弹窗**：

- **实现方式**：
  - 使用 CodeMirror 6 直接编辑 JavaScript 代码
  - 用户以 JavaScript 对象字面量形式编写 Props 配置
  - 支持所有 JavaScript 语法，包括函数

- **配置示例**：
  ```javascript
  {
    value: "test value",
    placeholder: "Enter text...",
    error: "This is an error message",
    readonly: true,
    disabled: false,
    onChange: (val) => {
      console.log('Value changed:', val);
    },
    options: [
      { label: 'Option 1', value: '1' },
      { label: 'Option 2', value: '2' },
    ]
  }
  ```

- **生效方式**：
  - 点击"应用"按钮后，配置的 Props 会实时传递给预览区的 Widget
  - Widget 会接收到配置的所有 props
  - 函数会被正常执行（如 `onChange` 回调）

- **持久化**：
  - Props 配置仅保存在浏览器 LocalStorage 中（用于当前编辑会话）
  - 不会保存到数据库（Props 配置仅用于预览测试）

#### 3.2.3 代码模板

系统提供一套通用的 Widget 代码模板，包含基本的代码骨架和可用依赖说明：

```typescript
/**
 * 自定义 Widget 模板
 * 
 * 可用依赖（已自动注入，可直接使用）：
 * - React, { useState, useEffect, useMemo, useCallback, useRef, useContext, forwardRef }
 * - @blueprintjs/core（所有组件，如 Button, Input, Select 等）
 * - @blueprintjs/icons（所有图标）
 * - helpers.ofetch（HTTP 请求工具）
 * - helpers._（Lodash 完整功能）
 * - helpers.z（Zod 运行时校验）
 * 
 * Widget Props 接口（FieldWidgetProps）：
 * - name: string（字段名称）
 * - label?: string（字段标签）
 * - value?: any（字段值）
 * - onChange?: (value: any) => void（值变更回调）
 * - onBlur?: () => void（失焦回调）
 * - disabled?: boolean（是否禁用）
 * - readonly?: boolean（是否只读）
 * - required?: boolean（是否必填）
 * - error?: string（错误信息）
 * - placeholder?: string（占位符）
 * - options?: Array<{ label: string; value: any }>（选项数据）
 * - schema?: ExtendedJSONSchema（字段 schema）
 * - ...其他自定义 props
 */

import React, { useState } from 'react';
import { FormGroup, InputGroup, Intent } from '@blueprintjs/core';

export default function MyCustomWidget({
  name,
  label,
  value = '',
  onChange,
  onBlur,
  disabled = false,
  readonly = false,
  required = false,
  error,
  placeholder,
  ...otherProps
}) {
  // 在这里添加你的状态管理逻辑
  const [internalState, setInternalState] = useState('');

  // 在这里添加你的业务逻辑
  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange?.(newValue);
  };

  // 在这里实现你的 UI
  return (
    <FormGroup
      label={label}
      labelFor={name}
      labelInfo={required ? '(required)' : undefined}
      helperText={error}
      intent={error ? Intent.DANGER : Intent.NONE}
    >
      <InputGroup
        id={name}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        readOnly={readonly}
        placeholder={placeholder}
        intent={error ? Intent.DANGER : Intent.NONE}
      />
    </FormGroup>
  );
}
```

**模板说明**：
- 顶部注释列出了所有可用的依赖和 Props 接口
- 提供了基本的组件结构和常见逻辑处理
- 用户可以在此基础上添加自己的业务逻辑
- 示例展示了如何处理表单状态、错误提示、禁用/只读等常见场景

### 3.3 Widget 使用流程

#### 3.3.1 在 DynamicForm 中使用

**步骤 1：加载自定义 widget**

```typescript
// 在页面初始化时调用 API 获取所有已发布的 widget
const customWidgets = await fetchCustomWidgets();

// 传递给 DynamicForm
<DynamicForm
  schema={schema}
  widgets={customWidgets}  // 动态注入
  onSubmit={handleSubmit}
/>
```

**步骤 2：在 schema 中引用**

```typescript
const schema = {
  type: 'object',
  properties: {
    dataTable: {
      type: 'object',
      title: 'Data Table',
      ui: {
        widget: 'my-data-table', // 使用自定义 widget 名称
      },
    },
  },
}
```

**步骤 3：自动渲染**

DynamicForm 会按照以下优先级选择 widget：

1. 通过 `widgets` prop 传入的自定义 widget
2. DynamicForm 内置的 widget

#### 3.3.2 在 SchemaBuilder 中使用

```typescript
// 在页面初始化时调用 API 获取所有已发布的 widget
const customWidgets = await fetchCustomWidgets();

<SchemaBuilder
  customWidgets={customWidgets}  // 传入自定义 widget 列表
  onChange={handleSchemaChange}
/>
```

**效果**：

- SchemaBuilder 的组件面板中会展示自定义 widget
- 按分类分组展示（与内置 widget 混合展示）
- 拖拽到画布后自动生成对应的 schema 配置

---

## 4. 非功能需求

### 4.1 性能要求

- **加载性能**：Widget 列表页首屏加载时间 < 1s
- **编译性能**：代码编译时间 < 500ms（单个 widget）
- **渲染性能**：实时预览响应时间 < 100ms
- **API 性能**：获取 widget 列表接口响应时间 < 500ms

### 4.2 安全要求

- **代码审查**：静态代码分析，禁止使用危险 API
- **沙箱隔离**：运行时沙箱环境，限制全局对象访问
- **权限控制**：严格的 RBAC 权限控制
- **审计日志**：记录所有 widget 的创建、修改、发布操作

### 4.3 可用性要求

- **错误提示**：友好的错误提示信息（编译错误、运行时错误）
- **代码提示**：智能代码补全和类型提示
- **操作引导**：首次使用时提供操作引导
- **帮助文档**：完善的 API 文档和示例

### 4.4 兼容性要求

- **浏览器兼容**：支持 Chrome、Firefox、Safari、Edge 最新两个版本
- **DynamicForm 版本**：兼容 DynamicForm v1.0+
- **向后兼容**：widget 代码格式变更需保证向后兼容

---

## 5. 数据模型

### 5.1 Widget 数据结构

```typescript
interface CustomWidget {
  // 基本信息
  id: string // UUID
  name: string // Widget 唯一标识（kebab-case）

  // 代码
  code: string // Widget 代码（字符串）
  compiledCode?: string // 编译后的代码（可选，缓存用）

  // 状态
  status: WidgetStatus // 草稿 | 已发布 | 已下架

  // 版本管理
  version: number // 当前版本号（从 1 开始）
  latestPublishedVersion?: number // 最新已发布版本号

  // 元数据
  createdBy: string // 创建者 ID
  createdAt: Date // 创建时间
  updatedBy: string // 最后修改者 ID
  updatedAt: Date // 最后修改时间
  publishedBy?: string // 发布者 ID
  publishedAt?: Date // 发布时间

  // 统计
  usageCount: number // 使用次数
}

type WidgetStatus =
  | 'draft' // 草稿
  | 'published' // 已发布
  | 'archived' // 已下架
```

### 5.2 Widget 版本历史数据结构

为了支持版本管理，需要额外的版本历史表：

```typescript
interface WidgetVersion {
  id: string // 版本记录 ID
  widgetId: string // 关联的 widget ID
  version: number // 版本号
  code: string // 该版本的代码
  compiledCode?: string // 编译后的代码
  status: WidgetStatus // 版本状态
  changelog?: string // 版本变更说明
  createdBy: string // 创建者 ID
  createdAt: Date // 创建时间
  publishedBy?: string // 发布者 ID
  publishedAt?: Date // 发布时间
}
```

**版本管理机制**：

1. **自动版本控制**：
   - 每次发布 widget 时自动创建新版本记录
   - 版本号自动递增（v1, v2, v3...）
   - 保留所有历史版本的代码

2. **版本回滚**：
   - 支持将 widget 回滚到任意历史版本
   - 回滚后创建新版本（而非直接覆盖）

3. **版本对比**：
   - 支持查看任意两个版本之间的代码差异
   - diff 视图高亮显示变更内容

4. **版本说明**：
   - 发布时可填写版本变更说明（changelog）
   - 自动记录发布者和发布时间

### 5.2 数据库表设计

**表名**：`custom_widgets`

| 字段名        | 类型         | 约束             | 说明                |
| ------------- | ------------ | ---------------- | ------------------- |
| id            | VARCHAR(36)  | PRIMARY KEY      | UUID                |
| name          | VARCHAR(100) | UNIQUE, NOT NULL | Widget 名称（唯一） |
| display_name  | VARCHAR(200) | NOT NULL         | 显示名称            |
| category      | VARCHAR(50)  | NOT NULL         | 分类                |
| tags          | JSON         |                  | 标签数组            |
| description   | TEXT         |                  | 描述                |
| icon          | VARCHAR(500) |                  | 图标                |
| code          | TEXT         | NOT NULL         | 代码                |
| compiled_code | TEXT         |                  | 编译后代码（缓存）  |
| status        | VARCHAR(20)  | NOT NULL         | 状态                |
| created_by    | VARCHAR(36)  | NOT NULL         | 创建者 ID           |
| created_at    | TIMESTAMP    | NOT NULL         | 创建时间            |
| updated_by    | VARCHAR(36)  | NOT NULL         | 最后修改者 ID       |
| updated_at    | TIMESTAMP    | NOT NULL         | 最后修改时间        |
| published_by  | VARCHAR(36)  |                  | 发布者 ID           |
| published_at  | TIMESTAMP    |                  | 发布时间            |
| usage_count   | INT          | DEFAULT 0        | 使用次数            |
| version       | INT          | DEFAULT 1        | 版本号              |

**索引**：

- PRIMARY KEY: `id`
- UNIQUE KEY: `name`
- INDEX: `status`, `category`, `created_by`
- INDEX: `created_at DESC`（用于排序）

---

## 6. API 接口

### 6.1 Widget 管理接口

#### 6.1.1 获取 Widget 列表

```
GET /api/custom-widgets
```

**Query 参数**：

- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 20）
- `search`: 搜索关键词
- `category`: 分类筛选
- `tags`: 标签筛选（逗号分隔）
- `status`: 状态筛选
- `sortBy`: 排序字段（createdAt | updatedAt | name）
- `sortOrder`: 排序方向（asc | desc）

**响应**：

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "my-data-table",
        "displayName": "数据表格",
        "category": "table",
        "tags": ["高级", "数据展示"],
        "status": "published",
        "createdBy": "user-id",
        "createdAt": "2026-08-08T10:00:00Z",
        "updatedAt": "2026-08-08T11:00:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 6.1.2 获取单个 Widget 详情

```
GET /api/custom-widgets/:id
```

**响应**：

```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "name": "my-data-table",
    "code": "export const MyWidget = () => { ... }",
    ...
  }
}
```

#### 6.1.3 创建 Widget

```
POST /api/custom-widgets
```

**请求体**：

```json
{
  "name": "my-data-table",
  "displayName": "数据表格",
  "category": "table",
  "tags": ["高级", "数据展示"],
  "description": "...",
  "icon": "table",
  "code": "export const MyWidget = () => { ... }"
}
```

#### 6.1.4 更新 Widget

```
PUT /api/custom-widgets/:id
```

#### 6.1.5 删除 Widget

```
DELETE /api/custom-widgets/:id
```

#### 6.1.6 发布 Widget

```
POST /api/custom-widgets/:id/publish
```

#### 6.1.7 下架 Widget

```
POST /api/custom-widgets/:id/archive
```

### 6.2 Widget 使用接口

#### 6.2.1 获取所有已发布的 Widget（用于 DynamicForm）

```
GET /api/custom-widgets/published
```

**响应**：

```json
{
  "code": 0,
  "data": [
    {
      "name": "my-data-table",
      "code": "export const MyWidget = () => { ... }"
    }
  ]
}
```

---

## 7. 用户故事

### 7.1 Story 1：创建自定义 Widget

**作为** Widget 开发者  
**我想要** 通过可视化编辑器创建一个新的 Widget  
**以便于** 在 DynamicForm 中使用该 Widget

**验收标准**：

- [ ] 能够访问 Widget 编辑器页面
- [ ] 能够填写 Widget 基本信息（名称、分类、描述等）
- [ ] 能够编写 Widget 代码，支持语法高亮和代码提示
- [ ] 能够实时预览 Widget 渲染效果
- [ ] 能够保存为草稿
- [ ] 保存后能在 Widget 列表中看到新创建的 Widget

### 7.2 Story 2：发布 Widget

**作为** Widget 管理员  
**我想要** 审核并发布 Widget  
**以便于** 其他开发者可以使用该 Widget

**验收标准**：

- [ ] 能够查看草稿状态的 Widget
- [ ] 能够预览 Widget 效果
- [ ] 能够发布 Widget
- [ ] 发布后 Widget 状态变更为"已发布"
- [ ] 发布后所有用户都能看到该 Widget

### 7.3 Story 3：在 DynamicForm 中使用自定义 Widget

**作为** Widget 使用者  
**我想要** 在 DynamicForm 中使用自定义 Widget  
**以便于** 渲染符合业务需求的表单字段

**验收标准**：

- [ ] 能够通过 API 获取所有已发布的 Widget
- [ ] 能够将 Widget 通过 `widgets` prop 传递给 DynamicForm
- [ ] 能够在 schema 中通过 `ui.widget` 引用自定义 Widget
- [ ] DynamicForm 能够正确渲染自定义 Widget
- [ ] 自定义 Widget 能够正常接收和更新表单数据

### 7.4 Story 4：在 SchemaBuilder 中使用自定义 Widget

**作为** Schema 设计者  
**我想要** 在 SchemaBuilder 中看到自定义 Widget  
**以便于** 通过拖拽方式使用自定义 Widget

**验收标准**：

- [ ] SchemaBuilder 的组件面板中能够展示自定义 Widget
- [ ] 自定义 Widget 按分类分组展示
- [ ] 能够拖拽自定义 Widget 到画布
- [ ] 拖拽后自动生成对应的 schema 配置

---

## 8. 成功指标

### 8.1 业务指标

- **Widget 数量**：3 个月内创建 ≥ 20 个自定义 Widget
- **使用率**：≥ 50% 的 DynamicForm 使用至少 1 个自定义 Widget
- **复用率**：每个 Widget 平均被 ≥ 3 个页面使用

### 8.2 技术指标

- **性能**：Widget 加载时间 < 500ms
- **稳定性**：Widget 运行时错误率 < 1%
- **可用性**：系统可用性 ≥ 99.9%

---

## 9. 里程碑计划

### Phase 1：核心功能开发（4 周）

- Week 1-2：Widget 编辑器页面 + 代码编译模块
- Week 3：Widget 管理列表页
- Week 4：后端 API + 数据库

### Phase 2：集成与测试（2 周）

- Week 5：DynamicForm 集成 + SchemaBuilder 集成
- Week 6：测试 + Bug 修复

### Phase 3：上线与优化（2 周）

- Week 7：灰度发布 + 文档编写
- Week 8：正式发布 + 用户培训

---

## 10. 风险与依赖

### 10.1 风险

| 风险           | 影响 | 概率 | 缓解措施                      |
| -------------- | ---- | ---- | ----------------------------- |
| 代码安全性问题 | 高   | 中   | 严格的静态代码检查 + 沙箱隔离 |
| 性能问题       | 中   | 低   | 编译缓存 + 懒加载             |
| 兼容性问题     | 中   | 中   | 充分的兼容性测试              |

### 10.2 依赖

- DynamicForm 需要支持 `widgets` prop
- SchemaBuilder 需要支持 `customWidgets` prop
- 需要后端团队配合开发 API

---

## 11. 附录

### 11.1 术语表

- **Widget**：表单字段渲染组件
- **Schema**：JSON Schema 格式的表单结构定义
- **DynamicForm**：动态表单组件
- **SchemaBuilder**：可视化 Schema 编辑器

### 11.2 参考资料

- DynamicForm 文档：`README.md`
- Blueprint.js 文档：https://blueprintjs.com/
- JSON Schema 规范：https://json-schema.org/

---

**文档结束**
