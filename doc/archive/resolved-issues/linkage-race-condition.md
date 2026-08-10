# 联动竞态问题解决方案

> **归档状态：已解决。** 本文保留问题背景、方案和验收记录，不作为现行实现依据。当前架构参见[联动系统设计](../../tech-design/linkage.md)，归档说明参见[历史归档索引](../README.md)。

## 背景

`DynamicForm` 的联动系统同时存在多条触发路径：

- 外部通过 `ref.setValue`、`ref.setValues`、`ref.reset` 写入表单值
- 用户输入触发 `react-hook-form.watch`
- `refreshLinkage` 主动刷新全部联动
- `linkageFunctions`、`linkages`、数组动态联动配置变化后触发重新计算
- 联动结果中的 `value`、`options` 又会反向写回表单

这些路径都可能触发异步联动函数。如果旧联动计算在新表单值、新联动配置或新联动函数之后才完成，并且仍然提交结果，就会覆盖最新表单内容或最新联动状态。

典型问题场景：

```typescript
formRef.current.setValues(initialData);
formRef.current.refreshLinkage();
```

`setValues` 会递归调用多次 `setValue`。每次写入都会触发 `watch`，`watch` 会延迟调度 `processQueue`。同时，调用方又主动执行 `refreshLinkage`。如果其中某一批联动使用了旧快照，且结果晚于最新操作提交，就会把最新值覆盖掉。

因此，根因不是单纯的“`refreshLinkage` 读取了半更新快照”，而是：

1. **批量写值不是原子操作**：`setValues` 中间态会被 `watch` 观察到。
2. **联动计算缺少统一调度**：`processQueue`、`refreshLinkage`、数组联动 refresh 彼此之间没有统一的批次模型。
3. **提交点缺少过期校验**：旧异步结果完成后仍可能执行 `setValue` 和 `setLinkageStates`。
4. **版本覆盖范围不足**：只保护单字段异步函数无法覆盖跨路径、跨批次、props 更新导致的竞态。

## 目标

本次修复应满足以下目标：

1. 只有基于最新表单版本、最新联动配置、最新联动函数计算出的结果才能提交。
2. `setValues` 对联动系统表现为一次原子批量写入，而不是多次独立字段变化。
3. `refreshLinkage()` 的 Promise 语义明确：调用完成时，本轮联动已经提交，或已经因为过期被丢弃。
4. `processQueue` 与 `refreshLinkage` 使用同一套过期判断，避免一个路径修好、另一个路径仍有竞态。
5. 保持对现有调用方式兼容，必要时新增可选能力，但不强制现有调用方迁移。

## 非目标

- 不重写联动表达式、依赖图、拓扑分层计算逻辑。
- 不改变现有 schema 联动配置格式。
- 不要求取消所有已经发起的异步请求。无法取消的请求可以继续完成，但其结果必须在提交阶段被丢弃。
- 不把所有联动强行串行化。允许并发计算，但只允许最新有效批次提交。

## 推荐方案：统一联动事务控制器

新增一个跨 `DynamicForm`、`useArrayLinkageManager`、`useLinkageManager` 共享的联动事务控制器。它不负责计算联动，只负责生成版本、创建运行令牌、判断结果是否仍然允许提交。

建议命名为 `LinkageOperationController`。

### 核心概念

控制器维护以下版本：

```typescript
interface LinkageRunToken {
  runId: number;
  formMutationVersion: number;
  linkagesVersion: number;
  linkageFunctionsVersion: number;
}
```

- `runId`：每次联动计算开始时递增。用于保证只提交最新联动批次。
- `formMutationVersion`：任何外部写值、用户输入、reset、联动写值导致的表单变更都会递增。
- `linkagesVersion`：静态或动态联动配置变化时递增。
- `linkageFunctionsVersion`：联动函数引用变化时递增。

提交时必须同时满足：

```typescript
controller.canCommit(token) === true
```

只要计算期间发生新的表单写入、联动配置变化、联动函数变化，旧 token 就失效。旧异步任务可以正常 resolve，但不能写回表单或联动状态。

### 控制器职责

```typescript
class LinkageOperationController {
  private runId = 0;
  private formMutationVersion = 0;
  private linkagesVersion = 0;
  private linkageFunctionsVersion = 0;
  private batchDepth = 0;
  private pendingLinkage = false;

  markFormMutation(): void {
    this.formMutationVersion += 1;
  }

  markLinkagesChanged(): void {
    this.linkagesVersion += 1;
  }

  markLinkageFunctionsChanged(): void {
    this.linkageFunctionsVersion += 1;
  }

  beginBatch(): void {
    this.batchDepth += 1;
  }

  endBatch(): boolean {
    this.batchDepth = Math.max(0, this.batchDepth - 1);
    if (this.batchDepth > 0 || !this.pendingLinkage) {
      return false;
    }
    this.pendingLinkage = false;
    return true;
  }

  isBatching(): boolean {
    return this.batchDepth > 0;
  }

  markPendingLinkage(): void {
    this.pendingLinkage = true;
  }

  consumePendingLinkage(): boolean {
    const pending = this.pendingLinkage;
    this.pendingLinkage = false;
    return pending;
  }

  createRun(): LinkageRunToken {
    this.runId += 1;
    return {
      runId: this.runId,
      formMutationVersion: this.formMutationVersion,
      linkagesVersion: this.linkagesVersion,
      linkageFunctionsVersion: this.linkageFunctionsVersion,
    };
  }

  canCommit(token: LinkageRunToken): boolean {
    return (
      token.runId === this.runId &&
      token.formMutationVersion === this.formMutationVersion &&
      token.linkagesVersion === this.linkagesVersion &&
      token.linkageFunctionsVersion === this.linkageFunctionsVersion
    );
  }
}
```

实际实现时可以按项目需要拆分方法，但必须保留两个核心能力：

1. **创建运行令牌**：联动计算开始时捕获当前版本。
2. **提交前校验令牌**：所有结果写回前统一判断是否过期。

如果提交过程中会写回表单并递增 `formMutationVersion`，不要在同一次提交内部反复调用 `canCommit(token)`。推荐提供一个提交包装方法：

```typescript
commitIfCurrent(token: LinkageRunToken, callback: () => void): boolean {
  if (!this.canCommit(token)) {
    return false;
  }
  callback();
  return true;
}
```

这样可以保证“提交开始前校验一次，提交内部的合法写值不会使自己失效”。提交产生的表单版本变化会让更早的 run 失效，并为后续级联联动创建新的 run。

## 架构改造点

### 1. 控制器创建位置

控制器不能只放在 `useLinkageManager` 内部。原因是 `setValue`、`setValues`、`reset` 暴露在 `DynamicForm` 层，而联动计算在 `useLinkageManager` 层。两边必须共享同一个控制器。

建议在 `DynamicFormInner` 中创建：

```typescript
const linkageOperationControllerRef = useRef(new LinkageOperationController());
const linkageOperationController = linkageOperationControllerRef.current;
```

然后传给：

- `useArrayLinkageManager`
- `useLinkageManager`
- `setValueWithoutLinkage`
- `setValue`
- `setValues`
- `reset`

如果需要支持嵌套表单，控制器也应通过 `LinkageStateContext` 向子级传递，避免父子表单各自持有独立版本导致互相覆盖。

### 2. 表单写入口统一标记版本

以下入口必须调用 `markFormMutation()`：

- `ref.setValue`
- `ref.setValues`
- `ref.reset`
- 用户输入触发的 `watch`
- 联动结果执行 `setValue`
- options 联动清空非法值时执行 `setValue`

注意：联动结果写回表单也会改变表单快照，因此也应递增表单版本。但它必须在当前 run 已通过 `canCommit(token)` 后执行，避免旧 run 先递增版本再影响新 run。

用户输入触发 `watch` 时，应先标记表单版本变化，再基于新版本创建联动 run。否则 token 会捕获旧的 `formMutationVersion`，导致刚创建的任务被自己的输入变化判定为过期。

### 3. `setValues` 原子化

`setValues` 应使用批处理包裹所有递归 `setValue`：

```typescript
controller.beginBatch();
try {
  controller.markFormMutation();
  setFormValues({ methods, values: displayValues, schema, options });
} finally {
  const shouldFlush = controller.endBatch();
  if (shouldFlush) {
    scheduleLinkageFromLatestSnapshot();
  }
}
```

`watch` 回调在批处理中不应立即 enqueue 多个任务，而应：

1. 更新 `latestFormDataRef`
2. 标记 `pendingLinkage`
3. 等批处理结束后只调度一次联动

这样 `setValues` 对联动系统表现为一次最终快照更新。

### 4. `processQueue` 携带运行令牌

`LinkageTask` 需要新增 token 或版本字段，至少应包含创建任务时的 `LinkageRunToken`：

```typescript
export interface LinkageTask {
  fieldName: string;
  timestamp: number;
  affectedFields: string[];
  token: LinkageRunToken;
}
```

enqueue 时创建 token：

```typescript
const token = controller.createRun();
taskQueue.enqueue(name, affectedFields, token);
```

处理任务时需要两次校验：

1. 计算前：如果 token 已过期，跳过任务。
2. 提交前：如果 token 已过期，丢弃结果。

计算前校验可以减少无意义工作；提交前校验才是安全边界。

### 5. `refreshLinkage` 使用同一套令牌

`refreshLinkage` 开始时创建新的 run：

```typescript
const token = controller.createRun();
```

计算使用当前快照：

```typescript
const formData = { ...getValues() };
```

计算完成后必须通过统一提交函数：

```typescript
await applyLinkageResults({
  fields: allFields,
  states,
  updatedFormData,
  preMarkFields: false,
  token,
});
```

不要只在 `refreshLinkage` 内部散落检查。所有写回都应集中在 `applyLinkageResults` 内部校验。

### 6. `applyLinkageResults` 成为唯一提交保护点

`applyLinkageResults` 应新增 `token` 参数，并在任何写操作前检查：

```typescript
const committed = controller.commitIfCurrent(token, () => {
  // 在这里执行 value 写回、options 清空和 setLinkageStates
});

return { committed };
```

该函数内部所有写操作都受同一个 token 保护：

- value 联动写回表单
- options 联动清空非法值
- `setLinkageStates`
- 清理 `updatingFields`

建议返回提交结果：

```typescript
interface ApplyLinkageResultsResult {
  committed: boolean;
}
```

这样 `refreshLinkage()` 可以明确知道本轮结果是已提交还是被丢弃。

### 7. `skipSequenceCheck` 的处理

当前 `refreshLinkage` 使用 `skipSequenceCheck: true`。引入 run token 后，字段级 sequence 不再是 refresh 的唯一保护。可以有两种选择：

1. 保留 `skipSequenceCheck: true`，但必须保证 `applyLinkageResults` 的 token 校验覆盖 refresh 提交。
2. 去掉 refresh 的 `skipSequenceCheck: true`，让 refresh 也参与字段级 sequence 校验。

推荐第一种：保留字段级 sequence 用于同字段异步函数的局部保护，使用 run token 作为最终提交保护。这样改动更小，也能覆盖跨字段、跨批次竞态。

### 8. `useArrayLinkageManager.refresh()` 的 Promise 语义

当前数组联动 refresh 的语义不够强：它更新 `dynamicLinkages` 和 `refreshCounter` 后只等待一个 tick，真实 `baseLinkageRefresh()` 由 effect 触发。

需要改成以下任一方式：

#### 方式 A：同步构造 linkages 并直接刷新

`refresh()` 内部生成 `newDynamicLinkages` 后，构造本次 `allLinkages`，并把它传给底层 refresh：

```typescript
await baseLinkageRefresh({ overrideLinkages: nextAllLinkages });
```

这种方式 Promise 语义最清晰，但需要底层 refresh 支持传入临时 linkages。

#### 方式 B：effect 完成后 resolve

`refresh()` 返回一个 Promise，把 resolver 存入 ref。effect 中执行完 `baseLinkageRefresh()` 后 resolve。

```typescript
pendingRefreshResolveRef.current = resolve;
setRefreshCounter((prev) => prev + 1);
```

effect：

```typescript
await baseLinkageRefresh();
pendingRefreshResolveRef.current?.();
pendingRefreshResolveRef.current = null;
```

这种方式改动较小，但要处理多次 refresh 的覆盖：后一次 refresh 应使前一次 Promise resolve 为 `{ committed: false }` 或直接等待同一个最新 refresh。

推荐方式 A。如果实现成本过高，再选择方式 B。

## API 设计建议

### 保持现有 API 兼容

现有 API 可以保持不变：

```typescript
setValues(values, options): void
refreshLinkage(): Promise<void>
```

即使不改 API，只要内部有 run token 提交保护，旧调用方式也应安全：

```typescript
formRef.current.setValues(initialData);
await formRef.current.refreshLinkage();
```

### 可选新增 `refreshAfter`

可以新增：

```typescript
interface SetValuesOptions {
  shouldValidate?: boolean;
  shouldDirty?: boolean;
  shouldTouch?: boolean;
  silence?: boolean;
  refreshAfter?: boolean;
}
```

但需要注意：如果 `setValues` 仍返回 `void`，`refreshAfter` 只能表示“内部会调度 refresh”，调用方无法等待最终稳定状态。

更严谨的 API 是新增一个方法，而不是改变 `setValues` 返回值：

```typescript
setValuesAndRefresh(
  values: Record<string, any>,
  options?: SetValuesOptions,
): Promise<void>
```

如果不想增加新方法，也可以暂不做 `refreshAfter`，先保证旧的 `setValues(); await refreshLinkage();` 安全。

推荐优先级：

1. 先完成内部事务保护，保证现有 API 安全。
2. 再视使用体验决定是否新增 `setValuesAndRefresh`。
3. 不建议只靠 `Promise.resolve().then(refreshLinkage)` 解决问题，因为当前 watch 队列和数组联动 refresh 都可能跨宏任务执行。

## 实施步骤

### 阶段一：引入控制器和 token

1. 新增 `LinkageOperationController` 类型和 `LinkageRunToken` 类型。
2. 在 `DynamicFormInner` 创建控制器。
3. 通过参数或 context 传给 `useArrayLinkageManager` 和 `useLinkageManager`。
4. 在 `linkages`、`linkageFunctions` 变化时标记对应版本。

### 阶段二：保护提交点

1. `evaluateLinkagesByLayers` 保持纯计算，不直接关心提交。
2. `refreshLinkage` 创建 token，并传入 `applyLinkageResults`。
3. `processQueue` enqueue 时创建 token，并传入 `applyLinkageResults`。
4. `applyLinkageResults` 在任何写操作前统一校验 token。
5. 过期结果直接丢弃，不打印错误日志。开发环境可使用 debug 日志，但不要污染测试输出。

### 阶段三：原子化批量写值

1. `setValues` 开始时 `beginBatch()`。
2. 递归写值期间 watch 只更新最新快照和 pending 标志。
3. `setValues` 结束后只调度一次基于最终快照的联动。
4. `silence: true` 语义保持为“不触发联动”，但仍应更新表单版本，使旧联动结果失效。

### 阶段四：修正数组联动 refresh

1. 明确 `useArrayLinkageManager.refresh()` 的 Promise 完成语义。
2. 避免只等待 `setTimeout(0)` 就返回。
3. 多次 refresh 连续调用时，只有最后一次结果可提交。

### 阶段五：补充测试

补齐后再考虑是否新增 `setValuesAndRefresh` 或 `refreshAfter`。

## 测试方案

### 1. `setValues` 与 `refreshLinkage` 并发

场景：

1. 第一次 `setValues({ source: "old" })`
2. 立即 `refreshLinkage()`，联动函数异步延迟返回 `"old-result"`
3. 在旧 refresh 完成前执行 `setValues({ source: "new" })`
4. 再执行最新 refresh，返回 `"new-result"`

期望：

- 最终表单值和联动状态只包含 `"new-result"`
- 旧 refresh 完成后不能覆盖新值

### 2. 多次快速 `refreshLinkage`

场景：

1. 连续触发三次 `refreshLinkage`
2. 第一、第二次异步函数晚返回
3. 第三次先完成或最后完成都应是唯一有效提交

期望：

- 只有最后一次 run 可以提交
- 前两次结果被丢弃

### 3. `linkageFunctions` 更新

场景：

1. 使用旧 `linkageFunctions` 发起异步联动
2. rerender 传入新 `linkageFunctions`
3. 旧函数晚返回

期望：

- 旧函数结果不能提交
- 新函数结果可以提交

### 4. `linkages` 或动态数组联动配置变化

场景：

1. 数组字段增减导致动态联动 key 集合变化
2. 旧数组元素联动异步返回

期望：

- 旧动态配置对应的结果不能写入不存在或已变化的字段
- `refreshLinkage()` Promise 等待真实底层刷新完成

### 5. `setValues` 原子批量更新

场景：

1. `setValues` 写入多个互相关联字段
2. 中间字段变化会触发 watch

期望：

- 联动函数只基于最终快照计算
- 不出现基于中间态的结果提交

### 6. `silence: true`

场景：

1. 旧联动 run 正在执行
2. 调用 `setValues(values, { silence: true })`
3. 旧 run 晚返回

期望：

- `silence: true` 不触发新联动
- 但旧 run 不能覆盖 silent 写入的新值

## 验收标准

1. 所有联动结果写回都经过同一个 token 提交校验。
2. `setValues` 不再产生多批可提交的中间态联动。
3. `refreshLinkage()` 的 Promise 不会在真实刷新完成前提前 resolve。
4. `linkageFunctions` 和 `linkages` 更新会使旧联动结果失效。
5. 现有 API 调用方式保持兼容。
6. 新增测试能稳定复现旧问题，并在修复后通过。

## 总结

最优方案不是单独给 `refreshLinkage` 加版本号，也不是要求调用方改成延迟刷新，而是把联动系统改造成“可并发计算、只允许最新有效批次提交”的事务模型。

具体落点是：

- 共享 `LinkageOperationController`
- 所有写入口递增版本
- `setValues` 批量原子化
- `processQueue` 和 `refreshLinkage` 都携带 run token
- `applyLinkageResults` 作为唯一提交保护点
- 修正数组联动 refresh 的 Promise 语义

这样可以覆盖初始化、异步函数、联动函数更新、动态数组联动和 silent 写入等场景，避免旧联动结果覆盖最新表单状态。
