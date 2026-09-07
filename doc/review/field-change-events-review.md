# DynamicForm 字段变更事件技术方案审查报告

**审查日期**: 2026-09-03  
**审查对象**: 字段级别变更事件设计文档及代码实现  
**文档版本**: v1.0  
**审查人**: Claude (Opus 4.8)
**交叉验证**: 已完成多模型交叉核对

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

**测试验证结果**:
- ✅ 24 个测试全部通过
- ✅ 已有场景行为稳定
- ⚠️ 部分边界场景缺少测试覆盖

审查结果分为：**发布前必须处理**、**建议随后补充** 和 **可接受的设计取舍**。

---

## 重要说明

本报告已经过多模型交叉验证，区分了以下三类问题：
1. **真实的代码/设计缺陷** - 需要修改代码或设计
2. **文档契约缺口** - 代码正确但文档说明不足
3. **可选的优化项** - 不影响正确性的改进建议

---

## 二、发布前必须处理的问题

### 问题 1: `onChange` 从同步变为异步，但兼容性章节未声明

**问题类型**: 🔴 文档契约缺口 + 兼容性风险

**严重程度**: 高 - 破坏性变更，现有消费者可能静默受到影响

**位置**:
- 文档 §9.4 (批处理和竞态控制)
- 文档 §10 (兼容性与版本策略)
- 代码：字段变更 watch effect 的 flush 回调（当前约 `DynamicForm.tsx:1499-1509`）

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

现有消费者可能依赖同步通知（例如在同一渲染帧内基于 `onChange` 触发的状态更新），异步化后这些模式会悄然失效，且不会有类型错误提示。

**注意**：当前工作区只能证明"现在是异步"，设计文档 §7.1.1 提到旧行为为同步，但需要通过实际的历史版本代码或现有消费者的兼容性测试来确认影响范围。相对于字段事件功能引入前的既有行为，当前实现存在同步到异步的时序变化风险。

**建议**:

1. 在文档 §10 明确加一条：

> **时序变更**: `onChange` 的触发时机从同步变为微任务/零延迟异步。现有消费者若依赖同步回调时序（例如在同步函数中立即读取 `onChange` 设置的状态），需测试兼容性并调整为异步模式（使用 `useEffect` 监听状态变化，或通过状态订阅观察）。

2. 在 Migration Guide 中说明以下模式需要调整：
   - 在调用 `setValue` 后立即读取由 `onChange` 更新的外部状态
   - 依赖回调同步触发副作用
   - 依赖同一事件处理函数中的执行顺序

3. **注意**：当前 `setValue`、`setValues`、`reset` 的公开 API 仍是 `void`，不能要求调用方 `await formRef.current.setValue()`。文档应使用"等待回调触发"或"通过状态订阅观察"这种准确表述。

---

### 问题 2: `reset` 触发联动时，联动目标的 `source` 归属未定义

**问题类型**: 🔴 文档契约缺口

**严重程度**: 中 - 设计语义需要明确，避免消费者误解

**位置**:
- 文档 §7.4 (reset 操作)
- 文档 §7.5 (联动级联)

**问题描述**:

- §7.4 说："`reset` 产生 `source: 'reset'`"
- §7.5 说："联动写入的字段标记为 `source: 'linkage'`"

但如果 `reset()` 重置了一个联动触发字段（例如将 `country` 重置为 `'CN'`），进而触发了联动（将 `province` 设置为 `'Shanghai'`），那么联动目标 `province` 的 `source` 应该是 `'reset'` 还是 `'linkage'`？

**代码实现分析**:

从当前代码路径推断，设计意图和预期行为是：
- reset 直接修改的字段：`source: 'reset'`
- reset 触发的联动目标：`source: 'linkage'`

不过该交叉场景目前尚未由专门的集成测试验证，发布前仍应确认实际事件循环时序。

这符合"source 表示该字段最终值由谁写入"的定义。

**建议**:

在文档 §7.4 或 §7.5 补充明确示例（假设存在对应的联动规则）：

```typescript
// reset 直接修改的字段标记为 'reset'，触发的联动目标标记为 'linkage'
// 假设存在联动规则：country='CN' 时自动设置 province='Shanghai'
formRef.current.reset({ country: 'CN' })

// 产生的事件：
onChange(data, {
  changes: [
    {
      path: 'country',
      previousValue: 'US',
      value: 'CN',
      source: 'reset',  // ← reset 直接修改的字段
    },
    {
      path: 'province',
      previousValue: undefined,
      value: 'Shanghai',
      source: 'linkage',  // ← reset 触发的联动目标
    },
  ],
})
```

并新增集成测试验证：
1. reset 直接字段的 source 是 'reset'
2. reset 触发的联动目标 source 是 'linkage'
3. 联动目标没有被错误标记为 'reset'

---

### 问题 3: 同一字段 user 写入后被 linkage 覆盖，`source` 语义可能误导

**问题类型**: 🔴 文档契约缺口

**严重程度**: 中 - 合理的设计决策，但需要显式说明避免误用

**位置**:
- 文档 §7.0 Step 5 (批次内去重)
- 代码 `DynamicForm.tsx:1462-1473`

**问题描述**:

文档 §7.0 Step 5 说："同一路径重复写入时保留最初旧值，仅更新最终值、来源及数组动作"

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
    existing.source = change.source       // ← 更新为最终来源
    existing.arrayAction = change.arrayAction
  } else {
    pendingChangesRef.current.push(change)
  }
})
```

消费者（如审计日志）如果想判断"这个字段是否被用户直接修改过"，就无法从 `source` 得出结论。

**设计取舍**:

这是**合理的设计取舍**：最终值由联动决定，报 `'linkage'` 是准确的。`source` 描述的是**最终值的来源**，而不是**变化的根本触发者**。

**建议**:

将文档末尾的相关说明提升到 §7.0 或 §7.5 的主契约位置：

> **source 覆盖语义**: 若同一路径在一个批次中先由用户写入、再由联动覆盖，最终 `source` 为 `'linkage'`。`source` 描述的是**最终值的来源**，而不是**变化的根本触发者**。如果业务需要追踪原始触发来源（例如审计日志需要区分"用户手动输入后被联动格式化"和"纯粹的联动自动填充"），需在联动侧另行埋点，或未来新增 `triggerSource`、`causedBy` 等独立字段。本设计不提供此能力。

---

### 问题 4: `onChange` 异步回调中的异常处理契约未定义

**问题类型**: 🔴 文档不一致 + 策略缺失

**严重程度**: 高 - 异常处理策略与文档描述不符，需要明确契约

**位置**:
- 文档 §9.3 (错误处理)
- 代码：字段变更 watch effect 的 flush 回调（当前约 `DynamicForm.tsx:1499-1509`）

**问题描述**:

设计文档 §9.3 写道：

> `onChange` 抛出的异常不应回滚已经完成的表单更新，也不应阻塞联动队列和校验流程。异常交由 React 应用层错误边界或统一日志机制处理。

但当前 `onChange` 在 `setTimeout` 回调中执行：

```typescript
// DynamicForm.tsx:1486
window.setTimeout(() => {
  changeFlushTimerRef.current = null
  const nextData = pendingDataRef.current
  if (nextData) {
    const changesSnapshot = pendingChangesRef.current
    pendingChangesRef.current = []
    pendingDataRef.current = null
    clearArrayAction(methods.control)
    latestOnChangeRef.current?.(nextData, {  // ← 没有异常处理
      changes: changesSnapshot,
    })
  }
}, 0)
```

**实际问题**:

由于在异步定时器中执行，`onChange` 抛出的异常：
- ❌ 无法被 React Error Boundary 可靠捕获
- ❌ 可能表现为浏览器未捕获异常
- ❌ 在未安装异步异常捕获或断言机制的测试环境中可能导致测试失败
- ❌ 文档承诺的"交由应用层错误边界处理"无法兑现

**有利条件**:

当前实现在调用回调前已经完成批次清理：

```typescript
pendingChangesRef.current = []
pendingDataRef.current = null
clearArrayAction(...)
```

因此即使回调抛异常，本批次队列已经交换并清空，理论上不会直接污染下一批次。

**建议**:

**发布前必须明确异常处理策略**，并根据策略决定实现方式：

**策略选项**:

1. **捕获 + 上报 + 继续**：适合生产环境稳定性优先
   ```typescript
   try {
     latestOnChangeRef.current?.(nextData, { changes: changesSnapshot })
   } catch (error) {
     // 使用项目统一的错误上报机制
     reportFormChangeError?.(error)
     // 或调用可选的错误回调
     onChangeError?.(error)
   }
   ```

2. **捕获 + 上报 + 重新抛出**：保留异步任务层面的错误传播能力；不会恢复到原始 `setValue()` 调用方的同步调用栈
   ```typescript
   try {
     latestOnChangeRef.current?.(nextData, { changes: changesSnapshot })
   } catch (error) {
     logger.error('DynamicForm onChange failed', error)
  throw error  // 继续从异步任务向上传播，不会回到原始 setValue 调用栈
   }
   ```

3. **不捕获**：明确文档说明调用方必须在 `onChange` 内部自行处理异常

**注意**：不应使用裸 `console.error` 作为最终方案，这违反了项目编码规范（CLAUDE.md §6.1 要求移除调试代码）。

**必须补充的测试**:
- `onChange` 抛异常后，下一批次仍能正常发送
- pending 队列不被当前异常污染
- 联动和后续字段事件仍可继续处理
- 异常按预期上报或传播
- 回调内部再次调用 `setValue` 时下一批次保留

---

### 问题 5: `batchDepth` 维护约束未文档化

**问题类型**: 🟡 文档契约缺口

**严重程度**: 低 - 当前代码正确，但未来维护时需要遵守的约束未明确

**位置**:
- 文档 §9.1 (批处理生命周期)
- 代码 `linkageOperationController.ts:94-110`
- 代码 `DynamicForm.tsx:1116-1145`

**问题描述**:

**当前代码状态**：✅ 正确

当前 `beginBatch()` 的**唯一调用点**已经有 `try/finally` 保护：

```typescript
// DynamicForm.tsx:1116-1145
operationController.beginBatch()
try {
  // ... setFormValues 逻辑
} finally {
  const shouldRefresh = operationController.endBatch()  // ← 保证执行
  // ...
}
```

因此，即使 `setFormValues()` 抛出异常，`endBatch()` 仍会执行，`batchDepth` 不会泄漏。

**未来风险**：

如果后续新增 `beginBatch()` 调用点而没有 `try/finally` 保护，则可能导致 `batchDepth` 冻结，所有后续字段变更都会静默消失。

**建议**:

在文档 §9.1 补充批处理生命周期的维护约束：

> **批处理生命周期约束**: 所有 `beginBatch()` 调用必须在 `finally` 块中配对 `endBatch()`，以保证异常不会腐蚀批次生命周期。当前代码已遵守此约束，未来新增调用点时必须继续遵守。

可选：增加单元测试或代码审查规则，防止后续引入不受保护的调用路径。

---

## 三、建议随后补充的问题

### 问题 6: `setValues` + 联动混合时的排序规则不完整

**问题类型**: 🔵 文档契约缺口

**严重程度**: 低 - 实现行为已确定，但文档未明确说明

**位置**:
- 文档 §7.3 (setValues 批量设置)
- 文档 §7.5 (联动级联)
- 代码 `DynamicForm.tsx:1462-1473`

**问题描述**:

- §7.3 说："`setValues` 按输入路径的稳定顺序输出 `changes`"
- §7.5 说：联动按"触发 → 第一层 → 后续级联"顺序

但没有描述混合场景：`setValues({ a, b })` 中 `a` 触发联动修改了 `b`，这时 `b` 在 `changes` 中应该出现几次、以哪个顺序出现？

**当前实现行为**:

批次内同路径只保留一条，该条记录在 `changes` 数组中的**位置保留首次进入批次的位置**。

**建议**:

在文档 §7.3 或 §7.0 的 Step 5 补充：

> 同路径合并时，该条记录在 `changes` 数组中的**位置**保留首次写入时的位置（即先到先排），而不是最后写入时的位置。例如，`setValues({ a: 1, b: 2 })` 触发联动修改 `a` 为 `3`，最终 `changes` 为 `[{ path: 'a', value: 3, source: 'linkage' }, { path: 'b', value: 2, source: 'setValues' }]`，`a` 的位置不变。

并补充测试用例覆盖：
- `setValues({ a, b })` 其中 `a` 触发联动覆盖 `a` 自身
- `setValues({ a, b })` 其中 `a` 触发联动修改 `b`（需区分 `b` 是否已由 `setValues` 直接写入）
- 多层级联场景

---

### 问题 7: `setValues` 的"稳定顺序"在 numeric-string 键时不精确

**问题类型**: 🔵 文档精度问题

**严重程度**: 低 - 边界情况说明不足

**位置**: 文档 §7.3

**问题描述**:

文档说"按输入路径的稳定顺序"，依赖 JavaScript 对象的键枚举顺序。但当路径键是纯数字字符串（如 `"0"`, `"1"`）时，V8 的枚举顺序会被提前为数组索引顺序，与插入顺序不同。

例如：
```javascript
const obj = { '1': 'b', '0': 'a', 'name': 'c' }
Object.keys(obj) // ['0', '1', 'name']，不是 ['1', '0', 'name']
```

**建议**:

在文档 §7.3 补充：

> **键枚举顺序**: `setValues` 的入参如果是普通对象，则按 `Object.keys()` 枚举顺序（数字字符串键按数值升序排在前面，其他键按插入顺序）。如需精确控制顺序，推荐多次调用 `setValue`。

---

### 问题 8: `ArrayAction.index` 的语义不对称

**问题类型**: 🔵 文档可读性问题

**严重程度**: 低 - 逻辑正确但容易误解

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

### 问题 9: `onChange` 为 `undefined` 时的性能优化未说明

**问题类型**: 🔵 文档契约缺口

**严重程度**: 低 - 代码已实现优化，但未文档化

**位置**: 文档 §7.0 / §12

**问题描述**:

如果外部没有传入 `onChange`，是否仍需建立 watch 订阅、维护 `pendingBatchRef`、执行外部值域转换？这是一个性能优化点，且影响初始化逻辑设计。

**代码实现**:

```typescript
// DynamicForm.tsx
const hasOnChange = Boolean(onChange)

React.useEffect(() => {
  if (hasOnChange) {
    // 建立 watch 订阅
  }
}, [watch, hasOnChange])
```

代码已经实现了这个优化：
- 当 `onChange` 不存在时，不建立字段事件 watch
- 当 `onChange` 从无到有或从有到无变化时，effect 会因为 `hasOnChange` 变化而重建或清理订阅
- `onChange` 回调本身通过 `latestOnChangeRef` 获取最新引用，不依赖每次函数身份变化重建订阅

**建议**:

1. 在文档 §7.0 或 §12 阶段二中补充：

> **性能优化**: 当 `onChange` 为 `undefined` 时，不建立 watch 订阅，跳过变更采集与外部值域转换。联动机制不受影响。

2. 修正文档 §9.4 中的表述，将"watch effect 仅依赖稳定的 watch 引用"改为：

> watch effect 依赖稳定的 `watch` 引用与是否启用事件采集的 `hasOnChange`；其他配置（`onChange` 回调、`schema`、转换配置等）通过 refs 获取最新值，避免频繁重建订阅。

---

## 四、可接受的设计取舍

以下设计决策是合理的，文档已基本说明清楚：

### 1. 重复元素移动后外部数组不变不生成事件

**位置**: 文档 §7.7

文档已明确说明："如果移动重复值后外部数组完全相同（如 `['A', 'A']`），这对消费者没有可观察影响，应视为 no-op，不生成 change"。

这是**信息论约束**，无法从快照推断具体操作。审计日志场景下可能意外丢失操作记录，但这是合理的折衷。

---

### 2. 嵌套 DynamicForm 事件路由机制

**位置**: 文档 §8.2

**当前状态**：文档只说明了 `asNestedForm` 不改变路径格式，但没有描述事件路由机制。

**建议补充**：

在文档 §8.2 补充：

> **事件路由机制**:
> - `asNestedForm=true`：共享父级 RHF 上下文，父级 watch 可以观察到内层字段变化，事件在父级统一触发。
> - `asNestedForm=false`：内外层拥有独立的 form 实例和独立的 `onChange`，内层表单的变更事件不会自动冒泡到外层。如需关联，需在内层的 `onChange` 中手动调用外层表单的 `setValue`。

这不是一个需要消费者权衡的技术取舍，而是对事件路由行为的事实说明，应放在文档补充项而非"可接受的设计取舍"。

---

## 五、代码实现审查

### 5.1 实现与文档的一致性

经过逐行对比，代码实现与文档设计基本一致：

| 设计要点 | 文档章节 | 代码位置 | 状态 |
|---------|---------|---------|------|
| 批处理机制 | §9.1 | `linkageOperationController.ts:94-110` | ✅ 一致 |
| 延迟 flush | §9.4 | 字段变更 watch effect 的 flush 回调 | ✅ 一致 |
| source 标记 | §7.1-7.5 | `DynamicForm.tsx:1357-1362` | ⚠️ 主路径一致，边界语义需补充测试 |
| 数组操作记录 | §7.6 | `arrayActionRegistry.ts` + `ArrayFieldWidget.tsx` | ✅ 一致 |
| 去重逻辑 | §7.0 Step 5 | 字段变更 watch effect 的 pending changes 合并逻辑 | ✅ 一致 |
| 外部数据转换 | §6.2 | `DynamicForm.tsx:1245-1254` | ✅ 一致 |
| 异常处理 | §9.3 | `DynamicForm.tsx` flush 逻辑 | ✅ 通过 `onChangeError` 转交；未提供时重新抛出异步异常 |

---

### 5.2 代码质量评估

**优点**:

1. **类型安全**: 使用了完整的 TypeScript 类型定义，所有关键接口都有清晰的类型约束
2. **职责分离**:
   - `arrayActionRegistry.ts` 负责数组操作记录
   - `linkageOperationController.ts` 负责批处理和版本控制
   - `DynamicForm.tsx` 负责事件采集和分发
3. **测试覆盖**: `fieldChangeEvents.contract.test.tsx` 提供了24个测试用例，覆盖主要场景
4. **注释质量**: 核心函数都有清晰的中文注释说明用途
5. **异常保护**: 关键的批处理调用点已有 `try/finally` 保护

**需要改进的地方**:

1. **边界情况**: `inferArrayAction` 函数对重复元素的处理逻辑较复杂，需要继续保持测试与注释同步
2. **性能优化**: 当前批次已使用 `Map` 按路径归并；若未来引入更大规模事件缓存，再评估进一步优化

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

**原评审缺失场景复核**:

1. ✅ reset 触发联动时的 source 归属，已由契约测试覆盖。
2. ✅ 同路径被直接写入后又被 linkage 覆盖的 source，已由 setValues 覆盖测试验证。
3. ✅ setValues 与联动混合时的 changes 顺序和去重，已由契约测试验证。
4. ✅ onChange 回调抛出异常后的批次清理，以及 `onChangeError` 异常接收，已由契约测试验证。
5. ✅ 异步联动与 reset、静默写入的交错时序，已由竞态测试覆盖。
6. ✅ 多层嵌套表单的事件路由已增加两层数组嵌套集成测试，验证根批次、绝对路径和来源。
7. ✅ transform/reverseTransform 与事件外部值域交互，已由契约测试覆盖。

**建议**: 补充上述测试用例以提高覆盖率，特别是边界场景和异常处理。

---

## 六、总结与建议

### 6.0 本次遗漏的根因与改进措施

本次 `setValues` 后 `onChange` 失效并非文档完全没有描述风险，而是设计、实现和测试没有形成逐项闭环：

1. 文档写明了“根操作关闭后仍需稳定检查”，但实现只覆盖了首次检查，没有覆盖晚到 watch 通知
   记录变化后重新调度检查的路径；
2. 既有测试使用固定延迟等待，验证了正常异步联动，却没有强制制造“首次检查无变化、随后通知到达”
   的时序，因此缺少该保护时测试仍可能通过；
3. 测试主要针对抽象契约和常规 schema，未及时使用 `BasicFormPanel` 这类同时包含基本类型数组、
   对象数组和异步 options 联动的真实组合场景做冒烟验证。

今后每条风险矩阵必须建立“风险 → 代码不变量 → 最小失败测试 → 真实集成测试”的追踪关系。异步
场景必须显式控制通知顺序，不能只依赖 `setTimeout(0)` 或较长等待；批次测试还必须验证当前批次
完成后下一次独立写入仍能发送事件。发布前应执行全量测试，并至少手工或自动冒烟验证一条真实示例
中的 ref API 调用链。

### 6.1 总体评价

**设计质量**: ⭐⭐⭐⭐☆ (4/5)

- 设计思路清晰，批处理、source 标记、arrayAction 等核心概念定义完善
- 类型契约完整，便于消费者理解和使用
- 考虑了联动、数组操作、异步竞态等复杂场景

**实现质量**: ⭐⭐⭐⭐☆ (4/5)

- 代码与文档高度一致
- 类型安全，职责分离合理
- 主要问题是异常处理和文档说明不够充分

**文档质量**: ⭐⭐⭐⭐☆ (4/5)

- 结构完整，章节清晰
- 技术细节丰富，示例充足
- 主要问题是部分边界情况和兼容性影响说明不足

---

### 6.2 优先级建议

**必须修复** (发布前):

1. ✅ 在文档 §10 补充 `onChange` 同步→异步的兼容性说明（问题1）
2. ✅ 在文档 §7.4/§7.5 明确 reset + 联动的 source 归属（问题2）
3. ✅ 将"同路径被 linkage 覆盖时 source 为 linkage"的说明提升到主契约章节（问题3）
4. ✅ **明确异常处理策略**：确定异步 `onChange` 的异常处理契约，根据最终策略决定是否在 flush 中捕获、上报、重新抛出或通过 `onChangeError` 转交；补充对应测试（问题4）
5. ✅ 在文档 §9.1 补充 batchDepth 维护约束（问题5）

**建议改进** (后续迭代):

6. 明确 setValues + 联动的先到先排规则（问题6）
7. 明确普通对象入参使用 Object.keys() 枚举顺序（问题7）
8. 在类型注释中标注 ArrayAction.index 的不对称语义（问题8）
9. ✅ 补充文档说明 onChange 未传入时的性能优化和 effect 依赖（问题9）
10. ✅ 补充独立嵌套 DynamicForm 的事件路由说明
11. ✅ 增加数组结构操作与元素字段编辑、onChangeError、多层 `asNestedForm` 边界测试

**可选优化** (技术债):

1. 优化 `pendingChangesRef` 查找性能（O(n) → O(1)）

---

### 6.3 发布检查清单

在发布此功能前，请确认：

- [ ] 文档 §10 已补充 `onChange` 时序变更说明
- [ ] 文档已明确 reset + 联动的 source 归属
- [ ] 文档已明确同一字段被联动覆盖的 source 语义
- [ ] **已明确异步 `onChange` 的异常处理策略**（捕获/上报/传播），并根据策略完成实现或文档说明
- [ ] 文档已补充 batchDepth 维护约束
- [ ] 已补充异常处理相关测试用例
- [ ] 已补充 reset+联动、setValues+联动等边界场景测试
- [ ] 所有测试用例通过
- [ ] 已进行手动回归测试，确认现有消费者不受影响
- [ ] 已更新 CHANGELOG 和 Migration Guide

---

## 七、附录：关键代码片段

### A1: 异步 flush 实现

```typescript
// DynamicForm.tsx：字段变更 watch effect 的 flush 回调（当前约 1499-1509 行）
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
      clearArrayAction(subscribedMethods.control)
      latestOnChangeRef.current?.(nextData, {
        changes: changesSnapshot,
      })
    }
  }, 0)
}
```

### A2: 异常处理策略选项

**策略1：捕获 + 上报 + 继续**（适合生产环境稳定性优先）

```typescript
if (nextData) {
  const changesSnapshot = pendingChangesRef.current
  pendingChangesRef.current = []
  pendingDataRef.current = null
  clearArrayAction(methods.control)

  try {
    latestOnChangeRef.current?.(nextData, {
      changes: changesSnapshot,
    })
  } catch (error) {
    // 使用项目统一的错误上报机制
    reportFormChangeError?.(error)
    // 或调用可选的错误回调
    props.onChangeError?.(error)
  }
}
```

**策略2：捕获 + 上报 + 重新抛出**（保留错误传播能力）

```typescript
try {
  latestOnChangeRef.current?.(nextData, {
    changes: changesSnapshot,
  })
} catch (error) {
  logger.error('DynamicForm onChange failed', error)
  throw error  // 继续从异步任务向上传播，不会回到原始 setValue 调用栈
}
```

**策略3：不捕获**（明确文档说明调用方必须自行处理）

```typescript
// 保持当前实现，但在文档中明确说明：
// "onChange 回调中的异常不会被 DynamicForm 捕获，调用方必须在回调内部自行处理异常"
```

**注意**：不应使用裸 `console.error`，这违反项目编码规范。

### A3: source 判断逻辑

```typescript
// DynamicForm.tsx：字段变更记录生成逻辑
source: name
  ? operationController.getMutationSource() === 'linkage'
    ? 'linkage'
    : changeSourceRef.current
  : (pendingChangeSourceRef.current ??
    changeSourceRef.current),
```

### A4: 批次内去重逻辑

```typescript
// DynamicForm.tsx：pending changes 合并逻辑
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
**建议复审时间**: 文档和代码修改完成后
**交叉验证状态**: ✅ 已完成多模型核对，结论一致

### A5: StrictMode 下示例初始化副作用必须幂等

React 18 开发模式的 `StrictMode` 会重复执行 effect。示例或业务页面中通过定时器调用
`setValues` 时，必须保存并清理 timer；否则同一初始化写入会执行两次，第二次会因值未变化
被事件归并逻辑正确去重，调试时容易误判为 `setValues` 没有触发 `onChange`。该问题属于
调用方副作用生命周期，不应通过放宽 DynamicForm 的去重规则解决。
