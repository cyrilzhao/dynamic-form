# 使用指南索引

仓库根目录的 [README](../../README.md) 已覆盖安装、快速开始、Schema 配置、API、最佳实践和常见问题。本目录只保留 README 未充分覆盖的专题指南。

## 专题指南

- [字段路径指南](./field-path.md)：路径格式选择、数组路径、转换工具、完整示例和排障。
- [SchemaBuilder 使用指南](./schema-builder.md)：可视化编辑 Schema、预览、导入导出和受限配置。

## Widget 指南

- [Widget Preset](./widgets/widget-presets.md)：预设适配、局部覆盖和渐进迁移。

KeyValueArrayWidget 和 TableArrayWidget 的配置直接参见[根 README 的 Array Fields 章节](../../README.md#array-fields)，不再维护重复的独立指南。

Widget 的架构与内部实现参见 [Widget 技术设计](../tech-design/README.md#widget-设计)。

## 收录标准

1. 根 README 已完整覆盖的内容不在此重复维护。
2. 指南应面向组件使用者，避免展开内部类和算法实现。
3. 当根 README 已覆盖组件说明、完整配置和选型结论时，不再保留独立指南。
