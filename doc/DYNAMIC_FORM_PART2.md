# 动态表单组件技术方案 - Part 2

## JSON Schema 规范详解

> **标准 JSON Schema 规范**：关于 JSON Schema 的标准定义、基础类型、验证规则和条件验证机制，请参考 [JSON Schema 定义规范文档](./JSON_SCHEMA_DEFINITION.md)。
>
> 本文档主要介绍**项目特有的 UI 扩展规范**，包括 `ui` 字段的配置、Widget 类型、字段路径透明化等内容。

---

## 5. UI 扩展规范

### 5.1 基础类型的 UI 扩展

本节介绍各基础类型字段如何通过 `ui` 字段进行 UI 层面的扩展配置。

> **前置知识**：关于各基础类型的标准验证规则（如 `minLength`、`maximum`、`pattern` 等），请参考 [JSON Schema 定义规范 - 基础类型详解](./JSON_SCHEMA_DEFINITION.md#基础类型详解)。

#### 5.1.1 字符串类型的 UI 扩展

**UI 扩展属性**:

```json
{
  "type": "string",
  "ui": {
    "widget": "textarea",
    "placeholder": "请输入描述",
    "rows": 4
  }
}
```

#### 5.1.2 数字类型 (number/integer)

> **前置知识**：关于数字类型的标准验证规则（如 `minimum`、`maximum`、`multipleOf` 等），请参考 [JSON Schema 定义规范 - 数字类型](./JSON_SCHEMA_DEFINITION.md#数字类型-numberinteger)。

**UI 扩展属性**:

```json
{
  "type": "number",
  "ui": {
    "widget": "range",
    "step": 0.1,
    "unit": "元"
  }
}
```

#### 5.1.3 布尔类型 (boolean)

```json
{
  "type": "boolean",
  "title": "是否同意协议",
  "default": false
}
```

**UI 扩展属性**:

```json
{
  "type": "boolean",
  "ui": {
    "widget": "switch",
    "checkedText": "是",
    "uncheckedText": "否"
  }
}
```

#### 5.1.4 数组类型 (array)

> **前置知识**：关于数组类型的标准验证规则（如 `minItems`、`maxItems`、`uniqueItems`、`items` 等），请参考 [JSON Schema 定义规范 - 数组类型](./JSON_SCHEMA_DEFINITION.md#数组类型-array)。

**Array Widget 选择**:

DynamicForm 提供了三种不同的 Array Widget 来满足不同的使用场景：

| Widget | 适用场景 | 布局方式 | 虚拟滚动 | 详细文档 |
|--------|---------|---------|---------|---------|
| **ArrayFieldWidget** | 通用数组（支持任意类型） | 卡片式/列表式 | ✅ | [查看文档](./ARRAY_FIELD_WIDGET.md) |
| **KeyValueArrayWidget** | 键值对数组（如环境变量、映射） | 表格式（固定两列） | ❌ | [查看文档](./KEY_VALUE_ARRAY_WIDGET.md) |
| **TableArrayWidget** | 对象数组（表格展示） | 表格式（自动生成列） | ✅ | [查看文档](./TABLE_ARRAY_WIDGET.md) |

**ArrayFieldWidget 渲染逻辑**:

当使用 `ArrayFieldWidget`（默认）时，内部根据 `items` 配置自动选择渲染方式：

1. **枚举数组（items.enum 存在）** → 多选框组（checkboxes）
2. **对象数组（items.type === 'object'）** → 嵌套表单（nested-form）
3. **基本类型数组** → 对应的基础 widget（如 text、number）

> **重要提示**：基本类型数组（如字符串数组）在 ArrayFieldWidget 中会被包装成对象格式 `[{value: 'x'}]`，提交时需要转换。详见 [ArrayFieldWidget 文档](./ARRAY_FIELD_WIDGET.md)。

**示例 1: ArrayFieldWidget（枚举数组）**:

```json
{
  "type": "array",
  "title": "兴趣爱好",
  "items": {
    "type": "string",
    "enum": ["reading", "sports", "music"],
    "enumNames": ["阅读", "运动", "音乐"]
  },
  "uniqueItems": true,
  "ui": {
    "widget": "array"
  }
}
```

**示例 2: ArrayFieldWidget（对象数组）**:

```json
{
  "type": "array",
  "title": "联系人列表",
  "items": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "title": "姓名" },
      "phone": { "type": "string", "title": "电话" },
      "email": { "type": "string", "title": "邮箱" }
    },
    "required": ["name", "phone"]
  },
  "minItems": 1,
  "ui": {
    "widget": "array",
    "addButtonText": "添加联系人"
  }
}
```

> **说明**: 对象数组会自动为每个数组项渲染独立的嵌套表单卡片，支持动态添加/删除。

**示例 3: KeyValueArrayWidget（键值对数组）**:

```json
{
  "type": "array",
  "title": "环境变量",
  "items": {
    "type": "object",
    "properties": {
      "key": { "type": "string", "title": "Key" },
      "value": { "type": "string", "title": "Value" }
    }
  },
  "ui": {
    "widget": "key-value-array",
    "widgetProps": {
      "keyField": "key",
      "valueField": "value",
      "keyLabel": "变量名",
      "valueLabel": "变量值"
    }
  }
}
```

> **说明**: 适用于环境变量、HTTP 头、输出映射等键值对场景，提供简洁的表格式布局。

**示例 4: TableArrayWidget（表格数组）**:

```json
{
  "type": "array",
  "title": "用户列表",
  "items": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "title": "姓名" },
      "age": { "type": "number", "title": "年龄" },
      "email": { "type": "string", "title": "邮箱" }
    }
  },
  "ui": {
    "widget": "table-array",
    "widgetProps": {
      "enableVirtualScroll": true,
      "virtualScrollHeight": 400
    }
  }
}
```

> **说明**: 适用于需要表格形式展示的对象数组，支持虚拟滚动优化，适合大量数据场景。

**数组特定的 UI 配置**:

**通用配置（所有 Array Widget）**:

| 属性               | 类型                    | 说明                                      |
| ------------------ | ----------------------- | ----------------------------------------- |
| `addButtonText`    | `string`                | 添加按钮的文本                            |
| `arrayMode`        | `'dynamic' \| 'static'` | 渲染模式（dynamic: 可增删，static: 固定） |
| `showAddButton`    | `boolean`               | 是否显示添加按钮                          |
| `showRemoveButton` | `boolean`               | 是否显示删除按钮                          |

**KeyValueArrayWidget 特定配置**:

| 属性               | 类型     | 说明                     |
| ------------------ | -------- | ------------------------ |
| `keyField`         | `string` | 键字段名（默认: 'key'）  |
| `valueField`       | `string` | 值字段名（默认: 'value'）|
| `keyLabel`         | `string` | 键列标题（默认: 'Key'）  |
| `valueLabel`       | `string` | 值列标题（默认: 'Value'）|
| `keyPlaceholder`   | `string` | 键输入框占位符           |
| `valuePlaceholder` | `string` | 值输入框占位符           |

**TableArrayWidget 特定配置**:

| 属性                   | 类型       | 说明                                 |
| ---------------------- | ---------- | ------------------------------------ |
| `enableVirtualScroll`  | `boolean`  | 是否启用虚拟滚动（默认: false）      |
| `virtualScrollHeight`  | `number`   | 虚拟滚动容器高度（默认: 400px）      |
| `columns`              | `string[]` | 列顺序（默认按 properties 顺序）     |
| `emptyText`            | `string`   | 空状态提示文本（默认: 'No data'）    |

**详细文档**:
- [ArrayFieldWidget 完整文档](./ARRAY_FIELD_WIDGET.md) - 通用数组字段的配置选项、渲染模式、数据包装机制和最佳实践
- [KeyValueArrayWidget 完整文档](./KEY_VALUE_ARRAY_WIDGET.md) - 键值对数组的使用场景和配置
- [TableArrayWidget 完整文档](./TABLE_ARRAY_WIDGET.md) - 表格数组的虚拟滚动和列配置

#### 5.1.5 对象类型 (object)

> **前置知识**：关于对象类型的标准验证规则（如 `properties`、`required`、`additionalProperties` 等），请参考 [JSON Schema 定义规范 - 对象类型](./JSON_SCHEMA_DEFINITION.md#对象类型-object)。

对象类型会自动渲染为嵌套表单，支持多层嵌套结构。

### 5.2 完整表单 Schema 示例

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "用户注册表单",
  "description": "新用户注册信息",
  "properties": {
    "username": {
      "type": "string",
      "title": "用户名",
      "minLength": 3,
      "maxLength": 20,
      "pattern": "^[a-zA-Z0-9_]+$",
      "ui": {
        "placeholder": "请输入用户名"
      }
    },
    "email": {
      "type": "string",
      "title": "邮箱",
      "format": "email",
      "ui": {
        "placeholder": "example@email.com"
      }
    },
    "password": {
      "type": "string",
      "title": "密码",
      "minLength": 6,
      "ui": {
        "widget": "password",
        "placeholder": "至少6位字符"
      }
    },
    "age": {
      "type": "integer",
      "title": "年龄",
      "minimum": 18,
      "maximum": 100
    },
    "gender": {
      "type": "string",
      "title": "性别",
      "enum": ["male", "female", "other"],
      "enumNames": ["男", "女", "其他"],
      "ui": {
        "widget": "radio"
      }
    },
    "interests": {
      "type": "array",
      "title": "兴趣爱好",
      "items": {
        "type": "string",
        "enum": ["reading", "sports", "music", "travel"],
        "enumNames": ["阅读", "运动", "音乐", "旅行"]
      },
      "uniqueItems": true,
      "ui": {
        "widget": "checkboxes"
      }
    },
    "bio": {
      "type": "string",
      "title": "个人简介",
      "maxLength": 500,
      "ui": {
        "widget": "textarea",
        "rows": 4
      }
    },
    "agreeTerms": {
      "type": "boolean",
      "title": "同意用户协议",
      "const": true
    }
  },
  "required": ["username", "email", "password", "agreeTerms"]
}
```

### 5.3 UI 扩展规范

#### 5.3.1 通用 UI 属性

UI 配置通过 `ui` 字段扩展，支持以下属性：

| 属性            | 类型                                     | 说明                                                                                          |
| --------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| `widget`        | `string`                                 | 组件类型（text、select、radio 等）                                                            |
| `widgetProps`   | `Record<string, any>`                    | Widget 专属配置（如 CodeEditor 的 language、config 等），会被展开传递给 widget 组件            |
| `placeholder`   | `string`                                 | 占位符文本                                                                                    |
| `disabled`      | `boolean`                                | 是否禁用                                                                                      |
| `readonly`      | `boolean`                                | 是否只读                                                                                      |
| `hidden`        | `boolean`                                | 是否隐藏                                                                                      |
| `help`          | `string`                                 | 帮助文本                                                                                      |
| `className`     | `string`                                 | CSS 类名                                                                                      |
| `style`         | `React.CSSProperties`                    | 内联样式                                                                                      |
| `order`         | `string[]`                               | 字段顺序                                                                                      |
| `errorMessages` | `ErrorMessages`                          | 自定义错误信息                                                                                |
| `linkage`       | `LinkageConfig`                          | UI 联动配置（详见 [UI_LINKAGE_DESIGN.md](./UI_LINKAGE_DESIGN.md)）                            |
| `layout`        | `'vertical' \| 'horizontal' \| 'inline'` | 布局方式（优先级高于全局配置，层级越深优先级越高）                                            |
| `labelWidth`    | `number \| string`                       | 标签宽度（仅在 horizontal layout 下生效）                                                     |
| `flattenPath`   | `boolean`                                | 路径透明化：是否跳过该对象层级（详见 [FIELD_PATH_FLATTENING.md](./FIELD_PATH_FLATTENING.md)） |
| `flattenPrefix` | `boolean`                                | 路径透明化：是否添加当前字段 title 作为前缀                                                   |

> **完整类型定义**：详见 [PART3 - 组件架构设计](./DYNAMIC_FORM_PART3.md#核心类型定义)
>
> **动态嵌套表单**：使用 `linkage` 配置实现动态 schema 加载，详见 [UI_LINKAGE_DESIGN.md](./UI_LINKAGE_DESIGN.md) 和 [NESTED_FORM.md](./NESTED_FORM.md)

**ErrorMessages 错误信息配置**：

| 属性        | 类型     | 说明             |
| ----------- | -------- | ---------------- |
| `required`  | `string` | 必填错误信息     |
| `minLength` | `string` | 最小长度错误信息 |
| `maxLength` | `string` | 最大长度错误信息 |
| `min`       | `string` | 最小值错误信息   |
| `max`       | `string` | 最大值错误信息   |
| `pattern`   | `string` | 格式错误信息     |

#### 5.3.2 Readonly vs Disabled 详解

`readonly` 和 `disabled` 是两个容易混淆但有重要区别的属性：

**核心区别对比表**：

| 特性                   | Readonly                        | Disabled              |
| ---------------------- | ------------------------------- | --------------------- |
| **值是否可修改**       | ❌ 不可修改                     | ❌ 不可修改           |
| **表单提交时是否包含** | ✅ 包含在表单数据中             | ❌ 不包含在表单数据中 |
| **是否可聚焦**         | ✅ 可以聚焦（可选中、复制）     | ❌ 不可聚焦           |
| **是否可交互**         | ✅ 部分交互（如滚动、选择文本） | ❌ 完全不可交互       |
| **视觉样式**           | 正常样式（可能有只读标识）      | 灰色/禁用样式         |
| **Tab 键导航**         | ✅ 可以通过 Tab 键访问          | ❌ 跳过该字段         |
| **语义含义**           | 数据只读，但有效                | 字段不可用/不适用     |

**使用场景**：

**使用 Readonly 的场景**：

1. **显示已确认的数据**：订单已提交，显示订单详情但不允许修改
2. **权限限制**：用户只有查看权限，没有编辑权限
3. **审核/审批流程**：审核人员查看申请内容，但不能修改
4. **历史记录查看**：查看历史版本，不允许修改

**使用 Disabled 的场景**：

1. **条件性禁用**：依赖其他字段的值，某些字段暂时不可用
2. **加载状态**：数据加载中，禁用表单
3. **表单提交中**：提交中，防止重复提交
4. **不适用的字段**：根据用户类型，某些字段不适用

**示例**：

```typescript
// Readonly 示例：查看已提交的订单
<DynamicForm
  schema={orderSchema}
  defaultValues={submittedOrder}
  readonly={true}  // 只读模式，数据会包含在表单中
/>

// Disabled 示例：表单提交中
const [isSubmitting, setIsSubmitting] = useState(false);

<DynamicForm
  schema={schema}
  disabled={isSubmitting}  // 禁用模式，防止重复提交
  onSubmit={async (data) => {
    setIsSubmitting(true);
    await submitData(data);
    setIsSubmitting(false);
  }}
/>
```

**最佳实践**：

- ✅ 根据实际场景选择合适的属性
- ✅ 需要提交数据时使用 `readonly`
- ✅ 字段不适用或临时禁用时使用 `disabled`
- ❌ 避免同时使用两者（语义重复）

#### 5.3.3 布局方式配置 (layout)

`layout` 用于控制表单字段的布局方式，支持层级继承。

**配置方式**：

1. **全局配置**（通过 DynamicForm 组件属性）：

```typescript
<DynamicForm
  schema={schema}
  layout="horizontal"  // 全局默认布局
/>
```

2. **字段级配置**（通过 ui.layout）：

```json
{
  "type": "object",
  "ui": {
    "layout": "horizontal"
  },
  "properties": {
    "username": {
      "type": "string",
      "title": "用户名"
    }
  }
}
```

**优先级规则**：层级越深优先级越高

- 当前字段的 `ui.layout`（最高优先级）
- 父级字段的 `ui.layout`
- 全局 `DynamicFormProps.layout`（最低优先级）

**支持的值**：

- `vertical`：垂直布局（标签在上，输入框在下）
- `horizontal`：水平布局（标签在左，输入框在右）
- `inline`：内联布局

#### 5.3.4 标签宽度配置 (labelWidth)

`labelWidth` 用于控制表单标签的宽度，仅在 `layout="horizontal"` 时生效。

**配置方式**：

1. **全局配置**（通过 DynamicForm 组件属性）：

```typescript
<DynamicForm
  schema={schema}
  layout="horizontal"
  labelWidth={120}  // 全局默认标签宽度
/>
```

2. **字段级配置**（通过 ui.labelWidth）：

```json
{
  "type": "object",
  "properties": {
    "username": {
      "type": "string",
      "title": "用户名",
      "ui": {
        "labelWidth": 100
      }
    },
    "email": {
      "type": "string",
      "title": "电子邮箱地址",
      "ui": {
        "labelWidth": 150
      }
    }
  }
}
```

**优先级**：字段级 `ui.labelWidth` > 全局 `labelWidth`

**支持的值类型**：

- 数字：如 `120`（表示 120px）
- 字符串：如 `"120px"`、`"10rem"`、`"20%"`

#### 5.3.5 Widget 专属配置 (widgetProps)

`widgetProps` 用于传递 widget 组件的专属配置，这些配置会被展开传递给对应的 widget 组件。

**设计原则**：

- **通用 UI 配置**（如 `placeholder`、`disabled`、`readonly`）直接放在 `ui` 顶层
- **Widget 专属配置**（如 CodeEditor 的 `language`、`config`）放在 `ui.widgetProps` 下

**配置示例**：

```json
{
  "properties": {
    "code": {
      "type": "string",
      "title": "代码编辑器",
      "ui": {
        "widget": "code-editor",
        "placeholder": "请输入代码...",  // 通用配置
        "widgetProps": {  // Widget 专属配置
          "language": "javascript",
          "theme": "light",
          "config": {
            "previewLines": 5,
            "previewMaxHeight": 150,
            "modalPadding": 40
          }
        }
      }
    }
  }
}
```

**实现原理**：

FormField 组件会将 `widgetProps` 中的所有属性展开传递给 widget：

```typescript
<WidgetComponent
  {...controllerField}
  placeholder={field.placeholder}
  disabled={disabled}
  {...(field.schema?.ui?.widgetProps || {})}  // 展开 widgetProps
/>
```

**使用场景**：

1. **CodeEditor Widget**：传递 `language`、`config`、`theme`、`validator`、`formatter` 等配置
2. **自定义 Widget**：传递任何 widget 特定的配置项
3. **第三方 Widget**：传递第三方组件库的专属配置

#### 5.3.6 字段级 UI 配置

```json
{
  "properties": {
    "email": {
      "type": "string",
      "title": "Email",
      "ui": {
        "widget": "email",
        "placeholder": "Enter your email",
        "help": "We will never share your email",
        "className": "custom-email-field"
      }
    }
  }
}
```

#### 5.3.7 自定义错误信息

```json
{
  "properties": {
    "username": {
      "type": "string",
      "title": "Username",
      "minLength": 3,
      "maxLength": 20,
      "pattern": "^[a-zA-Z0-9_]+$",
      "ui": {
        "placeholder": "Enter username",
        "errorMessages": {
          "required": "Username is required",
          "minLength": "Username must be at least 3 characters",
          "maxLength": "Username cannot exceed 20 characters",
          "pattern": "Username can only contain letters, numbers and underscores"
        }
      }
    },
    "age": {
      "type": "integer",
      "title": "Age",
      "minimum": 18,
      "maximum": 100,
      "ui": {
        "errorMessages": {
          "required": "Please enter your age",
          "min": "You must be at least 18 years old",
          "max": "Age cannot exceed 100"
        }
      }
    }
  },
  "required": ["username", "age"]
}
```

#### 5.3.8 支持的 Widget 类型

| Widget 类型          | 适用字段类型        | 说明                                     |
| -------------------- | ------------------- | ---------------------------------------- |
| `text`               | string              | 单行文本输入                             |
| `textarea`           | string              | 多行文本输入                             |
| `password`           | string              | 密码输入                                 |
| `email`              | string              | 邮箱输入                                 |
| `url`                | string              | URL 输入                                 |
| `number`             | number/integer      | 数字输入                                 |
| `range`              | number/integer      | 滑块                                     |
| `select`             | string/number/array | 下拉选择（array 类型的默认 widget）      |
| `radio`              | string/number       | 单选按钮                                 |
| `checkboxes`         | array               | 多选框组（当 items.enum 存在时自动使用） |
| `checkbox`           | boolean             | 单个复选框                               |
| `switch`             | boolean             | 开关                                     |
| `date`               | string              | 日期选择                                 |
| `datetime`           | string              | 日期时间选择                             |
| `time`               | string              | 时间选择                                 |
| `color`              | string              | 颜色选择                                 |
| `file`               | string              | 文件上传                                 |
| `code-editor`        | string              | 代码编辑器（详见 CODE_EDITOR_WIDGET_DESIGN.md） |
| `array`              | array               | 通用数组（详见 ARRAY_FIELD_WIDGET.md）   |
| `key-value-array`    | array               | 键值对数组（详见 KEY_VALUE_ARRAY_WIDGET.md） |
| `table-array`        | array               | 表格数组（详见 TABLE_ARRAY_WIDGET.md）   |
| `nested-form`        | object/array        | 嵌套表单（详见 NESTED_FORM.md）          |

> **注意**：
>
> - **array 类型字段的 widget 选择规则**：
>   - 如果 `items.enum` 存在 → 自动使用 `checkboxes`（多选框组）
>   - 如果显式指定 `ui.widget` → 使用指定的 widget：
>     - `array` - ArrayFieldWidget（通用数组，支持任意类型）
>     - `key-value-array` - KeyValueArrayWidget（键值对数组）
>     - `table-array` - TableArrayWidget（表格数组，支持虚拟滚动）
>   - 如果 `items.type === 'object'` 且未指定 widget → 默认使用 `array`（ArrayFieldWidget）
>   - 其他情况 → 默认使用 `select`（下拉选择）
>
> - **Array Widget 选择建议**：
>   - **通用场景**：使用 `array`（ArrayFieldWidget），支持所有类型的数组
>   - **键值对场景**：使用 `key-value-array`（如环境变量、HTTP 头、输出映射）
>   - **表格展示场景**：使用 `table-array`（适合大量数据，支持虚拟滚动）
> - **object 类型字段**自动使用 `nested-form` widget，无需显式指定
> - `nested-form` widget 用于渲染嵌套对象和对象数组，支持静态和动态 schema
> - 对象数组使用 `nested-form` 时，每个数组项都会渲染为独立的嵌套表单卡片

#### 5.3.9 字段路径透明化（Field Path Flattening）

> **详细文档**：完整的设计和实现请参考 [字段路径透明化设计文档](./FIELD_PATH_FLATTENING.md)

字段路径透明化用于解决深层嵌套参数显示冗余的问题。当后端接口参数嵌套较深时，可以通过配置跳过中间层级，直接展示目标字段。

**核心特点（v3.0）**：

- 设置了 `flattenPath: true` 的对象字段**不会渲染 Card 组件**，避免多余的边框和 padding
- 字段路径使用标准 `.` 分隔符（如 `auth.content.key`），与普通嵌套字段完全相同
- 数据保持标准嵌套格式，无需路径转换

**配置属性**：

| 属性            | 类型      | 说明                                                      |
| --------------- | --------- | --------------------------------------------------------- |
| `flattenPath`   | `boolean` | 是否对该对象字段进行路径扁平化，跳过该层级直接展示子字段  |
| `flattenPrefix` | `boolean` | 是否在扁平化后的字段标签前添加当前字段的 `title` 作为前缀 |

**快速示例**：

```json
{
  "auth": {
    "type": "object",
    "title": "认证配置",
    "ui": { "flattenPath": true, "flattenPrefix": true },
    "properties": {
      "content": {
        "type": "object",
        "ui": { "flattenPath": true },
        "properties": {
          "key": { "type": "string", "title": "密钥" }
        }
      }
    }
  }
}
```

**效果**：表单显示 `认证配置 - 密钥`，提交数据 `{ auth: { content: { key: 'xxx' } } }`

更多使用场景、实现原理和最佳实践，请查看 [完整文档](./FIELD_PATH_FLATTENING.md)。

### 5.4 条件验证（Conditional Validation）

> **重要说明**：条件验证属于 **JSON Schema 标准的数据验证机制**，用于定义"在什么条件下，数据需要满足什么验证规则"。
>
> **完整文档**：关于条件验证的详细说明（dependencies、if/then/else、allOf/anyOf/oneOf 等），请参考 [JSON Schema 定义规范 - 条件验证机制](./JSON_SCHEMA_DEFINITION.md#条件验证机制)。
>
> **这不是 UI 联动逻辑**！如果你需要实现字段的显示/隐藏、禁用/启用等 UI 行为，请参考 [UI 联动设计文档](./UI_LINKAGE_DESIGN.md)。

### 5.5 自定义验证

#### 5.5.1 自定义格式验证

```json
{
  "type": "string",
  "format": "phone",
  "title": "手机号"
}
```

对应的验证器注册：

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);

// 自定义手机号格式
ajv.addFormat('phone', {
  validate: (data: string) => /^1[3-9]\d{9}$/.test(data)
});

// 在 DynamicForm 中使用
<DynamicForm
  schema={schema}
  customFormats={{
    phone: (value: string) => /^1[3-9]\d{9}$/.test(value)
  }}
/>
```

#### 5.5.2 自定义关键字验证

```typescript
ajv.addKeyword({
  keyword: 'isAdult',
  validate: (schema: boolean, data: number) => {
    return schema ? data >= 18 : true;
  },
});
```

使用：

```json
{
  "type": "integer",
  "title": "年龄",
  "isAdult": true
}
```

#### 5.5.3 跨字段验证

```json
{
  "type": "object",
  "properties": {
    "password": {
      "type": "string",
      "title": "密码",
      "minLength": 6
    },
    "confirmPassword": {
      "type": "string",
      "title": "确认密码",
      "ui": {
        "widget": "password",
        "validation": {
          "function": "matchPassword",
          "dependencies": ["password"]
        }
      }
    }
  }
}
```

对应的验证函数：

```typescript
const customValidators = {
  matchPassword: (value: string, formData: any) => {
    if (value !== formData.password) {
      return '两次密码输入不一致';
    }
    return true;
  }
};

<DynamicForm
  schema={schema}
  customValidators={customValidators}
/>
```

---

## 6. UI 联动逻辑

> **重要提示**：本文档主要介绍 JSON Schema 的数据验证机制。
>
> 如果你需要实现 **UI 层面的字段联动**（如字段显示/隐藏、禁用/启用、值的自动计算等），请参考：
>
> **[UI 联动设计文档 (UI_LINKAGE_DESIGN.md)](./UI_LINKAGE_DESIGN.md)**
>
> 该文档详细介绍了如何通过 `ui.linkage` 扩展字段实现 UI 联动逻辑，并与 react-hook-form 深度集成。

---

**下一部分**: 组件架构设计
