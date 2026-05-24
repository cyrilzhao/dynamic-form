# Widget 预设系统使用指南

## 概述

Widget 预设系统允许你快速替换 DynamicForm 的整套组件库实现，从 Blueprint 切换到 Antd、Material-UI 或其他任何组件库。

## 核心概念

### 1. Widget 预设 (WidgetPreset)

一个完整的表单组件集合，包含所有必需的 widget 类型：

```typescript
interface WidgetPreset {
  text: ComponentType<FieldWidgetProps>;
  textarea: ComponentType<FieldWidgetProps>;
  password: ComponentType<FieldWidgetProps>;
  email: ComponentType<FieldWidgetProps>;
  url: ComponentType<FieldWidgetProps>;
  number: ComponentType<FieldWidgetProps>;
  select: ComponentType<FieldWidgetProps>;
  radio: ComponentType<FieldWidgetProps>;
  checkbox: ComponentType<FieldWidgetProps>;
  switch: ComponentType<FieldWidgetProps>;
  'nested-form': ComponentType<FieldWidgetProps>;
  array: ComponentType<FieldWidgetProps>;
  'key-value-array': ComponentType<FieldWidgetProps>;
  'table-array': ComponentType<FieldWidgetProps>;
}
```

### 2. FieldWidgetProps

所有 widget 组件必须接受的标准 props：

```typescript
interface FieldWidgetProps {
  name: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  error?: string;
  value?: any;
  onChange?: (value: any) => void;
  onBlur?: () => void;
  options?: FieldOption[];
  schema?: ExtendedJSONSchema;
  [key: string]: any;
}
```

## 使用方式

### 方式一：全局替换（推荐）

在应用入口处一次性替换整套 widgets：

```typescript
// main.tsx
import { FieldRegistry } from '@/components/DynamicForm';
import { antdPreset } from './widgets/antd-preset';

// 设置 Antd 为默认预设
FieldRegistry.setDefaultPreset(antdPreset);

// 然后正常使用 DynamicForm
function App() {
  return <DynamicForm schema={schema} />;
}
```

### 方式二：局部覆盖

通过 `widgets` prop 覆盖特定组件：

```typescript
import { DynamicForm } from '@/components/DynamicForm';
import { AntdInput } from './widgets/AntdInput';

function MyForm() {
  return (
    <DynamicForm
      schema={schema}
      widgets={{
        text: AntdInput,
        email: AntdInput,
      }}
    />
  );
}
```

### 方式三：混合使用

全局设置 Antd 预设，局部覆盖个别组件：

```typescript
// main.tsx
FieldRegistry.setDefaultPreset(antdPreset);

// MyForm.tsx
<DynamicForm
  schema={schema}
  widgets={{
    // 只覆盖 select，其他使用 Antd 预设
    select: CustomSelectWidget,
  }}
/>
```

## 创建自定义预设

### 示例：Antd 预设

```typescript
// widgets/antd-preset.ts
import { Input, InputNumber, Select, Checkbox, Switch, Radio } from 'antd';
import { forwardRef } from 'react';
import type { WidgetPreset, FieldWidgetProps } from '@/components/DynamicForm';

// 1. 创建适配器组件
const AntdTextWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, value, onChange, onBlur }, ref) => {
    return (
      <Input
        ref={ref}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        status={error ? 'error' : undefined}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={onBlur}
      />
    );
  }
);

const AntdNumberWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, value, onChange, onBlur }, ref) => {
    return (
      <InputNumber
        ref={ref}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        status={error ? 'error' : undefined}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        style={{ width: '100%' }}
      />
    );
  }
);

const AntdSelectWidget = forwardRef<any, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, value, onChange, onBlur, options }, ref) => {
    return (
      <Select
        ref={ref}
        placeholder={placeholder}
        disabled={disabled || readonly}
        status={error ? 'error' : undefined}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        options={options?.map(opt => ({ label: opt.label, value: opt.value }))}
        style={{ width: '100%' }}
      />
    );
  }
);

// 2. 组装完整预设
export const antdPreset: WidgetPreset = {
  text: AntdTextWidget,
  textarea: AntdTextWidget, // 可以复用或创建专门的 TextArea
  password: AntdTextWidget,
  email: AntdTextWidget,
  url: AntdTextWidget,
  number: AntdNumberWidget,
  select: AntdSelectWidget,
  radio: AntdSelectWidget, // 简化示例，实际应创建 Radio.Group
  checkbox: AntdTextWidget, // 简化示例，实际应创建 Checkbox
  switch: AntdTextWidget, // 简化示例，实际应创建 Switch
  'nested-form': AntdTextWidget, // 复用 Blueprint 的实现或自定义
  array: AntdTextWidget, // 复用 Blueprint 的实现或自定义
  'key-value-array': AntdTextWidget,
  'table-array': AntdTextWidget,
};
```

## 最佳实践

### 1. 适配器模式

为每个组件库创建适配器，将其 API 转换为 `FieldWidgetProps` 接口：

```typescript
// 适配器负责：
// - Props 映射（error -> status）
// - 事件处理（onChange 参数转换）
// - 样式统一（width: 100%）
// - ref 转发
```

### 2. 复用复杂组件

对于复杂的 widgets（如 array、nested-form），可以复用 Blueprint 实现：

```typescript
import { ArrayFieldWidget, NestedFormWidget } from '@/components/DynamicForm/widgets';

export const antdPreset: WidgetPreset = {
  // ... 其他 Antd widgets
  array: ArrayFieldWidget, // 复用
  'nested-form': NestedFormWidget, // 复用
};
```

### 3. 渐进式迁移

不需要一次性实现所有 widgets，可以部分替换：

```typescript
import { blueprintPreset } from '@/components/DynamicForm';

export const antdPreset: PartialWidgetPreset = {
  ...blueprintPreset, // 继承 Blueprint 预设
  text: AntdTextWidget, // 只覆盖部分
  select: AntdSelectWidget,
};
```

## 注意事项

1. **ref 转发**：所有 widget 必须使用 `forwardRef` 以支持 React Hook Form
2. **onChange 参数**：确保 `onChange` 接收正确的值类型（不是事件对象）
3. **error 处理**：根据组件库的 API 正确映射错误状态
4. **样式一致性**：确保所有 widgets 的宽度和间距保持一致

## 完整示例

查看 `src/components/DynamicForm/presets/blueprint.ts` 了解完整的预设实现。
