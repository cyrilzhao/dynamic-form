# DynamicForm 字段级变更事件技术设计

## 1. 文档信息

- **状态**：已确认，待实施
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
  /**
   * 创建本次稳定批次的顶层操作来源。
   * 可选字段用于保持仅接收既有 meta.changes 的消费者兼容。
   */
  rootSource?: FieldChangeSource
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

1. **创建或加入稳定批次**：用户 Widget、`ref.setValue`、`ref.setValues`、`reset`
   创建顶层批次，并在每次 RHF 写入的显式上下文中携带内部 `batchId` 与 `source`。
   联动写入继承触发它的 `batchId`，但自身 `source` 固定为 `linkage`。批量 API 仍会
   增加操作控制器的 batch 深度，以抑制递归写入过程中的中间联动刷新；这个内部深度
   不是对外事件的批次边界。
2. **watch 采集**：稳定的 watch 订阅收到 RHF 通知，取得变更 `name`（若 RHF 未
   提供路径，则使用 API 写入时保存的兜底路径）和当前原始表单快照。
3. **外部值域转换**：使用采集时的 schema、callbacks、helpers 和 variant，依次
   完成 schema 变体解析、`transformFormData`、字段 transform、数组解包及字段
   过滤，得到对外 `data` 快照。
4. **计算差异**：以本批次开始前的外部快照为 `previousValue` 基线，读取变更路径
   的新值；值未实际变化时丢弃该记录。数组结构操作在此处附加结构化 `arrayAction`。
5. **批次归并**：按路径把记录写入待发送批次。同一路径重复写入时保留最初旧值，
   仅更新最终值、来源及数组动作；批量赋值和联动级联按稳定顺序保留多条记录。
6. **等待稳定**：批次只有在顶层操作已关闭、所有关联的同步/异步联动 run 都已成功
   结束或被淘汰、且至少完成一次 RHF 通知稳定检查后，才允许安排 flush。不能仅依赖
   微任务或零延迟定时器，因为 RHF watch 通知与联动队列的调度顺序彼此独立。
7. **发送回调**：flush 开始时必须原子地脱离当前批次，再读取最新的 `onChange` 引用，
   调用 `onChange(data, { rootSource, changes })`。回调期间产生的新修改必然创建下一批次，
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
  },
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

重置直接写入的字段产生 `source: 'reset'`，本次批次的 `rootSource` 为 `reset`；只报告
前后值不同的字段。无参数重置为空值时，仍应使用字段 schema 推导出的正确空值进行比较。

若 reset 的直接字段触发联动，联动目标必须标记为 `source: 'linkage'`，而不是 `reset`。
例如 `reset({ country: 'CN' })` 使联动将 `province` 写为 `Shanghai` 时，`country` 的
`source` 是 `reset`，`province` 的 `source` 是 `linkage`，两者都包含在
`rootSource: 'reset'` 的同一稳定批次内。

### 7.5 联动变化

联动函数直接或间接修改字段时，产生 `source: 'linkage'`。当前实现会因每个联动目标的 `setValue` 分别触发 `onChange`；目标设计则应在联动传播稳定后通过同一回调中的 `changes` 数组表达整批变化，并按以下顺序报告：

1. 触发联动的直接字段；
2. 第一层联动目标；
3. 后续级联目标。

若联动设置的值与现值相同，不生成事件，避免循环联动产生噪声。

#### 7.5.1 `rootSource` 与字段 `source`

`rootSource` 描述谁开启了本次顶层逻辑操作，`FieldChange.source` 描述各路径的最终值
由谁写入。二者的约定如下：

| 顶层操作                                              | `rootSource` | 直接字段 `source` | 联动目标 `source` |
| ----------------------------------------------------- | ------------ | ----------------- | ----------------- |
| 用户输入                                              | `user`       | `user`            | `linkage`         |
| `setValue`                                            | `setValue`   | `setValue`        | `linkage`         |
| `setValues`                                           | `setValues`  | `setValues`       | `linkage`         |
| `reset`                                               | `reset`      | `reset`           | `linkage`         |
| 仅刷新联动（context/schema/functions 变化或显式刷新） | `linkage`    | 无                | `linkage`         |

同一路径在一个批次内被多次写入时，保留批次开始前的 `previousValue` 和首次出现顺序，
仅把 `value`、`source`、`arrayAction` 更新为最终稳定结果。因此用户输入后又被联动覆盖
的同一路径，最终 `source` 是 `linkage`；需要知道根本触发者的消费者应读取
`rootSource`，不能把字段 `source` 当作完整因果链。

#### 7.5.2 用户输入触发多层联动示例

用户将 `country` 从 `US` 改为 `CN`，第一层联动写入 `province: 'Shanghai'`，第二层联动
再写入 `city: 'Shanghai'`。三条变化必须在同一稳定批次中返回：

```ts
onChange(
  { country: 'CN', province: 'Shanghai', city: 'Shanghai' },
  {
    rootSource: 'user',
    changes: [
      { path: 'country', previousValue: 'US', value: 'CN', source: 'user' },
      {
        path: 'province',
        previousValue: undefined,
        value: 'Shanghai',
        source: 'linkage',
      },
      {
        path: 'city',
        previousValue: undefined,
        value: 'Shanghai',
        source: 'linkage',
      },
    ],
  },
)
```

这里 `province` 与 `city` 的 `source` 是 `linkage`，但整条变化链仍由用户开启，故
`rootSource` 是 `user`。

#### 7.5.3 `setValues` 被联动覆盖的去重示例

`setValues({ country: 'CN', province: 'Beijing' })` 会先直接写入两个字段，再由联动把
`province` 改为 `Shanghai`。最终只能产生一条 `province` 记录：它保留批次开始前的
`previousValue` 和首次出现位置，更新为最终的值和来源。

```ts
onChange(
  { country: 'CN', province: 'Shanghai', city: 'Shanghai' },
  {
    rootSource: 'setValues',
    changes: [
      {
        path: 'country',
        previousValue: undefined,
        value: 'CN',
        source: 'setValues',
      },
      {
        path: 'province',
        previousValue: undefined,
        value: 'Shanghai',
        source: 'linkage',
      },
      {
        path: 'city',
        previousValue: undefined,
        value: 'Shanghai',
        source: 'linkage',
      },
    ],
  },
)
```

这不是逐次 RHF 写入的日志，因此不得同时包含 `province: 'Beijing'` 和
`province: 'Shanghai'` 两条记录。被新操作淘汰的异步联动结果同样不得进入任何批次。

#### 7.5.4 稳定批次的关键规则

一次顶层逻辑操作的直接字段变化，以及由它引发并最终成功提交的全部同步或异步联动变化，
必须合并为一次稳定 `onChange(data, meta)`。该承诺由以下规则组成：

1. `changes` 中同一路径最多出现一条记录；
2. `previousValue` 固定为批次开始前的外部存储域值；
3. `value` 取批次稳定后的最终外部存储域值；
4. `source` 取最后一次实际写入该路径的来源；
5. 字段输出位置按其在批次中第一次发生实际变化的顺序固定；
6. 被新操作、reset 或 `silence: true` 淘汰的异步结果不得进入任何 `changes`；
7. `onChange` 回调期间的表单写入必须创建下一批次和下一次回调，不能污染已 detach 的
   当前批次。

“全部联动变化”的边界是：只等待已被 linkage manager 登记、可由 token 取消或正常 settle 的
run；不等待脱离控制器且可能无限 pending 的任意业务 Promise。该边界保证事件既包含可归属
的最终联动结果，也不会无限期阻塞。

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

事件聚合由独立的 `ChangeBatchController` 管理，而不是复用现有
`LinkageOperationController.batchDepth`。后者只用于阻止 `setValues` 的递归写入在中途
刷新联动；它无法描述异步联动生命周期、对外来源和 callback 重入边界。

每个顶层操作在内部创建 `batchId`，并通过下列上下文贯穿直接写入、watch 采集与联动
写回：

```ts
interface FormMutationContext {
  /** 仅供内部将 RHF 写入和联动 run 归属到正确批次，不作为公共 API 暴露。 */
  batchId: number
  /** 此次写入的直接来源；联动写入固定为 linkage。 */
  source: FieldChangeSource
  /** 区分联动写回与外部 API 的直接写入，避免从全局可变状态猜测来源。 */
  isLinkageWrite: boolean
}
```

`ChangeBatchController` 至少保存批次根来源、批次开始前的外部快照、按路径去重的
`Map<string, FieldChange>`、关联的 pending linkage run、根操作关闭状态和 flush 状态。
内部 `batchId` 是防止异步结果串批所必需的实现细节；公共 `FormChangeMeta` 不暴露它，
因为当前每个顶层操作只允许产生一次回调，消费者没有跨回调关联的需求。

所有 `beginBatch()` 必须通过 `try/finally` 与 `endBatch()` 配对，防止异常路径永久压住
后续联动刷新。

以下数据流刻画组件间的唯一职责传递；箭头不是新的异步队列，而是 batchId、快照和 run
归属随既有 RHF/watch/linkage 生命周期传递的方向：

```text
顶层 API / 用户输入
        │ 创建 ChangeBatch，写入 FormMutationContext
        ▼
    RHF setValue / reset ──────────────► RHF watch
        │                                  │ 采集路径、转换外部值域
        │                                  ▼
        │                         ChangeBatchController.recordChange()
        │                                  │
        ▼                                  │
LinkageOperationController / useLinkageManager
        │ 创建并登记 { batchId, runId }    │
        ▼                                  │
evaluate linkage / applyLinkageResults ───┘
        │ 在 linkage mutation context 中写回 RHF
        ▼
RHF watch 再次采集并归并
        │ pending run 归零 + 根操作关闭 + 稳定检查完成
        ▼
detach ChangeBatch -> onChange(finalData, { rootSource, changes })
```

#### 9.1.1 批次实体与控制器职责

每个逻辑操作对应一个内部 `ChangeBatch`。其中 `changesByPath` 必须使用 `Map`：它既避免
同路径归并时的线性查找，也固定字段第一次发生变化的输出顺序，避免对象的 numeric-string
key 枚举规则影响事件顺序。

```ts
interface ChangeBatch {
  /** 单调递增的内部标识，只用于关联写入和异步联动 run。 */
  id: number
  /** 整条逻辑操作的初始来源。 */
  rootSource: FieldChangeSource
  /** 批次创建时的外部存储域快照，用于固定 previousValue。 */
  baseData: Record<string, unknown>
  /** 以首次出现顺序归并的变化；后写同路径只更新最终结果。 */
  changesByPath: Map<string, FieldChange>
  /** 尚未完成、失败或淘汰处理的联动 run。 */
  pendingLinkageRunIds: Set<string>
  /** 顶层 API 或用户交互已结束，不再预期新的直接写入。 */
  rootOperationClosed: boolean
  /** 已 detach 并发送的批次不能再次接收写入。 */
  flushed: boolean
  /** 防止每一个 watch 通知都重复安排稳定检查。 */
  flushCheckScheduled: boolean
}
```

新增的 `ChangeBatchController` 应只管理对外事件批次，负责创建批次、记录变化、关联/解除
联动 run、判断稳定、原子 detach、处理重入和卸载。它不应承担联动规则计算；规则计算和
`LinkageRunToken` 的失效判断仍属于 `useLinkageManager` 与现有操作控制器。

其对外给 DynamicForm 内部使用的方法参数超过两个时必须使用对象参数，例如
`beginBatch({ rootSource, baseData })`、`recordChange({ batchId, change })`、
`trackLinkageRun({ batchId, runId })`、`completeLinkageRun({ batchId, runId })`。这既满足
项目函数参数规范，也使批次与 run 的归属不依赖位置参数或全局可变 ref。

#### 9.1.2 写入上下文与归属流程

写入必须携带 `FormMutationContext`，不能继续依据“最后一次全局 source”推断来源。三类
入口的绑定规则如下：

1. **同步直接写入**：Widget、`setValue`、`setValues`、`reset` 创建批次并进入上下文；
   watch 将变化归入该 batch，顶层操作结束后关闭根操作。`setValues` 保留 `batchDepth`，
   只在最终快照启动联动。
2. **联动写入**：任务创建时继承触发 batchId 并登记 run；`applyLinkageResults` 在
   `{ batchId, source: 'linkage', isLinkageWrite: true }` 上下文中写回 RHF。run 成功、无变化、
   失败或 token 失效时都必须解除登记。
3. **主动纯联动刷新**：`refreshLinkage` 或 linkageContext/schema/linkageFunctions 更新
   创建 `rootSource: 'linkage'` 批次；仅记录成功提交的真实差异，无差异不回调。

flush 时先 detach 并关闭旧批次，再调用用户 `onChange`。因此回调内的表单写入必然创建新
批次，绝不能重新使用已发送批次。

#### 9.1.3 四类完整流程示例

##### 场景 A：用户输入触发两层联动

```text
用户编辑 country = CN
  │
  ├─ 创建 batch #101
  │    rootSource = user
  │    baseData = { country: US, province: undefined, city: undefined }
  │
  ├─ Widget / RHF 写入 country
  │
  ├─ watch 收到 country
  │    record(country, user)
  │    changes = [country]
  │
  ├─ useLinkageManager 创建 run #A，绑定 batch #101
  │
  ├─ run #A 写入 province = Shanghai
  │
  ├─ watch 收到 province
  │    record(province, linkage)
  │    changes = [country, province]
  │
  ├─ province 又触发 run #B，仍绑定 batch #101
  │
  ├─ run #B 写入 city = Shanghai
  │
  ├─ watch 收到 city
  │    record(city, linkage)
  │    changes = [country, province, city]
  │
  ├─ rootOperationClosed = true
  ├─ run #A / #B 均完成
  └─ flush batch #101
```

回调：

```ts
onChange(finalData, {
  rootSource: 'user',
  changes: [
    { path: 'country', source: 'user' /* ... */ },
    { path: 'province', source: 'linkage' /* ... */ },
    { path: 'city', source: 'linkage' /* ... */ },
  ],
})
```

##### 场景 B：`setValues` 中的字段被联动覆盖

```text
setValues({ country: CN, province: Beijing })
  │
  ├─ 创建 batch #102，rootSource = setValues
  ├─ 递归写入 country、province
  ├─ watch 记录：
  │    country  → source setValues
  │    province → source setValues
  ├─ batchDepth 结束，启动最终快照联动 run #C
  ├─ run #C 写入 province = Shanghai
  ├─ watch 再次收到 province
  │    命中已有 province 记录：
  │    - 保留最初 previousValue
  │    - 保留原位置
  │    - 更新 value = Shanghai
  │    - 更新 source = linkage
  └─ run #C 完成后 flush
```

最终：

```ts
{
  rootSource: 'setValues',
  changes: [
    { path: 'country', source: 'setValues', value: 'CN' },
    { path: 'province', source: 'linkage', value: 'Shanghai' },
  ],
}
```

不得产生两条 `province` 记录：

```ts
;[
  { path: 'province', value: 'Beijing', source: 'setValues' },
  { path: 'province', value: 'Shanghai', source: 'linkage' },
]
```

##### 场景 C：reset 触发联动

```text
reset({ country: CN, province: New York })
  │
  ├─ 创建 batch #103，rootSource = reset
  ├─ RHF reset + 递归同步 Controller
  ├─ watch 记录 country / province 的直接变化，source = reset
  ├─ country 触发 linkage run #D
  ├─ run #D 写入 province = Shanghai
  ├─ 已有 province 记录：最终 source 改为 linkage
  └─ run #D 完成后 flush
```

最终：

```ts
{
  rootSource: 'reset',
  changes: [
    { path: 'country', source: 'reset', value: 'CN' },
    { path: 'province', source: 'linkage', value: 'Shanghai' },
  ],
}
```

##### 场景 D：回调内再次写入

```text
batch #104 flush
  │
  ├─ 先交换当前 batch，并标记为 flushed
  ├─ 再调用 onChange(...)
  │
  └─ onChange 内调用 setValue(...)
       │
       └─ 创建 batch #105
```

不能复用 #104，否则会有两个问题：

- 新变化被 #104 清理逻辑误删除；
- 新变化与已发送快照不一致。

当前实现已经通过“先清空队列再调用回调”部分规避该问题；新架构必须保留这一顺序，并将其
提升为 ChangeBatch 的明确不变量。

### 9.2 异步联动

linkage manager 为由某批次触发的每个联动任务创建 run，并登记其 `runId` 和 `batchId`。
联动函数完成后，只有 token 仍有效的结果才能以 `source: 'linkage'` 写回 RHF；写回后的
watch 通知继续归入原批次，后续级联也必须继承同一 `batchId`。

无论 run 成功、无实际变化、抛错还是被新输入/`silence: true` 淘汰，都必须在 finally
路径解除 pending 登记。只有根操作已经关闭、pending run 为空且 RHF 通知稳定后，批次
才允许发送。失效的旧结果不得写回表单、不得写入 `changes`、不得额外触发 `onChange`。

批次只等待由 linkage manager 显式登记、并受 `LinkageRunToken` 管理的 run，不等待任何
脱离控制器的业务 Promise。每个已登记 run 都必须保证“正常 settle”或“因新 mutation、
静默写入、卸载而取消并解除登记”二者之一；联动实现若访问网络或外部资源，应在自身边界
设置可取消请求或业务超时，不能以一个永不 settle 的 Promise 无限阻塞 `onChange`。框架
不以任意延迟 timer 伪造超时完成，因为那会让尚未确认失效的结果在事件已发送后写回表单。

显式 `refreshLinkage()`，以及 linkageContext、schema、linkageFunctions 变更导致的纯联动
写入，应创建 `rootSource: 'linkage'` 的批次；如果最终外部值域没有差异，不发送空回调。

### 9.3 回调异常

稳定通知是异步的；因此 `onChange` 在调度回调中抛出的异常不能依赖 React Error Boundary
可靠捕获。组件不得静默吞掉该异常，也不得回滚已经完成的表单更新或阻塞联动队列和校验。

flush 必须在调用用户回调前原子地 detach 当前批次并完成内部清理。这样即使用户回调抛错，
已发送批次也不会恢复或重复发送，后续用户操作仍可创建并发送新的独立批次。应用可以通过
运行环境的异步异常机制或统一监控记录异常。

### 9.4 watch 订阅与 effect 依赖竞态

当前实现把 `onChange`、`schema`、转换配置等变量放在 watch effect 的依赖数组中，
并在 cleanup 中取消尚未执行的 `setTimeout`。如果定时器已经创建但尚未 flush，
此时任一依赖变化会先触发 cleanup，导致待发送的 `onChange` 事件被静默丢弃；
`pendingChangesRef` 和 `pendingDataRef` 还可能残留并与新订阅产生的事件串批。
定时器回调若直接闭包捕获依赖，则还可能调用旧版 `onChange`，或用新旧 schema
不一致的转换结果发送快照。

实现时应遵循以下约束：

1. watch 订阅 effect 仅依赖稳定的 `watch` 引用；`onChange`、`schema`、
   callbacks、helpers、variant 等转换配置通过 refs 保存最新值，稳定检查读取 refs，
   不捕获旧闭包。
2. 待发送事件属于 `ChangeBatchController`，effect 重新执行不得清理、覆盖或重置
   已存在的批次。只有组件卸载才取消调度，并使尚未提交的 run 失效。
3. 事件在正确的外部值域中采集并固定；schema 或转换配置变化后，旧批次仍使用
   采集时的值和路径语义，新事件使用新配置，不得重新解释旧事件。
4. 同一路径在同一批次内多次写入时，保留批次开始前的 `previousValue`，仅更新
   最终 `value`、`source` 和 `arrayAction`；跨 effect 重建不得重新开始比较基线。
5. 不能把更长的 timer、更多的微任务或“等待队列暂时为空”作为稳定条件。这些方案
   不能表达异步 run 的真实完成状态，会重新引入中间快照、重复回调或来源错标。

### 9.5 异步与竞态风险矩阵

| 风险                            | 可能表现                                        | 设计保护                                           | 必测场景                               |
| ------------------------------- | ----------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| RHF watch 延后通知              | API 已返回，但部分写入路径尚未采集              | 根操作关闭后仍执行稳定检查                         | `setValues` 的全部递归路径均被收集     |
| `setValues` 中间态              | 递归写入多次触发联动，规则读取半成品            | 保留 `batchDepth`，只基于最终快照启动联动          | 多字段批量赋值只按最终值联动           |
| 直接写入与 linkage 交错         | 直接字段被全局最后来源错误标为 `linkage`        | 每次 RHF 写入显式携带 batchId/source               | 批量写入后联动覆盖同路径               |
| 同路径重复写入                  | changes 重复 path，或 previousValue 漂移        | `Map` 固定首次旧值与位置，覆盖最终结果             | user/API 后被 linkage 覆盖同字段       |
| 多层联动                        | 第一层完成即 flush，漏掉后续级联                | 每个 run 绑定同一 batch，全部完成后再稳定检查      | `country -> province -> city` 一次回调 |
| 并行联动                        | 独立目标完成顺序不稳定，导致输出顺序漂移        | 路径首次被记录时固定顺序，未出现路径按实际写入追加 | 一个输入并行更新两个字段               |
| 异步旧结果晚到                  | 旧请求覆盖新用户输入并产生幽灵事件              | `LinkageRunToken.canCommit()` 与 batchId 双重校验  | 慢请求 A、快请求 B，最终仅含 B         |
| 新 batch 覆盖旧 batch           | A 的异步结果写入 B 的快照                       | 新 mutation 推进版本并使旧 token/batch 失效        | setValue(A) 后立刻 setValue(B)         |
| reset 与异步联动交错            | reset 后仍被旧请求或旧 context 覆盖             | reset 创建新批次并淘汰旧 run                       | 异步联动未完成时 reset                 |
| `silence: true`                 | 不触发新联动但旧联动仍写回或泄露事件            | 静默 mutation 淘汰旧 token，并关闭相关等待         | 静默 setValues 后旧异步结果返回        |
| 回调内重入                      | 新事件被当前 flush 清空或混入旧 meta            | flush 前原子 detach；重入创建新 batch              | onChange 内 setValue/setValues/reset   |
| `onChange` 抛异常               | 当前批次半清理，后续批次受影响                  | detach 后再调用回调，异常不恢复旧 batch            | 抛错后下一次操作仍可回调               |
| 组件卸载                        | timer/run 晚到后仍写入或回调                    | dispose、取消调度、解除订阅、失效 run              | 卸载前存在待发批次或异步 run           |
| schema、callback 或转换配置更新 | 已采集 batch 被新配置重解释                     | batch 固定采集时的外部值域快照                     | schema/transform 更新时旧数据不漂移    |
| `onChange` 动态替换             | 已排队批次调用旧回调引用                        | flush 读取最新 callback ref，不重算 batch 数据     | 更新 callback 后事件送达新函数         |
| `asNestedForm` 嵌套表单         | 子父分别建批次，导致重复或漏事件                | 通过 Context 共享根 batch controller               | 数组项内 nested DynamicForm 联动       |
| 独立子 DynamicForm              | 错误地自动向父表单冒泡                          | 不共享 controller，保持独立事件边界                | `asNestedForm=false` 不冒泡            |
| 数组结构操作                    | useFieldArray 产生多条内部 watch 路径而重复记录 | 数组 action registry 绑定 batch，归并为数组根路径  | insert/remove/move 与字段编辑混合      |
| 数组重复元素                    | 快照 diff 错误推断 `arrayAction`                | 显式 registry 优先；无法唯一判断时省略动作         | 重复值移动不产生错误动作               |
| transform/reverseTransform      | 直接值与事件值不在同一值域                      | batch 仅存转换后的外部存储域差异                   | transform + linkage + setValues        |

## 10. 兼容性与版本策略

1. 保留 `onChange` 第一参数及其数据格式。
2. 第二参数为可选，旧消费者无需修改。
3. 新增类型通过组件入口统一导出。
4. 不改变 Widget 层 `onChange(value)` 签名。
5. `onChange` 是稳定批次完成后的异步通知。公开的 `setValue`、`setValues`、`reset`
   仍返回 `void`，调用方不能 `await` 它们，也不能在同一同步调用栈中假定回调已执行。
6. 在变更日志中说明：只有实际值变化才会出现在 `meta.changes`；调用方应等待回调或
   订阅自身状态变化，而不是在调用 ref API 后同步读取由回调驱动的外部状态。
7. 若未来需要改变字段路径或值域，必须引入新的版本化字段，不能静默改变现有字段含义。

## 11. 测试设计

### 11.1 ChangeBatchController 单元测试

该层不依赖 React、RHF 或 timer，专门固定数据结构和 flush 不变量：

- 首次记录固定 `previousValue`；同路径第二次记录保留位置，只更新最终
  value/source/arrayAction；多路径按首次出现顺序返回；
- 相同值、空 changes、根操作未关闭、存在 pending run、尚未完成稳定检查时均不可 flush；
- run 成功、失败、无变化和淘汰都会解除 pending；flush 后同一 batch 拒绝再写入；
- 新批次不影响旧批次的历史快照和 pending run，包含数字字符串路径的顺序回归。

### 11.2 linkage 与操作控制器集成测试

该层验证 run 与 batch 的绑定，不把异步协调逻辑仅留给 DynamicForm 黑盒测试：

- 一层、多层和并行联动均继承 batchId，所有 run 完成前不得 flush；
- token 失效的旧结果、reset 打断的旧结果和 `silence: true` 打断的旧结果都不得提交；
- `setValues` 只在 `batchDepth` 结束后的最终快照计算联动，异常路径后深度必须归零；
- `refreshLinkage`、linkageContext、schema、linkageFunctions 刷新有真实写入时形成
  `rootSource: 'linkage'` 批次，无差异时不产生空事件。

### 11.3 DynamicForm 公共契约测试

- 用户、`setValue`、`setValues`、`reset` 的 `rootSource` 与直接字段 `source` 正确；
- 用户输入触发一层/多层联动时，所有最终字段在一次回调内返回，联动字段为 `linkage`；
- `setValues` 的目标字段被联动覆盖时，只回调一次、无中间值、同路径不重复；
- `reset` 的直接字段为 `reset`，联动目标为 `linkage`，整个批次 `rootSource` 为 `reset`；
- 异步联动成功时与直接字段合并；慢请求被快请求、新输入或静默操作淘汰时不泄露旧事件；
- callback 内 `setValue`、`setValues`、`reset` 均生成下一独立批次；回调抛错后表单值不回滚，
  后续批次仍可发送；卸载前存在待发批次/run 时不再回调；
- transform、reverseTransform、基本类型数组解包和 schema 过滤后的 `data`、`previousValue`、
  `value` 始终处于同一外部存储域；
- 嵌套表单返回绝对路径，`asNestedForm` 共享批次，独立子 DynamicForm 不向父表单冒泡；
- 数组 insert/remove/move 携带正确 arrayAction，结构事件使用数组根路径；重复值无法可靠
  推断时安全省略动作；结构操作与数组元素字段编辑混合时不重复记录；
- watch effect、schema/transform 和 `onChange` 引用更新后，既有批次不丢失、不重解释，
  且 flush 调用最新 callback；只接收一个参数的现有 onChange 测试保持通过。

## 12. 分阶段实施建议

### 阶段一：契约与兼容层

- 增加 `FieldChangeSource`、`ArrayAction`、`FieldChange`、`FormChangeMeta` 类型；
- 扩展 `onChange` 类型和 `FormChangeMeta.rootSource`，但保持第一参数不变；
- 明确绝对路径、存储域值和稳定批处理边界；`batchId` 仅作为内部实现细节生成，
  不在首版公共 meta 中暴露。

### 阶段二：变更采集与聚合

- 新增独立的 ChangeBatchController，在统一 watch 层按 batchId 记录字段前后值；
- 为 ref API、reset 和联动操作传递显式 mutation context，避免全局 source 串批；
- 让 linkage run 登记、完成和淘汰均回写批次生命周期，聚合 `setValues`、同步/异步联动级联。

### 阶段三：测试、文档与迁移

- 补充上述单元和集成测试；
- 增加 effect 依赖变化、定时器 flush 和组件卸载的竞态测试；
- 更新 README、API 文档和示例；
- 增加一个展示字段名、前后值和来源的调试示例，但不依赖生产日志。

## 13. 验收标准

- 现有 `onChange(data)` 消费者行为不变；
- 新消费者可通过 `meta.changes` 精确识别字段、前值、后值和来源；
- 批量赋值、重置或用户输入及其同步/异步联动只产生一次最终稳定回调，且 `rootSource`
  与每条 FieldChange.source 符合 §7.5.1；
- 嵌套对象、数组和嵌套 DynamicForm 的路径稳定且可定位；
- 数组结构变更能够生成正确的 `insert/remove/move` 动作，歧义场景不会误报；
- transform、联动和异步竞态不会泄露内部值、过期事件、静默事件或卸载后事件；
- 类型检查、现有 DynamicForm 测试及新增事件测试通过。

## 14. 结论

DynamicForm 应将现有完整快照回调扩展为“完整快照 + 可选变更元数据”，而不是替换为破坏性事件对象或立即引入第二套字段回调。以 `rootSource`、`changes`、前后值、字段最终来源和稳定批处理边界为核心的首版契约，能够覆盖当前用户交互、ref API、批量赋值、重置、同步/异步联动和嵌套数组场景。内部 `batchId` 仅用于保证异步传播不会串批；若未来业务确有跨回调追踪需求，再单独设计版本化的公共关联字段。
