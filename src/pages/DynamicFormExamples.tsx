import React, { useState } from 'react';
import { Tabs, Tab } from '@blueprintjs/core';
import '@blueprintjs/core/lib/css/blueprint.css';

// 基础表单
import { BasicFormPanel } from './examples/BasicForm/BasicFormPanel';

// 条件渲染
import { ConditionalFormPanel } from './examples/ConditionalForm/ConditionalFormPanel';

// 嵌套表单
import { StaticNestedExample } from './examples/NestedForm/StaticNestedExample';
import { DynamicNestedExample } from './examples/NestedForm/DynamicNestedExample';
import { JsonPointerNestedExample } from './examples/NestedForm/JsonPointerNestedExample';
import { ArrayNestedExample } from './examples/NestedForm/ArrayNestedExample';
import { SchemaLoaderExample } from './examples/NestedForm/SchemaLoaderExample';

// 数组字段
import { BasicArrayExample } from './examples/ArrayField/BasicArrayExample';
import { EnumArrayExample } from './examples/ArrayField/EnumArrayExample';
import { ObjectArrayExample } from './examples/ArrayField/ObjectArrayExample';
import { NestedArrayExample as ArrayNestedArrayExample } from './examples/ArrayField/NestedArrayExample';
import { ArrayWithFlattenExample } from './examples/ArrayField/ArrayWithFlattenExample';
import { ArrayWithLinkageExample } from './examples/ArrayField/ArrayWithLinkageExample';
import { ArrayWithFlattenAndLinkageExample } from './examples/ArrayField/ArrayWithFlattenAndLinkageExample';

// // 数组字段联动场景
import { RelativePathLinkageExample } from './examples/ArrayField/RelativePathLinkageExample';
import { AbsolutePathLinkageExample } from './examples/ArrayField/AbsolutePathLinkageExample';
import { DiamondDependencyExample } from './examples/ArrayField/DiamondDependencyExample';
import { MixedDependencyExample } from './examples/ArrayField/MixedDependencyExample';
import { CrossArrayDependencyExample } from './examples/ArrayField/CrossArrayDependencyExample';
import { NestedArrayLinkageExample } from './examples/ArrayField/NestedArrayLinkageExample';
import { ArrayAggregationExample } from './examples/ArrayField/ArrayAggregationExample';

// 路径透明化
import { BasicFlattenExample } from './examples/FlattenPath/BasicFlattenExample';
import { WithPrefixFlattenExample } from './examples/FlattenPath/WithPrefixFlattenExample';
import { MultiLevelPrefixExample } from './examples/FlattenPath/MultiLevelPrefixExample';
import { MixedFlattenExample } from './examples/FlattenPath/MixedFlattenExample';
import { NestedWithFlattenExample } from './examples/FlattenPath/NestedWithFlattenExample';

// 布局示例
import { VerticalLayoutExample } from './examples/LayoutExamples/VerticalLayoutExample';
import { HorizontalLayoutExample } from './examples/LayoutExamples/HorizontalLayoutExample';
import { InlineLayoutExample } from './examples/LayoutExamples/InlineLayoutExample';
import { LayoutPriorityExample } from './examples/LayoutExamples/LayoutPriorityExample';
import { LabelWidthPriorityExample } from './examples/LayoutExamples/LabelWidthPriorityExample';
import { ComprehensiveExample } from './examples/LayoutExamples/ComprehensiveExample';

// 复杂场景
import { ComplexFormPanel } from './examples/ComplexForm/ComplexFormPanel';

// 性能测试
import { LargeDataPerformanceExample } from './examples/PerformanceTest/LargeDataPerformanceExample';

export const DynamicFormExamples: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('basic');

  return (
    <div style={{ padding: '20px' }}>
      <h1>动态表单示例</h1>
      <Tabs
        selectedTabId={selectedTab}
        onChange={id => setSelectedTab(id as string)}
        renderActiveTabPanelOnly={true}
      >
        <Tab id="basic" title="基础表单" panel={<BasicFormPanel />} />
        <Tab id="conditional" title="条件渲染" panel={<ConditionalFormPanel />} />
        <Tab id="nested" title="嵌套表单" panel={<NestedFormPanel />} />
        <Tab id="array" title="数组字段" panel={<ArrayFieldPanel />} />
        <Tab id="flatten" title="路径透明化" panel={<FlattenPathPanel />} />
        <Tab id="layout" title="布局示例" panel={<LayoutPanel />} />
        <Tab id="complex" title="复杂场景" panel={<ComplexFormPanel />} />
        <Tab id="performance" title="性能测试" panel={<LargeDataPerformanceExample />} />
      </Tabs>
    </div>
  );
};

const ArrayFieldPanel: React.FC = () => {
  const [selectedExample, setSelectedExample] = useState('basic');

  return (
    <div style={{ marginTop: '20px' }}>
      <Tabs
        selectedTabId={selectedExample}
        onChange={id => setSelectedExample(id as string)}
        renderActiveTabPanelOnly={true}
      >
        <Tab id="basic" title="基本类型数组" panel={<BasicArrayExample />} />
        <Tab id="enum" title="枚举数组" panel={<EnumArrayExample />} />
        <Tab id="object" title="对象数组" panel={<ObjectArrayExample />} />
        <Tab id="nested" title="嵌套数组" panel={<ArrayNestedArrayExample />} />
        <Tab id="arrayWithFlatten" title="数组+路径透明化" panel={<ArrayWithFlattenExample />} />
        <Tab id="arrayWithLinkage" title="数组+字段联动" panel={<ArrayWithLinkageExample />} />
        <Tab
          id="arrayWithAll"
          title="数组+透明化+联动"
          panel={<ArrayWithFlattenAndLinkageExample />}
        />
        <Tab id="relativePath" title="场景1：相对路径依赖" panel={<RelativePathLinkageExample />} />
        <Tab id="absolutePath" title="场景2：绝对路径依赖" panel={<AbsolutePathLinkageExample />} />
        <Tab id="diamond" title="场景3：菱形依赖" panel={<DiamondDependencyExample />} />
        <Tab id="mixed" title="场景4：混合依赖" panel={<MixedDependencyExample />} />
        <Tab id="crossArray" title="场景5：跨数组依赖" panel={<CrossArrayDependencyExample />} />
        <Tab id="nestedLinkage" title="场景6：嵌套数组联动" panel={<NestedArrayLinkageExample />} />
        <Tab id="aggregation" title="场景7：数组聚合计算" panel={<ArrayAggregationExample />} />
      </Tabs>
    </div>
  );
};

const NestedFormPanel: React.FC = () => {
  const [selectedExample, setSelectedExample] = useState('static');

  return (
    <div style={{ marginTop: '20px' }}>
      <Tabs
        selectedTabId={selectedExample}
        onChange={id => setSelectedExample(id as string)}
        renderActiveTabPanelOnly={true}
      >
        <Tab id="static" title="静态嵌套" panel={<StaticNestedExample />} />
        <Tab id="dynamic" title="动态嵌套" panel={<DynamicNestedExample />} />
        <Tab id="jsonPointer" title="JSON Pointer 跨层级" panel={<JsonPointerNestedExample />} />
        <Tab id="arrayNested" title="数组嵌套" panel={<ArrayNestedExample />} />
        <Tab id="schemaLoader" title="异步加载 Schema" panel={<SchemaLoaderExample />} />
      </Tabs>
    </div>
  );
};

const FlattenPathPanel: React.FC = () => {
  const [selectedExample, setSelectedExample] = useState('basic');

  return (
    <div style={{ marginTop: '20px' }}>
      <Tabs
        selectedTabId={selectedExample}
        onChange={id => setSelectedExample(id as string)}
        renderActiveTabPanelOnly={true}
      >
        <Tab id="basic" title="基础用法" panel={<BasicFlattenExample />} />
        <Tab id="withPrefix" title="带前缀" panel={<WithPrefixFlattenExample />} />
        <Tab id="multiLevel" title="多层前缀" panel={<MultiLevelPrefixExample />} />
        <Tab id="mixed" title="混合使用" panel={<MixedFlattenExample />} />
        <Tab id="nestedWithFlatten" title="嵌套表单+透明化" panel={<NestedWithFlattenExample />} />
      </Tabs>
    </div>
  );
};

const LayoutPanel: React.FC = () => {
  const [selectedExample, setSelectedExample] = useState('vertical');

  return (
    <div style={{ marginTop: '20px' }}>
      <Tabs
        selectedTabId={selectedExample}
        onChange={id => setSelectedExample(id as string)}
        renderActiveTabPanelOnly={true}
      >
        <Tab id="vertical" title="垂直布局" panel={<VerticalLayoutExample />} />
        <Tab id="horizontal" title="水平布局" panel={<HorizontalLayoutExample />} />
        <Tab id="inline" title="内联布局" panel={<InlineLayoutExample />} />
        <Tab id="layoutPriority" title="布局优先级" panel={<LayoutPriorityExample />} />
        <Tab id="labelWidthPriority" title="标签宽度优先级" panel={<LabelWidthPriorityExample />} />
        <Tab id="comprehensive" title="综合示例" panel={<ComprehensiveExample />} />
      </Tabs>
    </div>
  );
};
