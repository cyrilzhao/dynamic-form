# AI 文档审核页与 DynamicForm 联动设计

## 1. 背景与目标

AI 文档审核页由左侧文档预览区和右侧 DynamicForm 表单组成。AI 返回的字段除了提取值，还包含值在原文档中的位置。审核人员需要在两个区域之间快速定位和修正字段：

1. focus 右侧文本字段时，左侧高亮该字段的原始提取位置；
2. focus 某个文本字段后，在左侧框选文档区域，将选中文本回填到该字段；
3. 回填后同步更新该字段的位置元数据，保证后续再次定位使用最新位置。

本方案只增强 DynamicForm 的文本字段 focus 通知能力。文档预览、坐标计算、OCR 清洗和审核提交由页面层负责。

## 2. 非目标

- 不把文档坐标、置信度或原始提取信息放入 DynamicForm 字段值。
- 不为 select、radio、checkbox 等非文本 Widget 增加审核专用 focus 协议。
- 不通过 window、document 或自定义 DOM 事件总线传递 focus。
- 不在 TextWidget 内实现文档选择、坐标转换或文本清洗。

## 3. 组件职责

```text
DocumentReviewPage
├── DocumentPreview
│   ├── activeAnchor
│   └── onSelection
└── DynamicForm
    ├── onTextFieldFocus
    └── ref.setValue()
```

DynamicForm 只负责字段路径和值的表单语义。审核页单独维护字段和文档位置的映射：

```ts
interface DocumentAnchor {
  documentId: string;
  page: number;
  boxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  coordinateSpace: "page-normalized";
  rotation?: number;
}

interface ExtractionMetadata {
  anchor?: DocumentAnchor;
  confidence?: number;
  originalText?: string;
}

type ExtractionMetadataMap = Record<string, ExtractionMetadata>;
```

坐标必须使用稳定的文档坐标，不能保存浏览器屏幕像素。推荐使用页面归一化坐标，范围为 0~1；预览组件根据缩放、旋转和视口状态转换为屏幕坐标。一个字段允许对应多个 bounding box，以支持跨行和跨区域提取。

## 4. Focus 通知设计

采用 DynamicForm 页面级回调，由 FormField 仅对 `text` Widget 注入，TextWidget 使用标准 React `onFocus` 同步调用。

```ts
interface TextFieldFocusPayload {
  name: string;
  value: string;
  event: React.FocusEvent<HTMLInputElement>;
}

interface DynamicFormProps {
  onTextFieldFocus?: (payload: TextFieldFocusPayload) => void;
}
```

FormField 是通用编排层，不实现审核逻辑，只负责在当前字段为 `text` 时合并两类回调：

1. `schema.ui.widgetProps.onFocus`；
2. DynamicForm 的 `onTextFieldFocus`。

字段级回调先执行，页面级回调后执行。这样既保留字段自定义行为，也能让审核页统一接收完整字段路径。TextWidget 不发送异步事件、不访问全局对象，也不需要知道审核页存在。

不推荐使用 `callbackProps` 承载该能力：focus 事件对象不适合经过脚本参数包装，且该交互属于页面级 UI 协调而不是 Schema 内联业务脚本。

## 5. Focus 到高亮的数据流

```text
TextWidget onFocus
  -> FormField 合并回调
  -> DynamicForm.onTextFieldFocus({ name, value, event })
  -> 页面设置 activeField
  -> 根据字段路径查找 ExtractionMetadataMap
  -> DocumentPreview 高亮 anchor
```

页面状态示例：

```ts
interface ActiveReviewField {
  name: string;
  anchor?: DocumentAnchor;
}
```

字段路径必须使用 DynamicForm 实际注册的完整路径，例如 `seller.name`、`items.0.amount`，不能使用显示标题或不含数组索引的短名称。

## 6. 框选到表单回填的数据流

预览组件输出：

```ts
interface DocumentSelection {
  text: string;
  anchor: DocumentAnchor;
}
```

页面收到选区后读取当前 activeField：

```ts
formRef.current?.setValue(activeField.name, selection.text, {
  shouldDirty: true,
  shouldTouch: true,
  shouldValidate: true,
});
```

随后更新 `ExtractionMetadataMap[activeField.name].anchor`，并继续高亮新位置。`setValue` 不应自动触发 focus，避免形成“回填 -> focus -> 高亮 -> 回填”的循环。

框选文本是否 trim、如何合并换行、是否执行 OCR 清洗和最大长度限制，由审核页配置；TextWidget 不承担这些策略。

## 7. 边界行为

- 没有 activeField 时框选：不回填字段，可保留选区并提示先选择文本字段。
- 字段失焦：普通 blur 不立即清除 activeField，避免用户无法从右侧操作到左侧；字段隐藏、Schema 切换或文档切换时清除。
- 文档异步加载：先保存 activeField，文档加载完成后再应用高亮，并通过 documentId 防止旧文档异步结果覆盖新文档。
- disabled 文本字段无法产生真实 focus。若业务仍需定位，应由审核列表或字段标签提供显式 `activateField(name)`，不伪造 TextWidget focus。
- setValue 仍经过 DynamicForm 的 reverse transform、联动和校验机制；审核页根据业务决定是否立即校验。

## 8. 测试方案

### TextWidget

- focus 调用传入的标准 `onFocus`；
- disabled/readOnly 不抛错；
- 不发送全局事件。

### FormField 和 DynamicForm

- `text` Widget 能收到页面级回调；
- select、radio、checkbox 不触发该回调；
- `widgetProps.onFocus` 与页面级回调都执行；
- 嵌套对象和数组字段传递完整路径；
- `setValue` 更新字段但不额外触发 focus 回调。

### 审核页集成

- focus 字段高亮正确 anchor；
- 框选文本回填 activeField；
- 回填同步更新 anchor；
- 多页、多框选区域和异步预览加载场景正确处理；
- 切换文档不会残留旧高亮。

## 9. 实施顺序

1. 为 DynamicForm 增加 `TextFieldFocusPayload` 和 `onTextFieldFocus` 类型；
2. 为 FormField 增加仅针对 text Widget 的回调合并；
3. 让 TextWidget 显式转发标准 `onFocus`；
4. 增加 Widget、FormField 和 DynamicForm 集成测试；
5. 由审核页面接入预览高亮和 `DynamicFormRef.setValue`。

## 10. 总结

推荐“页面级回调 + FormField 条件 wiring + TextWidget 标准 onFocus”的方案。该方案保持 DynamicForm 的通用性，把文档坐标和审核状态留在页面层，同时支持嵌套字段、数组字段、表单转换和现有 widgetProps 机制。
