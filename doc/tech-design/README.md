# 技术设计索引

本目录收录 DynamicForm 的现行技术设计，以及与现行实现直接相关的部分实现和未来提案。建议先阅读总体设计，再按问题进入专题；使用方法请前往[根 README](../../README.md)或[使用指南索引](../guides/README.md)。

## 文档状态

- **现行实现**：代码中已经存在，可以按文档直接使用。
- **部分实现**：核心能力存在，但文档会明确列出尚未实现或存在限制的部分。
- **提案/未实现**：用于记录未来方案，不能作为当前可用 API。
- **历史说明**：仅用于解释演进背景，不代表当前推荐写法。

当文档同时包含现行设计和提案时，章节必须分别标注状态。

## 主设计

- [DynamicForm 总体技术设计](./overview.md)（现行实现）：目标、边界、分层架构、数据流、扩展机制、测试与维护。

## 核心专题

- [Schema 与验证](./schema-and-validation.md)（现行实现，含能力边界）：项目支持的 Schema 约束、条件验证和自定义字段验证。
- [多类型字段与可切换 Widget](./polymorphic-field-variants.md)（提案/未实现）：同一字段在不同数据类型、Widget、校验和 transform 模式之间自动识别与手动切换的设计。
- [联动系统](./linkage.md)（现行实现）：统一联动模型、执行流程、异步控制和数组联动。
- [字段路径](./field-path.md)（现行实现）：标准点号路径、路径透明化和数组模板路径。
- [嵌套表单](./nested-form.md)（现行实现）：嵌套对象、动态 Schema 和提交数据过滤。
- [Helpers](./helpers.md)（现行实现）：内置与自定义依赖的注入模型。
- [脚本隔离](./script-isolation.md)（提案/未实现）：当前 Inline Script 风险和未来隔离方案。
- [性能优化](./performance.md)（部分实现）：已实施优化、当前限制和后续计划。
- [大规模数据性能优化](./large-scale-data-optimization.md)（提案/未实现）：数千数组项场景的候选优化方案。
- [自定义 Widget 管理](./custom-widget.md)（部分实现）：当前前端 Mock 管理能力和未来服务端方案。

## Widget 设计

- [ArrayField](./widgets/array-field.md)（部分实现）
- [Select](./widgets/select.md)（部分实现）
- [Code Editor](./widgets/code-editor.md)（部分实现）
- [Schema Builder](./widgets/schema-builder.md)（部分实现）
- [Widget Preset](./widgets/widget-presets.md)（现行实现）

具体配置和用法参见 [Widget 使用指南](../guides/README.md#widget-指南)。

## 阅读原则

- 总体设计负责解释系统边界和模块关系，不展开专题算法。
- 专题设计负责解释实现机制，不复制完整入门示例。
- 当前行为以 TypeScript 类型和运行时代码为事实来源。
- 未实现内容必须标注为提案，不能与现行 API 并列为可用能力。
- 历史设计和已解决问题应放入归档，不能保留两个相互冲突的现行结论。
