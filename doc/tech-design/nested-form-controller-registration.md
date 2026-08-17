# NestedForm 父子 Controller 注册冲突分析与改造方案

> **状态：已实现。** 本文记录 `nested-form` 对象容器与其子字段同时注册 React Hook Form Controller 的结构性风险、改造方案和回归测试要求。当前代码已按本文方案将 `nested-form` 改为不注册父对象 Controller 的结构 Widget。

## 1. 背景与结论

`DynamicForm` 会把 `type: 'object'` 的字段默认解析为 `nested-form` widget。当前 `FormField` 对所有字段统一渲染 `Controller`，因此对象字段 `ocr` 会注册父路径 `ocr`；`NestedFormWidget` 随后通过 `asNestedForm=true` 复用同一个 React Hook Form Context，并为内部字段注册 `ocr.model`、`ocr.language` 等子路径。

实际注册结构如下：

```text
FormField("ocr")
  └─ Controller("ocr")
       └─ NestedFormWidget
            └─ DynamicForm(asNestedForm=true, pathPrefix="ocr")
                 ├─ Controller("ocr.model")
                 └─ Controller("ocr.language")
```

这使 `ocr` 同时承担两种职责：

1. 拥有 `_f` 元数据的可控值字段；
2. `ocr.model` 等叶子字段的命名空间节点。

这种父子路径双重注册属于结构性缺陷。弹窗关闭、快速切换 Schema 和 React 18 开发模式 StrictMode 会扩大注册与清理时序的交错范围，但它们不是根因。根因是同一条路径没有唯一的值所有者。

代码审核中提到的 `Cannot read properties of undefined (reading 'mount')` 与该结构风险方向一致，但仅凭父子双注册还不能证明仓库当前锁定的 `react-hook-form@7.69.0` 必然按所描述的路径崩溃。7.69.0 的 `register()` 会为已有命名空间节点补建 `_f`，`useController` 更新 `mount` 前也有空值保护。要确认具体异常入口，仍需保留原始 stack trace，并核对生产包实际加载的 RHF 版本。

无论当前版本是否能够稳定复现该异常，都不应依赖 RHF 私有 `_fields` 结构的容错行为。推荐从字段所有权上消除冲突。

## 2. 改造前架构与数据流

### 2.1 Schema 解析

`SchemaParser.getWidget()` 将未显式配置 widget 的对象字段映射为 `nested-form`：

```typescript
if (type === 'object') {
  return 'nested-form'
}
```

对象字段仍然作为一个普通 `FieldConfig` 返回，并进入统一的 `FormField` 渲染流程。

### 2.2 父对象注册

`FormField` 当前不区分值 Widget 和结构 Widget，所有字段都会进入以下流程：

```typescript
<Controller
  name={field.name}
  control={control}
  rules={field.validation}
  render={({ field: controllerField }) => (
    <WidgetComponent {...controllerField} schema={field.schema} />
  )}
/>
```

对于 `ocr`，这一步会在 RHF 中注册父字段 `ocr`，并把 `value`、`onChange`、`onBlur` 和 `ref` 传给 `NestedFormWidget`。

### 2.3 子字段注册

`NestedFormWidget` 不使用父 Controller 传入的 `value` 和 `onChange`。它只使用 `name` 计算完整路径，然后渲染另一个 `DynamicForm`：

```typescript
<DynamicForm
  schema={schema}
  pathPrefix={fullPath}
  asNestedForm={true}
  renderAsForm={false}
/>
```

`asNestedForm=true` 时，内层 `DynamicForm` 复用父级 FormContext，并把解析出的相对字段名转换为绝对路径。例如 `model` 会变成 `ocr.model`，随后由子级 `FormField` 注册自己的 Controller。

因此父 Controller 对 `NestedFormWidget` 的值同步没有实际作用，却改变了 RHF 字段树的结构和生命周期。

### 2.4 Schema 切换与组件复用

字段渲染使用 `field.name` 作为 React key。当两个 Schema 都包含 `ocr`，但其 properties 不同时，React 会复用父 `FormField("ocr")` 和 `NestedFormWidget`，只卸载旧叶子字段并挂载新叶子字段。例如：

```text
Schema A: ocr.model
Schema B: ocr.engine
```

同时，根 `useForm` 不会仅因 `schema` prop 变化而创建新实例；未启用 `shouldUnregister` 时，卸载的 Controller 默认主要更新 mount 状态，而不是立即清除所有字段树和值。由此会出现旧子字段清理、新子字段注册和父字段复用交错的窗口。

Dialog 的退出动画或 keep-mounted 行为还可能让弹窗已被业务逻辑标记为关闭，但旧内容仍在 React 树中。React 18 StrictMode 在开发环境执行额外的 effect setup、cleanup 和 setup，使这一窗口更容易暴露。

## 3. 根因分析

### 3.1 字段路径没有唯一所有者

一个 RHF 路径应由一个值组件拥有。叶子字段模式符合这一原则：

```text
Controller("name")  → TextWidget
Controller("age")   → NumberWidget
```

当前嵌套对象模式违反了这一原则：

```text
Controller("ocr")        → 把 ocr 当成原子值
Controller("ocr.model")  → 把 ocr 当成命名空间
```

RHF 内部允许节点同时包含 `_f` 和子节点，并不意味着两个独立 Controller 可以安全地分别管理这两种角色。其正确性会依赖注册、ref 回调、effect 清理、unregister 和 setValue 的内部执行顺序。

### 3.2 父 Controller 是冗余的

`NestedFormWidget` 当前接口仍继承 `value` 和 `onChange`，但组件实现没有消费它们。嵌套数据实际由共享 FormContext 中的子 Controller 直接读写，因此父 Controller 没有提供必要的数据能力。

父对象验证同样不依赖这个 Controller。`createSchemaResolver` 接收完整 values，并使用完整 Schema 执行 `SchemaValidator` 和自定义字段验证。对象 required、properties 和对象级验证可以在 resolver 中完成。

### 3.3 递归 setValue 是双注册的补偿机制

当前 `setValuesRecursive` 会同时写入父对象路径和所有叶子路径：

```text
setValue("address", object)
setValue("address.street", value)
setValue("address.city", value)
```

现有注释明确说明，这样做是因为仅更新父 Controller 时，子 Controller 不一定收到新值。也就是说，递归写入逻辑的一部分复杂度正是由父子 Controller 并存引入的。

移除父 Controller 后，不能立刻删除递归逻辑。需要先通过契约测试验证 RHF 对结构节点写入、叶子 watch、dirty、touched、errors 和 onChange 通知的行为，再决定是否简化。

### 3.4 具体 `_f.mount` 崩溃仍需原始证据

仓库当前使用 `react-hook-form@7.69.0`。该版本的关键行为包括：

- `register(name)` 会在已有节点没有 `_f` 时创建 `_f`；
- `useController` 的 `updateMounted` 在写入 `_f.mount` 前检查 `field && field._f`；
- Controller 默认卸载时，在未启用 `shouldUnregister` 的情况下主要把 mount 标记为 false。

因此，`_fields.ocr` 暂时只有子节点这一状态本身，不足以完整解释 7.69.0 的报错。排查具体事故时应补齐：

1. 完整 stack trace 和 sourcemap 映射后的代码位置；
2. 生产包实际 RHF 版本以及是否存在重复安装；
3. Dialog 是否延迟卸载或保留内容；
4. schema 切换时 `DynamicForm` 和 FormProvider 是否仍为同一个实例；
5. 是否涉及 `useFieldArray`、显式 `unregister` 或自定义 Widget 的 ref 回调。

这不会改变结构改造结论，只影响对单次异常入口的定性。

## 4. 推荐设计

### 4.1 区分值 Widget 和结构 Widget

`FormField` 应明确区分：

| 类型        | 示例                                                    | 是否注册 Controller |
| ----------- | ------------------------------------------------------- | ------------------- |
| 值 Widget   | text、number、select、ObjectEditor、自定义原子值 Widget | 是                  |
| 结构 Widget | `nested-form`                                           | 否                  |

判断应基于最终解析后的 widget 是否为 `nested-form`，不能简单规定所有 `type: 'object'` 都不注册。显式配置的 ObjectEditor 或业务自定义对象 Widget 可能确实需要把整个对象作为一个原子值，通过 `value/onChange` 管理。

改造后的注册结构应为：

```text
NestedFormWidget("ocr")       结构容器，不注册
├─ Controller("ocr.model")    唯一所有者
└─ Controller("ocr.language") 唯一所有者
```

### 4.2 结构字段直接渲染 NestedFormWidget

`FormField` 可以抽取公共 Widget props，然后为 `nested-form` 走独立渲染分支：

```text
FormField
├─ nested-form → StructuralFormField → NestedFormWidget
└─ 其他 widget → Controller → WidgetComponent
```

建议使用单独组件承载结构字段逻辑，避免在同一组件中条件调用 Hooks，也便于分别维护 memo 比较和错误订阅。

结构字段只需要向 `NestedFormWidget` 传递：

- `name`；
- `schema`；
- `disabled`、`readonly`；
- layout、labelWidth 和虚拟滚动等展示配置；
- widgetProps 和 callbackProps 中与结构容器有关的扩展属性。

不再传递 RHF Controller 产生的 `value`、`onChange`、`onBlur` 和 `ref`。

### 4.3 父对象错误使用只读订阅

移除父 Controller 后，仍需展示对象字段自身的错误，例如对象 required 或对象级自定义验证。应使用只读表单状态订阅，而不是为了取得 `fieldState` 重新注册 Controller。

推荐在结构字段组件中使用精确路径订阅，例如 `useFormState({ control, name, exact: true })`，再从 errors 中读取父路径错误。子字段错误继续由各自的 Controller 展示。

需要区分两类错误：

- 父路径直接包含 `{ type, message }`：显示在对象容器上；
- 父路径只是子错误对象：不重复显示，由子字段分别展示。

### 4.4 保持共享 FormContext 和统一 resolver

不建议为每个 `NestedFormWidget` 创建独立 `useForm` 再手动同步对象值。现行 `asNestedForm` 共享上下文方案仍应保留，因为它保证：

- 叶子字段直接写入统一数据树；
- 根表单统一 watch、提交和 reset；
- resolver 使用完整表单快照执行跨字段验证；
- 联动系统可以使用绝对字段路径；
- 不需要父子表单之间的 value/onChange 双向同步。

本次改造只移除冗余父 Controller，不改变 FormContext、路径或 resolver 架构。

### 4.5 Schema 实例隔离是补充措施

当业务弹窗在“编辑 A 类型”和“编辑 B 类型”之间切换，且两者在业务上是完全独立的表单实例时，调用方可以使用稳定业务标识作为 React key：

```tsx
<DynamicForm key={formTypeOrRecordId} schema={schema} />
```

这能保证旧表单和新表单使用不同的 RHF control，但它只是实例隔离措施，不替代结构字段改造。

禁止使用 schema 对象引用作为 key。联动或父组件重渲染可能产生新的 schema 对象引用，导致表单无意义重建并丢失 values、dirty、touched 和 errors。

## 5. 不采用的方案

### 5.1 依赖 effect 或注册顺序

不采用提前注册父路径、改用 `useLayoutEffect`、延时挂载或强制父 Controller 先执行。这些做法仍保留父子双重所有权，只是缩小某些时序窗口。

### 5.2 直接访问或修补 RHF 私有字段

不在业务代码中读取或修改 `control._fields`、`_f.mount` 等私有结构。它们不是公开 API，版本升级时没有兼容性保证。

### 5.3 仅升级 RHF

升级 RHF 可以作为依赖维护工作，但不能替代架构修复。当前版本已经包含多处 `_f` 防御判断，仍无法消除双重字段所有权及其写值复杂度。

### 5.4 全局启用 shouldUnregister

不以全局 `shouldUnregister=true` 作为默认修复。动态 Schema 当前允许切换期间保留数据，并在提交时根据有效 Schema 过滤。全局卸载即删除会改变 values、defaultValues 和重新切换后的回显语义。

如未来需要清理已移除字段的注册元数据，应先定义数据保留契约，再评估定向 `unregister` 及 `keepValue`、`keepDefaultValue` 等选项。

## 6. 实现细节与兼容性边界

### 6.1 自定义对象 Widget

仅 `nested-form` 是结构 Widget。以下对象字段仍应保留 Controller：

```typescript
{
  type: 'object',
  ui: {
    widget: 'object-editor',
  },
}
```

这类 Widget 应明确接收整个对象的 `value` 和 `onChange`，并独占该字段路径。它不能同时在同一个 FormContext 中为该对象的子路径注册 Controller，除非设计为另一种结构 Widget。

### 6.2 对象 transform

结构型 `nested-form` 不依赖父 Controller，因此不能把 `WidgetWithTransform` 的父字段 onChange 当作转换入口。对象级 transform 应继续在 `getValues`、`onChange`、`onSubmit` 和反向写值的数据边界统一执行。

如果存在依赖实时父 Controller onChange 的对象 transform，需要在实施前补充用例并明确其契约；当前 `NestedFormWidget` 不消费父 `onChange`，因此现有父 Controller 也不能可靠提供该能力。

### 6.3 setValues 和 reset

第一阶段改造应保持 `setValues` 和 `reset` 的外部契约不变：

- `setValues` 保持顶层 patch 语义；
- 传入对象分支的整体替换行为保持不变；
- `reset(values)` 保持完整替换语义；
- `reset({})` 继续按 Schema 生成类型恰当的空值；
- 多选 Select 继续保持基本类型数组；
- `ArrayFieldWidget/useFieldArray` 的包装与解包规则不变。

在父 Controller 移除并通过回归测试后，才能单独评估是否简化 `setValuesRecursive`。该优化应作为后续独立变更，不能与注册所有权修复混在一次提交中。

### 6.4 数组字段

`ArrayFieldWidget` 同时涉及父数组字段、`useFieldArray` 和数组元素 Controller，其生命周期由 RHF 的 field-array 专用逻辑参与管理。本方案不直接改变数组字段注册方式。

但对象数组元素内部的 `NestedFormWidget` 同样应遵循“结构容器不注册、叶子字段注册”的原则。回归测试必须包含对象数组，确认没有破坏数组增删、移动、虚拟滚动和数组联动。

## 7. 测试方案

### 7.1 最小复现测试

新增真实集成测试，不 mock `NestedFormWidget` 内部的 `DynamicForm`。测试宿主应具备：

1. `React.StrictMode`；
2. 可打开和关闭的 Dialog 或等价延迟卸载容器；
3. Schema A：`ocr.model`；
4. Schema B：`ocr.engine`；
5. 在关闭、Schema 切换和重新打开之间快速调度状态更新；
6. ErrorBoundary 和 `console.error` 监控。

测试应循环切换多次，以扩大时序问题的暴露概率，但不能依靠固定 sleep 判断正确性。

### 7.2 注册所有权测试

需要验证：

- `nested-form` 不注册父路径 `ocr` 的 Controller；
- 叶子字段 `ocr.model` 正常注册和交互；
- 显式 ObjectEditor 仍注册父对象路径；
- 父对象 required 和对象级自定义验证仍能显示；
- 结构字段隐藏或卸载后不会影响其他字段。

优先采用黑盒行为断言。若为了定位注册冲突需要观察 `control.register` 调用，可以在测试适配层做 spy，但生产代码不得读取 `_fields`。

### 7.3 Schema 切换矩阵

至少覆盖以下变化：

| 初始 Schema         | 目标 Schema          | 验证重点           |
| ------------------- | -------------------- | ------------------ |
| `ocr.model`         | `ocr.engine`         | 同父路径替换子字段 |
| `ocr.model`         | 无 `ocr`             | 整个对象卸载       |
| 无 `ocr`            | `ocr.model`          | 对象重新挂载       |
| `config.ocr.model`  | `config.ocr.engine`  | 多层嵌套           |
| `items[].ocr.model` | `items[].ocr.engine` | 对象数组           |

### 7.4 API 与状态回归

每个场景应验证：

- 输入值和 `getValues()` 一致；
- `setValue`、`setValues`、`reset(values)`、`reset({})` 行为不变；
- dirty、touched、errors 和 isValid 符合原有契约；
- watch 和外部 `onChange` 没有异常重复或遗漏；
- 当前 Schema 的默认值正确应用；
- 已移除字段按现有提交过滤规则处理；
- 联动值、options、visibility、disabled 和 readonly 不受影响。

## 8. 文档同步要求

实施代码改造时，应同步更新：

1. `nested-form.md`：明确 `NestedFormWidget` 是结构容器，不接收父 Controller 的 value/onChange；
2. `overview.md`：把字段渲染描述修正为“值 Widget 注册 Controller，结构 Widget 只组织子字段”；
3. `large-scale-data-optimization.md`：更新 `setValuesRecursive` 的历史原因和后续优化边界；
4. `NestedFormWidgetProps`：移除实现不使用的 `value`、`onChange`，或从结构 Widget 类型中排除这些属性；
5. 变更历史：说明 v2.0 中“移除 Controller”实际只移除了 NestedFormWidget 内部的独立值同步，父级 `FormField` Controller 直到本次改造才真正移除。

当前文档存在以下矛盾，实施时必须消除：

- 接口示例仍包含 `value/onChange`，说明却称不需要它们；
- v2.0 变更历史称已移除 Controller，现行 `FormField` 实际仍注册父对象；
- “所有字段注册到父表单”没有区分结构对象和叶子值字段。

## 9. 实现计划

### 阶段 1：建立失败用例

1. 增加 StrictMode + Schema 快切的真实嵌套表单测试；
2. 增加注册所有权和父对象验证测试；
3. 记录当前失败行为、stack trace 和实际 RHF 版本。

### 阶段 2：移除 nested-form 父 Controller

1. 在 `FormField` 中区分结构 Widget 和值 Widget；
2. 新增结构字段渲染组件；
3. 使用只读 formState 订阅展示父对象错误；
4. 保持共享 FormContext、路径和 resolver 设计不变。

### 阶段 3：兼容性验证

1. 运行 DynamicForm、NestedFormWidget、数组和联动相关测试；
2. 验证 setValues/reset、默认值和对象 transform；
3. 在真实开发构建的 StrictMode 与业务 Dialog 中人工复核。

### 阶段 4：后续清理

1. 移除 `NestedFormWidgetProps` 中无效的值控制属性；
2. 更新相关技术文档；
3. 单独评估 `setValuesRecursive` 是否可以减少父路径与叶子路径的重复写入；
4. 如仍有异常，使用原始 stack trace 继续回溯 RHF 的实际入口，避免通过猜测修改内部时序。

## 10. 最佳实践

1. 一个 RHF 路径只允许一个值所有者。
2. 结构容器负责路径、布局和子字段组织，不伪装成原子值字段。
3. 显式对象编辑器可以拥有整个对象值，但不能再让相同 FormContext 下的子 Controller 共享该前缀。
4. Schema 快切时使用稳定字段路径；只有业务实例真正变化时才通过 React key 重建表单。
5. 不依赖 StrictMode effect 顺序保证字段注册正确性。
6. 不访问或修补 RHF 的 `_fields`、`_f` 等私有结构。
7. 修改字段注册模型后，必须同时验证值、验证状态、联动、数组和外部 ref API。

## 11. 总结

当前 `nested-form` 的主要问题不是某一个 effect 执行得早或晚，而是父对象路径和子叶子路径由多个 Controller 共同管理。父 `Controller("ocr")` 对 `NestedFormWidget` 没有提供实际值同步能力，却让 `ocr` 同时成为值字段和命名空间，增加了 Schema 切换、卸载和 StrictMode 下的生命周期风险。

推荐方案是把 `nested-form` 明确定义为结构 Widget：对象容器不注册 Controller，只有实际叶子字段注册；父对象错误通过只读状态订阅展示；共享 FormContext、统一 resolver 和标准点号路径保持不变。该方案从字段所有权源头消除冲突，同时保留现有嵌套表单的数据、验证和联动架构。
