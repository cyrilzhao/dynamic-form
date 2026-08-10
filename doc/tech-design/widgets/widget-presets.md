# Widget 预设系统设计优势

> **状态：现行实现。** 本文描述 `FieldRegistry`、Blueprint 默认预设和表单级 `widgets` 覆盖机制。

## 1. 简单易用

### 全局替换（一行代码）
```typescript
import { FieldRegistry } from '@/components/DynamicForm';
import { antdPreset } from './widgets/antd-preset';

// 一行代码替换整套组件库
FieldRegistry.setDefaultPreset(antdPreset);
```

## 2. 灵活可扩展

### 支持三种使用方式

**方式一：全局替换**
```typescript
// 应用入口
FieldRegistry.setDefaultPreset(antdPreset);
```

**方式二：局部覆盖**
```typescript
// 单个表单
<DynamicForm
  schema={schema}
  widgets={{ text: CustomInput }}
/>
```

**方式三：混合使用**
```typescript
// 全局 Antd + 局部自定义
FieldRegistry.setDefaultPreset(antdPreset);

<DynamicForm
  schema={schema}
  widgets={{ select: CustomSelect }}
/>
```

## 3. 渐进式迁移

不需要一次性实现所有 widgets：

```typescript
export const antdPreset: PartialWidgetPreset = {
  ...blueprintPreset, // 继承默认预设
  text: AntdInput,    // 只覆盖部分
  select: AntdSelect,
};
```

## 4. 类型安全

所有 widget 必须符合 `FieldWidgetProps` 接口：

```typescript
interface FieldWidgetProps {
  name: string;
  value?: any;
  onChange?: (value: any) => void;
  error?: string;
  disabled?: boolean;
  // ... 标准属性
}
```

TypeScript 会在编译时检查类型兼容性。

## 5. 向后兼容

- 默认自动初始化 Blueprint 预设
- 未传入自定义 `widgets` 时继续使用全局注册表
- 表单级 `widgets` 优先于 `FieldRegistry` 中的同名 Widget

## 6. 解耦设计

- FieldRegistry 不再依赖具体的 widget 实现
- Blueprint widgets 作为可选预设，而非硬编码
- 支持任意组件库（Antd、Material-UI、Chakra UI 等）

自定义预设需要自行适配 `FieldWidgetProps`，项目当前只提供 Blueprint 预设，不内置 Antd、Material UI 或 Chakra UI 预设。

## 7. 易于测试

```typescript
// 测试中可以轻松替换 widgets
beforeEach(() => {
  FieldRegistry.setDefaultPreset(mockPreset);
});

afterEach(() => {
  FieldRegistry.clear();
});
```
