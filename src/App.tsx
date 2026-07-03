import React, { Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Menu, MenuItem, MenuDivider, Spinner } from '@blueprintjs/core'

function namedLazy<M>(fn: () => Promise<M>, name: keyof M) {
  return React.lazy(() => fn().then((m) => ({ default: m[name] as React.FC })))
}

const groups = [
  {
    label: '基础表单',
    items: [
      { id: 'basic-form', label: '基础表单', component: namedLazy(() => import('./examples/BasicForm/BasicFormPanel'), 'BasicFormPanel') },
      { id: 'complex-form', label: '复杂表单', component: namedLazy(() => import('./examples/ComplexForm/ComplexFormPanel'), 'ComplexFormPanel') },
      { id: 'conditional-form', label: '条件表单', component: namedLazy(() => import('./examples/ConditionalForm/ConditionalFormPanel'), 'ConditionalFormPanel') },
    ],
  },
  {
    label: '数组字段',
    items: [
      { id: 'basic-array', label: '基础数组', component: namedLazy(() => import('./examples/ArrayField/BasicArrayExample'), 'BasicArrayExample') },
      { id: 'object-array', label: '对象数组', component: namedLazy(() => import('./examples/ArrayField/ObjectArrayExample'), 'ObjectArrayExample') },
      { id: 'enum-array', label: '枚举数组', component: namedLazy(() => import('./examples/ArrayField/EnumArrayExample'), 'EnumArrayExample') },
      { id: 'nested-array', label: '嵌套数组', component: namedLazy(() => import('./examples/ArrayField/NestedArrayExample'), 'NestedArrayExample') },
      { id: 'key-value-array', label: 'Key-Value 数组', component: namedLazy(() => import('./examples/KeyValueArrayExample'), 'KeyValueArrayExample') },
      { id: 'table-array', label: '表格数组', component: namedLazy(() => import('./examples/TableArrayExample'), 'TableArrayExample') },
      { id: 'array-with-linkage', label: '数组联动', component: namedLazy(() => import('./examples/ArrayField/ArrayWithLinkageExample'), 'ArrayWithLinkageExample') },
      { id: 'array-with-flatten', label: '数组路径拉平', component: namedLazy(() => import('./examples/ArrayField/ArrayWithFlattenExample'), 'ArrayWithFlattenExample') },
      { id: 'array-flatten-linkage', label: '数组拉平+联动', component: namedLazy(() => import('./examples/ArrayField/ArrayWithFlattenAndLinkageExample'), 'ArrayWithFlattenAndLinkageExample') },
      { id: 'relative-path-linkage', label: '相对路径联动', component: namedLazy(() => import('./examples/ArrayField/RelativePathLinkageExample'), 'RelativePathLinkageExample') },
      { id: 'absolute-path-linkage', label: '绝对路径联动', component: namedLazy(() => import('./examples/ArrayField/AbsolutePathLinkageExample'), 'AbsolutePathLinkageExample') },
      { id: 'nested-array-linkage', label: '嵌套数组联动', component: namedLazy(() => import('./examples/ArrayField/NestedArrayLinkageExample'), 'NestedArrayLinkageExample') },
      { id: 'cross-array-dependency', label: '跨数组依赖', component: namedLazy(() => import('./examples/ArrayField/CrossArrayDependencyExample'), 'CrossArrayDependencyExample') },
      { id: 'diamond-dependency', label: '菱形依赖', component: namedLazy(() => import('./examples/ArrayField/DiamondDependencyExample'), 'DiamondDependencyExample') },
      { id: 'mixed-dependency', label: '混合依赖', component: namedLazy(() => import('./examples/ArrayField/MixedDependencyExample'), 'MixedDependencyExample') },
      { id: 'array-aggregation', label: '数组聚合', component: namedLazy(() => import('./examples/ArrayField/ArrayAggregationExample'), 'ArrayAggregationExample') },
    ],
  },
  {
    label: '嵌套表单',
    items: [
      { id: 'static-nested', label: '静态嵌套', component: namedLazy(() => import('./examples/NestedForm/StaticNestedExample'), 'StaticNestedExample') },
      { id: 'dynamic-nested', label: '动态嵌套', component: namedLazy(() => import('./examples/NestedForm/DynamicNestedExample'), 'DynamicNestedExample') },
      { id: 'array-nested', label: '数组嵌套', component: namedLazy(() => import('./examples/NestedForm/ArrayNestedExample'), 'ArrayNestedExample') },
      { id: 'json-pointer-nested', label: 'JSON Pointer 嵌套', component: namedLazy(() => import('./examples/NestedForm/JsonPointerNestedExample'), 'JsonPointerNestedExample') },
      { id: 'async-schema-linkage', label: '异步 Schema 联动', component: namedLazy(() => import('./examples/NestedForm/AsyncSchemaLinkageExample'), 'AsyncSchemaLinkageExample') },
      { id: 'schema-loader', label: 'Schema 加载器', component: namedLazy(() => import('./examples/NestedForm/SchemaLoaderExample'), 'SchemaLoaderExample') },
      { id: 'set-values-nested', label: '嵌套设值', component: namedLazy(() => import('./examples/SetValuesNestedExample'), 'SetValuesNestedExample') },
    ],
  },
  {
    label: '布局',
    items: [
      { id: 'horizontal-layout', label: '水平布局', component: namedLazy(() => import('./examples/LayoutExamples/HorizontalLayoutExample'), 'HorizontalLayoutExample') },
      { id: 'vertical-layout', label: '垂直布局', component: namedLazy(() => import('./examples/LayoutExamples/VerticalLayoutExample'), 'VerticalLayoutExample') },
      { id: 'inline-layout', label: '行内布局', component: namedLazy(() => import('./examples/LayoutExamples/InlineLayoutExample'), 'InlineLayoutExample') },
      { id: 'multi-column-layout', label: '多列布局', component: namedLazy(() => import('./examples/LayoutExamples/MultiColumnLayoutExample'), 'MultiColumnLayoutExample') },
      { id: 'layout-priority', label: '布局优先级', component: namedLazy(() => import('./examples/LayoutExamples/LayoutPriorityExample'), 'LayoutPriorityExample') },
      { id: 'label-width-priority', label: '标签宽度优先级', component: namedLazy(() => import('./examples/LayoutExamples/LabelWidthPriorityExample'), 'LabelWidthPriorityExample') },
      { id: 'comprehensive-layout', label: '综合布局', component: namedLazy(() => import('./examples/LayoutExamples/ComprehensiveExample'), 'ComprehensiveExample') },
    ],
  },
  {
    label: '路径拉平',
    items: [
      { id: 'basic-flatten', label: '基础拉平', component: namedLazy(() => import('./examples/FlattenPath/BasicFlattenExample'), 'BasicFlattenExample') },
      { id: 'nested-with-flatten', label: '嵌套拉平', component: namedLazy(() => import('./examples/FlattenPath/NestedWithFlattenExample'), 'NestedWithFlattenExample') },
      { id: 'with-prefix-flatten', label: '前缀拉平', component: namedLazy(() => import('./examples/FlattenPath/WithPrefixFlattenExample'), 'WithPrefixFlattenExample') },
      { id: 'multi-level-prefix', label: '多级前缀', component: namedLazy(() => import('./examples/FlattenPath/MultiLevelPrefixExample'), 'MultiLevelPrefixExample') },
      { id: 'mixed-flatten', label: '混合拉平', component: namedLazy(() => import('./examples/FlattenPath/MixedFlattenExample'), 'MixedFlattenExample') },
    ],
  },
  {
    label: '联动',
    items: [
      { id: 'schema-linkage', label: 'Schema 联动', component: namedLazy(() => import('./examples/SchemaLinkageExample'), 'SchemaLinkageExample') },
      { id: 'category-action', label: 'Category-Action', component: namedLazy(() => import('./examples/CategoryActionExample'), 'CategoryActionExample') },
      { id: 'multiple-linkages', label: '多联动', component: namedLazy(() => import('./examples/MultipleLinkagesExample'), 'MultipleLinkagesExample') },
      { id: 'refresh-linkage', label: '刷新联动', component: namedLazy(() => import('./examples/RefreshLinkageExample'), 'RefreshLinkageExample') },
      { id: 'schema-defaults', label: 'Schema 默认值', component: namedLazy(() => import('./examples/SchemaDefaultsExample'), 'SchemaDefaultsExample') },
      { id: 'race-condition', label: '竞态条件', component: namedLazy(() => import('./examples/RaceConditionExample'), 'RaceConditionExample') },
    ],
  },
  {
    label: '高级功能',
    items: [
      { id: 'schema-builder', label: 'Schema 构建器', component: namedLazy(() => import('./examples/SchemaBuilderExample'), 'SchemaBuilderExample') },
      { id: 'dynamic-icon', label: '动态图标', component: namedLazy(() => import('./examples/DynamicIconExample'), 'DynamicIconExample') },
      { id: 'virtual-scroll', label: '虚拟滚动', component: namedLazy(() => import('./examples/VirtualScrollExample'), 'VirtualScrollExample') },
      { id: 'error-scroll', label: '错误滚动', component: namedLazy(() => import('./examples/ErrorScrollExample'), 'ErrorScrollExample') },
    ],
  },
  {
    label: '性能测试',
    items: [
      { id: 'memo-performance', label: 'Memo 性能', component: namedLazy(() => import('./examples/PerformanceTest/MemoPerformanceTest'), 'MemoPerformanceTest') },
      { id: 'large-data', label: '大数据量', component: namedLazy(() => import('./examples/PerformanceTest/LargeDataPerformanceExample'), 'LargeDataPerformanceExample') },
    ],
  },
]

const allItems = groups.flatMap((g) => g.items)

const Sidebar: React.FC = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        borderRight: '1px solid rgba(17,20,24,.15)',
        overflowY: 'auto',
        height: '100vh',
        padding: '8px 0',
      }}
    >
      <Menu>
        {groups.map((group) => (
          <React.Fragment key={group.label}>
            <MenuDivider title={group.label} />
            {group.items.map(({ id, label }) => (
              <MenuItem
                key={id}
                text={label}
                active={pathname === `/${id}`}
                onClick={() => navigate(`/${id}`)}
              />
            ))}
          </React.Fragment>
        ))}
      </Menu>
    </div>
  )
}

export const App: React.FC = () => (
  <HashRouter>
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Suspense fallback={<div style={{ padding: 40 }}><Spinner /></div>}>
          <Routes>
            <Route path="/" element={<Navigate to={`/${allItems[0].id}`} replace />} />
            {allItems.map(({ id, component: Comp }) => (
              <Route key={id} path={`/${id}`} element={<Comp />} />
            ))}
          </Routes>
        </Suspense>
      </div>
    </div>
  </HashRouter>
)
