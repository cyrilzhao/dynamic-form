# DynamicForm 稳定字段变更批次设计

## 1. 目标与范围

本设计修复 DynamicForm 字段变更事件在 `setValue`、`setValues`、`reset`、同步/异步联动交织时的来源错标、快照中间态、重复回调与竞态问题。它只重构 DynamicForm 内部的事件采集与批次生命周期，不改变 Widget 的局部 `onChange(value)` 接口，也不建立跨表单事件总线。

对外继续使用兼容的 `onChange(data, meta?)` 签名；`meta` 新增可选的 `rootSource`，用于表达本次顶层逻辑操作的根触发来源。

## 2. 已确认的公共契约

```ts
export type FieldChangeSource =
  | 'user'
  | 'setValue'
  | 'setValues'
  | 'reset'
  | 'linkage'

export interface FormChangeMeta {
  /** 创建此稳定批次的顶层操作来源；保留可选以维持已有调用方兼容性。 */
  rootSource?: FieldChangeSource
  /** 批次稳定后、按首次出现顺序去重的字段变化。 */
  changes: FieldChange[]
}
```

### 2.1 来源含义

`rootSource` 表示“谁开启了这次顶层逻辑操作”；`FieldChange.source` 表示“该路径最终值由谁写入”。二者刻意不同：

| 根操作 | `rootSource` | 直接字段的 `source` | 被联动写入字段的 `source` |
| --- | --- | --- | --- |
| 用户输入 | `user` | `user` | `linkage` |
| `setValue` | `setValue` | `setValue` | `linkage` |
| `setValues` | `setValues` | `setValues` | `linkage` |
| `reset` | `reset` | `reset` | `linkage` |
| 仅刷新联动（context/schema/functions 变化或显式刷新） | `linkage` | 无 | `linkage` |

同一路径在一个批次中被多次写入时，保留批次开始前的 `previousValue` 和首次出现顺序，使用最终稳定的 `value`、`source`、`arrayAction` 覆盖该条记录。因而“用户输入后又被联动覆盖”最终的字段来源为 `linkage`；需要追踪因果链的业务不能把 `source` 误作根触发来源，应读取 `rootSource`，更细的因果关系不在本次 API 范围内。

### 2.2 稳定回调边界

一次顶层操作及其**最终成功提交**的同步和异步联动写入，必须只调用一次 `onChange(data, meta)`：

```ts
onChange(
  { country: 'CN', province: 'Shanghai' },
  {
    rootSource: 'setValues',
    changes: [
      { path: 'country', previousValue: undefined, value: 'CN', source: 'setValues' },
      { path: 'province', previousValue: undefined, value: 'Shanghai', source: 'linkage' },
    ],
  },
)
```

`data` 与 `changes` 必须来自同一个最终外部值域快照：完成字段 transform、基本类型数组解包、schema 过滤后再对外暴露。被新输入或 `silence: true` 淘汰的旧异步结果不得进入旧批次，也不得额外触发回调。

回调中再次调用表单 API 是一个新的顶层操作：当前批次必须在调用用户回调前脱离活动状态，确保重入写入不能污染已准备发送的快照。

### 2.3 时序与异常

为了等待 RHF 通知及联动链达到稳定，`onChange` 是异步通知，公开的 `setValue`、`setValues`、`reset` 仍返回 `void`，调用方不能 `await` 它们。迁移文档应明确：不能在调用 API 的同一同步栈中依赖回调已经运行。

回调调用前必须先完成批次状态转移和资源清理。用户 `onChange` 抛出的异常不回滚表单值、不恢复已经发送的批次，也不阻塞后续联动；异常传播策略维持当前异步调用语义（不在组件内静默吞掉），并以回归测试固定“后续批次仍可工作”的保证。

## 3. 架构与职责边界

新增 `utils/changeBatchController.ts`，其职责仅是对外事件批次：保存根来源、初始外部快照、按路径归并的变更、未完成联动 run、顶层操作关闭状态与 flush 状态。

```text
入口/API 或 Widget
  -> FormMutationContext { batchId, source, isLinkageWrite }
  -> RHF setValue/reset
  -> DynamicForm watch（采集并转换为外部值域 FieldChange）
  -> ChangeBatchController.recordChange()
  -> useLinkageManager（携带 batchId 创建/完成/淘汰 run）
  -> linkage 写回 RHF（source: linkage）
  -> 批次稳定检查
  -> detach 后 onChange(finalData, { rootSource, changes })
```

现有 `LinkageOperationController.batchDepth` 不替代 ChangeBatchController：前者仅阻止 `setValues` 递归写入过程触发中间态联动刷新；后者定义一次对外事件何时稳定、如何跨异步 run 聚合、如何去重。两者必须保持独立，避免将内部递归计数误当作异步业务生命周期。

### 3.1 ChangeBatchController 内部模型

```ts
interface ChangeBatch {
  id: number
  rootSource: FieldChangeSource
  baseData: Record<string, unknown>
  changesByPath: Map<string, FieldChange>
  pendingLinkageRunIds: Set<string>
  rootOperationClosed: boolean
  flushed: boolean
  flushCheckScheduled: boolean
}
```

控制器需要提供以下明确操作：创建/加入当前根批次、记录变更、登记联动 run、完成或淘汰 run、关闭根操作、安排一次 RHF 稳定检查、判断可 flush、原子 detach 待发送批次。`Map` 是必须的：它同时保证 O(1) 同路径去重和“首次出现顺序”稳定，不依赖对象 numeric-string key 的枚举规则。

## 4. 操作流程

### 4.1 顶层直接写入

1. Widget 用户输入或 ref API 创建批次；批次捕获操作前的外部快照，并写入 `FormMutationContext`。
2. `setValues` 仍以 `LinkageOperationController.beginBatch/endBatch` 包裹递归写入，且必须使用 `try/finally`；这只抑制中间联动刷新。
3. RHF watch 收到通知后，按 mutation context 归属到正确批次，转换外部快照并记录直接字段变化。
4. 顶层操作关闭后，如有联动，关联的 run 会阻止发送；无联动时也需至少一次已调度的 RHF 稳定检查，防止同轮通知遗漏。

### 4.2 联动写入与多层级联

1. linkage manager 为由某批次引起的任务创建带 `batchId` 的 run，并向控制器登记 runId。
2. 联动函数完成且 token 仍有效时，`applyLinkageResults` 用 `{ batchId, source: 'linkage', isLinkageWrite: true }` 写回 RHF。
3. watch 把写回字段归入原批次，记录为 `source: 'linkage'`；若触发下一层联动，下一层 run 仍继承该 batchId。
4. 无论 run 成功、无变化、失败或被淘汰，都必须在 finally 路径中结束登记；淘汰结果不允许写 RHF、更不允许写事件。
5. 仅当根操作已关闭、pending run 为空并完成稳定检查时，批次才可 detach 并发送一次。

### 4.3 纯联动刷新

显式 `refreshLinkage()`、linkageContext/schema/linkageFunctions 变更造成的写入没有直接字段根操作时，创建 `rootSource: 'linkage'` 的批次。没有实际外部值域变化时不产生空 `onChange` 回调。

### 4.4 回调重入与卸载

flush 时先从控制器原子 detach 待发送批次，再调用最新 `onChange` ref。这样回调中的 `setValue`/`reset` 必然创建新批次。组件卸载时取消稳定检查调度、解除 watch；尚未提交的异步 run 应通过现有 token/生命周期机制失效，不得在卸载后写状态或回调。

## 5. 竞态风险与防护

| 风险 | 现有/潜在表现 | 设计防护 |
| --- | --- | --- |
| 全局可变 source 被后到的 linkage 覆盖 | 直接 `setValues` 字段被错标为 linkage | 每次写入与 run 显式携带 `batchId + source` 上下文，不从全局最后来源推断。 |
| RHF watch 与 linkage queue 调度顺序不同 | 先发中间 `Beijing`，后发最终 `Shanghai` | pending run 与稳定检查共同成为 flush 前置条件。 |
| 异步旧 run 晚于新输入完成 | 旧结果覆盖新值并产生幽灵事件 | 复用/强化 run token 校验；失效 run 不写回、finally 移除 pending。 |
| `silence: true` 后旧 run 返回 | 静默操作仍泄露一次回调 | 静默操作使相关 token/batch 失效，任何失效结果不记录。 |
| 同字段多次写入 | 多条同 path 或 previousValue 漂移 | `Map` 固定首次 previousValue，更新最终字段。 |
| callback 内重入 | 新变化被当前 flush 清空或混入旧 meta | flush 前 detach 当前批次，新写入创建新批次。 |
| `beginBatch/endBatch` 异常不配对 | 后续联动永久被抑制 | 所有批量包装使用 `try/finally`，针对抛错路径测试深度归零。 |
| 组件卸载 | timer/run 在卸载后调用回调 | 生命周期取消检查；run token 失效，清理所有调度器。 |

## 6. 测试策略

### 6.1 控制器单元测试

- 首次记录固定 `previousValue`，同路径后写只更新最终值/source/arrayAction。
- `Map` 维持第一次出现的路径顺序，包含数字字符串片段的路径。
- 根操作未关闭、有 pending run、尚未完成稳定检查时均不能 flush。
- run 成功、失败、无变化和淘汰均能释放 pending；flush 后拒绝继续记录。
- 两个批次的变化和 run 完全隔离。

### 6.2 DynamicForm 集成测试

- 用户输入 + 一层、两层同步联动：一次回调、正确 rootSource/source、最终快照。
- `setValues` 中目标字段先被直接赋值再被联动覆盖：一次回调、无中间值、同路径去重。
- `reset` 直接字段为 `reset`，联动目标为 `linkage`。
- 异步联动成功后与直接字段合并；新输入淘汰旧结果后不产生旧事件。
- `silence: true` 使旧异步联动及待发事件均不泄露。
- 回调中调用 `setValue`、`setValues`、`reset`：必须分成后续独立批次。
- transform、数组 insert/remove/move、嵌套对象路径、`asNestedForm` 路由与独立嵌套表单不冒泡的现有契约不回归。
- `onChange` 抛错后，表单最终值保持且后续独立批次仍能发送。
- 卸载前存在待发送/异步 run 时，不再发生状态写入或回调。

每个新增测试都需用中文注释说明验证的行为以及该竞态为何会发生，避免测试只固定实现细节。

## 7. 实施边界与验收标准

预计新增 controller 及其单测，修改 `DynamicForm.tsx`、`useLinkageManager.ts`、相关类型与契约集成测试，并同步技术设计/审查文档中的已确认契约。所有生产代码和测试的新增复杂分支必须写中文注释，同时说明“做什么”和“为什么不能采用全局 source/timer 方案”。

验收以以下为准：对外 `onChange` 的第一参数保持兼容；一个顶层操作只发一个最终稳定回调；`rootSource` 与每条字段 `source` 满足第 2.1 节；所有旧结果、静默结果和卸载后结果均不可泄露；类型检查、相关单测与完整 DynamicForm 回归测试通过。
