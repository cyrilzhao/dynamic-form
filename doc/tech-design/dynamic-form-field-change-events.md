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

export type FieldChangeAction = 'update' | 'remove' | 'reset'

export interface FieldChange {
  /** 标准绝对字段路径，如 items.0.price */
  path: string
  /** 变化前的外部存储域值 */
  previousValue: unknown
  /** 变化后的外部存储域值 */
  value: unknown
  /** 变更来源：用户输入、外部 API、重置或联动 */
  source: FieldChangeSource
  /** 字段值变化的动作类型 */
  action: FieldChangeAction
  /** 数组结构变化时使用 */
  arrayAction?: 'append' | 'remove' | 'moveUp' | 'moveDown'
}

export interface FormChangeMeta {
  /** 本次稳定变更批次包含的字段变化 */
  changes: FieldChange[]
}
```

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
        action: 'update',
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

重置产生 `source: 'reset'`。`action` 使用 `reset`；只报告前后值不同的字段。无参数重置为空值时，仍应使用字段 schema 推导出的正确空值进行比较。

### 7.5 联动变化

联动函数直接或间接修改字段时，产生 `source: 'linkage'`。当前实现会因每个联动目标的 `setValue` 分别触发 `onChange`；目标设计则应在联动传播稳定后通过同一回调中的 `changes` 数组表达整批变化，并按以下顺序报告：

1. 触发联动的直接字段；
2. 第一层联动目标；
3. 后续级联目标。

若联动设置的值与现值相同，不生成事件，避免循环联动产生噪声。

## 8. 嵌套对象与数组路径

### 8.1 路径命名

事件字段使用 `path` 而不是 `name`。这里表达的是完整的、标准化的绝对字段路径，而不是字段的局部名称，避免与 Widget/RHF 中的 `name` 概念混淆。

### 8.2 嵌套对象

字段路径统一使用绝对路径，例如：

- `employeeInfo.position`
- `shippingAddress.city`

`asNestedForm` 和 `pathPrefix` 只影响内部注册方式，不改变对外事件路径。

### 8.3 数组字段

数组元素字段使用索引路径，例如 `items.0.price`。因此 `FieldChange` 不再单独提供 `index` 字段，避免索引同时出现在 `path` 和 `index` 中。

当前 ArrayFieldWidget 实际提供的结构操作是追加、删除、上移和下移，因此 `arrayAction` 只定义为 `append`、`remove`、`moveUp` 和 `moveDown`，不虚构尚未存在的 `replace` 操作。

数组结构事件的 `path` 直接指向受影响的数组元素或数组节点：追加和删除使用元素路径（如 `items.2`），移动使用移动前元素路径（如 `items.2`），目标位置由 `moveUp` 或 `moveDown` 的方向确定。移动操作必须区分方向：上移使用 `moveUp`，下移使用 `moveDown`。如果未来新增整段替换能力，应单独评估并扩展枚举，而不是预先把 `replace` 纳入当前契约。

索引并非稳定身份。如果业务需要跨重排追踪同一个元素，建议在数组元素 schema 中提供业务 ID，并由调用方使用 `value.id` 建立关联；本设计不强制引入 RHF 内部 id。

## 9. 批处理、异步与错误处理

### 9.1 批处理边界

事件聚合应复用现有操作控制器的 batch 生命周期：开始批处理时创建批次上下文，期间记录前后值，批处理结束后基于最终快照一次性回调。当前控制器只有 `batchDepth`、`pendingLinkage` 和版本号，没有对外可用的 `batchId`。

首版不引入 `batchId`：在“一次稳定批处理对应一次 `onChange`”的契约下，`changes` 已经提供完整的批次边界。只有未来需要将同一逻辑操作拆分为多次回调，并让审计、埋点或事务追踪跨回调关联时，才应增加由表单操作上下文生成并贯穿联动传播的 `batchId`。

### 9.2 异步联动

异步联动的旧结果被版本控制丢弃时，不应产生字段事件。只有最终成功提交到表单状态的变化才进入 `changes`。

### 9.3 回调异常

`onChange` 抛出的异常不应回滚已经完成的表单更新，也不应阻塞联动队列和校验流程。异常交由 React 应用层错误边界或统一日志机制处理。

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
- `changes` 的路径、顺序和 `action` 正确。

### 11.2 集成测试

- 用户编辑普通字段，`source` 为 `user`；
- `ref.setValue`，`source` 为 `setValue`；
- `ref.setValues` 只回调一次且不暴露中间态；
- `reset` 正确报告变化字段；
- 联动产生的派生字段标记为 `linkage`；
- 嵌套表单返回绝对路径；
- 对象数组内字段返回如 `permissions.0.actions` 的路径；
- 数组增删和移动操作携带正确的 `arrayAction`（`append`、`remove`、`moveUp`、`moveDown`）；
- 现有只接收一个参数的 `onChange` 测试全部保持通过。

## 12. 分阶段实施建议

### 阶段一：契约与兼容层

- 增加 `FieldChangeSource`、`FieldChangeAction`、`FieldChange`、`FormChangeMeta` 类型；
- 扩展 `onChange` 类型但保持第一参数不变；
- 明确绝对路径、存储域值和稳定批处理边界；首版不生成无实际消费方的 `batchId`。

### 阶段二：变更采集与聚合

- 在统一 watch 层记录字段前后值；
- 为 ref API、reset 和联动操作标记来源；
- 复用 batch 生命周期聚合 `setValues` 和联动级联。

### 阶段三：测试、文档与迁移

- 补充上述单元和集成测试；
- 更新 README、API 文档和示例；
- 增加一个展示字段名、前后值和来源的调试示例，但不依赖生产日志。

## 13. 验收标准

- 现有 `onChange(data)` 消费者行为不变；
- 新消费者可通过 `meta.changes` 精确识别字段、前值、后值和来源；
- 批量赋值不产生中间态回调；
- 嵌套对象、数组和嵌套 DynamicForm 的路径稳定且可定位；
- transform、联动和异步竞态不会泄露内部值或过期事件；
- 类型检查、现有 DynamicForm 测试及新增事件测试通过。

## 14. 结论

DynamicForm 应将现有完整快照回调扩展为“完整快照 + 可选变更元数据”，而不是替换为破坏性事件对象或立即引入第二套字段回调。以 `changes`、前后值、来源和稳定批处理边界为核心的首版契约，能够覆盖当前用户交互、ref API、批量赋值、重置、联动和嵌套数组场景；未来若出现跨回调追踪需求，再独立增加 `batchId`。
