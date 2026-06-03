# 动态表单组件技术方案 - Part 4

## 代码实现示例

> **重要说明**：
>
> 本文档展示的是实际生产环境中的完整实现，包含了嵌套表单、数组字段、联动管理等高级特性。
>
> **关于 UI 组件库的选择**：
>
> - 动态表单的核心架构与具体的 UI 组件库是**完全解耦**的
> - 当前实现使用 **Blueprint.js** 作为 UI 组件库，但这只是一个实现选择
> - 开发者可以自由选择任何 UI 组件库（Ant Design、Material-UI、Chakra UI 等）
> - 只需实现符合 `FieldWidgetProps` 接口的 Widget 组件即可
> - 通过 `FieldRegistry.register()` 或 `widgets` prop 可以轻松替换或扩展 Widget
>
> 本文档中的 Widget 示例使用 Blueprint 组件，但你可以用任何组件库实现相同的功能。

---

## 相关文档

本文档是动态表单技术方案的第四部分，提供核心代码实现示例和快速参考。

**系列文档**：

- [Part 1: 核心架构](./DYNAMIC_FORM_PART1.md) - 整体架构设计
- [Part 2: Schema 解析](./DYNAMIC_FORM_PART2.md) - Schema 解析机制
- [Part 3: 高级特性](./DYNAMIC_FORM_PART3.md) - 高级特性说明
- **Part 4: 代码实现**（本文档）- 代码实现示例

**专题文档**：

- [嵌套表单设计](./NESTED_FORM.md) - 嵌套表单的完整设计和实现
- [数组字段设计](./ARRAY_FIELD_WIDGET.md) - ArrayFieldWidget 的完整设计
- [数组字段联动](./ARRAY_FIELD_LINKAGE.md) - 数组字段联动的详细方案
- [字段路径透明化](./FIELD_PATH_FLATTENING.md) - 路径扁平化特性
- [字段路径指南](./FIELD_PATH_GUIDE.md) - 路径系统完全指南
- [UI 联动设计](./UI_LINKAGE_DESIGN.md) - UI 联动的完整设计

---

### 7.1 主组件实现

#### 7.1.1 组件架构说明

动态表单采用**分层架构**设计：

1. **外层组件 (`DynamicForm`)**：提供 `NestedSchemaProvider` 上下文
2. **内层组件 (`DynamicFormInner`)**：实现核心表单逻辑
3. **支持两种模式**：
   - **独立表单模式**：创建自己的 `FormProvider`
   - **嵌套表单模式**：复用父表单的 `FormContext`（通过 `asNestedForm` prop）

#### 7.1.2 核心实现（简化版）

```typescript
// src/components/DynamicForm/DynamicForm.tsx

import React, { useMemo } from 'react';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { Button } from '@blueprintjs/core';
import { SchemaParser } from './core/SchemaParser';
import { FormField } from './layout/FormField';
import { ErrorList } from './components/ErrorList';
import type { DynamicFormProps } from './types';
import { parseSchemaLinkages, transformToAbsolutePaths } from '@/utils/schemaLinkageParser';
import { useArrayLinkageManager } from '@/hooks/useArrayLinkageManager';
import { filterValueWithNestedSchemas } from './utils/filterValueWithNestedSchemas';
import {
  NestedSchemaProvider,
  useNestedSchemaRegistryOptional,
} from './context/NestedSchemaContext';
import { PathPrefixProvider } from './context/PathPrefixContext';
import { LinkageStateProvider, useLinkageStateContext } from './context/LinkageStateContext';
import { PathTransformer } from '@/utils/pathTransformer';
import { wrapPrimitiveArrays, unwrapPrimitiveArrays } from './utils/arrayTransformer';

// 空对象常量，避免每次渲染创建新对象
const EMPTY_LINKAGE_FUNCTIONS = {};
const EMPTY_WIDGETS = {};
const EMPTY_CUSTOM_FORMATS = {};

// 内层组件：实际的表单逻辑
const DynamicFormInner: React.FC<DynamicFormProps> = ({
  schema,
  defaultValues = {},
  onSubmit,
  onChange,
  widgets,
  linkageFunctions,
  customFormats,
  layout = 'vertical',
  labelWidth,
  showErrorList = false,
  showSubmitButton = true,
  validateMode = 'onSubmit',
  loading = false,
  disabled = false,
  readonly = false,
  className,
  style,
  pathPrefix = '',
  asNestedForm = false,
}) => {
  // 使用稳定的空对象引用，避免每次渲染创建新对象导致 useEffect 重复触发
  const stableLinkageFunctions = linkageFunctions || EMPTY_LINKAGE_FUNCTIONS;
  const stableWidgets = widgets || EMPTY_WIDGETS;
  const stableCustomFormats = customFormats || EMPTY_CUSTOM_FORMATS;

  // 检查是否使用了路径扁平化
  const useFlattenPath = useMemo(() => SchemaParser.hasFlattenPath(schema), [schema]);

  // 设置自定义格式验证器并解析字段
  const fields = useMemo(() => {
    if (stableCustomFormats && Object.keys(stableCustomFormats).length > 0) {
      SchemaParser.setCustomFormats(stableCustomFormats);
    }
    const parsedFields = SchemaParser.parse(schema);

    // 如果是嵌套表单模式且有路径前缀，为字段名添加前缀
    if (asNestedForm && pathPrefix) {
      return parsedFields.map(field => ({
        ...field,
        name: `${pathPrefix}.${field.name}`,
      }));
    }
    return parsedFields;
  }, [schema, stableCustomFormats, asNestedForm, pathPrefix]);

  // 处理 defaultValues：包装基本类型数组 + 路径扁平化
  const processedDefaultValues = useMemo(() => {
    if (!defaultValues) return undefined;

    // 第一步：包装基本类型数组
    const wrappedData = wrapPrimitiveArrays(defaultValues, schema);

    // 第二步：如果使用了路径扁平化，使用基于 Schema 的转换
    if (!useFlattenPath) return wrappedData;
    return PathTransformer.nestedToFlatWithSchema(wrappedData, schema);
  }, [defaultValues, useFlattenPath, schema]);

  // 尝试获取父表单的 FormContext（用于嵌套表单模式）
  const parentFormContext = useFormContext();

  // 只有非嵌套表单模式才创建新的 useForm 实例
  const ownMethods = useForm({
    defaultValues: processedDefaultValues,
    mode: validateMode,
  });

  // 根据模式选择使用哪个 form methods
  const methods = asNestedForm && parentFormContext ? parentFormContext : ownMethods;

  // ... 省略联动管理和其他逻辑 ...
};
```

#### 7.1.3 数据处理流程

**提交时的数据转换**：

```typescript
const onSubmitHandler = async (data: Record<string, any>) => {
  if (onSubmit) {
    // 第一步：如果使用了路径扁平化，将扁平数据转换回嵌套结构
    let processedData = useFlattenPath
      ? PathTransformer.flatToNestedWithSchema(data, schema)
      : data;

    // 第二步：解包基本类型数组（将对象数组转换回基本类型数组）
    processedData = unwrapPrimitiveArrays(processedData, schema);

    // 第三步：根据当前 schema 过滤数据，只保留 schema 中定义的字段
    const filteredData = filterValueWithNestedSchemas(
      processedData,
      schema,
      nestedSchemaRegistry?.getAllSchemas() || new Map()
    );

    await onSubmit(filteredData);
  }
};
```

**外层组件：提供 Context**：

```typescript
// 外层组件：提供 NestedSchemaProvider
export const DynamicForm: React.FC<DynamicFormProps> = props => {
  const existingRegistry = useNestedSchemaRegistryOptional();

  if (existingRegistry) {
    return <DynamicFormInner {...props} />;
  }

  return (
    <NestedSchemaProvider>
      <DynamicFormInner {...props} />
    </NestedSchemaProvider>
  );
};
```

### 7.2 字段包装器实现

#### 7.2.1 嵌套错误处理

FormField 组件支持嵌套路径的错误获取（如 `address.city`）：

```typescript
// src/components/DynamicForm/layout/FormField.tsx

import React from 'react';
import { useFormContext, Controller, type FieldErrors } from 'react-hook-form';
import { FormGroup } from '@blueprintjs/core';
import { FieldLabel } from '../components/FieldLabel';
import { FieldError } from '../components/FieldError';
import { FieldHelp } from '../components/FieldHelp';
import { FieldRegistry } from '../core/FieldRegistry';
import type { FieldConfig } from '../types/schema';
import type { LinkageResult } from '../types/linkage';

/**
 * 根据嵌套路径获取错误信息
 * 例如：getNestedError(errors, 'address.city') 会返回 errors.address?.city
 */
function getNestedError(errors: FieldErrors, path: string): string | undefined {
  const parts = path.split('.');
  let current: any = errors;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[part];
  }

  return current?.message as string | undefined;
}

interface FormFieldProps {
  field: FieldConfig;
  disabled?: boolean;
  readonly?: boolean;
  widgets?: Record<string, React.ComponentType<any>>;
  linkageState?: LinkageResult;
  layout?: 'vertical' | 'horizontal' | 'inline';
  labelWidth?: number | string;
}

export const FormField: React.FC<FormFieldProps> = ({
  field,
  disabled,
  readonly,
  widgets = {},
  linkageState,
  layout = 'vertical',
  labelWidth,
}) => {
  const {
    control,
    formState: { errors },
    setValue,
  } = useFormContext();

  // 当联动状态中有值时，自动设置字段值
  React.useEffect(() => {
    if (linkageState?.value !== undefined) {
      setValue(field.name, linkageState.value);
    }
  }, [linkageState?.value, field.name, setValue]);

  const WidgetComponent = widgets[field.widget] || FieldRegistry.getWidget(field.widget);

  if (!WidgetComponent) {
    console.warn(`Widget "${field.widget}" not found`);
    return null;
  }

  // 使用 getNestedError 支持嵌套路径的错误获取（如 address.city）
  const error = getNestedError(errors, field.name);

  // 计算 layout 的优先级：字段级 > 父级 > 全局级
  const effectiveLayout = field.schema?.ui?.layout ?? layout;

  // 计算 labelWidth 的优先级：字段级 > 全局级
  const effectiveLabelWidth = field.schema?.ui?.labelWidth ?? labelWidth;

  // 构建 FormGroup 的样式，需要覆盖 Blueprint 的默认样式
  const formGroupStyle: React.CSSProperties = {};
  if (effectiveLayout === 'horizontal') {
    formGroupStyle.flexDirection = 'row';  // 覆盖 Blueprint 的 column
    formGroupStyle.alignItems = 'flex-start';
  } else if (effectiveLayout === 'inline') {
    formGroupStyle.display = 'inline-flex';
    formGroupStyle.marginRight = '15px';
  }

  // 构建 label 的样式
  const labelStyle: React.CSSProperties = {};
  if (effectiveLayout === 'horizontal' && effectiveLabelWidth) {
    labelStyle.width = typeof effectiveLabelWidth === 'number'
      ? `${effectiveLabelWidth}px`
      : effectiveLabelWidth;
    labelStyle.flexShrink = 0;
    labelStyle.marginRight = '12px';
  }

  return (
    <FormGroup
      label={
        field.label ? (
          <div style={labelStyle}>
            <FieldLabel htmlFor={field.name} label={field.label} required={field.required} />
          </div>
        ) : undefined
      }
      labelFor={field.name}
      helperText={field.description ? <FieldHelp text={field.description} /> : undefined}
      intent={error ? 'danger' : 'none'}
      style={formGroupStyle}
    >
      <Controller
        name={field.name}
        control={control}
        rules={field.validation}
        render={({ field: controllerField }) => (
          <WidgetComponent
            {...controllerField}
            placeholder={field.placeholder}
            disabled={disabled || field.disabled}
            readonly={readonly || field.readonly}
            options={field.options}
            error={error}
            schema={field.schema}
            layout={effectiveLayout}
            labelWidth={effectiveLabelWidth}
          />
        )}
      />
      {error && <FieldError message={error} />}
    </FormGroup>
  );
};
```

> **注意**：此实现使用了 Blueprint 的 `FormGroup` 组件，但你可以替换为任何其他 UI 库的表单组件。

### 7.2.2 基本类型数组的字段路径格式

**重要说明**：对于基本类型数组（如 `string[]`、`number[]`），ArrayFieldWidget 会将其包装为对象数组，字段路径会自动添加 `.value` 后缀。

**字段路径格式**：

```typescript
// Schema 定义
{
  tags: {
    type: 'array',
    items: { type: 'string' }
  }
}

// 内部数据结构（自动包装）
{
  tags: [
    { value: 'tag1' },
    { value: 'tag2' }
  ]
}

// 字段路径格式
'tags.0.value'  // 第一个标签的值
'tags.1.value'  // 第二个标签的值
```

**为什么需要包装？**

- react-hook-form 的 `useFieldArray` 会过滤掉基本类型的空值（空字符串、0、false）
- 包装成对象后，即使 value 为空，对象本身也不会被过滤
- 这确保了数组项的稳定性和可编辑性

**提交时的数据转换**：

```typescript
const handleSubmit = (data: any) => {
  // DynamicForm 会自动解包基本类型数组
  // 提交的数据会是纯数组格式：['tag1', 'tag2']
  console.log(data.tags); // ['tag1', 'tag2']
};
```

> **详细说明**：关于基本类型数组的完整处理机制，请参考 [ArrayFieldWidget 设计方案](./ARRAY_FIELD_WIDGET.md) 的第 3.1 节和第 6.1 节。

### 7.3 字段组件示例

> **关于 Widget 实现**：
>
> - 以下示例使用 **Blueprint.js** 组件库实现
> - 这只是一个实现选择，你可以使用任何 UI 组件库
> - 关键是实现符合 `FieldWidgetProps` 接口的组件
> - 所有 Widget 都使用 `forwardRef` 包装，以支持 react-hook-form 的 ref 传递

#### 7.3.1 文本输入组件（Blueprint 实现）

```typescript
// src/components/DynamicForm/widgets/TextWidget.tsx

import React, { forwardRef } from 'react';
import { InputGroup } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';

export const TextWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, ...rest }, ref) => {
    return (
      <InputGroup
        inputRef={ref}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        intent={error ? 'danger' : 'none'}
        {...rest}
      />
    );
  }
);

TextWidget.displayName = 'TextWidget';
```

**如果使用原生 HTML**：

```typescript
export const TextWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, error, ...rest }, ref) => {
    return (
      <input
        ref={ref}
        type="text"
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readonly}
        className={`text-widget ${error ? 'text-widget--error' : ''}`}
        {...rest}
      />
    );
  }
);
```

#### 7.3.2 下拉选择组件（Blueprint 实现）

```typescript
// src/components/DynamicForm/widgets/SelectWidget.tsx

import React, { forwardRef } from 'react';
import { HTMLSelect } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';

export const SelectWidget = forwardRef<HTMLSelectElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, options = [], error, value, onChange, ...rest }, ref) => {
    return (
      <HTMLSelect
        elementRef={ref}
        name={name}
        disabled={disabled || readonly}
        intent={error ? 'danger' : 'none'}
        fill
        value={value ?? ''}
        onChange={e => onChange?.(e.target.value)}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </HTMLSelect>
    );
  }
);

SelectWidget.displayName = 'SelectWidget';
```

**如果使用原生 HTML**：

```typescript
export const SelectWidget = forwardRef<HTMLSelectElement, FieldWidgetProps>(
  ({ name, placeholder, disabled, readonly, options = [], error, ...rest }, ref) => {
    return (
      <select
        ref={ref}
        name={name}
        disabled={disabled || readonly}
        className={`select-widget ${error ? 'select-widget--error' : ''}`}
        {...rest}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(option => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);
```

#### 7.3.3 单选按钮组（Blueprint 实现）

```typescript
// src/components/DynamicForm/widgets/RadioWidget.tsx

import React, { forwardRef } from 'react';
import { RadioGroup, Radio } from '@blueprintjs/core';
import type { FieldWidgetProps } from '../types';
import type { FieldOption } from '../types/schema';

export const RadioWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, disabled, readonly, options = [], value, onChange }, ref) => {
    return (
      <RadioGroup
        name={name}
        disabled={disabled || readonly}
        selectedValue={value}
        onChange={e => {
          const target = e.target as HTMLInputElement;
          onChange?.(target.value);
        }}
      >
        {options.map((option: FieldOption) => (
          <Radio
            key={option.value}
            label={option.label}
            value={option.value}
            disabled={option.disabled}
          />
        ))}
      </RadioGroup>
    );
  }
);

RadioWidget.displayName = 'RadioWidget';
```

**如果使用原生 HTML**：

```typescript
export const RadioWidget = forwardRef<HTMLInputElement, FieldWidgetProps>(
  ({ name, disabled, readonly, options = [], error, onChange, ...rest }, ref) => {
    return (
      <div className={`radio-widget ${error ? 'radio-widget--error' : ''}`}>
        {options.map((option, index) => (
          <label
            key={option.value}
            className={`radio-widget__option ${
              option.disabled ? 'radio-widget__option--disabled' : ''
            }`}
          >
            <input
              ref={index === 0 ? ref : undefined}
              type="radio"
              name={name}
              value={option.value}
              disabled={disabled || readonly || option.disabled}
              onChange={onChange}
              {...rest}
            />
            <span className="radio-widget__label">{option.label}</span>
          </label>
        ))}
      </div>
    );
  }
);
```

### 7.4 字段注册表

```typescript
// src/components/DynamicForm/core/FieldRegistry.ts

import type { WidgetType } from '../types/schema';
import {
  TextWidget,
  PasswordWidget,
  TextareaWidget,
  NumberWidget,
  SelectWidget,
  RadioWidget,
  CheckboxWidget,
  SwitchWidget,
  NestedFormWidget,
  UrlWidget,
  ArrayFieldWidget,
} from '../widgets';

export class FieldRegistry {
  private static widgets: Map<WidgetType, React.ComponentType<any>> = new Map<
    WidgetType,
    React.ComponentType<any>
  >([
    ['text', TextWidget],
    ['textarea', TextareaWidget],
    ['password', PasswordWidget], // 独立的密码输入组件
    ['email', TextWidget],
    ['url', UrlWidget], // URL 输入组件
    ['number', NumberWidget],
    ['select', SelectWidget],
    ['radio', RadioWidget],
    ['checkbox', CheckboxWidget],
    ['switch', SwitchWidget],
    ['nested-form', NestedFormWidget], // 嵌套表单组件（用于 object 类型）
    ['array', ArrayFieldWidget], // 数组字段组件
  ]);

  /**
   * 注册自定义 Widget
   */
  static register(type: WidgetType, component: React.ComponentType<any>) {
    this.widgets.set(type, component);
  }

  /**
   * 获取 Widget 组件
   */
  static getWidget(type: WidgetType): React.ComponentType<any> | undefined {
    return this.widgets.get(type);
  }

  /**
   * 批量注册 Widgets
   */
  static registerBatch(widgets: Record<string, React.ComponentType<any>>) {
    Object.entries(widgets).forEach(([type, component]) => {
      this.register(type as WidgetType, component);
    });
  }
}
```

**新增的 Widget 类型说明**：

- **`PasswordWidget`**：专门的密码输入组件，支持显示/隐藏密码
- **`UrlWidget`**：URL 输入组件，带有 URL 格式验证
- **`NestedFormWidget`**：用于渲染 `object` 类型字段的嵌套表单
- **`ArrayFieldWidget`**：用于渲染 `array` 类型字段的数组管理组件

### 7.5 JSON Schema 标准条件渲染实现

#### 7.5.1 条件渲染说明

动态表单支持 JSON Schema 标准的条件渲染方式：

- `if/then/else` - 条件分支
- `dependencies` - 字段依赖

这些是 JSON Schema 规范的一部分，无需额外的 UI 扩展。

#### 7.5.2 SchemaParser 处理条件逻辑

```typescript
// src/components/DynamicForm/core/SchemaParser.ts (扩展)

export class SchemaParser {
  /**
   * 解析 Schema 时处理条件逻辑
   */
  static parse(schema: ExtendedJSONSchema): FieldConfig[] {
    const fields: FieldConfig[] = [];

    if (schema.type !== 'object' || !schema.properties) {
      return fields;
    }

    // 解析基础字段
    const baseFields = this.parseProperties(schema);

    // 处理 if/then/else 条件
    if (schema.if) {
      const conditionalFields = this.parseConditionalSchema(schema);
      return [...baseFields, ...conditionalFields];
    }

    return baseFields;
  }

  /**
   * 解析条件 Schema
   */
  private static parseConditionalSchema(schema: ExtendedJSONSchema): FieldConfig[] {
    // 条件渲染由表单运行时动态处理
    // SchemaParser 只负责解析所有可能的字段
    const thenFields = schema.then ? this.parseProperties(schema.then) : [];
    const elseFields = schema.else ? this.parseProperties(schema.else) : [];

    return [...thenFields, ...elseFields];
  }
}
```

---

**说明**:

- JSON Schema 的条件逻辑在运行时由表单动态处理
- SchemaParser 负责解析所有可能出现的字段
- 字段的显示/隐藏由 JSON Schema 验证引擎控制

---

## 8. 高级特性实现

### 8.1 嵌套表单（NestedFormWidget）

嵌套表单用于渲染 `object` 类型的字段，支持递归嵌套。

**核心特性**：

- **复用父表单的 FormContext**：通过 `asNestedForm` prop 实现
- **路径前缀管理**：自动为嵌套字段添加路径前缀（如 `address.city`）
- **联动状态继承**：子表单可以访问父表单的联动状态
- **Schema 注册**：通过 `NestedSchemaProvider` 管理嵌套 schema
- **动态 Schema 切换**：支持根据字段值动态切换子表单 schema
- **避免双层 Card 嵌套**：在 ArrayFieldWidget 中使用时，通过 `noCard={true}` 参数避免渲染多余的 Card 组件

**快速示例**：

```typescript
const schema = {
  type: 'object',
  properties: {
    address: {
      type: 'object',
      title: '地址',
      properties: {
        city: { type: 'string', title: '城市' },
        street: { type: 'string', title: '街道' },
      },
    },
  },
};
// 字段路径：address.city, address.street
```

> **详细说明**：关于嵌套表单的完整设计和实现，请参考 [嵌套表单设计](./NESTED_FORM.md)

### 8.2 数组字段（ArrayFieldWidget）

数组字段用于渲染 `array` 类型的字段，支持动态添加/删除元素。

**核心特性**：

- **动态元素管理**：支持添加、删除、排序数组元素
- **基本类型数组包装**：自动将基本类型数组（如 `string[]`）包装为对象数组
- **嵌套数组支持**：数组元素可以是对象或嵌套数组
- **联动实例化**：为每个数组元素动态创建联动实例

**快速示例**：

```typescript
// 基本类型数组
const schema = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      title: '标签',
      items: { type: 'string' },
    },
  },
};
// 内部包装为: [{ value: 'tag1' }, { value: 'tag2' }]
// 字段路径: tags.0.value, tags.1.value
```

> **详细说明**：关于数组字段的完整设计和实现，请参考 [ArrayFieldWidget 设计方案](./ARRAY_FIELD_WIDGET.md)

### 8.3 联动管理（useArrayLinkageManager）

联动管理是动态表单的核心特性之一，支持字段间的动态交互。

**核心特性**：

- **统一联动处理**：同时处理普通字段和数组元素的联动
- **动态实例化**：为数组元素动态创建联动实例
- **路径映射支持**：支持 `flattenPath` 场景的路径转换
- **联动状态继承**：子表单可以访问父表单的联动状态

**快速示例**：

```typescript
// Schema 中定义联动
const schema = {
  type: 'object',
  properties: {
    country: {
      type: 'string',
      title: '国家',
      enum: ['china', 'usa'],
    },
    city: {
      type: 'string',
      title: '城市',
      ui: {
        linkages: [
          {
            source: ['country'],
            target: 'city',
          }
        ],
      },
    },
  },
};
```

> **详细说明**：
>
> - 关于 UI 联动的完整设计和实现，请参考 [UI 联动设计](./UI_LINKAGE_DESIGN.md)
> - 关于数组字段联动的详细方案，请参考 [数组字段联动](./ARRAY_FIELD_LINKAGE.md)
