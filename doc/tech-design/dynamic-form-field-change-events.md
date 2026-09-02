# DynamicForm 字段级变更事件技术设计

## 1. 文档信息

- **状态**：设计中
- **目标版本**：待实现版本的下一个 minor 版本
- **适用范围**：`src/components/DynamicForm`
- **读者**：DynamicForm 维护者、组件封装者、业务接入方
- **变更性质**：向后兼容的对外回调能力扩展

## 2. 背景与问题

当前 `DynamicFormProps.onChange` 的签名为：

```ts
onChange?: (data: Record<string, any>) => void
```

回调只接收经过 transform、数组处理和 schema 过滤后的完整表单快照。外部调用方能够同步表单状态，却无法可靠回答以下问题：

- 哪个字段发生了变化？
- 字段变化前后的值是什么？
- 变化来自用户输入、`ref.setValue`、批量赋值、重置，还是联动函数？
- 一次 `setValues` 或一次联动传播涉及了哪些字段？
- 嵌套对象和数组字段的完整路径是什么？

底层 React Hook Form 的 `watch` 已提供字段名元数据；联动管理器也维护了前后值比较、批处理和异步联动队列，但这些信息目前没有形成稳定的公共契约。因此，业务只能通过比较两次完整快照、在各个 Widget 中自行埋点，或依赖不稳定的内部实现来推断字段变化。

## 3. 设计目标与非目标

### 3.1 设计目标

1. 在不破坏现有 `onChange(data)` 用法的前提下提供字段级变更信息。
2. 统一用户输入、外部 ref API、重置和联动产生的变化语义。
3. 支持嵌套对象、数组元素和嵌套 DynamicForm 的标准路径。
4. `setValues` 等批量操作只暴露稳定快照，不暴露递归写入过程中的中间态。
5. 事件中的值与现有 `onChange` 数据保持相同的外部存储域语义。
6. 使事件契约可测试、可文档化，并可在未来扩展数组操作和批次追踪。

### 3.2 非目标

- 不改变现有 Widget 的局部 `onChange(value)` 接口。
- 不把 UI 联动规则改造成业务事件总线。
- 不在本设计中引入全局状态管理、持久化或跨表单事件中心。
- 不要求为每一次 RHF 注册、校验或无值变化通知生成事件。

## 4. 现状分析

### 4.1 当前数据流

1. Widget 通过字段控制器写入 RHF。
2. `DynamicForm.tsx` 订阅 `watch`，取得完整数据。
3. 数据经过 `transformFormData`、有效变体 schema、字段 transform 和 schema 过滤。
4. 仅调用 `onChange(processedData)`。

联动管理器在自己的 `watch` 订阅中能够取得 `name`，并通过快照比较得到 `previousValue` 与 `nextValue`。批量赋值期间还会延迟联动刷新，说明项目已经具备事件聚合所需的生命周期边界。

### 4.2 主要风险

- 若直接把 RHF 原始值暴露出去，调用方会同时面对展示域、存储域和内部数组包装格式。
- 若每一次递归 `setValue` 都回调，`setValues` 会产生多个中间快照。
- 若不记录来源，联动导致的字段变化会被误认为用户直接修改。
- 嵌套表单若返回相对路径，外部无法定位实际字段。
- 仅返回字段名和值而不返回旧值，无法实现审计、撤销或差异展示。

## 5. 方案比较与决策

### 5.1 方案 A：扩展现有 `onChange` 的第二参数（采用）

保持第一参数不变，新增可选元数据参数：

```ts
onChange(data, meta)
```

优点是完全兼容现有消费者，能够在同一个回调中同时获得完整快照和增量信息；批量操作也可以通过 `changes` 数组表达。缺点是 `onChange` 同时承担“快照通知”和“变更事件”两个职责，需要在文档中明确两者边界。

### 5.2 方案 B：新增 `onFieldChange`

让 `onChange` 保持现状，新增独立的字段事件回调。该方案语义直观，但批量写入和联动传播会带来多个回调，调用方需要同时维护快照订阅与字段订阅两套逻辑。

### 5.3 方案 C：改成事件对象

将 `onChange(data)` 改成 `onChange({ data, changes, source })`。该方案结构统一，但会破坏现有 API，不适合作为当前版本的增量演进方式。

### 5.4 决策

采用方案 A。后续如出现明确的高频字段订阅场景，可在不改变 `FormChangeMeta` 契约的前提下增加 `onFieldChange` 作为派生能力；当前不提前引入第二套回调。

## 6. 公共 API 设计

### 6.1 类型定义

建议新增以下公共类型，并从 `src/components/DynamicForm/index.ts` 导出：

```ts
export type FieldChangeSource =
  | 'user'
  | 'setValue'
  | 'setValues'
  | 'reset'
  | 'linkage'

export interface ArrayInsertAction {
  action: 'insert'
  index: number
  value: unknown
}

export interface ArrayRemoveAction {
  action: 'remove'
  index: number
  value: unknown
}

export interface ArrayMoveAction {
  action: 'move'
  fromIndex: number
  toIndex: number
  value: unknown
}

export type ArrayAction =
  | ArrayInsertAction
  | ArrayRemoveAction
  | ArrayMoveAction

export interface FieldChange {
  /** 标准绝对字段路径，如 items.0.price */
  path: string
  /** 变化前的外部存储域值 */
  previousValue: unknown
  /** 变化后的外部存储域值 */
  value: unknown
  /** 变更来源：用户输入、外部 API、重置或联动 */
  source: FieldChangeSource
  /** 数组结构变化时使用；普通字段更新时省略 */
  arrayAction?: ArrayAction
}

export interface FormChangeMeta {
  /** 本次稳定变更批次包含的字段变化 */
  changes: FieldChange[]
}
```

`arrayAction` 不是 `FormChangeMeta` 的顶层字段，而是数组结构对应的那一条
`FieldChange` 的可选字段。新增数组元素时，消费者应在
`meta.changes.find(change => change.path === 'items')?.arrayAction` 读取动作；
当本次变更不是数组结构操作时，该字段应省略（而不是以 `null` 表示）。

`FieldChange` 不定义通用的 `action` 或 `type` 字段：当前所有可观察的字段变化
都可以由路径、前后值和来源完整表达；重置由 `source: 'reset'` 表达，数组结构
差异由 `arrayAction` 表达。只有未来出现无法由这些字段表达的新变化语义时，才
应在明确需求后新增字段，而不是预先保留只有单一取值的占位字段。

`DynamicFormProps.onChange` 调整为：

```ts
onChange?: (
  data: Record<string, any>,
  meta?: FormChangeMeta,
) => void
```

第二参数必须保持可选，以兼容只声明单参数的现有函数。

### 6.2 值域约定

`data`、`previousValue` 和 `value` 必须使用同一套外部数据契约：

- 应用字段 `callback`/`transform` 后的存储域值；
- 按现有规则解包基本类型数组；
- 按 schema 过滤不属于表单的数据；
- 不暴露 RHF 内部 `{ value }` 包装对象。

这样调用方无需为快照和字段事件编写两套转换逻辑。

## 7. 事件语义与数据流

### 7.0 从字段修改到 `onChange` 的完整链路

一次对外字段变更事件按以下顺序产生：

1. **触发修改**：用户 Widget、`ref.setValue`、`ref.setValues`、`reset` 或联动逻辑
   向 RHF 写入值，并在操作上下文中标记 `source`；批量 API 在此阶段只增加批次
   深度，不立即通知外部。
2. **watch 采集**：稳定的 watch 订阅收到 RHF 通知，取得变更 `name`（若 RHF 未
   提供路径，则使用 API 写入时保存的兜底路径）和当前原始表单快照。
3. **外部值域转换**：使用采集时的 schema、callbacks、helpers 和 variant，依次
   完成 schema 变体解析、`transformFormData`、字段 transform、数组解包及字段
   过滤，得到对外 `data` 快照。
4. **计算差异**：以本批次开始前的外部快照为 `previousValue` 基线，读取变更路径
   的新值；值未实际变化时丢弃该记录。数组结构操作在此处附加结构化 `arrayAction`。
5. **批次归并**：按路径把记录写入待发送批次。同一路径重复写入时保留最初旧值，
   仅更新最终值、来源及数组动作；批量赋值和联动级联按稳定顺序保留多条记录。
6. **调度 flush**：首次写入批次时安排一次微任务或零延迟定时器；后续 watch 通知
   只更新同一批次，不重复安排 flush。
7. **发送回调**：flush 开始时先交换出当前批次并清空队列，再读取最新的 `onChange`
   引用，调用 `onChange(data, { changes })`。回调期间产生的新修改进入下一批次，
   不会被本次清理覆盖。

`data` 与 `changes` 必须来自同一个稳定快照；任何依赖变更不得重新解释已经入队的
批次。组件卸载时才执行订阅和调度器的最终清理。

### 7.1 单字段用户修改

用户编辑 `email` 时，触发一次 `onChange`：

```ts
onChange(
  { email: 'new@example.com' },
  {
    changes: [
      {
        path: 'email',
        previousValue: 'old@example.com',
        value: 'new@example.com',
        source: 'user',
      },
    ],
  }
)
```

值未发生实际变化时不生成 `FieldChange`。

### 7.1.1 `changes` 为多元素的场景

普通用户编辑一个叶子字段时，`changes` 通常只有一个元素。需要特别区分当前实现与本设计的目标行为：当前 `DynamicForm.tsx` 的 `watch` 订阅会在每次 RHF `setValue` 后分别调用 `onChange`；联动目标由 `applyLinkageResults` 逐个写入，因此一个触发字段导致多个联动字段更新时，当前代码会产生多次独立的 `onChange`，不会把它们自动聚合到同一个 `changes` 数组中。

本设计建议新增变更收集与 flush 机制，在一次稳定操作结束时统一回调。聚合后的 `changes` 用于表达以下“一次稳定操作包含多个逻辑字段变化”的场景：

1. **批量赋值**：`setValues({ firstName: 'Ada', lastName: 'Lovelace' })` 在一次稳定回调中包含两个 `FieldChange`。
2. **重置表单**：`reset()` 同时清空多个已注册字段时，按实际前后值差异生成多个 `FieldChange`。
3. **联动级联**：用户修改 `country` 后，联动同时更新 `province` 和 `city`，同一稳定传播结果可包含三个变化，分别标记直接变化和联动变化来源。
4. **数组结构操作**：一次追加、删除或移动通常对应一个结构性 `FieldChange`；如果该操作同时导致其他已注册字段或联动目标发生变化，则这些逻辑变化也应放在同一 `changes` 中，而不是暴露 RHF 的每个内部通知。

事件采集必须按逻辑操作去重：同一路径在一个批次内多次写入时，只保留从批次开始前的 `previousValue` 和批次结束后的最终 `value`。因此，目标行为中的 `changes` 数组表达的是业务可观察的最终差异，不是底层 `watch` 回调次数。

### 7.2 `setValue`

`ref.setValue('address.city', 'Shanghai')` 产生一个 `source: 'setValue'` 的变化。事件路径使用标准点号路径，不因调用方是否处于嵌套表单而改变格式。

### 7.3 `setValues`

批量赋值必须在递归写入结束后聚合：

- 不暴露递归 `setValue` 产生的中间态；
- 只报告实际变化的字段；
- `source` 为 `setValues`；
- 按输入路径的稳定顺序输出 `changes`。

### 7.4 `reset`

重置产生 `source: 'reset'`；只报告前后值不同的字段。无参数重置为空值时，仍应使用字段 schema 推导出的正确空值进行比较。

### 7.5 联动变化

联动函数直接或间接修改字段时，产生 `source: 'linkage'`。当前实现会因每个联动目标的 `setValue` 分别触发 `onChange`；目标设计则应在联动传播稳定后通过同一回调中的 `changes` 数组表达整批变化，并按以下顺序报告：

1. 触发联动的直接字段；
2. 第一层联动目标；
3. 后续级联目标。

若联动设置的值与现值相同，不生成事件，避免循环联动产生噪声。

### 7.6 数组结构操作

数组新增、删除或移动应生成一条 `FieldChange`，其 `path` 为数组字段路径，
`arrayAction` 为对应的结构化动作。新增元素的
`value` 是插入后的元素；删除元素的 `value` 是删除前的元素；移动元素的
`value` 是被移动元素。非数组结构变更不得填充 `arrayAction: null`，应直接省略
该属性，以便消费者通过判别联合安全收窄类型。

#### 7.6.1 `arrayAction` 的生成

首选在 ArrayFieldWidget 执行结构操作的边界显式记录操作描述，再由统一变更采集器
转换为事件：

1. **insert**：写入新数组后记录数组路径、插入索引和插入元素，生成
   `{ action: 'insert', index, value }`；`index` 是新数组中的位置。
2. **remove**：在删除写入前读取旧数组元素，记录其索引和值，写入新数组后生成
   `{ action: 'remove', index, value }`；`value` 始终是删除前的元素。
3. **move**：在移动前记录元素所在索引，移动完成后记录目标索引，生成
   `{ action: 'move', fromIndex, toIndex, value }`；`value` 是被移动元素。

结构操作事件的 `FieldChange.path` 为数组路径，`previousValue` 和 `value` 分别为
操作前后的完整数组快照。若底层只能取得前后快照而没有显式描述，则按长度和元素
序列执行兜底 diff：长度增加一项尝试识别 insert，减少一项尝试识别 remove，长度
不变则尝试识别单元素 move。元素比较应优先使用 schema 声明的稳定业务 ID，其次
使用深度相等比较；存在重复元素、多个候选索引或无法唯一判断时，不猜测动作，
仅报告数组字段的普通值变化并省略 `arrayAction`。

#### 7.6.2 重复值与元素身份

当数组中存在多个完全相同的值时，仅凭前后快照无法判断元素身份。例如
`['A', 'A']` 移动后快照不变，任何算法都无法证明是否发生过移动；
`['A', 'A', 'B']` 也可能对应多个不同的删除或移动路径。此时这是信息论上的
不可判定，而不是 diff 算法实现不充分。

因此不应强制给所有数组值注入唯一 ID：

- 会改变用户数据结构，影响 schema 校验、transform、提交和现有消费者；
- 对基本类型数组无法无侵入地附加 ID；
- ID 只能解决“追踪同一元素”，不能让一个本身没有可观察差异的操作凭空变得可见。

推荐采用分层策略：

1. ArrayFieldWidget 在 insert/remove/move 的操作边界显式记录索引和元素，作为
   `arrayAction` 的权威来源；即使元素值重复，也能准确报告操作。
2. 对需要跨重排追踪身份的对象数组，由业务 schema 提供稳定 ID（如 `id`），并将
   其作为普通业务字段保留在值中；事件仍返回原始元素，不由框架偷偷注入字段。
3. 若业务没有 ID 且只能通过快照推断，遇到重复值或多个候选匹配时降级为普通数组
   值变化，省略 `arrayAction`，不得生成不可靠的索引。

RHF/useFieldArray 的内部 key 可以作为渲染和操作层的辅助身份，但不应直接暴露到
`data`、`previousValue`、`value` 或公共事件契约中；如未来确有审计需求，可另行
增加独立的内部身份字段并明确其生命周期。

### 7.7 外部消费者如何理解 `meta`

`meta` 是“已提交且对外可观察的数据差异”描述，不是 ArrayFieldWidget 的操作日志。
消费者应始终以第一个参数 `data` 作为当前完整真值，以 `meta.changes` 作为从上一
个稳定快照到当前快照的解释信息；不能假设每次点击、每次 RHF 通知或每次内部写入
都会对应一条 change。

一次 `onChange` 可能属于以下几种情况：

1. **普通字段变化**：`changes` 包含一个叶子路径及其前后值，例如
   `profile.name`；`source` 表示用户、API、重置或联动来源。
2. **数组插入/删除**：数组长度或内容发生可观察变化，`path` 为数组路径，并携带
   结构化 `arrayAction`。插入和删除即使元素值与其他项重复，也能通过显式索引理解。
3. **数组移动**：数组顺序发生可观察变化时携带 `fromIndex`、`toIndex`。如果移动
   重复值后外部数组完全相同（如 `['A', 'A']`），这对消费者没有可观察影响，应
   视为 no-op，不生成 change；显式内部 move 也不得强行制造一条与 `data` 不一致
   的事件。
4. **数组变化但动作不确定**：前后数组不同，但只有快照且存在重复值、多个候选
   匹配，无法证明是 insert、remove 还是 move。此时仍报告数组路径的前后完整值，
   但省略 `arrayAction`。消费者可以确认“数组值发生了变化”，却不能仅凭该事件
   可靠区分结构操作和整体数组替换；缺少 `arrayAction` 不代表没有结构变化。
5. **批量或级联变化**：一次稳定操作在 `changes` 中包含多条记录，按稳定顺序排列；
   消费者不应依赖底层 watch 回调次数来推断批次边界。

框架要对结构变化提供可靠分类，必须让 ArrayFieldWidget 的 insert/remove/move
在操作边界写入显式操作上下文，并让该上下文随 watch 事件进入变更采集器。对于
调用方直接以 `setValue('items', nextArray)` 替换整个数组，若没有额外动作参数，
契约只能报告数组字段值变化，不能承诺结构分类。若业务必须区分这两类来源，应
使用 ArrayFieldWidget 的结构 API，或另行设计带动作描述的数组 API，而不能依赖
重复值快照推断。

若某次内部操作经过 transform、schema 过滤或数组解包后，与上一个对外快照完全
相同，则不产生 `FieldChange`；如果整个快照没有可观察差异，则不调用 `onChange`。
实现应在外部值域完成结构相等比较（对数组和对象不能只依赖引用相等），而不是依据
RHF 内部包装对象或引用变化误报事件。为兼容旧消费者，`meta` 仍可缺省；新契约下
只要回调因数据变化触发，就应提供 `meta.changes`，且至少包含一条实际差异。

## 8. 嵌套对象与数组路径

### 8.1 路径命名

事件字段使用 `path` 而不是 `name`。这里表达的是完整的、标准化的绝对字段路径，而不是字段的局部名称，避免与 Widget/RHF 中的 `name` 概念混淆。

### 8.2 嵌套对象

字段路径统一使用绝对路径，例如：

- `employeeInfo.position`
- `shippingAddress.city`

`asNestedForm` 和 `pathPrefix` 只影响内部注册方式，不改变对外事件路径。

### 8.3 数组字段

数组元素内部字段更新使用精确索引路径，例如 `items.0.price`，且不携带 `arrayAction`。

数组结构事件的 `path` 始终指向数组字段本身（如 `items`），索引只放在结构化的 `arrayAction` 中：

- 插入：`{ action: 'insert', index: 2, value: newItem }`
- 删除：`{ action: 'remove', index: 2, value: removedItem }`（`value` 是删除前的元素）
- 移动：`{ action: 'move', fromIndex: 2, toIndex: 0, value: movedItem }`

这样可以避免把易变的索引同时编码在 `path` 和动作对象中；移动也能一次表达来源和目标位置。当前 ArrayFieldWidget 的追加映射为 `insert`，上移/下移统一映射为 `move`。若未来新增整段替换能力，应单独评估并扩展联合类型。

索引并非稳定身份。如果业务需要跨重排追踪同一个元素，建议在数组元素 schema 中提供业务 ID，并由调用方使用 `value.id` 建立关联；本设计不强制引入 RHF 内部 id。

## 9. 批处理、异步与错误处理

### 9.1 批处理边界

事件聚合应复用现有操作控制器的 batch 生命周期：开始批处理时创建批次上下文，期间记录前后值，批处理结束后基于最终快照一次性回调。当前控制器只有 `batchDepth`、`pendingLinkage` 和版本号，没有对外可用的 `batchId`。

首版不引入 `batchId`：在“一次稳定批处理对应一次 `onChange`”的契约下，`changes` 已经提供完整的批次边界。只有未来需要将同一逻辑操作拆分为多次回调，并让审计、埋点或事务追踪跨回调关联时，才应增加由表单操作上下文生成并贯穿联动传播的 `batchId`。

### 9.2 异步联动

异步联动的旧结果被版本控制丢弃时，不应产生字段事件。只有最终成功提交到表单状态的变化才进入 `changes`。

### 9.3 回调异常

`onChange` 抛出的异常不应回滚已经完成的表单更新，也不应阻塞联动队列和校验流程。异常交由 React 应用层错误边界或统一日志机制处理。

### 9.4 watch 订阅与 effect 依赖竞态

当前实现把 `onChange`、`schema`、转换配置等变量放在 watch effect 的依赖数组中，
并在 cleanup 中取消尚未执行的 `setTimeout`。如果定时器已经创建但尚未 flush，
此时任一依赖变化会先触发 cleanup，导致待发送的 `onChange` 事件被静默丢弃；
`pendingChangesRef` 和 `pendingDataRef` 还可能残留并与新订阅产生的事件串批。
定时器回调若直接闭包捕获依赖，则还可能调用旧版 `onChange`，或用新旧 schema
不一致的转换结果发送快照。

实现时应遵循以下约束：

1. watch 订阅 effect 仅依赖稳定的 `watch` 引用；`onChange`、`schema`、
   callbacks、helpers、variant 等转换配置通过 refs 保存最新值，定时器回调读取
   refs，而不是捕获旧闭包。
2. 待发送事件先构造成不可变的批次快照（最终 `data` 与 `changes`），再入队；
   effect 重新执行不得清理、覆盖或重置该队列。只有组件卸载时才允许按产品策略
   丢弃尚未发送的事件。
3. flush 必须交换并清空当前队列后再调用最新的 `onChange`，这样回调期间产生的
   新事件会进入下一批次，不会被清空操作覆盖。
4. 事件采集时即完成外部值域转换并固定快照。schema 或转换配置变化后，旧批次
   仍使用采集时的值和路径语义，新事件使用最新配置，不得重新解释旧事件。
5. 同一路径在同一批次内多次写入时，保留批次开始前的 `previousValue`，仅更新
   最终 `value`、`source` 和 `arrayAction`；跨 effect 重建不得重新开始比较基线。

推荐使用两个 refs：`latestConfigRef` 保存所有外部依赖，`pendingBatchRef` 保存
当前待 flush 的批次和 timer 状态。若运行环境支持 `queueMicrotask`，可用微任务
替代零延迟定时器；无论采用何种调度方式，都必须满足上述“不因依赖变化丢事件”的
保证。

## 10. 兼容性与版本策略

1. 保留 `onChange` 第一参数及其数据格式。
2. 第二参数为可选，旧消费者无需修改。
3. 新增类型通过组件入口统一导出。
4. 不改变 Widget 层 `onChange(value)` 签名。
5. 在变更日志中说明：只有实际值变化才会出现在 `meta.changes`。
6. 若未来需要改变字段路径或值域，必须引入新的版本化字段，不能静默改变现有字段含义。

## 11. 测试设计

### 11.1 单元测试

- 相同值赋值不会产生变化事件；
- 前后值比较支持 `undefined`、`null`、数组和对象；
- transform 前后的事件值均符合外部存储域契约；
- `changes` 的路径、顺序和前后值正确；数组结构动作的判别联合字段正确。
- watch effect 因 `onChange`、schema 或转换配置变化而重建时，已排队事件仍能发送；
- flush 使用最新的 `onChange`，且不会把回调期间产生的新事件清空；
- 组件卸载时按约定清理订阅、定时器和待发送队列。

### 11.2 集成测试

- 用户编辑普通字段，`source` 为 `user`；
- `ref.setValue`，`source` 为 `setValue`；
- `ref.setValues` 只回调一次且不暴露中间态；
- `reset` 正确报告变化字段；
- 联动产生的派生字段标记为 `linkage`；
- 嵌套表单返回绝对路径；
- 对象数组内字段返回如 `permissions.0.actions` 的路径；
- 数组插入、删除和移动操作携带结构化 `arrayAction`（`insert`、`remove`、`move`），且数组结构事件的 `path` 指向数组字段；
- 数组动作优先使用结构操作边界记录的索引和值；无法唯一 diff 时不猜测动作；
- 重复数组值场景通过显式操作元数据仍能正确报告；纯快照无法判定时安全降级；
- 现有只接收一个参数的 `onChange` 测试全部保持通过。

## 12. 分阶段实施建议

### 阶段一：契约与兼容层

- 增加 `FieldChangeSource`、`ArrayAction`、`FieldChange`、`FormChangeMeta` 类型；
- 扩展 `onChange` 类型但保持第一参数不变；
- 明确绝对路径、存储域值和稳定批处理边界；首版不生成无实际消费方的 `batchId`。

### 阶段二：变更采集与聚合

- 在统一 watch 层记录字段前后值；
- 为 ref API、reset 和联动操作标记来源；
- 复用 batch 生命周期聚合 `setValues` 和联动级联。

### 阶段三：测试、文档与迁移

- 补充上述单元和集成测试；
- 增加 effect 依赖变化、定时器 flush 和组件卸载的竞态测试；
- 更新 README、API 文档和示例；
- 增加一个展示字段名、前后值和来源的调试示例，但不依赖生产日志。

## 13. 验收标准

- 现有 `onChange(data)` 消费者行为不变；
- 新消费者可通过 `meta.changes` 精确识别字段、前值、后值和来源；
- 批量赋值不产生中间态回调；
- 嵌套对象、数组和嵌套 DynamicForm 的路径稳定且可定位；
- 数组结构变更能够生成正确的 `insert/remove/move` 动作，歧义场景不会误报；
- transform、联动和异步竞态不会泄露内部值或过期事件；
- 类型检查、现有 DynamicForm 测试及新增事件测试通过。

## 14. 结论

DynamicForm 应将现有完整快照回调扩展为“完整快照 + 可选变更元数据”，而不是替换为破坏性事件对象或立即引入第二套字段回调。以 `changes`、前后值、来源和稳定批处理边界为核心的首版契约，能够覆盖当前用户交互、ref API、批量赋值、重置、联动和嵌套数组场景；未来若出现跨回调追踪需求，再独立增加 `batchId`。
