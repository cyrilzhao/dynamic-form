# 联动管理器 Stale Closure 分析与解决方案

## 1. 问题背景

在 React Hook 中，`useRef` 通常用于保存一个"跨 render 保持引用稳定的值"。但当 `useRef` 被用来保存一个**函数**时，该函数体内捕获的所有外部变量都被冻结在首次 render 那一刻的值上——即使后续 render 产生了新版本，`ref.current` 也不会自动更新。这就是 **Stale Closure（闭包陈旧）** 问题。

与 `useCallback` 不同，`useCallback` 可以通过 deps 数组声明依赖，在依赖变化时重新创建函数。而 `useRef(fn).current` 完全不参与 React 的依赖追踪，函数只会被创建一次。

本文档记录在 `useLinkageManager.ts` 和 `useArrayLinkageManager.ts` 中发现的闭包陈旧问题、风险评估和解决方案。

---

## 2. 问题扫描结果

### 2.1 [HIGH] processQueue — `useLinkageManager.ts:278`

#### 问题描述

```ts
const processQueue = useRef(async () => {
  // ...
  const { states: newStates, updatedFormData } =
    await evaluateLinkagesByLayers({
      fields: affectedFields,
      linkages,           // ❌ 首次 render 的闭包值
      formData,
      linkageFunctions,   // ❌ 首次 render 的闭包值
      asyncSequenceManager,
      dependencyGraph,    // ❌ 首次 render 的闭包值
      cache,
      _caller: `processQueue(trigger=${task.fieldName})`,
    })

  await applyLinkageResults({  // ❌ 首次 render 的闭包值
    fields: affectedFields,
    states: newStates,
    updatedFormData,
    preMarkFields: true,
  })
}).current
```

`processQueue` 通过 `useRef(fn).current` 保存，首次 render 之后永不更新。函数体内直接读取了以下**会随 rerender 变化**的外部变量：

| 变量 | 为何会变化 |
|---|---|
| `linkages` | 来自 `useArrayLinkageManager` 的入参，schema 变化时更新 |
| `dependencyGraph` | `useMemo([linkages])` 重新构建 |
| `linkageFunctions` | 来自组件 props，父组件重渲染时可能产生新引用 |
| `applyLinkageResults` | `useCallback([linkages, getValues, setValue, ...])` |

以下变量虽然也在函数体内，但**不受影响**（通过 `useRef` 保持引用稳定，读取 `.current` 时拿到最新值）：

| 变量 | 为何不受影响 |
|---|---|
| `taskQueue` | `useRef` 实例，引用稳定 |
| `asyncSequenceManager` | `useRef` 实例，引用稳定 |
| `cache` | `useRef` 实例，引用稳定 |
| `latestFormDataRef` | `useRef`，读 `.current` 时总是最新 |

#### 影响的真实场景

**场景 1：schema 动态变化**（高频，schema 联动场景下必现）

```
初始 schema → linkages={} → processQueue 捕获空 linkages
                 ↓
外部联动触发 schema 更新 → linkages={province: [...]}
                 ↓
用户修改 country 字段
                 ↓
watch 用新 dependencyGraph 找到 affectedFields=['province']
                 ↓
processQueue 执行，但 linkages 仍是首次 render 的 {}
                 ↓
evaluateLinkagesByLayers 内 linkages[fieldName] 为 undefined
                 ↓
province 联动不执行 ← 静默失败
```

**场景 2：linkageFunctions 动态更新**（中频，异步数据加载场景）

```
初始 linkageFunctions = { loadOptions: () => [] }
                 ↓
异步数据加载完成，父组件传入新 linkageFunctions = { loadOptions: () => realData }
                 ↓
processQueue 仍调用旧版 loadOptions
                 ↓
options 联动返回空数组 ← 使用旧函数闭包
```

**场景 3：applyLinkageResults 基于旧 linkages 判断**（与场景 1 联动）

`applyLinkageResults` 的 `useCallback` 包含 `linkages` 依赖，其内部逻辑：

```ts
const hasValueLinkage = linkageArray?.some(
  (linkage) => linkage.type === 'value'
)
```

如果 `processQueue` 使用的是旧版 `applyLinkageResults`，即使联动计算正确，value 联动的 `form.setValue` 也可能不执行，因为旧版认为"这个字段没有 value 联动"。

#### 为什么 `watch` 路径没问题

`watch` 的订阅逻辑在 `useEffect([watch, linkages, dependencyGraph])` 中，每次 `linkages` 或 `dependencyGraph` 变化，`useEffect` 重新执行，watch 重新订阅，回调函数是新的闭包，会使用最新的 `dependencyGraph.getAffectedFields`。

但 watch 回调的最后调用 `processQueue()`，此时 `processQueue` 已经是陈旧的。即：

```
watch 回调（新闭包，新 dependencyGraph）→ 计算出正确的 affectedFields
     ↓
processQueue（旧闭包，旧 linkages / dependencyGraph / applyLinkageResults）→ 计算出错误结果
```

---

### 2.2 [LOW] applyLinkageResults — `useLinkageManager.ts:184`

#### 问题描述

`applyLinkageResults` 是 `useCallback`，deps 包含 `linkages`，所以它本身能随 `linkages` 变化而更新。但它被 `processQueue` 以陈旧闭包方式调用，所以等价于被间接陈旧了（是 2.1 的次生影响，不是独立问题）。

独立来看，`applyLinkageResults` 的实现本身没有闭包陈旧问题。

---

### 2.3 [NONE] useArrayLinkageManager — watch 订阅（第 219–246 行）

#### 结论：无问题

```ts
useEffect(() => {
  const subscription = watch(() => {
    setDynamicLinkages((prev) => {
      const next = generateDynamicLinkages()  // 读闭包
      ...
    })
  })
  return () => subscription.unsubscribe()
}, [watch, baseLinkages, generateDynamicLinkages])  // generateDynamicLinkages 在 deps 中
```

`generateDynamicLinkages` 是 `useCallback([baseLinkages, schema, getValues])`，它的每个依赖变化都会重新生成函数。`useEffect` 的 deps 里包含了 `generateDynamicLinkages`，所以每次它变化时，subscription 会重新建立，闭包是新鲜的。

---

### 2.4 [NONE] useArrayLinkageManager — generateDynamicLinkages（第 61–112 行）

#### 结论：无问题

```ts
const generateDynamicLinkages = useCallback(() => {
  const formData = getValues()   // ← getValues 在 deps 中
  ...
  Object.entries(baseLinkages).forEach(...)  // ← baseLinkages 在 deps 中
}, [baseLinkages, schema, getValues])
```

deps 数组覆盖了所有捕获变量，无陈旧闭包问题。

---

## 3. 根本原因

`processQueue` 必须是一个**引用稳定的函数**，因为：

1. 它在 `setTimeout` 延迟后执行（`window.setTimeout(() => processQueue(), 0)`）
2. 它在异步 `while` 循环中递归调用自身
3. 它需要防止并发执行（通过 `taskQueue.getProcessing()` 标志）

把它改成普通 `useCallback` 会导致：每次 `linkages` 变化就产生新函数，而 `setTimeout` 里已经捕获的旧引用仍会继续执行，新旧版本可能并发运行，破坏串行队列的保证。

因此，既需要**函数引用稳定**，又需要**函数体读取最新依赖**。

标准解决方案是 **Latest Ref 模式**（React 官方也称为 "useEvent" 模式的基础思路）：

```
稳定的函数引用 + 内部通过 ref 读取最新运行时依赖
```

---

## 4. 解决方案

### 4.1 核心方案：Latest Runtime Ref

在 `useLinkageManager` 中引入一个 `runtimeRef`，在每次 render 时同步更新：

```ts
// 1. 定义运行时依赖类型
interface LinkageRuntime {
  linkages: Record<string, LinkageConfig[]>
  linkageFunctions: Record<string, LinkageFunction>
  dependencyGraph: DependencyGraph
  applyLinkageResults: (params: ApplyLinkageResultsParams) => Promise<void>
}

// 2. 在 hook 内部维护 runtimeRef
const runtimeRef = useRef<LinkageRuntime>({
  linkages,
  linkageFunctions,
  dependencyGraph,
  applyLinkageResults,
})

// 3. 每次 render 同步更新（无需 deps，每次都更新）
// 注意：useLayoutEffect 比 useEffect 更早，确保在 setTimeout 回调前已更新
useLayoutEffect(() => {
  runtimeRef.current = {
    linkages,
    linkageFunctions,
    dependencyGraph,
    applyLinkageResults,
  }
})

// 4. processQueue 内部通过 runtimeRef 读取最新依赖
const processQueue = useRef(async () => {
  if (taskQueue.getRefreshing()) return
  if (taskQueue.getProcessing()) return

  taskQueue.setProcessing(true)

  try {
    while (!taskQueue.isEmpty()) {
      const task = taskQueue.dequeue()
      if (!task) break
      if (!taskQueue.isTaskValid(task.fieldName, task.timestamp)) continue

      // ✅ 每次执行时读取最新依赖，而不是使用首次 render 的闭包值
      const {
        linkages,
        linkageFunctions,
        dependencyGraph,
        applyLinkageResults,
      } = runtimeRef.current

      const formData =
        Object.keys(latestFormDataRef.current).length > 0
          ? { ...latestFormDataRef.current }
          : { ...form.getValues() }

      const affectedFields = task.affectedFields

      const { states: newStates, updatedFormData } =
        await evaluateLinkagesByLayers({
          fields: affectedFields,
          linkages,
          formData,
          linkageFunctions,
          asyncSequenceManager,
          dependencyGraph,
          cache,
          _caller: `processQueue(trigger=${task.fieldName})`,
        })

      await applyLinkageResults({
        fields: affectedFields,
        states: newStates,
        updatedFormData,
        preMarkFields: true,
      })
    }
  } finally {
    taskQueue.setProcessing(false)
    if (!taskQueue.isEmpty()) {
      processQueue()
    }
  }
}).current
```

### 4.2 为什么用 useLayoutEffect 而不是 useEffect

`useEffect` 在浏览器绘制之后执行，而 `setTimeout(fn, 0)` 也可能在浏览器绘制之后执行。两者的执行顺序不确定，存在以下竞态：

```
render → 浏览器绘制
                   → setTimeout 回调开始执行（此时 useEffect 可能还未更新 runtimeRef）
                   → useEffect 执行，runtimeRef 更新
```

`useLayoutEffect` 在浏览器绘制之前、DOM 更新之后同步执行，确保 `runtimeRef` 在任何 `setTimeout` 回调之前已经是最新值：

```
render → useLayoutEffect 执行（runtimeRef 更新）→ 浏览器绘制 → setTimeout 回调
```

### 4.3 完整修改后的 `useLinkageManager.ts` 关键片段

在 `dependencyGraph` useMemo 之后、`processQueue` useRef 之前添加：

```ts
// --- 新增：运行时依赖 ref ---
const runtimeRef = useRef<{
  linkages: Record<string, LinkageConfig[]>
  linkageFunctions: Record<string, LinkageFunction>
  dependencyGraph: DependencyGraph
  applyLinkageResults: typeof applyLinkageResults
}>({
  linkages,
  linkageFunctions,
  dependencyGraph,
  applyLinkageResults: null as any, // applyLinkageResults 在后面定义，首次由 useLayoutEffect 填充
})
// --- 结束新增 ---
```

在 `applyLinkageResults` useCallback 之后添加：

```ts
// 每次 render 后同步更新运行时依赖，确保 processQueue 读取到最新值
useLayoutEffect(() => {
  runtimeRef.current = {
    linkages,
    linkageFunctions,
    dependencyGraph,
    applyLinkageResults,
  }
})
```

然后修改 `processQueue` 的 useRef：

```ts
const processQueue = useRef(async () => {
  if (taskQueue.getRefreshing()) return
  if (taskQueue.getProcessing()) return

  taskQueue.setProcessing(true)

  try {
    while (!taskQueue.isEmpty()) {
      const task = taskQueue.dequeue()
      if (!task) break

      if (!taskQueue.isTaskValid(task.fieldName, task.timestamp)) {
        continue
      }

      // ✅ 从 runtimeRef 读取最新运行时依赖
      const {
        linkages: currentLinkages,
        linkageFunctions: currentLinkageFunctions,
        dependencyGraph: currentDependencyGraph,
        applyLinkageResults: currentApplyLinkageResults,
      } = runtimeRef.current

      const formData =
        Object.keys(latestFormDataRef.current).length > 0
          ? { ...latestFormDataRef.current }
          : { ...form.getValues() }

      const affectedFields = task.affectedFields

      const { states: newStates, updatedFormData } =
        await evaluateLinkagesByLayers({
          fields: affectedFields,
          linkages: currentLinkages,
          formData,
          linkageFunctions: currentLinkageFunctions,
          asyncSequenceManager,
          dependencyGraph: currentDependencyGraph,
          cache,
          _caller: `processQueue(trigger=${task.fieldName})`,
        })

      await currentApplyLinkageResults({
        fields: affectedFields,
        states: newStates,
        updatedFormData,
        preMarkFields: true,
      })
    }
  } finally {
    taskQueue.setProcessing(false)

    if (!taskQueue.isEmpty()) {
      processQueue()
    }
  }
}).current
```

---

## 5. 方案对比

| 方案 | 优点 | 缺点 |
|---|---|---|
| **Latest Ref 模式**（推荐） | 引用稳定 + 读取最新依赖；改动最小 | `useLayoutEffect` 需要了解其时序语义 |
| 改为 `useCallback` | 每次 deps 变化时函数更新 | 新旧函数版本可能并发执行，破坏队列串行保证 |
| 每次执行前先 `await` 等待旧版完成 | 可保证串行 | 实现复杂，性能差；本质上是在绕过根本问题 |

---

## 6. 非问题确认

扫描后以下位置**确认无闭包陈旧问题**：

| 文件/位置 | 结论 | 原因 |
|---|---|---|
| `useArrayLinkageManager.ts:61` `generateDynamicLinkages` | ✅ 无问题 | `useCallback` deps 完整覆盖所有捕获变量 |
| `useArrayLinkageManager.ts:219` watch 订阅 | ✅ 无问题 | `generateDynamicLinkages` 在 `useEffect` deps 中，变化时重新订阅 |
| `useArrayLinkageManager.ts:254` `refresh` | ✅ 无问题 | 仅依赖 `generateDynamicLinkages`，deps 正确 |
| `useLinkageManager.ts:436` `refreshLinkage` | ✅ 无问题 | 正常 `useCallback`，deps 完整 |
| `useLinkageManager.ts:494` `setValueWithoutLinkage` | ✅ 无问题 | 无外部依赖 |
| `useLinkageManager.ts:184` `applyLinkageResults` | ✅ 无独立问题（依赖 `processQueue` 修复） | 本身 `useCallback` deps 正确；被 `processQueue` 陈旧调用是 2.1 的次生影响 |

---

## 7. 测试验证

修复后应通过以下验证场景：

### 场景 1：schema 联动更新后 linkageFunctions 变化

```ts
// 1. 初始渲染：linkageFunctions = { loadOptions: () => [] }
// 2. 渲染后更新：linkageFunctions = { loadOptions: () => realData }
// 3. 触发 country 字段变化
// 期望：province 联动调用新版 loadOptions，返回 realData
```

### 场景 2：动态 schema 变化后新联动生效

```ts
// 1. 初始 schema 无 linkages
// 2. 通过 schema 联动加载新 schema，linkages 变化
// 3. 修改触发字段
// 期望：新 linkages 对应的目标字段联动执行
```

### 场景 3：数组元素增加后联动正确绑定

```ts
// 1. 初始 items 数组有 1 个元素
// 2. 添加第 2 个元素（触发 linkages 更新，新增 items.1.xxx 联动）
// 3. 修改 items.1.price
// 期望：items.1.subtotal 联动执行（而非静默失败）
```

---

**文档版本**: 1.0
**创建日期**: 2026-07-02
**适用文件**: `src/components/DynamicForm/hooks/useLinkageManager.ts`
