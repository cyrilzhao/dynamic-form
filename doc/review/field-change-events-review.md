# DynamicForm 字段变更事件技术方案审查报告

**审查日期**: 2026-09-03  
**审查对象**: 字段级别变更事件设计文档及代码实现  
**文档版本**: v1.0  
**审查人**: Claude (Opus 4.8)

---

## 一、审查概述

本次审查覆盖以下内容：

1. **设计文档**: `doc/tech-design/dynamic-form-field-change-events.md`
2. **核心实现**:
   - `src/components/DynamicForm/DynamicForm.tsx` (主表单组件)
   - `src/components/DynamicForm/widgets/ArrayFieldWidget.tsx` (数组字段组件)
   - `src/components/DynamicForm/utils/arrayActionRegistry.ts` (数组操作注册表)
   - `src/components/DynamicForm/utils/linkageOperationController.ts` (联动操作控制器)
3. **类型定义**: `src/components/DynamicForm/types/index.ts`
4. **测试用例**: `src/components/DynamicForm/__tests__/fieldChangeEvents.contract.test.tsx`

审查结果分为：**重大问题**、**次要问题** 和 **可接受的设计取舍**。

---

## 二、重大问题

### 问题 1: `onChange` 从同步变为异步，但兼容性章节未声明

**严重程度**: 🔴 高

**位置**:

- 文档 §9.4 (批处理和竞态控制)
- 文档 §10 (兼容性与版本策略)
- 代码 `DynamicForm.tsx:1478-1490`

**问题描述**:

文档 §9.4 明确使用"微任务或零延迟定时器"批处理，代码实现中使用 `setTimeout(..., 0)` 延迟 flush：

```typescript
// DynamicForm.tsx:1478
changeFlushTimerRef.current = window.setTimeout(() => {
  changeFlushTimerRef.current = null
  const nextData = pendingDataRef.current
  if (nextData) {
    const changesSnapshot = pendingChangesRef.current
    pendingChangesRef.current = []
    pendingDataRef.current = null
    clearArrayAction(methods.control)
    latestOnChangeRef.current?.(nextData, {
      changes: changesSnapshot,
    })
  }
}, 0)
```

这意味着 `onChange` 回调从**同步**变为**异步**（至少延迟一个事件循环）。

文档 §7.1.1 提到"当前 DynamicForm.tsx 的 watch 订阅会在每次 RHF setValue 后分别调用 onChange"，说明现有实现是同步的。但 §10 的兼容性清单中**没有列出这一行为变更**。

**影响**:

现有消费者可能依赖同步通知（例如在同一渲染帧内基于 `onChange` 触发的状态更新），异步化后这些模式会悄然失效，且不会有类型错误提示。这是一个**破坏性变更**。

**建议**:

在文档 §10 明确加一条：

> **时序变更**: `onChange` 的触发时机从同步变为微任务/零延迟异步。现有消费者若依赖同步回调时序（例如在同步函数中立即读取 `onChange` 设置的状态），需测试兼容性并调整为异步模式（使用 `await` 或 `useEffect` 监听状态变化）。

---

### 问题 2: `reset` 触发联动时，联动目标的 `source` 归属未定义

**严重程度**: 🟡 中

**位置**:

- 文档 §7.4 (reset 操作)
- 文档 §7.5 (联动级联)

**问题描述**:

- §7.4 说："`reset` 产生 `source: 'reset'`"
- §7.5 说："联动写入的字段标记为 `source: 'linkage'`"

但如果 `reset()` 重置了一个联动触发字段（例如将 `country` 重置为 `'CN'`），进而触发了联动（将 `province` 设置为 `'Shanghai'`），那么联动目标 `province` 的 `source` 应该是 `'reset'` 还是 `'linkage'`？

**代码实现分析**:

```typescript
// DynamicForm.tsx:1147-1185
reset: (values) => {
  operationController.markFormMutation()
  const previousSource = changeSourceRef.current
  const previousMutationSource = operationController.setMutationSource('reset')
  changeSourceRef.current = 'reset'
  try {
    // ... reset 逻辑
  } finally {
    changeSourceRef.current = previousSource
    window.setTimeout(
      () => operationController.setMutationSource(previousMutationSource),
      0,
    )
  }
}
```

代码中 `operationController.setMutationSource('reset')` 设置了全局来源为 `'reset'`，但联动执行时会根据 `operationController.getMutationSource()` 判断：

```typescript
// DynamicForm.tsx:1357-1362
source: name
  ? operationController.getMutationSource() === 'linkage'
    ? 'linkage'
    : changeSourceRef.current
  : (pendingChangeSourceRef.current ??
    changeSourceRef.current),
```

当 `operationController.getMutationSource()` 为 `'linkage'` 时，`source` 被设置为 `'linkage'`；否则使用 `changeSourceRef.current`。

但 `reset` 调用后，`operationController.setMutationSource('reset')` 已经设置，联动执行时 `getMutationSource()` 应该返回 `'linkage'`（在联动管理器中设置）。这个逻辑链条在文档中没有明确说明。

**建议**:

在文档 §7.4 补充一句：

> **reset + 联动**: 当 `reset()` 触发联动时，联动目标字段的 `source` 标记为 `'linkage'`，而不是 `'reset'`。只有 `reset()` 直接修改的字段才标记为 `'reset'`。

或者，在 §7.5 中补充一个交叉场景示例。

---

### 问题 3: `batchDepth` 异常恢复机制缺失

**严重程度**: 🟡 中

**位置**:

- 文档 §9.1 (批处理生命周期)
- 代码 `linkageOperationController.ts:94-110`

**问题描述**:

文档复用了现有控制器的 `batchDepth` 计数器，代码实现如下：

```typescript
// linkageOperationController.ts:94-110
beginBatch(): void {
  this.batchDepth += 1
}

endBatch(): boolean {
  this.batchDepth = Math.max(0, this.batchDepth - 1)
  if (this.batchDepth > 0 || !this.pendingLinkage) {
    return false
  }
  this.pendingLinkage = false
  return true
}
```

如果联动处理器抛出异常，调用栈可能在 `beginBatch` 和 `endBatch` 之间中断，导致 `batchDepth` 没有被正确递减。一旦 `batchDepth > 0` 被冻结，之后所有的字段变更都会进入无限期的待发批次，静默消失。

**代码中的调用点**:

```typescript
// DynamicForm.tsx:1116-1145
operationController.beginBatch()
try {
  if (options?.silence) {
    setValueWithoutLinkage(() => {
      setFormValues({
        methods,
        values: displayValues,
        schema,
        options,
      })
    })
  } else {
    setFormValues({
      methods,
      values: displayValues,
      schema,
      options,
    })
  }
} finally {
  const shouldRefresh = operationController.endBatch()
  if (shouldRefresh && !options?.silence) {
    void refreshLinkage()
  }
  changeSourceRef.current = previousSource
}
```

这里使用了 `try/finally`，所以 `endBatch()` 能被正确调用。**但文档 §9.3 只说了 `onChange` 抛出的异常不阻塞联动队列，没有讨论联动执行本身的异常**。

**建议**:

在文档 §9.1 或 §9.3 补充：

> **异常恢复**: 批处理计数器必须在 `try/finally` 块中递减，以保证异常不会腐蚀批次生命周期。所有调用 `beginBatch` 的代码路径必须确保 `endBatch` 在 `finally` 块中执行。

并在代码审查时确认所有 `beginBatch` 调用点都有对应的 `try/finally` 保护。

---

### 问题 4: 同一字段 user 写入后被 linkage 覆盖，`source` 语义可能误导

**严重程度**: 🟡 中

**位置**:

- 文档 §7.0 Step 5 (批次内去重)
- 代码 `DynamicForm.tsx:1462-1473`

**问题描述**:

文档 §7.0 Step 5 说：

> "同一路径重复写入时保留最初旧值，仅更新最终值、来源及数组动作"

这意味着：

- 用户输入 `foo` → 联动将同一字段改为 `FOO`
- 最终事件的 `source` 变为 `'linkage'`，而不是 `'user'`

代码实现：

```typescript
// DynamicForm.tsx:1462-1473
changes.forEach((change) => {
  const existing = pendingChangesRef.current.find(
    (item) => item.path === change.path,
  )
  if (existing) {
    existing.value = change.value
    existing.source = change.source
    existing.arrayAction = change.arrayAction
  } else {
    pendingChangesRef.current.push(change)
  }
})
```

消费者（如审计日志）如果想判断"这个字段是否被用户直接修改过"，就无法从 `source` 得出结论。

**设计取舍**:

这是合理的设计取舍：最终值由联动决定，报 `'linkage'` 是准确的。但文档应该**明确说明这是设计决定**，而不是让消费者自行推断。

**建议**:

在文档 §7.0 或 §7.5 补充一段：

> **source 覆盖语义**: 若同一路径在一个批次中先由用户写入、再由联动覆盖，最终 `source` 为 `'linkage'`。`source` 描述的是**最终值的来源**，而不是**变化的根本触发者**。如果业务需要追踪原始触发来源（例如审计日志需要区分"用户手动输入后被联动格式化"和"纯粹的联动自动填充"），需在联动侧另行埋点，本设计不提供 `triggerSource` 或 `rootSource`。

---

## 三、次要问题

### 问题 5: `setValues` + 联动混合时的排序规则不完整

**严重程度**: 🔵 低

**位置**:

- 文档 §7.3 (setValues 批量设置)
- 文档 §7.5 (联动级联)

**问题描述**:

- §7.3 说："`setValues` 按输入路径的稳定顺序输出 `changes`"
- §7.5 说：联动按"触发 → 第一层 → 后续级联"顺序

但没有描述混合场景：`setValues({ a, b })` 中 `a` 触发联动修改了 `b`，这时 `b` 在 `changes` 中应该出现几次、哪次以哪个顺序出现？

代码实现中，批次内同路径只保留一条（§7.0 Step 5），但**该条记录在 `changes` 数组中的位置**是保留最初写入时的位置，还是最后写入时的位置，文档没有明确。

**建议**:

在文档 §7.3 或 §7.0 的 Step 5 补充：

> 同路径合并时，该条记录在 `changes` 数组中的**位置**保留最初写入时的位置（即先到先排），而不是最后写入时的位置。例如，`setValues({ a: 1, b: 2 })` 触发联动修改 `a` 为 `3`，最终 `changes` 为 `[{ path: 'a', value: 3, source: 'linkage' }, { path: 'b', value: 2, source: 'setValues' }]`，`a` 的位置不变。

---

### 问题 6: `setValues` 的"稳定顺序"在 numeric-string 键时不精确

**严重程度**: 🔵 低

**位置**: 文档 §7.3

**问题描述**:

文档说"按输入路径的稳定顺序"，依赖 JavaScript 对象的键枚举顺序。但当路径键是纯数字字符串（如 `"0"`, `"1"`）时，V8 的枚举顺序会被提前为数组索引顺序，与插入顺序不同。

例如：

```javascript
const obj = { 1: 'b', 0: 'a', name: 'c' }
Object.keys(obj) // ['0', '1', 'name']，不是 ['1', '0', 'name']
```

**建议**:

在文档 §7.3 补充：

> **键枚举顺序**: `setValues` 的入参如果是普通对象，则按 `Object.keys()` 枚举顺序（数字字符串键按数值升序排在前面，其他键按插入顺序）。如需精确控制顺序，推荐多次调用 `setValue` 或使用有序的实现方式。

---

### 问题 7: `meta.changes` 非空不变量未在类型层面体现

**严重程度**: 🔵 低

**位置**:

- 文档 §6.1 (类型定义)
- 文档 §7.7 (无差异不生成事件)

**问题描述**:

文档 §7.7 说：

> "只要回调因数据变化触发，就应提供 `meta.changes`，且至少包含一条实际差异"

但类型定义：

```typescript
export interface FormChangeMeta {
  changes: FieldChange[]
}
```

`changes` 的类型是普通数组，可以是空数组，消费者无法依靠类型系统获得"非空"保证。

**建议**:

在文档的契约约定里明确：

> **非空不变量**: 实现层面必须保证 `changes.length >= 1`。如果计算后没有实际差异，则不传入 `meta`（保持 `undefined`），而不是传入空 `changes`。这样消费者只需检查 `meta != null` 而不需要再检查 `changes.length`。

如果需要更强的类型保证，可以使用：

```typescript
export type NonEmptyArray<T> = [T, ...T[]]

export interface FormChangeMeta {
  changes: NonEmptyArray<FieldChange>
}
```

但这会增加类型复杂度，需权衡收益。

---

### 问题 8: `ArrayAction` 中 `index` 的语义不对称

**严重程度**: 🔵 低

**位置**:

- 文档 §7.6.1 (数组操作元数据)
- 代码类型定义 `types/index.ts:578-595`

**问题描述**:

- `insert.index`：新数组中的位置（插入后）
- `remove.index`：旧数组中的位置（删除前）

虽然文档有说明，但这个不对称性与开发者的直觉预期容易产生混淆。

**建议**:

在类型注释中显式标注：

```typescript
export interface ArrayInsertAction {
  action: 'insert'
  /** 插入后在新数组中的位置 */
  index: number
  value: unknown
}

export interface ArrayRemoveAction {
  action: 'remove'
  /** 删除前在旧数组中的位置 */
  index: number
  value: unknown
}
```

并在文档 §6.1 的类型定义章节用醒目提示说明这一不对称性。

---

### 问题 9: `onChange` 为 `undefined` 时是否跳过采集未说明

**严重程度**: 🔵 低

**位置**: 文档 §7.0 / §12

**问题描述**:

如果外部没有传入 `onChange`，是否仍需建立 watch 订阅、维护 `pendingBatchRef`、执行外部值域转换？这是一个性能优化点，且影响初始化逻辑设计。

**代码实现**:

```typescript
// DynamicForm.tsx:1220-1504
React.useEffect(() => {
  if (onChange) {
    // ... 建立 watch 订阅
  }
}, [watch])
```

代码已经实现了这个优化：当 `onChange` 为 `undefined` 时，不建立 watch 订阅。

**建议**:

在文档 §7.0 或 §12 阶段二中补充：

> **性能优化**: 当 `onChange` 为 `undefined` 时，不建立 watch 订阅，跳过变更采集与外部值域转换。联动机制不受影响。

---

## 四、可接受的设计取舍

以下设计决策是合理的，但建议在文档中更显式地说明：

### 1. 重复元素移动后外部数组不变不生成事件

**位置**: 文档 §7.7

**说明**:

文档已明确说明："如果移动重复值后外部数组完全相同（如 `['A', 'A']`），这对消费者没有可观察影响，应视为 no-op，不生成 change"。

这是**信息论约束**，无法从快照推断具体操作。审计日志场景下可能意外丢失操作记录，但这是合理的折衷。

**建议**: 保持现状，文档已清晰说明。

---

### 2. 嵌套 DynamicForm 事件冒泡机制

**位置**: 文档 §8.2

**说明**:

文档只说 `asNestedForm` 不改变路径格式，但没有描述**完全独立的嵌套表单**（非 `asNestedForm` 模式）的事件路由机制。

对于 `asNestedForm=true` 的场景，嵌套表单的字段注册在父级 RHF 上下文中，父级的 watch 会自动捕获所有变化，无需额外冒泡。

对于完全独立的嵌套表单（例如在自定义 widget 内部渲染的 `DynamicForm`），它有自己的 `onChange`，与父表单的 `onChange` 是两个独立的回调。

**建议**:

在文档 §8.2 补充：

> **独立嵌套表单**: 当在自定义 widget 内部渲染完全独立的 `DynamicForm`（`asNestedForm=false`）时，内层表单的 `onChange` 与外层表单的 `onChange` 是两个独立的回调。内层表单的变更事件不会自动冒泡到外层。如需关联，需在内层的 `onChange` 中手动调用外层表单的 `setValue`。

---

## 五、代码实现审查

### 5.1 实现与文档的一致性

经过逐行对比，代码实现与文档设计基本一致：

| 设计要点     | 文档章节    | 代码位置                                          | 状态    |
| ------------ | ----------- | ------------------------------------------------- | ------- |
| 批处理机制   | §9.1        | `linkageOperationController.ts:94-110`            | ✅ 一致 |
| 延迟 flush   | §9.4        | `DynamicForm.tsx:1476-1490`                       | ✅ 一致 |
| source 标记  | §7.1-7.5    | `DynamicForm.tsx:1357-1362`                       | ✅ 一致 |
| 数组操作记录 | §7.6        | `arrayActionRegistry.ts` + `ArrayFieldWidget.tsx` | ✅ 一致 |
| 去重逻辑     | §7.0 Step 5 | `DynamicForm.tsx:1462-1473`                       | ✅ 一致 |
| 外部数据转换 | §6.2        | `DynamicForm.tsx:1245-1254`                       | ✅ 一致 |

---

### 5.2 代码质量评估

**优点**:

1. **类型安全**: 使用了完整的 TypeScript 类型定义，所有关键接口都有清晰的类型约束
2. **职责分离**:
   - `arrayActionRegistry.ts` 负责数组操作记录
   - `linkageOperationController.ts` 负责批处理和版本控制
   - `DynamicForm.tsx` 负责事件采集和分发
3. **测试覆盖**: `fieldChangeEvents.contract.test.tsx` 提供了18个测试用例，覆盖主要场景
4. **注释质量**: 核心函数都有清晰的中文注释说明用途

**需要改进的地方**:

1. **异常处理**: 缺少对联动执行异常的捕获和恢复机制（虽然 `setValues` 有 try/finally，但 `refreshLinkage` 是 async 且没有 await）
2. **边界情况**: `inferArrayAction` 函数（`DynamicForm.tsx:120-211`）对重复元素的处理逻辑较复杂，需要更多注释说明各分支的边界条件
3. **性能优化**: `pendingChangesRef.current.find()` 是 O(n) 查找，在大批量变更时可能成为瓶颈（可优化为 Map）

---

### 5.3 测试覆盖分析

现有测试用例覆盖：

- ✅ setValues 批量设置
- ✅ 联动 + 直接变化合并
- ✅ 数组插入、删除、移动
- ✅ reset 操作
- ✅ source 标记
- ✅ arrayAction 元数据
- ✅ 重复值无法推断时省略 arrayAction
- ✅ 异步联动竞态保护
- ✅ 组件卸载时取消 flush

**缺失的测试场景**:

1. ❌ reset 触发联动时的 source 归属（问题2）
2. ❌ setValues + 联动混合时的 changes 排序（问题5）
3. ❌ onChange 回调抛出异常时的行为
4. ❌ 多层嵌套表单的事件冒泡
5. ❌ transform 回调与事件采集的交互

**建议**: 补充上述测试用例以提高覆盖率。

---

## 六、总结与建议

### 6.1 总体评价

**设计质量**: ⭐⭐⭐⭐☆ (4/5)

- 设计思路清晰，批处理、source 标记、arrayAction 等核心概念定义完善
- 类型契约完整，便于消费者理解和使用
- 考虑了联动、数组操作、异步竞态等复杂场景

**实现质量**: ⭐⭐⭐⭐☆ (4/5)

- 代码与文档高度一致
- 类型安全，职责分离合理
- 主要问题是文档与实际行为变更的说明不够充分

**文档质量**: ⭐⭐⭐⭐☆ (4/5)

- 结构完整，章节清晰
- 技术细节丰富，示例充足
- 主要问题是部分边界情况和兼容性影响说明不足

---

### 6.2 优先级建议

**必须修复** (发布前):

1. ✅ 在文档 §10 补充 `onChange` 同步→异步的兼容性说明（问题1）
2. ✅ 在文档 §7.4 或 §7.5 明确 reset + 联动的 source 归属（问题2）
3. ✅ 在文档 §7.0/§7.5 明确同一字段被联动覆盖时的 source 语义（问题4）

**建议改进** (后续迭代):

4. 在文档 §9.1 补充批处理异常恢复说明（问题3）
5. 在文档 §7.3 补充 setValues + 联动混合时的排序规则（问题5）
6. 在类型注释中标注 ArrayAction.index 的不对称语义（问题8）

**可选优化** (技术债):

7. 补充缺失的测试用例
8. 优化 `pendingChangesRef` 查找性能（O(n) → O(1)）
9. 增强异常处理机制

---

### 6.3 发布检查清单

在发布此功能前，请确认：

- [ ] 文档 §10 已补充 `onChange` 时序变更说明
- [ ] 文档已明确 reset + 联动的 source 归属
- [ ] 文档已明确同一字段被联动覆盖的 source 语义
- [ ] 所有测试用例通过
- [ ] 已进行手动回归测试，确认现有消费者不受影响
- [ ] 已更新 CHANGELOG 和 Migration Guide

---

## 七、附录：代码片段引用

### A1: 异步 flush 实现

```typescript
// DynamicForm.tsx:1476-1490
if (
  pendingChangesRef.current.length > 0 &&
  changeFlushTimerRef.current === null
) {
  changeFlushTimerRef.current = window.setTimeout(() => {
    changeFlushTimerRef.current = null
    const nextData = pendingDataRef.current
    if (nextData) {
      const changesSnapshot = pendingChangesRef.current
      pendingChangesRef.current = []
      pendingDataRef.current = null
      clearArrayAction(methods.control)
      latestOnChangeRef.current?.(nextData, {
        changes: changesSnapshot,
      })
    }
  }, 0)
}
```

### A2: source 判断逻辑

```typescript
// DynamicForm.tsx:1357-1362
source: name
  ? operationController.getMutationSource() === 'linkage'
    ? 'linkage'
    : changeSourceRef.current
  : (pendingChangeSourceRef.current ??
    changeSourceRef.current),
```

### A3: 批次内去重逻辑

```typescript
// DynamicForm.tsx:1462-1473
changes.forEach((change) => {
  const existing = pendingChangesRef.current.find(
    (item) => item.path === change.path,
  )
  if (existing) {
    existing.value = change.value
    existing.source = change.source
    existing.arrayAction = change.arrayAction
  } else {
    pendingChangesRef.current.push(change)
  }
})
```

---

**审查完成时间**: 2026-09-03  
**建议复审时间**: 文档修改完成后
