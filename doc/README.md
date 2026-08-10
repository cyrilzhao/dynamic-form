# DynamicForm 文档中心

本目录按文档职责划分为产品需求、技术设计、使用指南和历史归档。DynamicForm 的安装、配置与 API 用法以仓库根目录的 [README](../README.md) 为准；本页只提供导航，不重复正文。

## 按角色阅读

### 产品与项目负责人

1. [自定义 Widget 产品需求](./prd/custom-widget.md)
2. [DynamicForm 总体技术设计](./tech-design/overview.md)
3. [性能优化设计](./tech-design/performance.md)

### 业务开发者

1. [DynamicForm 使用指南](../README.md)
2. [字段路径指南](./guides/field-path.md)
3. [Widget 使用指南](./guides/README.md#widget-指南)
4. [联动系统设计](./tech-design/linkage.md)

### 组件维护者

1. [DynamicForm 总体技术设计](./tech-design/overview.md)
2. [技术设计索引](./tech-design/README.md)
3. [历史归档](./archive/README.md)

## 按主题查找

| 主题 | 主入口 | 相关内容 |
| --- | --- | --- |
| 总体架构 | [总体技术设计](./tech-design/overview.md) | [根 README](../README.md) |
| Schema 与验证 | [Schema 与验证设计](./tech-design/schema-and-validation.md) | [根 README：Schema Definition](../README.md#schema-definition) |
| UI 联动 | [联动系统设计](./tech-design/linkage.md) | [字段路径设计](./tech-design/field-path.md) |
| 字段路径 | [字段路径设计](./tech-design/field-path.md) | [字段路径指南](./guides/field-path.md) |
| 嵌套表单 | [嵌套表单设计](./tech-design/nested-form.md) | [根 README：Nested Forms](../README.md#nested-forms) |
| Widget | [Widget 技术设计](./tech-design/README.md#widget-设计) | [Widget 使用指南](./guides/README.md#widget-指南) |
| Helpers 与脚本 | [Helpers 设计](./tech-design/helpers.md) | [脚本隔离设计](./tech-design/script-isolation.md) |
| 性能 | [性能优化设计](./tech-design/performance.md) | [根 README：Performance Optimization](../README.md#performance-optimization) |
| 历史问题 | [归档索引](./archive/README.md) | [联动系统现行设计](./tech-design/linkage.md) |

## 文档分类

- [产品需求](./prd/)：描述用户、场景、范围、验收标准和产品约束。
- [技术设计](./tech-design/README.md)：描述现行架构、接口、算法和工程约束。
- [使用指南](./guides/README.md)：补充根 README 未覆盖的专题用法和排障内容。
- [历史归档](./archive/README.md)：保留已解决问题和历史决策，不作为现行实现依据。

## 维护规则

1. 新文档必须先确定职责分类，再放入对应目录。
2. 使用小写 kebab-case 文件名，不使用 `Part N`、`final` 或日期区分现行版本。
3. 使用说明优先更新根 README；仅当专题内容明显超出 README 范围时新增指南。
4. 新增或移动文档时同步更新本页和所属目录索引。
5. 已失效但有追溯价值的文档移入 `archive/`，并注明现行替代入口。
