# 文档体系重组设计

## 1. 背景

当前 `doc/` 同时存放 PRD、总体技术设计、专题设计、使用指南和已解决问题记录，且存在以下问题：

- DynamicForm 总体方案拆为 `DYNAMIC_FORM_PART1.md` 至 `DYNAMIC_FORM_PART6.md`，文件名无法表达内容职责。
- `TECHNICAL_OVERVIEW.md` 与上述分篇方案并存，缺少唯一的总体技术设计入口。
- 联动主设计、异步联动和数组联动分散在多个同级文件中，阅读路径不连续。
- Widget 设计文档与使用指南混放，文档类型不明确。
- 已解决问题的分析记录与现行设计并列，容易让读者误判其有效性。
- 多处链接指向不存在的 `UI_LINKAGE_DESIGN.md` 等文件。

## 2. 目标

1. 按文档职责区分产品需求、技术设计、使用指南和历史归档。
2. 建立唯一的全局索引和总体技术设计入口。
3. 使用能够直接表达主题的文件名，移除 `PART1` 等顺序型命名。
4. 合并同一主题下被人为拆散的内容，同时保留必要的专题边界。
5. 保留已解决问题的完整历史记录，但不让其干扰现行设计阅读。
6. 修复仓库内 Markdown 文档链接，并提供明确的替代文档入口。

## 3. 目标目录

```text
doc/
├── README.md
├── prd/
│   └── custom-widget.md
├── tech-design/
│   ├── README.md
│   ├── overview.md
│   ├── linkage.md
│   ├── schema-and-validation.md
│   ├── field-path.md
│   ├── nested-form.md
│   ├── helpers.md
│   ├── script-isolation.md
│   ├── performance.md
│   └── widgets/
├── guides/
│   ├── README.md
│   ├── field-path.md
│   └── widgets/
└── archive/
    ├── README.md
    ├── decisions/
    └── resolved-issues/
```

## 4. 信息架构

### 4.1 全局索引

`doc/README.md` 是唯一的文档总入口，提供两种导航：

- 按角色：产品、开发者、维护者。
- 按主题：总体架构、Schema、联动、字段路径、Widget、性能与安全。

索引只描述文档用途和推荐阅读顺序，不复制专题正文。

### 4.2 总体技术设计

`doc/tech-design/overview.md` 是 DynamicForm 的主设计文档。它吸收原 `DYNAMIC_FORM_PART1.md` 至 `DYNAMIC_FORM_PART4.md` 中仍属于总体架构的内容，并以原 `TECHNICAL_OVERVIEW.md` 的架构视角为基础去重整理。

总体设计保留系统目标、技术选型、核心架构、数据流、扩展机制、测试和部署边界。详细算法、完整配置和大量示例通过链接进入专题设计或指南，避免总体文档再次膨胀。

### 4.3 专题技术设计

- `linkage.md` 合并原 `LINKAGE.md`、`ASYNC_LINKAGE.md` 和 `ARRAY_FIELD_LINKAGE.md`，依次说明统一模型、同步执行、异步与竞态控制、数组路径、实现架构和测试策略。
- `schema-and-validation.md` 整理 `JSON_SCHEMA_DEFINITION.md` 与 `SCHEMA_VALIDATION_DESIGN.md`，区分标准 Schema 语义和项目级验证实现。
- `field-path.md` 以 `FIELD_PATH_FLATTENING.md` 为设计主体；原 `FIELD_PATH_GUIDE.md` 的使用内容迁入指南。
- 其他专题按单一职责重命名迁移，不在迁移中改写其技术结论。
- Widget 技术设计统一放入 `tech-design/widgets/`。

### 4.4 使用指南

- 根目录 `README.md` 继续作为 DynamicForm 的主要使用指南，不再创建内容重复的 `guides/dynamic-form.md`。
- 原 `DYNAMIC_FORM_PART5.md` 的基础用法、高级示例、集成方式和最佳实践已由根目录 `README.md` 覆盖，因此不再保留独立文档。
- 原 `DYNAMIC_FORM_PART6.md` 的 FAQ 已由根目录 `README.md` 的 Troubleshooting 覆盖，因此不再保留独立文档；其中仍有效且未重复的测试、部署和维护约束只合入总体技术设计一次。
- `FIELD_PATH_GUIDE.md` 包含根目录 `README.md` 未覆盖的路径格式、转换工具、数组路径和排障细节，迁移为 `guides/field-path.md`。
- `WIDGET_PRESET_GUIDE.md` 包含根目录 `README.md` 未覆盖的预设适配与渐进迁移内容，迁入 `guides/widgets/`。
- `KEY_VALUE_ARRAY_WIDGET.md` 和 `TABLE_ARRAY_WIDGET.md` 的组件说明、配置项、数据格式和选型结论均已由根目录 `README.md` 的 Array Fields 章节覆盖，因此不再保留独立指南。
- 指南面向使用者，保留可直接运行的示例和排障内容，不重复实现类与内部算法。

### 4.5 归档

`STALE_CLOSURE_ANALYSIS.md` 和 `linkage-race-condition-solution.md` 原文迁入 `archive/resolved-issues/`。`archive/README.md` 标注问题状态、归档原因、原始文件和对应的现行设计入口。

归档文件只允许修复迁移后的相对链接，不改写历史结论。

## 5. 命名与维护规则

- 目录和 Markdown 文件统一使用小写 kebab-case。
- 每篇文档只承担一种职责；PRD 不包含详细实现，指南不承担架构决策记录。
- 技术设计开头注明文档定位、适用范围和关联文档。
- 新专题必须同时加入 `doc/README.md` 和对应目录的 `README.md`。
- 已失效但仍有追溯价值的内容移入归档，并注明替代入口；不再适用且无追溯价值的重复内容可删除。
- 不使用 `Part N`、`final`、`new` 等依赖时间或顺序的文件名。

## 6. 迁移与兼容策略

1. 先创建目标目录、索引和合并后的主文档。
2. 再迁移单一职责文档和归档文件。
3. 逐篇将使用指南与根目录 `README.md` 比对；完整重复的删除，部分重复的划分概览与细节后再迁移。
4. 更新仓库内所有指向旧路径的 Markdown 链接。
5. 使用 Git 重命名信息保留文件历史；合并文档在变更说明中列出来源。
6. 删除已被完整吸收的旧文件，不保留内容重复的跳转占位文件。
7. 最后执行链接校验、旧文件名扫描、标题层级检查和 Git 差异检查。

## 7. 验收标准

- `doc/README.md` 能在两次点击内到达任一专题。
- PRD、技术设计、指南和归档之间不存在同级混放。
- 不再存在 `DYNAMIC_FORM_PART*.md` 或含义不明确的同类命名。
- 联动现行设计只有一个入口，并包含同步、异步和数组联动章节。
- 已解决问题记录完整保留在 `archive/resolved-issues/`。
- 根目录 `README.md` 与 `guides/` 不存在整篇重复或大段重复的使用说明。
- 仓库内不存在指向旧文档路径或不存在 Markdown 文件的有效链接。
- 合并前的重要章节可在新索引或新文档目录中定位。
