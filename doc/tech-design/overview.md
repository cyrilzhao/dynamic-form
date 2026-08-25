# DynamicForm 总体技术设计

> **状态：现行实现。** 本文描述当前代码的总体架构；未来方案以各专题中的“提案/未实现”章节为准。

## 文档定位

本文档是 DynamicForm 的主技术设计，说明系统边界、核心架构、关键数据流和维护约束。具体配置与 API 以[根 README](../../README.md) 为准；专题算法和组件细节从[技术设计索引](./README.md)进入。

## 1. 目标与边界

DynamicForm 是基于 React、TypeScript、React Hook Form 和 JSON Schema 的配置驱动表单系统，主要目标包括：

- 根据 Schema 生成字段、布局和初始值。
- 将字段级验证、Schema 级验证和 UI 联动明确分层。
- 支持嵌套对象、数组、路径透明化和动态 Schema。
- 支持同步与异步联动，并保证并发结果的一致性。
- 通过 Widget 注册、Preset、Callbacks 和 Helpers 扩展业务能力。
- 在复杂表单中保持字段级更新和可控的重渲染范围。

系统不负责：

- 持久化 Schema、表单草稿或提交结果。
- 管理业务权限和后端接口协议。
- 为不可信脚本提供完整的服务端安全沙箱。
- 将 UI 联动替代为数据合法性验证。条件验证仍由 Schema 验证层负责。

## 2. 技术栈

| 领域 | 技术 | 职责 |
| --- | --- | --- |
| UI | React 18、Blueprint.js | 组件渲染、交互和默认 Widget |
| 表单状态 | React Hook Form 7 | 字段注册、值管理、订阅和提交 |
| 类型 | TypeScript 5 | Schema、Props、Widget 和联动接口约束 |
| 验证 | Extended JSON Schema、自定义验证器 | 字段约束、项目级条件验证和 `ui.validators` |
| Helper | Zod | 作为内置 `z` helper 供可信回调或脚本按需使用，不直接承担 Schema 验证 |
| 状态扩展 | React Context | Helpers、Callbacks、Widgets、路径和联动状态传递 |
| 构建测试 | Vite、Jest、Testing Library | 开发构建、单元测试和集成测试 |

## 3. 分层架构

```text
业务调用层
  ├─ schema / values / callbacks / helpers / widgets
  └─ DynamicFormRef
            │
            ▼
DynamicForm 编排层
  ├─ React Hook Form 生命周期
  ├─ Context Provider 组装
  ├─ Schema 与联动状态协调
  └─ 提交数据过滤与转换
            │
      ┌─────┼──────────┐
      ▼     ▼          ▼
Schema 核心  联动系统    字段渲染
  │          │          │
  ├ Parser   ├ Graph    ├ FormField
  ├ Validator├ Queue    ├ FieldRegistry
  └ Resolver ├ Cache    └ Widgets
             └ OperationController
            │
            ▼
路径与数据工具
  ├─ PathResolver / PathPrefixContext
  ├─ ArrayTransformer
  ├─ Schema defaults / filtering
  └─ Inline script / helpers
```

### 3.1 编排层

`DynamicForm.tsx` 是系统编排入口，负责：

1. 创建或复用 React Hook Form 上下文。
2. 按字段路径提取并合并 Schema 默认值与调用方默认值：外部 `defaultValues` 优先；object 默认值覆盖其明确键，缺失键由子 Schema 默认值补齐；array 默认值保持整体快照。
3. 创建 Schema resolver，并在动态 Schema 变化后使用有效 Schema 验证。
4. 解析静态联动并接入数组动态联动。
5. 组装 Helpers、Callbacks、Widgets、路径和联动状态 Context。
6. 根据 Schema 渲染 `FormField`，在提交前过滤或转换数据。
7. 通过 `DynamicFormRef` 暴露读取、写入、验证、重置和主动刷新联动能力。

编排层只协调生命周期，不应承载具体路径算法、条件计算或 Widget 业务逻辑。

### 3.2 Schema 核心

- `SchemaParser` 将 `ExtendedJSONSchema` 转换为可渲染的字段描述。
- `SchemaParser` 根据字段类型和 `ui.widget` 决定 Widget 名称。
- `FieldRegistry` 管理 Widget 名称到字段组件的注册和查询。
- `SchemaValidator` 处理 Schema 级条件验证。
- `createSchemaResolver` 将 Schema 验证和字段自定义验证统一适配为 React Hook Form resolver。

Schema 扩展集中在 `types/schema.ts`，UI 属性通过 `ui` 字段表达。标准 JSON Schema 约束与项目 UI 扩展不得混用同一职责，详见 [Schema 与验证设计](./schema-and-validation.md)。

### 3.3 联动系统

联动系统由以下部分协作：

- `schemaLinkageParser` 从 Schema 中收集和规范化联动配置。
- `DependencyGraph` 维护字段依赖并检测循环。
- `useLinkageManager` 负责普通字段联动的调度和状态提交。
- `useArrayLinkageManager` 在运行时为数组实例生成实际路径联动。
- `LinkageTaskQueue` 合并任务并控制执行顺序。
- `LinkageResultCache` 避免相同输入上的重复计算。
- `LinkageOperationController` 通过运行令牌阻止过期异步结果提交。

联动结果可以影响值、选项、Schema、可见性、禁用或只读状态。所有结果写回应经过统一提交边界，不能由单个联动函数直接修改其他模块状态。完整模型见 [联动系统设计](./linkage.md)。

### 3.4 字段渲染与 Widget

`FormField` 连接 Schema 字段、React Hook Form 和联动状态，并根据字段配置选择 Widget。值 Widget 通过 Controller 独占字段路径；`nested-form` 是结构 Widget，只组织子字段并通过只读状态订阅展示父对象错误，不注册父对象 Controller。默认 Widget 通过 Blueprint Preset 注册，调用方可以：

- 使用完整 `WidgetPreset` 全局替换组件库。
- 使用局部 Widget 注册覆盖单个类型。
- 通过自定义 Widget 接收统一的 `FieldWidgetProps`。

Widget 只负责字段表现和交互，不自行解析全局 Schema 或调度跨字段联动。设计入口见 [Widget 设计](./README.md#widget-设计)。

### 3.5 Context 边界

| Context | 用途 |
| --- | --- |
| `CallbacksContext` | 注册命名回调，避免在 JSON 中直接传递函数 |
| `HelpersContext` | 向验证、转换、联动和回调脚本提供共享依赖 |
| `WidgetsContext` | 提供当前 Widget 注册表 |
| `LinkageStateContext` | 共享字段联动状态和嵌套层级协调能力 |
| `PathPrefixContext` | 组合嵌套表单字段路径 |
| `NestedSchemaContext` | 记录动态嵌套 Schema |

Context 用于跨层传递稳定能力，不应成为任意业务状态仓库。

## 4. 核心数据流

### 4.1 初始化与渲染

```text
输入 Schema
  → 提取 Schema 默认值
  → 与 defaultValues 合并
  → 创建 React Hook Form
  → 解析字段与静态联动
  → 生成数组运行时联动
  → 计算初始联动状态
  → FormField 选择 Widget
  → 值 Widget 注册 Controller，结构 Widget 组织叶子字段
```

Schema 或联动函数变化时，依赖它们的解析结果必须重新生成。长期运行的回调应读取最新引用，不能通过只初始化一次的闭包永久捕获旧配置。

### 4.2 用户输入与联动

```text
字段值变化
  → React Hook Form watch
  → 查找受影响字段
  → 按依赖层级计算联动
  → 检查运行令牌是否仍有效
  → 提交值与 UI 状态
  → 仅重渲染受影响字段
```

异步联动允许并发计算，但只允许最新有效批次提交。批量写值应作为一个逻辑操作处理，避免中间快照生成可提交结果。

### 4.3 验证与提交

```text
当前表单值
  → 标准字段约束
  → Schema 级条件验证
  → 自定义 validators
  → 合并错误
  → 按有效 Schema 过滤值
  → 解包基础类型数组
  → onSubmit
```

提交时会按照当前有效 Schema 裁剪未定义的数据，并解包基础类型数组。联动状态为 `visible: false` 的字段不会渲染且跳过验证，但不会仅因为不可见就自动从提交值中删除；只有字段不在提交时采用的有效 Schema 中时才会被过滤。禁用、只读和不可见不能被当作同一个语义处理。

## 5. 路径与嵌套模型

系统同时处理三种路径：

- React Hook Form 运行时路径，例如 `items.0.price`。
- 数组模板路径，例如 `items[].price`。
- Schema 中的联动依赖路径，包括 `./field` 和 JSON Pointer。

路径解析和前缀组合必须由统一工具或 Context 完成，不能在 Widget 或 Hook 中随意拼接临时字符串。当前 `NestedFormWidget` 通过 `asNestedForm` 复用父级 React Hook Form 上下文；调用方也可以单独渲染另一个顶层 `DynamicForm` 创建独立实例，但这不是 `NestedFormWidget` 内部自动完成的能力。详见 [字段路径设计](./field-path.md)和[嵌套表单设计](./nested-form.md)。

## 6. 扩展机制

### 6.1 Widget 扩展

调用方通过 Preset 或注册表提供组件，组件遵循 `FieldWidgetProps`。复杂 Widget 的专用属性通过 `widgetProps` 传递，不扩张 `DynamicFormProps`。

### 6.2 Callbacks 与 Helpers

命名 Callback 适合由宿主代码提供业务行为；Inline Script 适合可信配置中的轻量表达。两者共享 Helpers 注入模型，内置 `ofetch`、Lodash 和 Zod，也允许业务方扩展。安全边界见 [Helpers 设计](./helpers.md)和[脚本隔离设计](./script-isolation.md)。

### 6.3 Schema 扩展

项目扩展统一放在 `ExtendedJSONSchema` 与 `UIConfig` 中。新增扩展时必须同时定义：

1. 类型与默认行为。
2. 解析位置和运行时职责。
3. 对验证、联动、嵌套和提交过滤的影响。
4. 单元测试、集成测试和文档入口。

## 7. 性能设计

主要策略包括：

- 使用 React Hook Form 的字段订阅缩小更新范围。
- `FormField` 使用 `React.memo` 和明确的 Props 比较。
- Schema 解析器、resolver、依赖图和 Widget 注册表按真实依赖缓存。
- 联动按受影响字段和依赖层级执行，并缓存可复用结果。
- 数组 Widget 在大数据量场景使用虚拟化。
- 避免在渲染过程中创建不稳定的 Schema、Callbacks、Helpers 或 Widget 对象。

性能优化必须基于可重复的场景和指标，不通过跳过验证或放宽一致性换取表面速度。详细记录见 [性能优化设计](./performance.md)。

## 8. 错误处理

- Schema 验证错误通过 resolver 返回英文错误信息；部分配置和脚本错误当前只会记录 `console.warn`/`console.error`，宿主应用不应假设所有运行时错误都有统一 UI 提示。
- 联动循环通过依赖图检测并进入明确的降级或回调路径。
- Inline Script 执行失败不能破坏整个表单渲染，应转换为对应字段或操作错误。
- 异步任务失败与过期结果是不同状态：失败需要反馈，过期结果应静默丢弃。
- Widget 加载失败应保留字段上下文并提供可诊断信息。

生产代码不得残留 `console.log` 或 `console.info` 调试输出。

## 9. 测试策略

| 层级 | 重点 |
| --- | --- |
| 单元测试 | Schema 解析、验证、路径解析、依赖图、缓存和数据转换 |
| Hook 测试 | 普通联动、数组联动、队列、竞态和最新引用 |
| Widget 测试 | 注册、值转换、只读/禁用状态和用户交互 |
| 集成测试 | DynamicForm 渲染、提交、动态 Schema、嵌套与各类联动 |
| 性能测试 | 大字段量、大数组和高频输入下的计算次数与渲染次数 |

修复跨模块问题时必须先增加可稳定复现的测试。涉及异步联动时至少覆盖乱序完成、配置更新、批量写值和组件卸载。

## 10. 构建、部署与维护

交付前至少执行：

```bash
npm run type-check
npm test -- --runInBand
npm run build
```

维护要求：

- Schema、联动或 Widget 公共接口变化必须提供兼容策略和迁移说明。
- 依赖升级后重点回归 React Hook Form 注册行为、Blueprint 组件 Props 和 JSON Schema 类型。
- 文档只保留一个现行结论；历史设计和已解决问题移入归档。
- 监控或业务埋点由宿主应用注入，DynamicForm 不绑定具体平台。

## 11. 专题边界

| 问题 | 文档 |
| --- | --- |
| 如何使用组件与 API | [根 README](../../README.md) |
| Schema 如何定义和验证 | [Schema 与验证](./schema-and-validation.md) |
| 字段如何联动 | [联动系统](./linkage.md) |
| 路径如何解析和透明化 | [字段路径设计](./field-path.md) |
| 嵌套表单如何隔离或复用上下文 | [嵌套表单](./nested-form.md) |
| 如何扩展 Widget | [Widget 设计索引](./README.md#widget-设计) |
| 如何注入 Helpers 和隔离脚本 | [Helpers](./helpers.md)、[脚本隔离](./script-isolation.md) |
| 如何定位历史联动问题 | [历史归档](../archive/README.md) |

## 12. 来源与去重说明

本文档整理自以下旧文档：

- `DYNAMIC_FORM_INDEX.md`：导航职责由 `doc/README.md` 和 `tech-design/README.md` 接管。
- `DYNAMIC_FORM_PART1.md`：系统目标、技术选型和风险纳入本文。
- `DYNAMIC_FORM_PART2.md`：Schema 扩展进入 Schema 专题，用法由根 README 接管。
- `DYNAMIC_FORM_PART3.md`：组件架构和核心模块关系纳入本文。
- `DYNAMIC_FORM_PART4.md`：实现示例由根 README 与各专题文档接管。
- `DYNAMIC_FORM_PART5.md`：与根 README 重复的使用指南和最佳实践不再保留。
- `DYNAMIC_FORM_PART6.md`：测试、部署和维护约束纳入本文；重复 FAQ 不再保留。
- `TECHNICAL_OVERVIEW.md`：总体架构、数据流、扩展、测试和部署内容去重后纳入本文。
