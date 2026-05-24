# TODO LIST

- [x] 跨层字段联动 - PathResolver
- [x] Linkage 串行计算和性能优化 - DAG 优化
- [x] 补充字段路径透明化的示例
- [x] 补充 schemaKey 跨层级字段依赖的示例
- [x] 为工具类和hook添加单元测试
  - [x] schemaParser
  - [x] PathResolver
  - [x] conditionEvaluator
  - [x] dependencyGraph
  - [x] schemaLinkageParser
  - [x] filterValueBySchema
  - [x] useLinkageManager
- [x] 确认 schemaLinkageParser 是否还有必要保留 - 要保留
- [x] 目前已经没有 useComputedFields 的实现方式，需要在文档中更新
- [x] 将联动目前存在的单条件和双条件分支两种使用方式，改为只保留双条件分支
- [x] 将 function 移动到 fulfill 和 otherwise 中
- [x] when 和 fulfill、otherwise 中的 function 都需要支持异步函数
- [x] linkage type 中的 computed 和 value 类型合并
- [x] 并行计算联动时确保不会因为某个计算失败影响其他计算任务
- [x] 修复表单初始化计算联动导致死循环的问题
- [x] 拆分 src/pages/DynamicFormExamples.tsx 中的示例代码到不同的文件
- [x] 嵌套表单 - JSON Pointer 跨层级示例切换公司类型时没有触发联动
- [x] 初始化和触发联动时根据依赖关系的拓扑顺序计算各个字段
- [x] DependencyGraph 中的 getAffectedFields 添加 affected 节点之前先判断是否已经添加过，避免重复添加
- [x] NestForm 文档补充 filterValueWithNestedSchemas 的相关逻辑
- [x] 当 flattenPath: true 时，中间层级不会渲染成 NestedFormWidget 和 Card，只有真正需要分组的字段才会显示 Card 边框
- [ ] 完善 DYNAMIC_FORM_PART2 文档中表单校验 JSON Schema 的内容
  - [x] 5.4.6, 5.4.7 下方需要补充含义说明
  - [x] 5.4.1 提到的 dependencies 是不是只能用于必填校验
  - [ ] if-else 分支判断和 anyOf/allOf/oneOf 判断中都只提到 required 校验，能否支持其他的校验方式（如 minLength, pattern 等）
  - [ ] 5.5.3 跨字段验证里为什么 schema 中还需要定义 "dependencies": ["password"]
  - [ ] 自定义格式和自定义关键字验证代码示例中的 Ajv 起到什么作用
- [ ] 支持 API Node 的场景方案
- [x] 添加 ui.labelWidth，ui.layout 字段并在文档中补充相关使用说明
- [x] 为已经设置了路径透明化的字段添加 layout 设置时，该设置不生效也无法被子字段继承
- [x] 补充 NestedForm 文档中提到的 “数组中的嵌套表单” 场景的代码示例
- [x] 在嵌套表单场景下，父表单提交时需要触发所有子表单的校验逻辑
  - [x] 数组嵌套数组的场景下，内层数组中的对象的字段没有正确回显表单的值
  - [x] 嵌套表单 JSON Pointer 跨层级场景切换公司类型时没有触发 schema 切换
- [x] array 类型字段对现有特性的兼容性支持
  - [x] 嵌套表单
  - [x] 嵌套数组 - 数组中的对象的某个字段也是数组
  - [x] 路径透明化
  - [x] 联动
  - [x] layout
  - [x] labelWidth
  - [ ] array 字段问题修复
    - [x] array 字段 mode 为 dynamic 时，新增 item 后如果未填写则无法继续添加 - 将基本类型数组转为对象数组进行处理
    - [x] 没有使用到 minItems 字段
    - [x] 基础类型数组的 ArrayItem 验证条件没有生效
    - [x] 对象数组的 ArrayItem 中字段的验证条件没有生效
    - [x] 添加空数组项时没有触发 minLength 校验
    - [x] 枚举数组没有正确显示
    - [x] 枚举类型数组提交的数据有问题
    - [x] 删除数组项之前需要提示确认
  - [ ] 数组字段联动问题
    - [x] 规范化同级字段和跨层级字段路径的书写方式
    - [x] 列出所有可能存在的复杂联动场景
    - [x] 确保数组元素字段依赖内外跨层级字段联动触发时能按照拓扑顺序计算字段
    - [x] 确保能检测到数组元素字段对内外跨层级字段的依赖关系是否存在循环依赖
    - [x] 联动时 otherwise 的赋值没生效
    - [x] 菱形依赖场景下，联系人类型切换成工作之后有触发联动，但是再切换回个人就没有触发对应的联动
    - [x] 解决字段名称相同的情况下，生成的逻辑字段路径冲突的问题（group.category.contacts 和 region.market.contacts）
    - [x] flattenPath 为 true 的字段触发联动隐藏时，其子字段没有被隐藏的问题
    - [x] 跨数组依赖 - 当权限列表中存在管理员权限时，功能列表中的所有功能都自动启用
    - [x] 场景6：嵌套数组联动 - 部门切换成技术部时，没有触发联动
    - [x] FormField 组件中有从传入的 widgets 和 FieldRegistry 两个来源获取 widget 的方法，这两种方法有何异同，是否只需要保留 FieldRegistry

      建议：不应该删除 widgets prop，两者应该共存

      理由：
      1. 灵活性：widgets prop 提供了运行时覆盖的能力，这在某些场景下非常有用：
         // 场景：某个特定表单需要特殊的输入框样式
         ```
          <DynamicForm
            schema={schema}
            widgets={{
                input: CustomInputForThisFormOnly
              }}
          />
         ```
      2. 避免全局污染：不是所有自定义 widget 都适合全局注册，有些可能只在特定上下文中使用
      3. 测试友好：在测试时可以轻松注入 mock widgets 而不影响全局注册表
      4. 符合 React 设计模式：这种"全局默认 + 局部覆盖"的模式是常见且合理的设计

    - [x] 场景3：菱形依赖（复杂依赖关系）和 场景5：跨数组依赖 的数组联动问题

- [x] 路径透明化 - 混合使用：部分透明化 + 部分正常嵌套 - basicInfo 提交时是空对象
- [x] 关于字段联动，是不是可能存在更复杂的拓扑结构，当前架构是否能覆盖
- [x] 将 Nested-form 作为 object 类型字段的默认渲染组件，不需要显式配置
- [x] 将所有对用户显示的内容改为英文
- [x] 支持配置 schema 的组件
- [x] 支持表达式输入组件
  - [x] 变量操作原子化（光标移动、删除）
  - [x] 滚动条出现时的右边距
  - [x] 支持悬浮编辑模式
- [x] NestedFormWidget 字段不支持渲染 array 类型的字段，需要新增一个 ArrayFieldWidget 组件，专门用于 array 类型字段的默认渲染
- [x] 支持基于 codeMirror 的代码输入组件
- [x] 补充使用 schemaLoader 的代码示例
- [x] schemaLoader 和 schemaKey 改为使用联动来更新 schema
  - [x] 配置了 schema 联动的字段设置 flattenPath 为 true 的情况下，没有触发 schema 更新时的渲染
- [ ] 添加自定义 nested form widget 的代码示例
- [ ] 大规模表单性能
  - [x] 输出性能分析和优化文档
  - [ ] 大量组件同时渲染
  - [ ] 不必要的重渲染
  - [ ] watch() 监听所有字段
  - [ ] 数组字段联动复杂度高
  - [ ] 每次渲染创建新对象

- [ ] 文档与代码实现对齐
