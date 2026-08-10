# 自定义 Widget 管理系统 - 技术设计文档

## 文档信息

- **版本**：v1.0
- **创建日期**：2026-08-08
- **依赖 PRD**：CUSTOM_WIDGET_PRD.md v1.0
- **状态**：部分实现；服务端与安全隔离部分为提案/未实现

> **阅读说明（2026-08-10）**
>
> 本文保留完整的目标架构、数据模型、API、权限、部署和监控设计，便于后续实施；这些设计并不都代表当前代码。
>
> **当前已经实现：** 前端 Widget 管理页面、内存 Mock API、Widget 编译器、动态加载器、实例级缓存，以及基于动态 `Function` 的执行器。
>
> **提案/未实现：** 真实后端 API、数据库表、版本历史与回滚、RBAC、审核流程、CDN/懒加载、生产监控和不可信代码安全沙箱。第 3、4、6、7、8 章及第 5 章中的未来优化均按提案阅读。
>
> 当前事实来源：`src/features/widget-manager/services/widgetApi.ts`、`src/components/DynamicForm/utils/widgetLoader.ts`、`src/components/DynamicForm/hooks/useCustomWidgets.ts` 和 `src/utils/widgetSandbox.ts`。

---

## 1. 技术架构概览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      前端应用层                              │
│  ┌────────────────────┐  ┌────────────────────────────┐   │
│  │  Widget 管理模块    │  │  Widget 使用模块           │   │
│  │  - 列表页          │  │  - DynamicForm 集成        │   │
│  │  - 编辑器页        │  │  - SchemaBuilder 集成      │   │
│  └────────────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Widget 编译执行层                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Widget Compiler (Babel Standalone)            │  │
│  │  - 语法转换 (JSX → JS)                               │  │
│  │  - ES Module → CommonJS                              │  │
│  │  - 安全检查                                           │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Dependency Injector (依赖注入器)              │  │
│  │  - React & Hooks                                     │  │
│  │  - Blueprint.js                                      │  │
│  │  - DynamicForm helpers (ofetch, _, z)               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Sandbox Executor (沙箱执行器)                 │  │
│  │  - Function Constructor 执行                         │  │
│  │  - 作用域隔离                                         │  │
│  │  - 错误捕获                                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               后端 API 层（提案/未实现）                    │
│  - Widget CRUD 接口                                         │
│  - Widget 版本管理接口                                       │
│  - Widget 发布/下架接口                                      │
│  - 权限验证                                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│               数据存储层（提案/未实现）                     │
│  - custom_widgets 表（主表）                                │
│  - widget_versions 表（版本历史）                           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计原则

1. **解耦设计**：Widget 管理模块与 DynamicForm 完全解耦，通过 API 和 props 接口通信
2. **安全优先（目标）**：未来需要为不可信代码提供真正的安全隔离；当前动态执行器不是安全沙箱
3. **性能优化**：当前只有 WidgetLoader 实例级编译结果缓存；懒加载、增量编译仍是提案
4. **版本管理（提案）**：完整的版本控制和回滚机制尚未实现
5. **向后兼容**：API 和数据格式变更需保证向后兼容

---

## 2. 前端技术设计

### 2.1 技术栈

- **框架**：React 18.3 + TypeScript 5.9
- **构建工具**：Vite 7.2
- **状态管理**：Zustand 5.0（Widget 管理状态）
- **UI 组件库**：Blueprint.js 6.4
- **代码编辑器**：CodeMirror 6（直接使用 CodeMirrorView 组件）
- **编译器**：Babel Standalone
- **HTTP 请求**：ofetch

### 2.2 目录结构

```
src/
├── features/
│   └── widget-manager/              # Widget 管理模块（独立模块）
│       ├── pages/
│       │   ├── WidgetListPage.tsx   # Widget 列表页
│       │   └── WidgetEditorPage.tsx # Widget 编辑器页
│       ├── components/
│       │   ├── WidgetList/          # Widget 列表组件
│       │   ├── WidgetEditor/        # Widget 编辑器组件
│       │   ├── WidgetPreview/       # Widget 预览组件
│       │   └── VersionHistory/      # 版本历史组件
│       ├── hooks/
│       │   ├── useWidgetList.ts     # Widget 列表数据管理
│       │   ├── useWidgetEditor.ts   # Widget 编辑器状态管理
│       │   └── useWidgetCompiler.ts # Widget 编译 Hook
│       ├── services/
│       │   ├── widgetApi.ts         # Widget API 请求封装
│       │   └── widgetCompiler.ts    # Widget 编译服务
│       ├── stores/
│       │   └── widgetStore.ts       # Widget 全局状态管理
│       └── types/
│           └── widget.ts            # Widget 类型定义
├── components/
│   └── DynamicForm/
│       ├── hooks/
│       │   └── useCustomWidgets.ts  # 自定义 Widget 加载 Hook
│       └── utils/
│           └── widgetLoader.ts      # Widget 动态加载工具
└── utils/
    └── widgetSandbox.ts             # Widget 沙箱执行工具
```

### 2.3 核心模块设计

#### 2.3.1 Widget 编译服务

**职责**：将用户编写的 JSX/TSX 代码编译为可执行的 JavaScript

**实现**：

```typescript
// src/features/widget-manager/services/widgetCompiler.ts
import { transform } from '@babel/standalone';

export interface CompileResult {
  success: boolean;
  code?: string;
  error?: string;
}

export class WidgetCompiler {
  private babelConfig = {
    presets: [
      ['react', { runtime: 'automatic' }],
      'typescript',
    ],
    plugins: ['transform-modules-commonjs'],
    filename: 'widget.tsx',
  };

  /**
   * 编译 Widget 代码
   */
  compile(sourceCode: string): CompileResult {
    try {
      // 静态安全检查
      this.securityCheck(sourceCode);

      // Babel 转译
      const result = transform(sourceCode, this.babelConfig);

      return {
        success: true,
        code: result.code || '',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compilation failed',
      };
    }
  }

  /**
   * 安全检查：禁止使用危险 API
   */
  private securityCheck(code: string): void {
    const dangerousPatterns = [
      /\beval\s*\(/,
      /\bFunction\s*\(/,
      /\b__proto__\b/,
      /\bconstructor\s*\[/,
      /\bwindow\s*\[/,
      /\bdocument\.write\b/,
      /\bimportScripts\b/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Security violation: dangerous pattern detected`);
      }
    }
  }
}
```

#### 2.3.2 Widget 沙箱执行器

**职责**：在安全的沙箱环境中执行编译后的代码

**实现**：

```typescript
// src/utils/widgetSandbox.ts
import React from 'react';
import * as BlueprintCore from '@blueprintjs/core';
import * as BlueprintIcons from '@blueprintjs/icons';
import { builtInHelpers } from '@/components/DynamicForm/utils/builtInHelpers';

export interface ExecuteResult {
  success: boolean;
  component?: React.ComponentType<any>;
  error?: string;
}

export class WidgetSandbox {
  /**
   * 创建沙箱环境
   * 
   * 关键设计：helpers 通过沙箱注入，不侵入 widget props
   * - 用户代码中的 import 语句会被 Babel 转换为 require() 调用
   * - require() 函数映射到预定义的依赖对象
   * - Widget 组件的 props 保持纯净，只包含表单字段相关属性
   */
  private createSandbox() {
    const moduleExports = {};

    return {
      // React 核心（直接注入，也支持 require('react')）
      React,
      useState: React.useState,
      useEffect: React.useEffect,
      useMemo: React.useMemo,
      useCallback: React.useCallback,
      useRef: React.useRef,
      useContext: React.useContext,
      forwardRef: React.forwardRef,

      // Blueprint.js（展开所有组件，方便直接使用）
      ...BlueprintCore,
      Icons: BlueprintIcons,

      // DynamicForm helpers（通过沙箱注入，不通过 props 传递）
      helpers: builtInHelpers,
      ofetch: builtInHelpers.ofetch,
      _: builtInHelpers._,
      lodash: builtInHelpers._,
      z: builtInHelpers.z,
      zod: builtInHelpers.z,

      // CommonJS 模块系统
      module: { exports: moduleExports },
      exports: moduleExports,
      require: (moduleName: string) => {
        // React 相关
        if (moduleName === 'react') return React;
        if (moduleName === 'react/jsx-runtime') return require('react/jsx-runtime');
        
        // Blueprint.js
        if (moduleName === '@blueprintjs/core') return BlueprintCore;
        if (moduleName === '@blueprintjs/icons') return BlueprintIcons;
        
        // DynamicForm helpers
        if (moduleName === 'helpers') return builtInHelpers;
        if (moduleName === 'ofetch') return builtInHelpers.ofetch;
        if (moduleName === 'lodash' || moduleName === '_') return builtInHelpers._;
        if (moduleName === 'zod' || moduleName === 'z') return builtInHelpers.z;
        
        throw new Error(`Module "${moduleName}" is not available in sandbox`);
      },

      // 受控的 console
      console: {
        log: (...args: any[]) => console.log('[Widget]', ...args),
        warn: (...args: any[]) => console.warn('[Widget]', ...args),
        error: (...args: any[]) => console.error('[Widget]', ...args),
      },

      // 禁用危险 API
      eval: undefined,
      Function: undefined,
      window: undefined,
      document: undefined,
      global: undefined,
      globalThis: undefined,
    };
  }

  /**
   * 执行 Widget 代码
   */
  execute(compiledCode: string): ExecuteResult {
    try {
      const sandbox = this.createSandbox();

      // 构造函数体
      const functionBody = `
        'use strict';
        ${compiledCode}
        return module.exports.default || module.exports;
      `;

      // Function Constructor 执行
      const fn = new Function(...Object.keys(sandbox), functionBody);
      const component = fn(...Object.values(sandbox));

      // 验证返回值是否为 React 组件
      if (typeof component !== 'function') {
        throw new Error('Widget must export a React component');
      }

      return {
        success: true,
        component,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      };
    }
  }
}
```

#### 2.3.3 Widget 加载器

**职责**：从后端 API 加载自定义 Widget 并编译执行

**实现**：

```typescript
// src/components/DynamicForm/utils/widgetLoader.ts
import { WidgetCompiler } from '@/features/widget-manager/services/widgetCompiler';
import { WidgetSandbox } from '@/utils/widgetSandbox';
import { fetchPublishedWidgets } from '@/features/widget-manager/services/widgetApi';

export interface WidgetLoadResult {
  [widgetName: string]: React.ComponentType<any>;
}

export class WidgetLoader {
  private compiler = new WidgetCompiler();
  private sandbox = new WidgetSandbox();
  private cache = new Map<string, React.ComponentType<any>>();

  /**
   * 加载所有已发布的自定义 Widget
   */
  async loadCustomWidgets(): Promise<WidgetLoadResult> {
    try {
      // 从后端 API 获取所有已发布的 Widget
      const widgets = await fetchPublishedWidgets();

      const result: WidgetLoadResult = {};

      for (const widget of widgets) {
        // 检查缓存
        if (this.cache.has(widget.name)) {
          result[widget.name] = this.cache.get(widget.name)!;
          continue;
        }

        // 使用缓存的编译代码或重新编译
        const code = widget.compiledCode || this.compileWidget(widget.code);

        // 在沙箱中执行
        const executeResult = this.sandbox.execute(code);

        if (executeResult.success && executeResult.component) {
          result[widget.name] = executeResult.component;
          this.cache.set(widget.name, executeResult.component);
        } else {
          console.error(`Failed to load widget: ${widget.name}`, executeResult.error);
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to load custom widgets:', error);
      return {};
    }
  }

  /**
   * 编译 Widget 代码
   */
  private compileWidget(sourceCode: string): string {
    const compileResult = this.compiler.compile(sourceCode);

    if (!compileResult.success || !compileResult.code) {
      throw new Error(compileResult.error || 'Compilation failed');
    }

    return compileResult.code;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}
```

#### 2.3.4 自定义 Widget 使用 Hook

**职责**：在 DynamicForm 中加载和使用自定义 Widget

**实现**：

```typescript
// src/components/DynamicForm/hooks/useCustomWidgets.ts
import { useState, useEffect } from 'react';
import { WidgetLoader } from '../utils/widgetLoader';

export interface UseCustomWidgetsResult {
  widgets: Record<string, React.ComponentType<any>>;
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
}

export function useCustomWidgets(): UseCustomWidgetsResult {
  const [widgets, setWidgets] = useState<Record<string, React.ComponentType<any>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loader = new WidgetLoader();

  const loadWidgets = async () => {
    try {
      setLoading(true);
      setError(null);
      const customWidgets = await loader.loadCustomWidgets();
      setWidgets(customWidgets);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load widgets'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWidgets();
  }, []);

  return {
    widgets,
    loading,
    error,
    reload: loadWidgets,
  };
}
```

**DynamicForm 集成示例**：

```typescript
// 使用示例
import { DynamicForm } from '@/components/DynamicForm';
import { useCustomWidgets } from '@/components/DynamicForm/hooks/useCustomWidgets';

function MyFormPage() {
  const { widgets, loading } = useCustomWidgets();

  if (loading) {
    return <Spinner />;
  }

  return (
    <DynamicForm
      schema={schema}
      widgets={widgets}  // 注入自定义 Widget
      onSubmit={handleSubmit}
    />
  );
}
```

#### 2.3.5 Props 配置弹窗

**职责**：为 Widget 编辑器提供 Props 配置功能，支持预览不同状态

**实现**：

```typescript
// src/features/widget-manager/components/PropsConfigDialog.tsx
import React, { useState } from 'react';
import { Dialog, Button, Intent } from '@blueprintjs/core';
import { CodeEditor } from '@/components/CodeEditor';

interface PropsConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (props: Record<string, any>) => void;
  initialProps?: Record<string, any>;
}

export const PropsConfigDialog: React.FC<PropsConfigDialogProps> = ({
  isOpen,
  onClose,
  onApply,
  initialProps = ,
}) => {
  // 将 props 对象序列化为 JavaScript 对象字面量字符串
  const [propsCode, setPropsCode] = useState(() => {
    return JSON.stringify(initialProps, null, 2);
  });
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    try {
      // 使用 Function Constructor 解析 JavaScript 对象字面量
      // 支持函数、复杂对象等 JSON 不支持的语法
      // 注意：这是受控环境，仅用于开发者预览 widget
      const parseFn = new Function(`return (${propsCode})`);
      const props = parseFn();

      // 验证返回值是否为对象
      if (typeof props !== 'object' || props === null) {
        throw new Error('Props must be an object');
      }

      // 保存到 LocalStorage（仅用于当前编辑会话）
      localStorage.setItem('widget-preview-props', propsCode);

      onApply(props);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid props format');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="配置 Widget Props"
      style={{ width: 800, height: 600 }}
    >
      <div style={{ padding: 20 }}>
        <p style={{ marginBottom: 10, color: '#5C7080' }}>
          在下方编辑器中以 JavaScript 对象字面量形式配置 Widget 的 props（支持函数）
        </p>
        
        <CodeEditor
          value={propsCode}
          language="javascript"
          onChange={setPropsCode}
          error={error}
          config={{
            initialMode: 'edit',
            height: 400,
          }}
        />

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button onClick={onClose}>取消</Button>
          <Button intent={Intent.PRIMARY} onClick={handleApply}>
            应用
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
```

**使用示例**：

```typescript
// 在 Widget 编辑器页面中使用
function WidgetEditorPage() {
  const [isPropsDialogOpen, setIsPropsDialogOpen] = useState(false);
  const [previewProps, setPreviewProps] = useState({});

  // 从 LocalStorage 恢复上次的配置
  useEffect(() => {
    const savedProps = localStorage.getItem('widget-preview-props');
    if (savedProps) {
      try {
        const parseFn = new Function(`return (${savedProps})`);
        setPreviewProps(parseFn());
      } catch {
        // 忽略解析错误
      }
    }
  }, []);

  return (
    <div>
      {/* Widget 预览区 */}
      <WidgetPreview component={compiledWidget} props={previewProps} />
      
      {/* Props 配置按钮 */}
      <Button
        icon="cog"
        text="配置 Props"
        onClick={() => setIsPropsDialogOpen(true)}
      />

      {/* Props 配置弹窗 */}
      <PropsConfigDialog
        isOpen={isPropsDialogOpen}
        onClose={() => setIsPropsDialogOpen(false)}
        onApply={setPreviewProps}
        initialProps={previewProps}
      />
    </div>
  );
}
```

**配置示例**：

用户可以在弹窗中编写如下配置：

```javascript
{
  value: "test value",
  placeholder: "Enter text...",
  error: "This is an error message",
  readonly: true,
  disabled: false,
  onChange: (val) => {
    console.log('Value changed:', val);
    // 可以编写任意 JavaScript 代码
  },
  options: [
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
  ],
  customProp: {
    nested: {
      data: 'complex object'
    }
  }
}
```

---

## 3. 后端技术设计（提案/未实现）

### 3.1 数据库设计

#### 3.1.1 custom_widgets 表（主表）

```sql
CREATE TABLE custom_widgets (
  id VARCHAR(36) PRIMARY KEY COMMENT 'UUID',
  name VARCHAR(100) UNIQUE NOT NULL COMMENT 'Widget 名称（kebab-case）',
  code TEXT NOT NULL COMMENT 'Widget 代码',
  compiled_code TEXT COMMENT '编译后的代码（缓存）',
  status VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT '状态：draft, published, archived',
  version INT NOT NULL DEFAULT 1 COMMENT '当前版本号',
  latest_published_version INT COMMENT '最新已发布版本号',
  created_by VARCHAR(36) NOT NULL COMMENT '创建者 ID',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_by VARCHAR(36) NOT NULL COMMENT '最后修改者 ID',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后修改时间',
  published_by VARCHAR(36) COMMENT '发布者 ID',
  published_at TIMESTAMP COMMENT '发布时间',
  usage_count INT NOT NULL DEFAULT 0 COMMENT '使用次数',
  INDEX idx_status (status),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自定义 Widget 表';
```

#### 3.1.2 widget_versions 表（版本历史）

```sql
CREATE TABLE widget_versions (
  id VARCHAR(36) PRIMARY KEY COMMENT '版本记录 ID',
  widget_id VARCHAR(36) NOT NULL COMMENT 'Widget ID（外键）',
  version INT NOT NULL COMMENT '版本号',
  code TEXT NOT NULL COMMENT '该版本的代码',
  compiled_code TEXT COMMENT '编译后的代码',
  status VARCHAR(20) NOT NULL COMMENT '版本状态',
  changelog TEXT COMMENT '版本变更说明',
  created_by VARCHAR(36) NOT NULL COMMENT '创建者 ID',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  published_by VARCHAR(36) COMMENT '发布者 ID',
  published_at TIMESTAMP COMMENT '发布时间',
  FOREIGN KEY (widget_id) REFERENCES custom_widgets(id) ON DELETE CASCADE,
  UNIQUE KEY uk_widget_version (widget_id, version),
  INDEX idx_widget_id (widget_id),
  INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Widget 版本历史表';
```

### 3.2 API 接口设计

#### 3.2.1 Widget CRUD 接口

**1. 获取 Widget 列表**

```
GET /api/custom-widgets
```

Query 参数：
- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 20）
- `search`: 按名称搜索
- `createdBy`: 按创建人筛选
- `status`: 按状态筛选（draft, published, archived）
- `sortBy`: 排序字段（createdAt, updatedAt, name）
- `sortOrder`: 排序方向（asc, desc）

响应：
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "my-widget",
        "status": "published",
        "version": 2,
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

**2. 获取单个 Widget 详情**

```
GET /api/custom-widgets/:id
```

响应：
```json
{
  "code": 0,
  "data": {
    "id": "uuid",
    "name": "my-widget",
    "code": "export const MyWidget = () => { ... }",
    "status": "published",
    "version": 2,
    "latestPublishedVersion": 2,
    "createdBy": "user-id",
    "createdAt": "2026-08-08T10:00:00Z",
    "updatedBy": "user-id",
    "updatedAt": "2026-08-08T11:00:00Z"
  }
}
```

**3. 创建 Widget**

```
POST /api/custom-widgets
```

请求体：
```json
{
  "name": "my-widget",
  "code": "export const MyWidget = () => { ... }"
}
```

**4. 更新 Widget**

```
PUT /api/custom-widgets/:id
```

请求体：
```json
{
  "code": "export const MyWidget = () => { ... }"
}
```

**5. 删除 Widget**

```
DELETE /api/custom-widgets/:id
```

#### 3.2.2 Widget 发布接口

**发布 Widget**

```
POST /api/custom-widgets/:id/publish
```

请求体：
```json
{
  "changelog": "Added feature X"
}
```

行为：
1. 创建新版本记录（version + 1）
2. 更新主表的 `status` 为 `published`
3. 更新 `latestPublishedVersion`
4. 记录发布者和发布时间

**下架 Widget**

```
POST /api/custom-widgets/:id/archive
```

行为：
1. 更新主表的 `status` 为 `archived`
2. 已使用该 Widget 的页面仍可正常工作（因为代码已缓存）

#### 3.2.3 版本管理接口

**获取版本历史**

```
GET /api/custom-widgets/:id/versions
```

响应：
```json
{
  "code": 0,
  "data": [
    {
      "id": "version-id",
      "version": 2,
      "status": "published",
      "changelog": "Added feature X",
      "createdAt": "2026-08-08T11:00:00Z",
      "publishedBy": "user-id",
      "publishedAt": "2026-08-08T11:30:00Z"
    },
    {
      "id": "version-id-2",
      "version": 1,
      "status": "published",
      "changelog": "Initial version",
      "createdAt": "2026-08-08T10:00:00Z"
    }
  ]
}
```

**获取特定版本代码**

```
GET /api/custom-widgets/:id/versions/:version
```

响应：
```json
{
  "code": 0,
  "data": {
    "version": 1,
    "code": "export const MyWidget = () => { ... }",
    "changelog": "Initial version"
  }
}
```

**回滚到特定版本**

```
POST /api/custom-widgets/:id/rollback
```

请求体：
```json
{
  "targetVersion": 1,
  "changelog": "Rollback to v1"
}
```

行为：
1. 将目标版本的代码复制到主表
2. 创建新版本记录（version + 1）
3. 更新主表的 `version`

#### 3.2.4 Widget 使用接口

**获取所有已发布的 Widget**

```
GET /api/custom-widgets/published
```

响应：
```json
{
  "code": 0,
  "data": [
    {
      "name": "my-widget",
      "code": "export const MyWidget = () => { ... }",
      "compiledCode": "..."
    }
  ]
}
```

此接口用于 DynamicForm 加载自定义 Widget。

### 3.3 权限控制

使用 RBAC（基于角色的访问控制）：

| 操作 | 所需权限 | 检查逻辑 |
|------|----------|----------|
| 创建 Widget | `widget:create` | 检查用户是否有该权限 |
| 编辑自己的 Widget | `widget:update:own` | 检查 `createdBy === currentUserId` |
| 编辑他人的 Widget | `widget:update:any` | 检查用户是否有该权限 |
| 删除 Widget | `widget:delete` | 仅管理员 |
| 发布 Widget | `widget:publish` | 仅管理员 |
| 下架 Widget | `widget:archive` | 仅管理员 |

---

## 4. 安全设计（目标方案，未实现完整隔离）

### 4.1 代码安全

**静态代码检查**：

在编译前检查代码中是否包含危险 API：
- `eval()`
- `Function()`
- `__proto__`
- `constructor[`
- `window[`
- `importScripts()`

**沙箱隔离**：

- 使用 Function Constructor 创建隔离的执行环境
- 禁用全局对象访问（`window`, `document`, `global`）
- 只提供预定义的依赖

### 4.2 权限控制

- 所有 API 请求需要身份验证（JWT Token）
- 基于 RBAC 的权限检查
- 操作审计日志记录

### 4.3 数据安全

- Widget 代码存储在数据库中，防止注入攻击
- 敏感操作（发布、删除）记录审计日志
- 定期备份版本历史数据

---

## 5. 性能优化

### 5.1 编译缓存

- 发布时预编译 Widget 代码，结果存储在 `compiledCode` 字段
- 前端加载时优先使用 `compiledCode`，避免重复编译

### 5.2 懒加载

- DynamicForm 只在首次使用时加载自定义 Widget
- 使用 React.lazy 和 Suspense 实现按需加载

### 5.3 增量编译

- Widget 编辑器中使用防抖（debounce）减少编译次数
- 只在代码真正变更时触发编译

---

## 6. 测试策略（提案验收范围）

### 6.1 单元测试

- Widget 编译器测试
- Widget 沙箱执行器测试
- API 接口测试

### 6.2 集成测试

- DynamicForm 集成自定义 Widget 测试
- SchemaBuilder 集成自定义 Widget 测试

### 6.3 安全测试

- 代码注入攻击测试
- 沙箱逃逸测试
- XSS 攻击测试

---

## 7. 部署方案（提案/未实现）

### 7.1 前端部署

- 独立构建 Widget 管理模块
- 通过路由懒加载，减少首屏加载时间

### 7.2 后端部署

- API 服务独立部署
- 数据库迁移脚本
- 权限配置初始化

---

## 8. 监控与告警（提案/未实现）

### 8.1 监控指标

- Widget 编译成功率
- Widget 加载失败率
- API 响应时间
- 错误日志统计

### 8.2 告警规则

- Widget 编译失败率 > 10%
- API 响应时间 > 2s
- 沙箱执行错误率 > 5%

---

**文档结束**
