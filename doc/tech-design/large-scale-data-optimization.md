# 大规模数据性能优化专题

> **状态：方案草案，尚未实施。** 本文中的性能预算是候选目标，不是当前性能保证。所有优化必须先建立可复现基准，并通过正确性测试后才能启用。

## 文档信息

- **版本**：1.1
- **创建日期**：2026-08-10
- **最后更新**：2026-08-11
- **作者**：Dynamic Form Team
- **适用场景**：数组字段包含数百至数万个元素，且数据转换、验证或整体写入已经被性能分析确认是瓶颈

---

## 1. 概述

### 1.1 背景

虚拟滚动和 `React.memo` 只能减少渲染成本。对于 3000 项以上的数组，以下数据操作仍可能占用主线程：

- `onChange` 对完整表单执行基本类型数组解包和字段转换；
- resolver 对完整数据执行 Schema 验证和自定义验证；
- `setValues`、`reset` 对外部数据执行反向转换、数组包装和 React Hook Form 写入；
- 数组插入、删除、排序导致索引路径和缓存失效。

是否需要优化不能只按数组长度判断。Schema 深度、每项字段数、转换函数复杂度、验证依赖关系和设备性能都会影响结果。

### 1.2 核心结论

1. **先测量，再优化**：本文不沿用缺少测试环境和原始报告的固定耗时、内存及提升百分比。
2. **正确性优先**：`onChange` 必须返回完整且一致的存储域快照；提交必须执行全量验证。
3. **Structural Sharing 是分配优化**：如果仍需遍历整棵数据树，时间复杂度仍为 O(n)，不能宣称无变化场景是 O(1)。
4. **增量处理必须利用变更路径**：再次扫描完整数据来寻找变化不属于真正的增量处理。
5. **Worker 只处理纯且可序列化的任务**：禁止通过 `fn.toString()` 和 `new Function()` 把运行时回调发送到 Worker。
6. **不使用对象池复用表单数据对象**：对象池会破坏引用稳定性，并可能引入对象释放后继续使用的问题。

### 1.3 优化目标

优化目标按优先级排序：

1. 保持现有表单数据、转换、验证和联动语义；
2. 避免输入期间出现超过 50ms 的连续主线程长任务；
3. 减少完整数据遍历次数和中间对象分配；
4. 控制大数组操作的峰值内存；
5. 在基准设备上建立并持续检查 p50、p95 性能预算。

### 1.4 非目标

- 不在本专题中重新设计数组虚拟滚动；相关内容见 `performance.md`。
- 不承诺仅凭数组长度自动选择最优策略。
- 不缓存依赖关系不明确的自定义验证结果。
- 不为了减少 GC 而复用可能被 React Hook Form 或外部调用方持有的数据对象。

---

## 2. 当前实现与问题边界

### 2.1 `onChange` 数据转换

当前 `DynamicForm.tsx` 订阅完整表单：

```typescript
React.useEffect(() => {
  if (!onChange) {
    return;
  }

  const subscription = watch((data) => {
    const processedData = transformFormData(data, schema);
    onChange(
      applyFieldTransforms(
        processedData,
        schema,
        callbacksRef.current,
        mergedHelpers,
      ),
    );
  });

  return () => subscription.unsubscribe();
}, [watch, onChange, schema, mergedHelpers]);
```

一次字段变化可能触发：

1. `unwrapPrimitiveArrays` 遍历 Schema 对应的数据；
2. `applyFieldTransforms` 再次遍历数据；
3. 两个步骤分别创建对象和数组。

对于未配置数组整体 transform 的对象数组，这两个步骤通常都是 O(n)。如果数组项包含多个字段，实际工作量更接近 O(n × f)，其中 `f` 是每项参与转换的字段数。数组字段自身配置整体 transform 时，`applyFieldTransforms` 的复杂度取决于该回调实现。

此外，React Hook Form 自身可能为 `watch` 通知构造完整值快照。即使应用层只读取变更字段名，上游仍可能存在 O(n) 的复制成本。因此，增量转换只能减少 DynamicForm 自身的重复工作，不能预先保证端到端复杂度降为 O(路径深度)；基准必须把 React Hook Form 通知成本单独列出。

### 2.2 验证

当前 resolver 每次执行时会：

1. 根据最新联动状态生成有效 Schema；
2. 创建 `SchemaValidator` 并执行全量 Schema 验证；
3. 执行 `runAllFieldValidators`；
4. 过滤隐藏或禁用字段的错误；
5. 把扁平错误路径转换成 React Hook Form 错误结构。

验证主流程通常可描述为 O(n × r + e × d)：

- `n`：参与验证的字段数；
- `r`：每个字段平均规则数；
- `e`：错误数；
- `d`：错误字段的平均路径深度。

当 `r` 和 `d` 有界时，整体更接近线性复杂度，不能仅因为存在嵌套循环就笼统标记为 O(n²)。条件 Schema 可能多次验证同一数据分支，需要通过 profile 单独识别。

### 2.3 `setValues` 和 `reset`

当前 `setValuesRecursive` 只递归普通对象，明确跳过数组：

```typescript
if (value !== null && typeof value === "object" && !Array.isArray(value)) {
  setValuesRecursive(methods, value, options, path);
}
```

因此对于：

```typescript
{
  rows: [
    { name: 'A', age: 20 },
    { name: 'B', age: 30 },
  ],
}
```

显式调用是 `setValue('rows', rows)`，不会由 `setValuesRecursive` 展开为 `rows.0.name`、`rows.0.age` 等路径。即使数组嵌套在普通对象中，递归也会在数组边界停止。

这不代表整体数组写入没有成本。`wrapPrimitiveArrays`、反向字段转换、React Hook Form 内部通知和数组字段重新渲染仍可能耗时，但必须分别测量。不能用“3000 项 × 5 字段 = 15000 次显式 `setValue`”解释当前实现。

### 2.4 已知的测量缺口

当前仓库没有能够支撑以下结论的统一基准报告：

- 3000 项时固定需要 500ms、2s 或其他绝对时间；
- Structural Sharing 固定减少 80% 以上内存；
- `unstable_batchedUpdates` 固定减少 50% 以上写入时间；
- Worker 可以把主线程成本降为 0ms。

这些数字只能作为历史观察或候选目标，不能作为设计依据或对外保证。

---

## 3. 整体架构

### 3.1 数据流

```text
字段输入
  │
  ├─ watch 变更事件（name/type）
  │    └─ 增量更新存储域快照
  │         └─ onChange（保持完整快照语义）
  │
  ├─ 交互验证
  │    └─ 变更字段 + 可证明的依赖字段
  │
  └─ 提交
       ├─ 对展示域数据执行全量 Schema 验证
       ├─ 对展示域数据执行全量自定义验证
       ├─ 全量转换为存储域数据
       └─ onSubmit

外部写入
  ├─ setValues：顶层 patch；传入的对象分支按当前行为整体替换
  └─ reset：替换完整表单快照
       └─ 反向转换 + 数组包装 + 经过测量的 RHF 写入策略

可选 Worker
  └─ 只接收纯、可序列化的完整任务
```

### 3.2 核心模块

建议将优化拆成以下独立模块：

| 模块                        | 职责                           | 不负责                     |
| --------------------------- | ------------------------------ | -------------------------- |
| `schemaTransformPlan`       | 预编译 Schema 路径和转换元数据 | 保存表单值                 |
| `fullDataTransform`         | 一次遍历完成完整快照转换       | 判断哪些字段变化           |
| `incrementalDataSnapshot`   | 根据变更路径更新存储域快照     | 全量验证                   |
| `validationDependencyGraph` | 计算字段及其依赖字段           | 猜测动态回调依赖           |
| `performanceBenchmark`      | 生成可复现的性能报告           | 在生产环境持续保存全部样本 |
| 可选 Worker client          | 任务版本、取消、错误与降级     | 动态反序列化函数           |

模块之间使用明确输入输出，不共享可变的数据对象。

### 3.3 正确性边界

- `onChange` 对外继续返回完整存储域数据，而不是局部 patch。
- 默认不改变 `onChange` 调用时机；防抖或节流只能作为显式配置加入。
- `getValues`、`onChange` 和 `onSubmit` 的字段转换结果必须一致。
- `setValue`、`setValues` 和 `reset` 必须继续接受存储域数据。
- `setValues` 继续保持顶层 patch 语义：未传入的顶层字段保留，传入的对象分支按当前行为整体替换并递归同步 Controller。
- Schema 约束和现有自定义验证继续作用于展示域数据；验证通过后才转换为提交所需的存储域数据。
- 提交不能复用可能不完整的交互验证缓存。
- Schema、callbacks、helpers 或 linkage schema 变化时，相关转换和验证缓存必须失效。
- 在启用 Structural Sharing 前，必须明确 `onChange` 数据的所有权：优先把回调参数定义为只读快照；若必须兼容外部原地修改，则需要防御性复制并把复制成本纳入基准。

---

## 4. 数据转换优化

### 4.1 预编译 Schema 转换计划

当前每次转换都会重复检查 Schema 类型、数组模式和字段 transform 配置。可以在 `schema` 或 callbacks 版本变化时生成只读计划：

```typescript
interface TransformPlanNode {
  kind: "object" | "array" | "primitive";
  children?: ReadonlyMap<string, TransformPlanNode>;
  item?: TransformPlanNode;
  unwrapPrimitiveArray: boolean;
  transformCallbackName?: string;
}
```

转换计划只缓存结构信息，不缓存表单值。对于内联脚本或 callbacks 注册表，计划保存标识和解析结果版本；callbacks 变化时重新生成。

收益需要通过基准确认，但它至少能够避免每次输入重复解析稳定的 Schema 结构。

### 4.2 合并完整转换遍历

提交、初始化回退以及无法安全增量处理的操作仍需要全量转换。此时可以将数组解包和字段 transform 合并为一次遍历，而不是先执行 `unwrapPrimitiveArrays`，再执行 `applyFieldTransforms`。

合并后必须保持现有执行语义：先完成子节点数组解包，再执行当前字段 transform；当前字段存在整体 transform 时，不再递归执行其子字段 transform。该后序执行顺序需要写入契约测试，不能只依赖最终性能测试发现差异。

Structural Sharing 可用于减少中间对象：

- 子节点转换结果与输入引用相同时，父节点保留输入引用；
- 只有变化路径创建新对象或数组；
- 基本类型数组需要解包时仍然必须扫描数组；
- 对象数组没有变更路径信息时仍然必须扫描所有元素。

因此，本方案降低的是分配次数和常数开销，完整遍历的复杂度仍为 O(n)，不能标记为 O(1)。

### 4.3 基于变更路径的增量快照

React Hook Form 的 `watch` 回调会提供字段名称。增量处理应直接使用该名称，而不是调用 `detectChangedFields` 再扫描完整表单。

建议维护两个版本化快照：

```typescript
interface DataSnapshotState {
  displaySnapshot: Record<string, unknown>;
  storageSnapshot: Record<string, unknown>;
  schemaVersion: number;
  formVersion: number;
}
```

初始化时必须从完整展示域数据生成一次完整 `storageSnapshot`。之后的处理流程是：

1. 从 `watch` 事件取得展示域路径 `name`；
2. 使用转换计划把展示域路径映射到存储域路径，并找到最近的安全重算祖先；
3. 从 React Hook Form 读取该祖先分支的最新展示域值；
4. 完整转换该分支；
5. 使用 immutable path update 更新 `displaySnapshot` 和 `storageSnapshot`；
6. 把完整 `storageSnapshot` 传给 `onChange`。

“最近的安全重算祖先”至少覆盖以下映射差异：

- 基本类型数组在展示域中可能是 `tags.0.value`，存储域中是 `tags.0`，因此需要从数组元素或数组分支重算；
- `address` 或数组自身配置整体 transform 时，修改其后代字段必须从该祖先 transform 边界重算；
- 转换会增删字段或改变数据形状时，必须从能够重新生成完整输出结构的祖先重算。

无法证明叶子更新与全量转换等价时，应重建对应对象/数组分支；仍无法证明时回退全量转换。

不可原地修改 `getValues()` 返回对象或之前交付给外部调用方的对象。字段删除和写入 `undefined` 必须使用不同的路径操作，避免内部快照残留已经卸载的字段。

`defaultValues` 和 `reset` 用完整表单重建快照。`setValues` 是顶层 patch，且传入的对象分支可能整体替换旧分支：写入完成后必须从 React Hook Form 读取完整展示域数据，不能把 `setValues` 参数直接当成完整表单，也不能假设它与内部快照递归深合并。

### 4.4 必须回退全量转换的情况

以下操作不能简单视为单个叶子字段变化：

- 数组插入、删除、移动或整体替换；
- `reset`，以及无法安全合并的 `setValues` patch；
- Schema、callbacks、helpers 或 linkage schema 版本变化；
- `watch` 事件没有字段名称；
- 变更路径无法映射到有效 Schema；
- 存在跨字段、非确定性或依赖未版本化 helpers 的转换回调。

数组结构变化时至少重建对应数组分支。实现初期可以安全地回退到全量转换，待基准证明该分支仍是瓶颈后再做数组级增量优化。

当前 transform API 没有依赖声明，并允许访问任意 helpers。第一版增量方案只能把已知为纯函数、只依赖当前值的 transform 纳入局部重算；其他现有自定义 transform 应保守地重建相关分支或执行全量转换。未来若增加依赖声明，应把依赖值和 helpers 版本纳入快照失效条件。

### 4.5 防抖策略

防抖会改变公开行为，不应默认加入现有 `onChange`：

- 启用时必须记录最后一次待发送快照；
- 提交前必须 flush；
- 组件卸载和 Schema 切换时必须 cancel；
- 不能让旧定时任务发送新快照之前的结果；
- 延迟时间必须由调用方显式配置。

更适合高频远程同步的长期方案，是新增局部事件 API，而不是让完整快照 `onChange` 无条件防抖。

---

## 5. 数据验证优化

### 5.1 验证器与静态结构缓存

优先缓存不会受字段值影响的内容：

- `SchemaValidator` 或编译后的验证计划；
- 字段路径到 Schema 的映射；
- 静态 required、类型和约束规则；
- 静态 hidden/disabled 路径；
- 字段依赖图。

动态 linkage schema 变化时必须生成新版本并使旧缓存失效。不能仅以根 Schema 对象作为 WeakMap 键，而忽略有效 Schema 的变化。

### 5.2 交互增量验证

React Hook Form resolver 的字段列表来自第三个参数 `options.names`：

```typescript
const incrementalResolver: Resolver = async (values, _context, options) => {
  const changedFields = new Set(options.names ?? []);
  // options.names 只表示本次请求的字段范围，不表示当前是否正在提交
};
```

`options.names` 不能可靠区分交互验证与提交验证：提交时它可能包含全部已注册字段，单字段表单中还可能与交互验证完全相同。必须由 DynamicForm 维护显式验证阶段，例如通过 resolver context 中的版本化 ref 传递 `interactive` 或 `submit`。表单提交包装器在调用 `handleSubmit` 前设置 `submit`，并在完成后恢复；不能根据字段数量猜测阶段。

跨字段错误还有一层 React Hook Form 状态边界：本次只请求字段 A 时，即使 resolver 额外返回字段 B 的错误，B 的 `formState.errors` 也不一定会更新或清除。建议增加验证协调器：

1. 根据字段 A 计算完整依赖闭包；
2. 在 resolver 外调用 `trigger([...affectedFields])`，确保所有受影响字段进入本次验证请求；
3. resolver 更新一份完整错误快照：闭包内错误重新计算，闭包外错误沿用；
4. resolver 返回更新后的完整错误快照，保证 React Hook Form 用整个 `errors` 计算 `isValid` 时不会丢失闭包外错误；
5. 对已经通过的受影响字段从完整快照中删除旧错误；
6. 防止协调器触发新的重复验证循环。

也可以使用 React Hook Form 字段依赖能力，但必须用集成测试证明依赖错误能够新增和清除。仅在 resolver 内扩大计算范围不算完成增量验证。如果无法可靠维护完整错误快照，或者错误缓存版本无法与当前 effective schema 对齐，则在订阅 `isValid` 的模式下保守执行全量验证。

当前 `SchemaValidator` 只有公开的全量 `validate()`。实施增量验证前，需要先设计并测试字段级公共 API，不能直接调用不存在的 `validateField()`。

字段级 API 必须接收完整表单值，因为条件规则可能依赖其他字段。建议使用对象参数：

```typescript
interface ValidateFieldsParams {
  values: Record<string, unknown>;
  fields: ReadonlySet<string>;
  effectiveSchema: ExtendedJSONSchema;
  validationVersion: number;
}
```

同步和异步 validator 都必须携带 `validationVersion`。结果返回时只接受最新版本，避免较旧的异步验证覆盖新输入。

### 5.3 依赖图

依赖图至少需要覆盖：

- `dependencies`；
- `if/then/else` 的条件字段和结果字段；
- `allOf`、`anyOf`、`oneOf`；
- 嵌套对象和数组项；
- 自定义 validator 显式声明的依赖字段。

自定义 validator 当前可以读取整个 `formValues`。如果没有新增依赖声明，就必须保守地把它视为依赖所有字段，不能缓存单字段结果。

数组插入、删除和移动会改变索引路径。对应数组分支的验证错误和字段结果必须失效，不能继续复用旧索引缓存。

对于 `oneOf`、`anyOf` 等可能生成全局错误的组合 Schema，需要定义全局错误归属、依赖闭包和旧错误清理方式。无法静态证明依赖集合完整时，验证整个相关对象或数组分支；仍无法证明时执行全量验证。

### 5.4 提交全量验证

交互验证用于降低输入延迟，不能替代提交验证。提交包装器必须先把显式验证阶段切换为 `submit`；resolver 在该阶段忽略增量缓存并执行：

1. 最新有效 Schema 的完整验证；
2. 所有适用的自定义 validators；
3. 最新 hidden/disabled 状态过滤；
4. 完整错误路径构建。

只有全量验证通过后，才能把展示域数据完整转换为存储域数据并调用 `onSubmit`。

### 5.5 不采用通用字段结果 LRU

不使用以下缓存键：

```typescript
`${field}:${JSON.stringify(value)}`;
```

该键没有包含依赖字段、有效 Schema、callbacks、helpers 和数组结构版本；`JSON.stringify` 对大对象也会增加 CPU 和内存开销。只有规则为纯函数且依赖集合明确时，才能引入带版本信息的定向缓存。

---

## 6. 数据写入优化

### 6.1 区分整体快照和局部写入

- `setValue(name, value)`：继续用于局部字段更新。
- `setValues(values)`：语义是顶层 patch；未传入的顶层字段保留，但传入的对象分支会先执行父路径 `setValue`，因此该分支中未传入的旧子字段可能被清除。应比较顶层 `setValue` 和现有递归策略，不能直接替换为会清除所有未传入顶层字段的 `reset`。
- `reset(values)`：适合完整替换，但必须验证 dirty、touched、errors 和已注册嵌套 Controller 的兼容性。

不能仅根据显式 `setValue` 数量选择策略。需要测量 React Hook Form 内部通知、字段数组更新和实际渲染次数。

### 6.2 `setValuesRecursive` 的正确分析

现有函数：

- 会递归普通嵌套对象；
- 会同时设置父对象路径和子字段路径；
- 不会递归数组；
- 不会显式逐项写入数组元素对象。

如果普通对象层级较深，仍可能产生多次 `setValue`。`NestedFormWidget` 本身不注册父对象 Controller，但其叶子字段拥有各自的 Controller；优化前仍需确认哪些结构路径和叶子路径必须同时设置，不能破坏已挂载叶子字段的同步行为。

递归 `setValue` 还可能触发多次 `watch` 通知。默认方案必须保持当前可观察的 `onChange` 时序；如果希望把一次 `setValues` 合并成一次通知，需要先定义为新的显式行为并补充兼容性测试。无论是否合并通知，内部增量快照都必须以写入完成后的完整表单为最终基线。

### 6.3 React 批处理的边界

React 18 已支持自动批处理。`unstable_batchedUpdates` 可能减少部分渲染，但不能消除 React Hook Form 内部每次 `setValue` 的状态计算和订阅通知。

因此：

- 不把 `unstable_batchedUpdates` 作为默认解决方案；
- 不预先承诺“n 次渲染降为 1 次”；
- 只有 React Profiler 和 React Hook Form 调用测量显示有效时才引入；
- 引入后仍需测试同步、异步和事件回调中的行为。

### 6.4 不使用对象池

表单值可能被以下对象持有：

- React Hook Form 内部状态；
- React 组件 props 和 memo 缓存；
- `onChange`、`getValues` 的外部调用方；
- 增量快照和验证缓存。

将对象清空后归还对象池会修改已有引用，并可能让后续数据复用同一对象身份。该方案与不可变更新及 Structural Sharing 冲突，因此从实施方案中删除。

---

## 7. 分片与调度

### 7.1 适用场景

分片适用于必须在主线程执行、允许异步完成且无法增量化的完整任务，例如显式导入超大数据后的预处理。

分片可以缩短单个任务片段，改善页面响应性，但不会降低总计算复杂度；因为调度开销，总完成时间还可能增加。

### 7.2 调度要求

- 优先使用 `scheduler.yield()`，不可用时降级到 `setTimeout(0)`；
- `requestIdleCallback` 必须设置超时或提供后备路径，避免繁忙页面长期饥饿；
- 每个片段处理后检查 `AbortSignal`；
- 片段大小由耗时预算动态校准，不按固定元素数量假设每项成本相同；
- 取消后不得交付部分结果作为完整表单快照。

### 7.3 与 Worker 的关系

分片和 Worker 解决不同问题：

- 分片让主线程主动让出执行权；
- Worker 把纯计算移出主线程，但增加数据复制和通信成本。

不能仅因为数组超过 3000 项就同时启用两者。应根据 profile 选择成本更低的方案。

---

## 8. Web Worker 可选方案

### 8.1 启用门槛

只有满足以下条件才考虑 Worker：

1. profile 证明纯计算而不是渲染、RHF 通知或自定义回调是主要瓶颈；
2. 单次任务足够大，收益能够覆盖 structured clone 和通信成本；
3. 输入、Schema 和输出均可序列化；
4. Worker 结果能够与主线程实现执行同一组契约测试。

数组长度阈值必须通过目标设备基准确定，不能固定写成 100 或 3000。

### 8.2 安全边界

禁止：

- `fn.toString()`；
- `new Function()` 反序列化 callbacks；
- 向 Worker 发送包含函数的 helpers；
- 在 Worker 内运行未受信任的动态代码。

允许的转换必须是：

- Worker bundle 中预先实现的内置操作；或
- 由稳定操作 ID 引用的纯函数；或
- 不包含运行时函数的 Schema 基础转换。

现有自定义 transform、validators 和 helpers 如果依赖运行时函数，应继续在主线程执行，除非未来设计专用隔离协议。

### 8.3 任务协议

```typescript
interface WorkerRunRequest<TPayload> {
  kind: "run";
  taskId: string;
  formVersion: number;
  schemaVersion: number;
  operation: "full-transform" | "base-validation";
  payload: TPayload;
}

interface WorkerCancelRequest {
  kind: "cancel";
  taskId: string;
}

type WorkerRequest<TPayload> = WorkerRunRequest<TPayload> | WorkerCancelRequest;

interface WorkerSuccess<TResult> {
  taskId: string;
  formVersion: number;
  schemaVersion: number;
  ok: true;
  result: TResult;
}

interface WorkerFailure {
  taskId: string;
  formVersion: number;
  schemaVersion: number;
  ok: false;
  error: string;
}

type WorkerResult<TResult> = WorkerSuccess<TResult> | WorkerFailure;
```

客户端必须：

- 使用 latest-wins 或显式队列策略；
- 忽略旧 `formVersion`、`schemaVersion` 的返回结果；
- 通过 cancel 消息请求协作式取消，并始终忽略已取消任务的迟到结果；如果任务无法协作式中止，可终止并重建专用 Worker；
- 取消、超时或组件卸载时，以明确的取消错误 reject pending Promise；
- 在 `onerror`、`onmessageerror` 和 Worker 终止时 reject pending Promise；
- 保证降级实现与 Worker 实现语义一致；
- 尽量在一次往返中完成同一纯任务，避免重复复制完整数据。

### 8.4 转换 Worker

转换 Worker 初期只处理基本类型数组解包等纯转换。自定义字段 transform 留在主线程，并在 Worker 返回后执行。

如果主线程自定义 transform 仍需扫描全部数据，Worker 可能无法产生净收益。此时应优先实施增量快照，而不是继续拆分更多 Worker 阶段。

### 8.5 验证 Worker

验证 Worker 的 `base-validation` 表示：使用最新版本的 effective schema，执行完整的内置 `SchemaValidator` 验证，而不是只检查类型或静态规则。发送前应把 effective schema 投影为可序列化的验证 Schema，剥离函数和与验证无关的 UI 元数据。

主线程仍需处理：

- 动态 linkage schema 的版本管理；
- callbacks/helpers 驱动的自定义验证；
- hidden/disabled 错误过滤；
- React Hook Form 错误结构转换。

Worker 方案必须与现有 resolver 的完整验证结果做差分测试，不能用只调用 `SchemaValidator.validate()` 的实现直接替换当前 resolver。

### 8.6 主线程成本

`postMessage` 的 structured clone、接收结果和状态交付仍会消耗主线程时间。Worker 的目标是减少连续长任务，而不是把主线程成本宣称为 0ms。

---

## 9. 性能基准与监控

### 9.1 基准数据集

至少覆盖：

| 维度      | 场景                                                |
| --------- | --------------------------------------------------- |
| 数组规模  | 100、500、1000、3000、10000 项                      |
| 数组类型  | 基本类型数组、对象数组、嵌套数组                    |
| 对象宽度  | 每项 1、5、20 个字段                                |
| Schema    | 无条件规则、dependencies、if/then/else、组合 Schema |
| Transform | 无 transform、内置纯 transform、自定义 callback     |
| 设备      | 团队基准设备和至少一台低性能设备                    |

### 9.2 测试操作

- 修改数组第一项、中间项和最后一项；
- 连续输入 20 个字符；
- 添加、删除、移动和整体替换数组；
- 调用 `setValue`、`setValues` 和 `reset`；
- 执行交互验证和提交验证；
- 连续触发多个异步任务，验证旧结果不会覆盖新结果。

### 9.3 指标

- 输入事件到 `onChange` 完成的 p50、p95；
- 单个主线程任务持续时间和 Long Task 数量；
- 全量转换、交互验证、提交验证、整体写入的总时间；
- React commit 次数和 commit 时间；
- JS heap 峰值及操作后的稳定值；
- Worker 发送、计算、接收三个阶段的独立耗时；
- 正确性差分结果。

### 9.4 候选性能预算

在基准报告建立前，仅使用以下候选预算：

- 普通字段输入不产生超过 50ms 的连续主线程任务；
- 3000 项目标场景中，输入到 `onChange` 完成的 p95 争取低于 100ms；
- 3000 项目标场景中，全量提交验证争取低于 500ms；
- 优化后小数据场景不得出现统计显著的性能退化；
- 任何性能优化都必须保持转换和验证结果完全一致。

预算应在确定设备、浏览器和 Schema 后校准，并在文档中附上原始报告链接。

### 9.5 监控实现要求

- 开发环境使用 `performance.mark` 和 `performance.measure`；
- 固定大小的环形缓冲区保存样本，避免监控自身无限占用内存；
- 在支持 Long Task entry type 时使用 `PerformanceObserver` 采集；不支持时记录能力缺失，不能把“没有采集结果”解释为没有长任务；
- 对 `scheduler.yield()`、`requestIdleCallback` 和性能 API 做特性检测，并在基准报告中注明实际采用的降级路径；
- 禁止提交临时 `console.log`、`console.info` 调试代码；
- 生产采样必须脱敏，不能记录实际表单值。

---

## 10. 实现计划

### 阶段 0：建立基线与选择路径

1. 为转换、验证和整体写入建立正确性测试。
2. 创建 100 至 10000 项的可复现基准数据。
3. 记录当前 p50、p95、Long Task、React commit 和 heap 数据。
4. 分离记录 DynamicForm 转换、React Hook Form 通知、验证、写入和渲染成本。
5. 根据 profile 确认首要瓶颈，并选择下面的一条优化路径。

**完成条件**：基准可重复运行，且已经定位到具体函数或调用链。阶段 0 之后不固定进入转换优化；如果首要瓶颈是验证或写入，应直接进入对应路径。

### 路径 A：转换与 `onChange`

**进入条件**：profile 证明数组解包、字段 transform 或完整 `onChange` 快照构建是主要瓶颈。

1. 预编译 Schema 转换计划。
2. 合并全量数组解包和字段 transform 遍历。
3. 使用 Structural Sharing 减少中间分配。
4. 如果全量转换仍是瓶颈，再使用 `watch` 路径和安全重算祖先维护版本化快照。
5. 为数组结构操作、setValues patch 和 reset 实现失效或全量回退。

**正确性验收**：增量结果、`getValues` 和提交转换与旧全量实现逐项一致；覆盖 transform 截断、路径形状变化和外部快照所有权。

**性能验收**：目标数据集所有适用的 p95 和 Long Task 预算均通过，小数据没有统计显著退化。

**回滚条件**：任一转换结果不一致、公开回调时序意外变化，或净收益不足。完成后重新 profile，再决定是否进入其他路径。

### 路径 B：验证

**进入条件**：profile 证明 Schema 验证、自定义验证或错误状态同步是主要瓶颈。

1. 缓存编译后的静态验证结构。
2. 建立完整依赖图。
3. 为 `SchemaValidator` 增加经过测试的字段级 API。
4. 增加显式验证阶段和依赖字段协调器。
5. 对不可静态分析的规则执行分支或全量回退。
6. 保留提交全量验证并做结果差分测试。

**正确性验收**：依赖字段错误能够新增和清除；组合 Schema、异步竞态、数组索引变化和提交全量验证全部通过。

**性能验收**：交互验证达到校准后的预算；如果阶段 0 定位到提交验证瓶颈，提交验证也必须获得可复现改善并达到对应预算；两条路径都不能出现正确性或小数据回归。

**回滚条件**：出现漏报、过期错误、异步旧结果覆盖或净收益不足。完成后重新 profile，再决定是否进入其他路径。

### 路径 C：整体写入

**进入条件**：profile 证明反向转换、数组包装、RHF 写入通知或相关渲染是主要瓶颈。

1. 分别测量 `setValues` patch 和 `reset` 完整替换。
2. 比较顶层 `setValue`、现有递归策略和仅适用于完整替换的 `reset`。
3. 验证 NestedForm Controller、dirty、touched、errors、watch 通知和 linkage 行为。
4. 只实施基准确认有效且行为兼容的策略。

**正确性验收**：未传入 `setValues` 的顶层字段保留；传入对象分支维持当前整体替换语义；reset 状态语义不变，嵌套 Controller 和联动结果一致。

**性能验收**：目标写入操作达到校准后的预算，React commit 和 RHF 通知成本有可复现下降。

**回滚条件**：状态语义、通知时序或嵌套字段同步变化，或净收益不足。完成后重新 profile，再决定是否进入其他路径。

### 路径 D：可选调度或 Worker

**进入条件**：完成所有经 profile 判定适用的 A 至 C 路径后，仍存在纯、可序列化且超过主线程预算的计算任务。

1. 根据 profile 选择主线程分片或 Worker。
2. 定义可序列化任务协议和版本控制。
3. 实现取消、错误、超时和等价降级。
4. 对比通信成本与净收益。
5. 通过正确性差分和性能预算后再启用。

**正确性验收**：Worker、主线程和降级实现输出一致，取消、超时、错误和版本竞态测试通过。

**性能验收**：包含发送和接收成本后的端到端结果优于主线程方案，并减少 Long Task。

**回滚条件**：通信成本抵消收益、峰值内存恶化、兼容性不足或出现异步错误。完成后重新 profile。

---

## 11. 测试策略

### 11.1 转换正确性

- 基本类型数组的包装和解包；
- 对象数组和嵌套数组；
- static/dynamic 数组模式；
- 字段 transform 与 reverse transform；
- 子 transform 后序执行和祖先整体 transform 截断；
- 展示域路径到存储域路径映射；
- 单字段增量结果与全量转换结果一致；
- 数组插入、删除、移动后的完整快照；
- defaultValues、顶层 setValues patch 和 reset 后的快照初始化或重建；
- setValues 对象分支整体替换且未传入顶层字段保留；
- 字段删除与写入 `undefined`；
- Schema 和 callback 版本变化后的缓存失效。

### 11.2 验证正确性

- required 和字段约束；
- dependencies；
- if/then/else；
- allOf、anyOf、oneOf；
- 自定义同步和异步 validators；
- hidden/disabled 字段；
- 动态 linkage schema；
- 数组索引变化后的错误清理；
- 依赖字段错误通过 RHF 状态新增和清除；
- 闭包外旧错误保留，`formState.isValid` 与完整错误快照一致；
- 单字段表单能够明确区分交互和提交阶段；
- 组合 Schema 的全局错误归属和保守回退；
- 交互增量验证与提交全量验证的差分。

### 11.3 异步与竞态

- 快速连续输入时只交付最新版本；
- 较旧的异步 validator 结果不会覆盖新输入；
- reset 后旧任务不能覆盖新值；
- Schema 更新后旧 Worker 结果被丢弃；
- 组件卸载后 pending 任务被清理；
- Worker 初始化失败、运行错误和消息反序列化失败时执行等价降级。
- cancel、超时和终止会 reject 并清理 pending Promise。

### 11.4 性能回归

- 基准报告保存运行环境、提交号和原始样本；
- 同一环境比较优化前后 p50、p95，而不是只比较单次最快结果；
- 单独报告 React Hook Form 创建 watch payload 的复制成本；
- 对小、中、大数据分别设置回归阈值；
- 性能测试不得用降低验证完整性或延迟公开回调来换取表面提升。

---

## 12. 最佳实践与决策记录

### 12.1 推荐

- 使用变更路径驱动增量计算；
- 优先缓存 Schema 结构，而不是缓存任意字段结果；
- 在完整提交路径保留全量正确性检查；
- 用版本号处理异步竞态；
- 用基准数据决定阈值和方案；
- 让所有优化都具备明确回退路径。

### 12.2 不推荐

| 方案                               | 决策       | 原因                                 |
| ---------------------------------- | ---------- | ------------------------------------ |
| 每次全量扫描后判断变化             | 不采用     | 仍是 O(n)，不是真正增量处理          |
| 通用字段值 LRU                     | 默认不采用 | 依赖和版本信息不足，容易返回过期结果 |
| 对象池复用表单数据                 | 不采用     | 破坏引用稳定性和不可变数据语义       |
| `fn.toString()` + `new Function()` | 不采用     | 闭包不可靠、CSP 和安全风险           |
| 默认防抖 `onChange`                | 不采用     | 改变公开 API 的时序语义              |
| 仅按数组长度启用 Worker            | 不采用     | 无法反映任务复杂度和通信成本         |
| 交互增量验证替代提交全量验证       | 不采用     | 可能遗漏依赖规则和过期错误           |

### 12.3 编码规范

- 超过两个参数的函数使用对象参数；
- 新增对象类型优先使用 `interface`；
- 避免 `any`，边界数据使用 `unknown` 并配合类型守卫；
- 公共 API 添加中文 JSDoc；
- 代码注释使用中文；
- 用户可见错误信息使用英文；
- 提交前移除调试日志。

---

## 13. 与其他性能优化的关系

| 文档             | 优化重点                           | 适用范围                         |
| ---------------- | ---------------------------------- | -------------------------------- |
| `performance.md` | 渲染、虚拟滚动、联动和组件更新     | 所有表单                         |
| 本文             | 转换、验证、整体写入和可选异步计算 | 已确认存在数据层瓶颈的大规模表单 |

建议顺序：

1. 先完成渲染和联动层面的基础优化；
2. 建立数据层基准；
3. 按 profile 结果逐阶段实施本文方案；
4. 每个阶段重新测量，不默认继续实施后续阶段。

---

## 14. 总结

大规模表单优化的核心不是叠加 Structural Sharing、缓存、分片和 Worker，而是减少不必要的完整工作，同时保留清晰的正确性边界：

- Structural Sharing 减少分配，但不会自动消除 O(n) 遍历；
- 真正的增量转换必须使用 React Hook Form 提供的变更路径；
- 交互验证可以增量，提交验证必须全量；
- 当前 `setValuesRecursive` 不会逐项展开数组，写入成本需要按真实调用链测量；
- Worker 只适合纯、可序列化、足够重的任务；
- 对象池、动态函数反序列化和无依赖信息的通用结果缓存不进入实施范围；
- 所有性能数字都必须关联可复现的测试环境和原始报告。

该方案以阶段性基准和差分测试作为实施门槛，确保性能提升不会以数据错误、验证漏报或 API 行为变化为代价。

---

## 更新记录

- 2026-08-10：v1.0，初始版本。
- 2026-08-11：v1.1，根据代码审阅重写；修正复杂度和 `setValues` 分析，重构增量转换与验证方案，限制 Worker 边界，删除对象池及未经验证的性能结论。
