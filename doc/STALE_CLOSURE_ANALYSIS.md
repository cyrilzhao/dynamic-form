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

### 2.5 [MEDIUM] useImperativeHandle — `DynamicForm.tsx:620`

#### 问题描述

```ts
useImperativeHandle(
  ref,
  () => ({
    ...
    setValues: (values, options) => {
      ...
      if (options?.silence) {
        setValueWithoutLinkage(() => { ... })  // ← 捕获外部 setValueWithoutLinkage
      }
    },
    refreshLinkage: async () => {
      await refreshLinkage()   // ← 捕获外部 refreshLinkage
    },
  }),
  [methods, schema]  // ← deps 只有 methods 和 schema！
)
```

当前 deps 为 `[methods, schema]`，但工厂函数内还捕获了以下变量：

| 变量 | 来源 | 是否会变化 | 风险 |
|---|---|---|---|
| `refreshLinkage` | `useArrayLinkageManager.refresh`，是 `useCallback([generateDynamicLinkages])` | **会变化**：`baseLinkages` / `schema` 更新时 `generateDynamicLinkages` 重建，`refresh` 随之重建 | ❌ 高 |
| `setValueWithoutLinkage` | `useLinkageManager.setValueWithoutLinkage`，是 `useCallback(fn, [])` | 不变（无 deps，捕获的 `skipLinkageRef` 是 ref，始终最新） | ✅ 安全 |
| `setFormValues` | 文件级纯函数 | 不变 | ✅ 安全 |
| `callbacksRef` | `useRef`，读 `.current` | 通过 ref 读取，始终最新 | ✅ 安全 |

#### 问题复现场景

```
初始渲染：baseLinkages = { province: [...] }，refresh 版本 v1
           ↓
schema 联动更新：baseLinkages 变化 → refresh 版本 v2（捕获新 baseLinkages）
           ↓
外部异步数据加载完成，调用 formRef.current.refreshLinkage()
           ↓
useImperativeHandle 未重建（refreshLinkage 不在 deps 中）
           ↓
调用的是 refresh v1，内部 generateDynamicLinkages 基于旧 baseLinkages 生成联动
           ↓
新 baseLinkages 对应的动态联动未被刷新 ← 静默失败
```

#### 影响范围

外部代码中典型的 `refreshLinkage` 调用场景：

```ts
// 加载异步数据后手动刷新联动
useEffect(() => {
  if (shouldRefreshLinkage && data.length > 0) {
    formRef.current?.refreshLinkage()  // ← 可能调用到旧版本
  }
}, [shouldRefreshLinkage, data])
```

若 schema / linkages 在异步数据加载完成之前发生了变化，`refreshLinkage` 将使用旧 `baseLinkages` 重新生成动态联动，导致刷新不完整。

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

在 `useLinkageManager` 中引入一个 `runtimeRef`，在每次 render 时同步更新。

#### 4.1.1 声明顺序

`runtimeRef` 必须在 `applyLinkageResults` 定义之后声明，否则 `typeof applyLinkageResults` 是前向引用，TypeScript 编译报错。推荐的声明顺序是：

```
1. dependencyGraph（useMemo）
2. linkageStates（useState）
3. applyLinkageResults（useCallback）   ← 先定义
4. runtimeRef（useRef）                 ← 再声明，此时 typeof applyLinkageResults 合法
5. processQueue（useRef）               ← 最后定义
```

如果希望将类型定义放在更早的位置，可以独立提取接口而不依赖 `typeof`：

```ts
// 独立定义类型，不依赖 typeof applyLinkageResults
interface LinkageRuntime {
  linkages: Record<string, LinkageConfig[]>
  linkageFunctions: Record<string, LinkageFunction>
  dependencyGraph: DependencyGraph
  getValues: () => Record<string, any>
  applyLinkageResults: (params: {
    fields: string[]
    states: Record<string, LinkageResult>
    updatedFormData: Record<string, any>
    preMarkFields?: boolean
  }) => Promise<void>
}
```

#### 4.1.2 render 阶段直接赋值 vs useLayoutEffect

**两种方案对比：**

| | render 阶段直接赋值 | useLayoutEffect |
|---|---|---|
| 执行时机 | render 阶段同步，最早 | DOM 更新后、绘制前，比 useEffect 早 |
| 写法 | `runtimeRef.current = {...}` | 需要额外 hook 注册 |
| React Strict Mode 双调用 | 写两次相同值，无害 | 同样执行两次，无害 |
| 竞态安全 | ✅ render 本身是同步的，赋值完成再进行绘制和异步回调 | ✅ 在 setTimeout 之前完成 |
| React 官方建议 | ✅ React 文档明确允许在 render 阶段写 ref | 官方推荐用于 DOM 副作用，对 ref 赋值属于"用 hook 做了不必要的事" |

**推荐：render 阶段直接赋值**。语义更清晰（"每次 render 后立即更新"），不需要额外的 hook，也不存在 useEffect 的异步执行顺序问题：

```ts
// ✅ 推荐：在 render 阶段直接写 ref，每次 render 后立即有效
// 注意：这里不在 useEffect 内，是 render 阶段的同步代码
// React 允许在 render 中写 ref（不影响 render 输出就安全）
runtimeRef.current = {
  linkages,
  linkageFunctions,
  dependencyGraph,
  getValues,
  applyLinkageResults,
}
```

#### 4.1.3 关于 `getValues` / `form` 是否需要加入 runtimeRef

`form` 参数来自 react-hook-form 的 `useForm()` 返回值，其引用在整个组件生命周期内保持稳定（react-hook-form 的设计保证）。因此 `form.getValues` 是一个稳定引用，无论捕获哪次 render 的版本，行为都一致。

但有一个边界情况：在 `DynamicForm.tsx` 中，`formToUse` 可能在初始化阶段从 `linkageStateContext?.form`（父级表单）切换到 `methodsRef.current`（自身表单），或者反之。如果切换发生在首次 render 之后，且 `useLinkageManager` 内部捕获的 `form` 是旧版本，理论上可能读到错误的表单实例。

**结论**：实践中风险极低，因为 `formToUse` 在初始化后不会再切换。但若追求零风险，可以将 `getValues` 也放入 `runtimeRef`：

```ts
runtimeRef.current = {
  linkages,
  linkageFunctions,
  dependencyGraph,
  getValues,           // ← 加入，消除边界情况风险
  applyLinkageResults,
}
```

然后 `processQueue` 中的 fallback 改为：

```ts
const { getValues: currentGetValues, ... } = runtimeRef.current
const formData =
  Object.keys(latestFormDataRef.current).length > 0
    ? { ...latestFormDataRef.current }
    : { ...currentGetValues() }
```

#### 4.1.4 完整修改片段

在 `applyLinkageResults` useCallback 之后、`processQueue` useRef 之前插入：

```ts
// ✅ 运行时依赖 ref：每次 render 同步更新，确保 processQueue 读取最新依赖
// 必须在 applyLinkageResults 定义之后声明（需要其类型）
const runtimeRef = useRef<{
  linkages: Record<string, LinkageConfig[]>
  linkageFunctions: Record<string, LinkageFunction>
  dependencyGraph: DependencyGraph
  getValues: UseFormReturn<any>['getValues']
  applyLinkageResults: typeof applyLinkageResults
}>({
  linkages,
  linkageFunctions,
  dependencyGraph,
  getValues,
  applyLinkageResults,
})

// render 阶段直接赋值（不用 useLayoutEffect），每次 render 后立即生效
runtimeRef.current = {
  linkages,
  linkageFunctions,
  dependencyGraph,
  getValues,
  applyLinkageResults,
}
```

修改 `processQueue`：

```ts
const processQueue = useRef(async () => {
  if (taskQueue.getRefreshing()) return
  if (taskQueue.getProcessing()) return

  taskQueue.setProcessing(true)

  try {
    while (!taskQueue.isEmpty()) {
      const task = taskQueue.dequeue()
      if (!task) break
      if (!taskQueue.isTaskValid(task.fieldName, task.timestamp)) continue

      // ✅ 从 runtimeRef 读取最新依赖，而不是首次 render 的闭包值
      const {
        linkages: currentLinkages,
        linkageFunctions: currentLinkageFunctions,
        dependencyGraph: currentDependencyGraph,
        getValues: currentGetValues,
        applyLinkageResults: currentApplyLinkageResults,
      } = runtimeRef.current

      const formData =
        Object.keys(latestFormDataRef.current).length > 0
          ? { ...latestFormDataRef.current }
          : { ...currentGetValues() }

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

### 4.2 修复 useImperativeHandle — `DynamicForm.tsx:620`

修复方案很简单：将 `refreshLinkage` 加入 `useImperativeHandle` 的 deps 数组。`setValueWithoutLinkage` 无需加入（引用稳定，见 2.5 节分析）。

```ts
useImperativeHandle(
  ref,
  () => ({
    setValue: (name, value, options) => { ... },
    getValue: (name) => { ... },
    getValues: () => { ... },
    setValues: (values, options) => {
      ...
      if (options?.silence) {
        setValueWithoutLinkage(() => { ... })
      }
    },
    reset: (values) => { ... },
    validate: async (name) => { ... },
    getErrors: () => { ... },
    clearErrors: (name) => { ... },
    setError: (name, error) => { ... },
    getFormState: () => { ... },
    refreshLinkage: async () => {
      await refreshLinkage()
    },
  }),
  [methods, schema, refreshLinkage]  // ✅ 新增 refreshLinkage
)
```

当 `baseLinkages` / `schema` 变化导致 `refreshLinkage` 重建时，`useImperativeHandle` 会同步重建，外部通过 `formRef.current.refreshLinkage()` 调用时始终使用最新版本。

---

## 5. 方案对比

### 5.1 processQueue 修复方案对比

| 方案 | 优点 | 缺点 |
|---|---|---|
| **Latest Ref 模式 + render 阶段赋值**（推荐） | 引用稳定 + 读取最新依赖；改动最小；render 阶段同步赋值，无额外 hook | 需理解"render 阶段写 ref 是合法的"这一 React 约定 |
| Latest Ref 模式 + useLayoutEffect | 与推荐方案等效 | 多一个 hook 注册；对 ref 赋值不需要 useLayoutEffect 的语义 |
| 改为 `useCallback` | 每次 deps 变化时函数更新 | 新旧函数版本可能并发执行，破坏队列串行保证 |
| 每次执行前 `await` 等待旧版完成 | 可保证串行 | 实现复杂，性能差；本质上是在绕过根本问题 |

### 5.2 useImperativeHandle 修复方案对比

| 方案 | 优点 | 缺点 |
|---|---|---|
| **在 deps 中添加 `refreshLinkage`**（推荐） | 改动最小（一行）；语义清晰 | `refreshLinkage` 变化时 ref 对象重建（代价极低） |
| 用 Latest Ref 在 `refreshLinkage` 上包一层 | 可以不动 deps | 多余的复杂性；`useImperativeHandle` 本身就是做这件事的 |

---

## 6. 非问题确认

扫描后以下位置**确认无独立闭包陈旧问题**：

| 文件/位置 | 结论 | 原因 |
|---|---|---|
| `useArrayLinkageManager.ts:61` `generateDynamicLinkages` | ✅ 无问题 | `useCallback` deps 完整覆盖所有捕获变量 |
| `useArrayLinkageManager.ts:219` watch 订阅 | ✅ 无问题 | `generateDynamicLinkages` 在 `useEffect` deps 中，变化时重新订阅 |
| `useArrayLinkageManager.ts:254` `refresh` | ✅ 无问题 | 仅依赖 `generateDynamicLinkages`，deps 正确 |
| `useLinkageManager.ts:436` `refreshLinkage` | ✅ 无问题 | 正常 `useCallback`，deps 完整 |
| `useLinkageManager.ts:494` `setValueWithoutLinkage` | ✅ 无问题 | 无外部依赖；捕获的 `skipLinkageRef` 是 ref，始终最新 |
| `useLinkageManager.ts:184` `applyLinkageResults` | ✅ 无独立问题 | 本身 `useCallback` deps 正确；被陈旧 `processQueue` 调用是 2.1 的次生影响，随 2.1 修复一并解决 |
| `DynamicForm.tsx` `useImperativeHandle` 中的 `setValueWithoutLinkage` | ✅ 无问题 | `setValueWithoutLinkage` 引用稳定，内部通过 ref 读取最新值 |

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

### 场景 4：useImperativeHandle.refreshLinkage 在 baseLinkages 变化后仍有效

```ts
// 1. 初始渲染，baseLinkages 基于初始 schema
// 2. schema 联动更新，baseLinkages 变化，refresh 版本更新
// 3. 异步数据加载完成，外部调用 formRef.current.refreshLinkage()
// 期望：refreshLinkage 基于最新 baseLinkages 重新生成动态联动，而非使用初始版本
```

---

**文档版本**: 1.1
**创建日期**: 2026-07-02
**适用文件**:
- `src/components/DynamicForm/hooks/useLinkageManager.ts`
- `src/components/DynamicForm/DynamicForm.tsx`
