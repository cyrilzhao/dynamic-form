# 文档体系重组实施计划

> **执行要求：** 按任务顺序迁移，每个任务完成后运行对应检查；所有文件移动、合并和删除都必须能从本计划追溯来源。

**目标：** 将 `doc/` 重组为职责明确、索引统一、无重复指南且链接有效的文档体系。

**实施方式：** 先建立目录和索引，再整理总体设计与专题设计，然后处理指南和归档，最后统一改写全仓 Markdown 链接。合并文档保留来源说明，历史问题记录保留全文。

**技术栈：** Markdown、Git、ripgrep、Node.js 链接校验脚本。

## 全局约束

- 技术文档使用中文；已有英文代码、API 名称和必要术语保持原样。
- 目录和文件名统一使用小写 kebab-case。
- 根目录 `README.md` 是 DynamicForm 使用指南，不重复创建同类指南。
- `doc/README.md` 是文档体系唯一总索引。
- 已解决问题记录保留全文，只移动到归档并修复相对链接。
- 合并或删除旧文档前，必须明确其内容的新入口。

---

### 任务 1：建立目录与索引

**文件：**

- 创建：`doc/README.md`
- 创建：`doc/tech-design/README.md`
- 创建：`doc/guides/README.md`
- 创建：`doc/archive/README.md`

- [x] 创建 `prd/`、`tech-design/widgets/`、`guides/widgets/` 和 `archive/resolved-issues/`。
- [x] 在全局索引中提供按角色、按主题和推荐阅读顺序三种导航。
- [x] 在各目录索引中写明收录标准、文档清单和维护规则。
- [x] 运行 `rg -n '^# ' doc/README.md doc/tech-design/README.md doc/guides/README.md doc/archive/README.md`，确认每篇只有一个一级标题。

### 任务 2：整理总体技术设计

**文件：**

- 创建：`doc/tech-design/overview.md`
- 删除：`doc/DYNAMIC_FORM_INDEX.md`
- 删除：`doc/DYNAMIC_FORM_PART1.md`
- 删除：`doc/DYNAMIC_FORM_PART2.md`
- 删除：`doc/DYNAMIC_FORM_PART3.md`
- 删除：`doc/DYNAMIC_FORM_PART4.md`
- 删除：`doc/DYNAMIC_FORM_PART5.md`
- 删除：`doc/DYNAMIC_FORM_PART6.md`
- 删除：`doc/TECHNICAL_OVERVIEW.md`

- [x] 以原总体文档为来源，整理系统目标、技术选型、分层架构、数据流、扩展机制、测试策略、部署维护和专题边界。
- [x] 将 Part 5 的用法内容指向根目录 `README.md`，不复制正文。
- [x] 将 Part 6 中仍有效的测试、部署和维护约束纳入总体设计，删除重复 FAQ。
- [x] 在新文档中列出八份来源文件和内容去向。
- [x] 扫描 `rg -n 'DYNAMIC_FORM_(INDEX|PART[1-6])|TECHNICAL_OVERVIEW' doc/tech-design/overview.md`，仅允许出现在来源说明中。

### 任务 3：合并并迁移专题技术设计

**文件：**

- 创建：`doc/tech-design/linkage.md`，来源为 `LINKAGE.md`、`ASYNC_LINKAGE.md`、`ARRAY_FIELD_LINKAGE.md`
- 创建：`doc/tech-design/schema-and-validation.md`，来源为 `JSON_SCHEMA_DEFINITION.md`、`SCHEMA_VALIDATION_DESIGN.md`
- 移动：`FIELD_PATH_FLATTENING.md` → `tech-design/field-path.md`
- 移动：`NESTED_FORM.md` → `tech-design/nested-form.md`
- 移动：`Helpers_Design.md` → `tech-design/helpers.md`
- 移动：`SCRIPT_ISOLATION_DESIGN.md` → `tech-design/script-isolation.md`
- 移动：`PERFORMANCE_OPTIMIZATION.md` → `tech-design/performance.md`
- 移动：`CUSTOM_WIDGET_TECH_DESIGN.md` → `tech-design/custom-widget.md`

- [x] 为联动专题增加统一定位和总目录，将主设计、异步机制和数组场景组织为三个一级专题章节。
- [x] 删除联动来源文档中重复的概述、总结、相关文档和变更历史，保留配置、算法、实现与测试内容。
- [x] 为 Schema 专题明确“标准 Schema 语义”和“项目级验证实现”两个边界。
- [x] 对单一职责专题执行 Git 移动并统一文件名，不改写技术结论。
- [x] 检查专题索引能链接到每一篇现行技术设计。

### 任务 4：整理 Widget 设计与指南

**文件：**

- 移动：`ARRAY_FIELD_WIDGET.md` → `tech-design/widgets/array-field.md`
- 移动：`SELECT_COMPONENT_DESIGN.md` → `tech-design/widgets/select.md`
- 移动：`Widgets/CODE_EDITOR_WIDGET.md` → `tech-design/widgets/code-editor.md`
- 移动：`Widgets/SCHEMA_BUILDER_DESIGN.md` → `tech-design/widgets/schema-builder.md`
- 移动：`Widgets/WIDGET_PRESET_ADVANTAGES.md` → `tech-design/widgets/widget-presets.md`
- 移动：`FIELD_PATH_GUIDE.md` → `guides/field-path.md`
- 移动：`Widgets/WIDGET_PRESET_GUIDE.md` → `guides/widgets/widget-presets.md`
- 删除：`Widgets/KEY_VALUE_ARRAY_WIDGET.md`，内容由根目录 `README.md` 的 Array Fields 章节覆盖
- 删除：`Widgets/TABLE_ARRAY_WIDGET.md`，内容由根目录 `README.md` 的 Array Fields 章节覆盖

- [x] 对照根目录 `README.md` 删除各指南中重复的组件概述和基础示例，保留完整配置、数据格式、特殊场景和排障内容。
- [x] 保留根目录 `README.md` 中 KeyValueArrayWidget 和 TableArrayWidget 的完整说明，删除对应重复指南。
- [x] 更新 `doc/guides/README.md` 和 `doc/tech-design/README.md` 的 Widget 索引。
- [x] 扫描 `rg -n 'DYNAMIC_FORM_PART5|DYNAMIC_FORM_PART6' doc/guides README.md`，结果必须为空。

### 任务 5：迁移 PRD 与历史归档

**文件：**

- 移动：`CUSTOM_WIDGET_PRD.md` → `prd/custom-widget.md`
- 移动：`STALE_CLOSURE_ANALYSIS.md` → `archive/resolved-issues/linkage-stale-closure.md`
- 移动：`linkage-race-condition-solution.md` → `archive/resolved-issues/linkage-race-condition.md`

- [x] 保持 PRD 正文不变，仅增加文档定位和关联技术设计入口。
- [x] 保持两个已解决问题记录的正文完整，仅增加归档状态和现行联动设计入口。
- [x] 在 `archive/README.md` 中记录问题状态、归档原因、原文件名和替代入口。
- [x] 使用 `git diff --stat` 确认归档文件没有意外大幅删减。

### 任务 6：修复链接并执行验收

**文件：**

- 修改：仓库内所有受迁移影响的 `*.md`

- [x] 根据旧路径到新路径映射更新 Markdown 链接，包括不存在的 `UI_LINKAGE_DESIGN.md`。
- [x] 对已合并来源的深层锚点链接改为新专题入口，避免重复标题导致错误锚点。
- [x] 扫描旧文件名：`rg -n 'DYNAMIC_FORM_PART|DYNAMIC_FORM_INDEX|UI_LINKAGE_DESIGN|ASYNC_LINKAGE|ARRAY_FIELD_LINKAGE|FIELD_PATH_GUIDE|TECHNICAL_OVERVIEW' --glob '*.md'`，只允许归档决策中的来源说明。
- [x] 使用 Node.js 遍历本地 Markdown 链接，确认所有目标文件存在。
- [x] 运行 `git diff --check`，确认没有空白错误。
- [x] 运行 `find doc -type f -maxdepth 4 | sort`，人工核对目录职责。
- [x] 运行 `git status --short` 和 `git diff --stat`，确认没有修改源码或丢失未映射文档。
