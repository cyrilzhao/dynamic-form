# 字段路径透明化设计方案

## 1. 概述

字段路径透明化（Field Path Flattening）是一个用于解决深层嵌套参数显示冗余问题的特性。当后端接口参数嵌套较深时（如 `{auth: {content: {key: ''}}}`），用户可能只需要填写最内层的 `key` 字段，但如果按照标准的嵌套表单方式展示所有层级会显得过于冗余，并且会产生多余的 Card 边框和 padding。

通过在 `ui` 配置中添加 `flattenPath` 属性，DynamicForm 可以在渲染时隐藏中间层级的视觉容器（Card、边框、padding），直接展示目标字段，同时保持完整的嵌套数据结构。

**核心特点**：
- 设置了 `flattenPath: true` 的对象字段会渲染 NestedFormWidget，但使用透明容器（无 Card、无 padding）
- 这些中间层级在 UI 上视觉"透明"，只显示最终的叶子节点字段
- 数据结构保持标准的嵌套格式（如 `{auth: {content: {key: 'value'}}}`），无需路径转换
- 完整支持所有联动类型，包括 schema 联动

---

## 2. 应用场景

### 2.1 场景 1：深层嵌套的 API 配置

```typescript
// 后端接口要求的数据结构
{
  auth: {
    content: {
      key: 'api-key-123'
    }
  }
}

// 用户实际只需要填写 key 字段
// 使用路径透明化后，表单只显示一个 "API Key" 输入框
```

### 2.2 场景 2：复杂的配置对象

```typescript
// 后端接口要求的数据结构
{
  service: {
    database: {
      connection: {
        host: 'localhost',
        port: 3306,
        username: 'admin',
        password: 'secret'
      }
    }
  }
}

// 使用路径透明化后，表单直接显示：
// - 数据库 - 主机地址
// - 数据库 - 端口
// - 数据库 - 用户名
// - 数据库 - 密码
```

---

## 3. 核心特性

1. **视觉透明化，保留组件结构**：
   - 设置了 `flattenPath: true` 的对象字段**会渲染 NestedFormWidget**，但使用透明容器
   - 透明容器：无 Card 边框、无 padding、不显示字段标题
   - 中间层级在 UI 上视觉"透明"，只显示最终的叶子节点字段
   - 组件结构保持嵌套，支持所有功能（包括 schema 联动）

2. **标准数据结构**：表单数据保持标准的嵌套格式，无需路径转换
   - 字段路径使用标准的 `.` 分隔符（如 `auth.content.key`）
   - 数据结构：`{auth: {content: {key: 'value'}}}`
   - 无需逻辑路径和物理路径的转换

3. **可选前缀**：支持在字段标签前添加父级标题作为前缀

4. **完整功能支持**：
   - ✅ 支持所有联动类型（visibility、disabled、value、options、**schema**）
   - ✅ 支持验证规则
   - ✅ 支持数组字段
   - ✅ 支持嵌套表单

5. **向后兼容**：不影响现有的嵌套表单功能

---

## 4. 类型定义

### 4.1 扩展的 UIConfig 类型

```typescript
// src/types/schema.ts

export interface UIConfig {
  widget?: WidgetType;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  help?: string;
  className?: string;
  style?: React.CSSProperties;
  order?: string[];
  errorMessages?: ErrorMessages;
  linkage?: LinkageConfig;

  // 路径透明化配置
  flattenPath?: boolean;        // 是否对该对象字段进行路径扁平化
  flattenPrefix?: boolean;      // 是否在扁平化后的字段标签前添加当前字段的 title

  [key: string]: any;
}
```

### 4.2 配置说明

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `flattenPath` | `boolean` | `false` | 是否对该对象字段进行路径扁平化。设置为 `true` 时，该对象的子字段会被提升到父级显示 |
| `flattenPrefix` | `boolean` | `false` | 是否在扁平化后的字段标签前添加当前字段的 `title`。设置为 `true` 时，会自动使用当前字段的 `title` 作为前缀 |

---

## 5. Schema 配置示例

### 5.1 基础用法：不带前缀的透明化

```json
{
  "type": "object",
  "properties": {
    "auth": {
      "type": "object",
      "title": "认证信息",
      "ui": {
        "flattenPath": true
      },
      "properties": {
        "content": {
          "type": "object",
          "ui": {
            "flattenPath": true
          },
          "properties": {
            "key": {
              "type": "string",
              "title": "API Key",
              "minLength": 10
            }
          }
        }
      }
    }
  }
}
```

**渲染效果**：
- 表单只显示一个字段：`API Key`
- 用户输入：`abc123456789`
- 提交数据：`{ auth: { content: { key: 'abc123456789' } } }`

### 5.2 带前缀的透明化

```json
{
  "type": "object",
  "properties": {
    "auth": {
      "type": "object",
      "title": "认证配置",
      "ui": {
        "flattenPath": true,
        "flattenPrefix": true
      },
      "properties": {
        "content": {
          "type": "object",
          "ui": {
            "flattenPath": true
          },
          "properties": {
            "key": {
              "type": "string",
              "title": "密钥"
            },
            "secret": {
              "type": "string",
              "title": "密文",
              "ui": {
                "widget": "password"
              }
            }
          }
        }
      }
    }
  }
}
```

**渲染效果**：
- 表单显示：
  - `认证配置 - 密钥`
  - `认证配置 - 密文`
- 提交数据：`{ auth: { content: { key: '...', secret: '...' } } }`

### 5.3 多层前缀叠加

```json
{
  "type": "object",
  "properties": {
    "service": {
      "type": "object",
      "title": "服务",
      "ui": {
        "flattenPath": true,
        "flattenPrefix": true
      },
      "properties": {
        "auth": {
          "type": "object",
          "title": "认证",
          "ui": {
            "flattenPath": true,
            "flattenPrefix": true
          },
          "properties": {
            "credentials": {
              "type": "object",
              "ui": {
                "flattenPath": true
              },
              "properties": {
                "username": {
                  "type": "string",
                  "title": "用户名"
                },
                "password": {
                  "type": "string",
                  "title": "密码",
                  "ui": { "widget": "password" }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**渲染效果**：
- 表单显示：
  - `服务 - 认证 - 用户名`
  - `服务 - 认证 - 密码`
- 提交数据：`{ service: { auth: { credentials: { username: 'admin', password: '***' } } } }`

### 5.4 混合使用：部分透明化 + 部分正常嵌套

```json
{
  "type": "object",
  "properties": {
    "basicInfo": {
      "type": "object",
      "title": "基本信息",
      "properties": {
        "name": { "type": "string", "title": "名称" },
        "description": { "type": "string", "title": "描述" }
      }
    },
    "advancedConfig": {
      "type": "object",
      "title": "高级配置",
      "ui": {
        "flattenPath": true,
        "flattenPrefix": true
      },
      "properties": {
        "performance": {
          "type": "object",
          "ui": {
            "flattenPath": true
          },
          "properties": {
            "timeout": {
              "type": "integer",
              "title": "超时时间"
            },
            "retries": {
              "type": "integer",
              "title": "重试次数"
            }
          }
        }
      }
    }
  }
}
```

**渲染效果**：
```
基本信息（嵌套表单）
  ├─ 名称
  └─ 描述
高级配置 - 超时时间
高级配置 - 重试次数
```

---

## 6. 实现方案

### 6.1 核心实现原理

路径透明化的实现非常简洁，**只需要修改 NestedFormWidget 的渲染逻辑**：

1. **Schema 解析阶段**（SchemaParser）：
   - 正常解析所有字段，包括设置了 `flattenPath: true` 的对象字段
   - 对象类型字段自动使用 `nested-form` widget
   - 使用标准的 `.` 分隔符构建字段路径（如 `auth.content.key`）
   - 支持 `flattenPrefix` 来添加标签前缀

2. **表单渲染阶段**（NestedFormWidget）：
   - 检查字段的 `schema.ui.flattenPath` 配置
   - 如果为 `true`，使用透明容器（`<div>`，无 Card、无 padding）
   - 如果为 `false`，使用标准容器（`<Card>`，有边框、有 padding）

3. **数据结构**：
   - 保持标准的嵌套格式，无需任何路径转换
   - defaultValues、onChange、onSubmit 都使用标准的嵌套对象

### 6.2 SchemaParser 实现

SchemaParser 无需特殊处理 flattenPath，正常解析所有字段即可：

```typescript
// src/components/DynamicForm/core/SchemaParser.ts

export class SchemaParser {
  /**
   * 解析 Schema 生成字段配置
   */
  static parse(schema: ExtendedJSONSchema, options: ParseOptions = {}): FieldConfig[] {
    const { parentPath = '', prefixLabel = '', inheritedUI } = options;
    const fields: FieldConfig[] = [];

    if (schema.type !== 'object' || !schema.properties) {
      return fields;
    }

    const properties = schema.properties;
    const required = schema.required || [];
    const order = schema.ui?.order || Object.keys(properties);

    for (const key of order) {
      const property = properties[key];
      if (!property || typeof property === 'boolean') continue;

      const fieldSchema = property as ExtendedJSONSchema;

      // 构建字段路径（使用标准的 . 分隔符）
      const currentPath = parentPath ? `${parentPath}.${key}` : key;

      // 处理 flattenPrefix：如果字段设置了 flattenPrefix，添加标签前缀
      const newPrefixLabel =
        fieldSchema.ui?.flattenPrefix && fieldSchema.title
          ? prefixLabel
            ? `${prefixLabel} - ${fieldSchema.title}`
            : fieldSchema.title
          : prefixLabel;

      // 处理 UI 配置继承（用于 flattenPath 场景）
      const newInheritedUI = {
        layout: fieldSchema.ui?.layout ?? inheritedUI?.layout,
        labelWidth: fieldSchema.ui?.labelWidth ?? inheritedUI?.labelWidth,
      };

      // 正常解析字段（包括 flattenPath 字段）
      const fieldConfig = this.parseField(
        currentPath,
        fieldSchema,
        required.includes(key),
        newPrefixLabel,
        newInheritedUI
      );

      if (!fieldConfig.hidden) {
        fields.push(fieldConfig);
      }
    }

    return fields;
  }
}
```

**关键点**：
- 所有字段统一处理，包括设置了 `flattenPath: true` 的对象字段
- 使用标准的 `.` 分隔符构建字段路径
- 对象类型字段会自动使用 `nested-form` widget（在 `getWidget` 方法中）
- `flattenPrefix` 配置用于添加标签前缀
- UI 配置（layout、labelWidth）会继承给子字段

### 6.3 NestedFormWidget 实现

**这是路径透明化的核心实现**，只需要根据 `flattenPath` 配置决定使用哪种容器：

```typescript
// src/components/DynamicForm/widgets/NestedFormWidget.tsx

export const NestedFormWidget = forwardRef<HTMLDivElement, NestedFormWidgetProps>(
  ({ name, schema, disabled, readonly, layout, labelWidth, noCard = false }, ref) => {
    // ... 现有的状态管理和联动逻辑 ...

    const formContent = (
      <DynamicForm
        schema={currentSchema}
        disabled={disabled}
        readonly={readonly}
        layout={layout}
        labelWidth={labelWidth}
        showSubmitButton={false}
        renderAsForm={false}
        pathPrefix={fullPath}
        asNestedForm={true}
      />
    );

    // 检查是否使用 flattenPath
    const useFlattenPath = schema.ui?.flattenPath;

    // 根据 flattenPath 或 noCard 决定渲染方式
    if (useFlattenPath || noCard) {
      // 透明容器：无 Card、无 padding、无标题
      return (
        <div
          ref={ref}
          className="nested-form-widget--flatten"
          data-name={name}
        >
          {formContent}
        </div>
      );
    }

    // 标准容器：有 Card、有 padding、有标题
    return (
      <Card
        ref={ref}
        className="nested-form-widget"
        data-name={name}
        elevation={1}
        style={{ padding: '15px' }}
      >
        {formContent}
      </Card>
    );
  }
);
```

**关键点**：
- 检查 `schema.ui.flattenPath` 配置
- `flattenPath: true` → 使用透明 `<div>` 容器
- `flattenPath: false` → 使用标准 `<Card>` 容器
- 组件结构保持嵌套，支持所有功能（包括 schema 联动）

### 6.4 数据处理

新方案下，DynamicForm 组件无需特殊处理 flattenPath：

```typescript
// src/components/DynamicForm/DynamicForm.tsx

const DynamicFormInner: React.FC<DynamicFormProps> = ({
  schema,
  defaultValues = {},
  onSubmit,
  onChange,
  ...props
}) => {
  // 解析字段配置（正常解析，无需特殊处理）
  const fields = useMemo(() => SchemaParser.parse(schema), [schema]);

  // 处理 defaultValues：只需要包装基本类型数组
  const processedDefaultValues = useMemo(() => {
    if (!defaultValues) return undefined;
    return wrapPrimitiveArrays(defaultValues, schema);
  }, [defaultValues, schema]);

  const methods = useForm({
    defaultValues: processedDefaultValues,
    mode: validateMode,
  });

  // 处理表单提交
  const onSubmitHandler = async (data: Record<string, any>) => {
    if (onSubmit) {
      // 解包基本类型数组
      let processedData = unwrapPrimitiveArrays(data, schema);

      // 过滤数据
      processedData = filterValueWithNestedSchemas(
        processedData,
        schema,
        nestedSchemaRegistry?.getAllSchemas() || new Map()
      );

      await onSubmit(processedData);
    }
  };

  // ... 渲染逻辑
};
```

**关键点**：
- 无需路径转换，数据保持标准的嵌套格式
- 只需要处理基本类型数组的包装/解包
- 代码大幅简化，易于维护

---

## 7. 完整使用示例

### 7.1 示例 1：深层嵌套的 API 配置

```typescript
const schema = {
  type: 'object',
  properties: {
    apiConfig: {
      type: 'object',
      title: 'API 配置',
      ui: {
        flattenPath: true,
        flattenPrefix: true
      },
      properties: {
        authentication: {
          type: 'object',
          ui: {
            flattenPath: true
          },
          properties: {
            credentials: {
              type: 'object',
              ui: {
                flattenPath: true
              },
              properties: {
                apiKey: {
                  type: 'string',
                  title: '密钥',
                  minLength: 10
                },
                apiSecret: {
                  type: 'string',
                  title: '密文',
                  ui: {
                    widget: 'password'
                  }
                }
              },
              required: ['apiKey']
            }
          }
        }
      }
    },
    endpoint: {
      type: 'string',
      title: '接口地址',
      format: 'uri'
    }
  }
};

// 使用
<DynamicForm
  schema={schema}
  defaultValues={{
    apiConfig: {
      authentication: {
        credentials: {
          apiKey: 'existing-key-123'
        }
      }
    },
    endpoint: 'https://api.example.com'
  }}
  onSubmit={(data) => {
    console.log('提交数据:', data);
    // 输出：
    // {
    //   apiConfig: {
    //     authentication: {
    //       credentials: {
    //         apiKey: 'new-key-456',
    //         apiSecret: 'secret'
    //       }
    //     }
    //   },
    //   endpoint: 'https://api.example.com'
    // }
  }}
/>
```

### 7.2 示例 2：数据库配置

```typescript
const databaseSchema = {
  type: 'object',
  properties: {
    database: {
      type: 'object',
      title: '数据库',
      ui: {
        flattenPath: true,
        flattenPrefix: true
      },
      properties: {
        connection: {
          type: 'object',
          ui: {
            flattenPath: true
          },
          properties: {
            host: {
              type: 'string',
              title: '主机地址',
              default: 'localhost'
            },
            port: {
              type: 'integer',
              title: '端口',
              default: 3306,
              minimum: 1,
              maximum: 65535
            },
            username: {
              type: 'string',
              title: '用户名'
            },
            password: {
              type: 'string',
              title: '密码',
              ui: {
                widget: 'password'
              }
            }
          },
          required: ['host', 'port', 'username', 'password']
        }
      }
    }
  }
};

// 渲染效果：
// - 数据库 - 主机地址
// - 数据库 - 端口
// - 数据库 - 用户名
// - 数据库 - 密码
```

### 7.3 示例 3：复杂的路径透明化 + 数组 + 联动

这是一个综合示例，展示了路径透明化、数组字段和联动配置的组合使用。

**Schema 配置**：

```typescript
const schema = {
  type: 'object',
  properties: {
    enableRegion: {
      type: 'boolean',
      title: '启用地区配置',
      default: true,
    },
    region: {
      title: '地区',
      type: 'object',
      ui: { flattenPath: true, flattenPrefix: true },
      properties: {
        market: {
          type: 'object',
          title: '市场',
          ui: { flattenPath: true },
          properties: {
            contacts: {
              type: 'array',
              title: '联系人列表',
              items: {
                type: 'object',
                properties: {
                  auth: {
                    type: 'object',
                    properties: {
                      apiKey: { type: 'string', title: 'API Key' },
                      apiSecret: { type: 'string', title: 'API Secret' },
                    },
                  },
                  category: {
                    type: 'object',
                    title: '分类',
                    ui: { flattenPath: true, flattenPrefix: true },
                    properties: {
                      group: {
                        type: 'object',
                        title: '分组',
                        ui: { flattenPath: true, flattenPrefix: true },
                        properties: {
                          type: { type: 'string', title: '类型', enum: ['vip', 'normal'] },
                          name: { type: 'string', title: '名称' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
```

**生成的字段路径**：

```typescript
// 顶层字段
'enableRegion'

// 数组字段（使用标准的 . 分隔符）
'region.market.contacts'

// 数组元素内部字段（假设索引为 0）
'region.market.contacts.0.auth.apiKey'
'region.market.contacts.0.auth.apiSecret'
'region.market.contacts.0.category.group.type'
'region.market.contacts.0.category.group.name'
```

**说明**：
- 新方案使用标准的 `.` 分隔符构建字段路径
- 数据结构保持标准的嵌套格式
- flattenPath 只影响视觉呈现（是否显示 Card 边框），不影响路径和数据结构

---

## 8. 与其他特性的配合

### 8.1 与验证规则配合

```json
{
  "type": "object",
  "properties": {
    "config": {
      "type": "object",
      "title": "配置",
      "ui": {
        "flattenPath": true,
        "flattenPrefix": true
      },
      "properties": {
        "settings": {
          "type": "object",
          "ui": {
            "flattenPath": true
          },
          "properties": {
            "apiKey": {
              "type": "string",
              "title": "API 密钥",
              "minLength": 10,
              "maxLength": 50,
              "pattern": "^[A-Za-z0-9_-]+$",
              "ui": {
                "errorMessages": {
                  "required": "API 密钥不能为空",
                  "minLength": "API 密钥至少需要 10 个字符",
                  "pattern": "API 密钥只能包含字母、数字、下划线和连字符"
                }
              }
            }
          },
          "required": ["apiKey"]
        }
      }
    }
  }
}
```

**说明**：验证规则正常工作，无需特殊处理。flattenPath 只影响视觉呈现，不影响验证逻辑。

### 8.2 与 UI 联动配合

```json
{
  "type": "object",
  "properties": {
    "enableAuth": {
      "type": "boolean",
      "title": "启用认证"
    },
    "auth": {
      "type": "object",
      "title": "认证",
      "ui": {
        "flattenPath": true,
        "flattenPrefix": true,
        "linkage": {
          "type": "visibility",
          "dependencies": ["enableAuth"],
          "condition": {
            "field": "enableAuth",
            "operator": "==",
            "value": true
          }
        }
      },
      "properties": {
        "credentials": {
          "type": "object",
          "ui": {
            "flattenPath": true
          },
          "properties": {
            "username": {
              "type": "string",
              "title": "用户名"
            },
            "password": {
              "type": "string",
              "title": "密码",
              "ui": {
                "widget": "password"
              }
            }
          }
        }
      }
    }
  }
}
```

**说明**：
- 当 `enableAuth` 为 `true` 时，显示 `认证 - 用户名` 和 `认证 - 密码` 字段
- **新方案完整支持所有联动类型**，包括 visibility、disabled、value、options、**schema** 联动
- flattenPath 字段可以正常使用联动功能，无需特殊处理

### 8.3 与布局配置（layout 和 labelWidth）配合

**重要特性**：当使用路径透明化时，父级对象的 `layout` 和 `labelWidth` 配置会自动继承到被扁平化的子字段上。

```json
{
  "type": "object",
  "properties": {
    "address": {
      "type": "object",
      "title": "地址信息",
      "ui": {
        "flattenPath": true,
        "flattenPrefix": true,
        "layout": "horizontal",
        "labelWidth": 120
      },
      "properties": {
        "details": {
          "type": "object",
          "ui": {
            "flattenPath": true
          },
          "properties": {
            "province": {
              "type": "string",
              "title": "省份"
            },
            "city": {
              "type": "string",
              "title": "城市"
            },
            "street": {
              "type": "string",
              "title": "街道",
              "ui": {
                "labelWidth": 80  // 子字段可以覆盖继承的配置
              }
            }
          }
        }
      }
    }
  }
}
```

**渲染效果**：
- `地址信息 - 省份`：使用 horizontal 布局，标签宽度 120px
- `地址信息 - 城市`：使用 horizontal 布局，标签宽度 120px
- `地址信息 - 街道`：使用 horizontal 布局，标签宽度 80px（覆盖了父级的 120px）

**配置继承规则**：
1. 设置了 `flattenPath: true` 的对象字段的 `layout` 和 `labelWidth` 配置会传递给其子字段
2. 多层嵌套时，配置会逐层传递和合并
3. 子字段可以通过自己的 `ui.layout` 或 `ui.labelWidth` 覆盖继承的配置
4. 优先级：子字段配置 > 父级配置 > 全局配置

**实现原理**：

SchemaParser 在解析时会将父级的 UI 配置传递给子字段：

```typescript
// 当检测到 flattenPath: true 时
if (fieldSchema.type === 'object' && fieldSchema.ui?.flattenPath) {
  // 准备要继承的 UI 配置
  const inheritedUI = {
    layout: fieldSchema.ui.layout ?? parentInheritedUI?.layout,
    labelWidth: fieldSchema.ui.labelWidth ?? parentInheritedUI?.labelWidth,
  };

  // 递归解析子字段，传递 UI 配置
  const nestedFields = this.parse(fieldSchema, {
    parentPath: currentPath,
    prefixLabel: newPrefixLabel,
    inheritedUI,
  });
}
```

在 `parseField` 方法中，继承的配置会合并到字段的 schema 中：

```typescript
// 如果有继承的 UI 配置，合并到 schema 中
if (inheritedUI && (inheritedUI.layout || inheritedUI.labelWidth)) {
  finalSchema = {
    ...schema,
    ui: {
      ...ui,
      // 只有当字段自己没有配置时，才使用继承的配置
      layout: ui.layout ?? inheritedUI.layout,
      labelWidth: ui.labelWidth ?? inheritedUI.labelWidth,
    },
  };
}
```

**使用场景**：
- 需要对一组扁平化的字段统一设置布局样式
- 避免在每个子字段上重复配置相同的 layout 和 labelWidth
- 保持代码简洁，同时保留子字段覆盖配置的灵活性

---

## 9. 最佳实践

### 9.1 何时使用路径透明化

**适合使用的场景**：
- ✅ 后端接口参数嵌套深度超过 2 层
- ✅ 中间层级没有实际业务意义，只是数据结构的组织方式
- ✅ 用户只需要关注最内层的实际字段
- ✅ 表单字段数量较少（< 10 个）

**不适合使用的场景**：
- ❌ 嵌套层级有明确的业务分组意义
- ❌ 需要展示层级结构帮助用户理解
- ❌ 字段数量很多，需要分组管理
- ❌ 不同层级的字段有不同的权限控制

### 9.2 前缀使用建议

**使用前缀的场景**：
- 多个透明化对象的字段可能产生命名冲突
- 需要保留一定的上下文信息帮助用户理解
- 表单字段较多，需要通过前缀进行逻辑分组

**不使用前缀的场景**：
- 只有一个透明化对象
- 字段名称已经足够清晰，不需要额外上下文
- 追求最简洁的表单展示

### 9.3 性能考虑

1. **路径转换开销**：
   - 扁平化和嵌套化转换有一定性能开销
   - 建议在字段数量 < 50 时使用
   - 大量字段时考虑分页或分步表单

2. **缓存优化**：
   ```typescript
   // 使用 useMemo 缓存转换结果
   const flatDefaultValues = useMemo(() => {
     if (!defaultValues) return undefined;
     return PathTransformer.nestedToFlat(defaultValues);
   }, [defaultValues]);
   ```

3. **避免过度嵌套**：
   - 建议透明化深度不超过 4 层
   - 过深的嵌套会导致字段名过长

---

## 10. 注意事项

### 10.1 字段名冲突

**新方案下不存在字段名冲突问题**：

```json
{
  "type": "object",
  "properties": {
    "config1": {
      "type": "object",
      "ui": { "flattenPath": true },
      "properties": {
        "name": { "type": "string", "title": "名称1" }
      }
    },
    "config2": {
      "type": "object",
      "ui": { "flattenPath": true },
      "properties": {
        "name": { "type": "string", "title": "名称2" }
      }
    }
  }
}
```

**说明**：
- 字段路径分别为 `config1.name` 和 `config2.name`，不会冲突
- 如果需要更清晰的标签，可以使用 `flattenPrefix: true` 添加前缀
- 新方案使用标准的嵌套路径，天然避免了冲突问题

### 10.2 Card 渲染行为

**新方案**：设置了 `flattenPath: true` 的对象字段**会渲染 NestedFormWidget**，但使用透明容器。

```typescript
// 多层 flattenPath 嵌套
{
  api: {                    // 设置 flattenPath: true
    auth: {                 // 设置 flattenPath: true
      content: {            // 设置 flattenPath: true
        name: 'value'       // 实际字段
      }
    }
  }
}

// ✅ 实际渲染：
// - 渲染 3 层 NestedFormWidget（api、auth、content）
// - 每层都使用透明容器（<div>，无 Card、无 padding）
// - 视觉效果：只显示一个输入框，没有边框和间距
// - 字段路径：api.auth.content.name
```

**说明**：
- 组件结构保持嵌套，但视觉上透明
- 支持所有功能（包括 schema 联动）
- 多层透明容器堆叠，视觉效果等同于扁平展示

### 10.3 数组字段的处理

路径透明化不适用于数组类型的字段：

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "ui": {
        "flattenPath": true  // ❌ 对数组无效
      },
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" }
        }
      }
    }
  }
}
```

**说明**：数组字段应该使用标准的数组组件或嵌套表单组件。

### 10.4 与嵌套表单的区别

| 特性 | 路径透明化 | 嵌套表单 |
|------|-----------|---------|
| 渲染方式 | 视觉扁平，组件嵌套 | 保留层级结构 |
| Card 组件 | 渲染 NestedFormWidget，但使用透明容器（无 Card） | 渲染 NestedFormWidget + Card |
| 适用场景 | 中间层级无业务意义 | 层级有明确业务分组 |
| 字段路径 | 标准嵌套路径（`auth.content.key`） | 标准嵌套路径（`auth.content.key`） |
| 数据结构 | 标准嵌套结构 | 标准嵌套结构 |
| UI 展示 | 视觉扁平，无边框和间距 | 字段按层级分组展示，有 Card 边框 |
| 功能支持 | ✅ 完整支持所有联动（包括 schema） | ✅ 完整支持所有联动 |

---

## 11. 总结

字段路径透明化是一个强大的特性，可以有效解决深层嵌套参数显示冗余的问题。通过合理使用 `flattenPath` 和 `flattenPrefix` 配置，可以在保持数据结构完整性的同时，为用户提供简洁清晰的表单界面。

**核心优势**：
- ✅ 配置简单，只需添加 `ui.flattenPath: true`
- ✅ 实现简洁，只需修改 NestedFormWidget 的渲染逻辑
- ✅ 无需路径转换，数据保持标准的嵌套格式
- ✅ 完整支持所有联动类型（包括 **schema 联动**）
- ✅ 向后兼容，不影响现有功能
- ✅ 代码易于维护，架构清晰
- ✅ 可以与正常嵌套表单混合使用，灵活控制 UI 展示

**使用建议**：
- 优先考虑业务场景，确认是否真的需要透明化
- 合理使用前缀，平衡简洁性和可读性
- 需要 Card 边框分组时使用正常嵌套表单，不需要时使用路径透明化
- 可以在同一个表单中混合使用两种方式，灵活控制 UI 展示

---

**创建日期**: 2025-12-26
**最后更新**: 2026-01-09
**版本**: 3.0
**文档状态**: 已重构

## 变更历史

### v3.0 (2026-01-09)

**重大重构**：简化 flattenPath 实现方案

**主要变更**：

1. **实现方案简化**
   - ✅ 移除复杂的路径转换逻辑（`~~` 分隔符、PathMapping、路径转换函数）
   - ✅ 使用标准的 `.` 分隔符构建字段路径
   - ✅ 数据保持标准的嵌套格式，无需转换
   - ✅ 只需修改 NestedFormWidget 的渲染逻辑

2. **功能完整性提升**
   - ✅ 完整支持所有联动类型（包括 **schema 联动**）
   - ✅ 组件结构保持嵌套，支持所有功能
   - ✅ 视觉透明化，使用透明容器替代 Card

3. **架构优势**
   - ✅ 代码大幅简化，易于维护
   - ✅ 无路径冲突问题
   - ✅ 性能更好（无路径转换开销）
   - ✅ 向后兼容

**核心思路**：
- 旧方案：跳过中间层级，不渲染 NestedFormWidget，使用 `~~` 分隔符和路径转换
- 新方案：渲染 NestedFormWidget，但使用透明容器，保持标准路径和数据结构

### v2.6 (2025-12-29)
- **重要修复**：修复了 `PathTransformer.flattenItemWithSchema` 方法中的数据转换错误
- 问题：数组元素内部的普通嵌套对象（未设置 `flattenPath`）被错误地扁平化处理
- 解决：区分 `flattenPath` 对象和普通嵌套对象，只对设置了 `flattenPath: true` 的对象进行路径扁平化
- 影响：修复后，数组元素内部的普通对象（如 `auth`）会保持嵌套结构，defaultValues 可以正确回显

### v2.5 (2025-12-29)
- 新增 7.3 节：复杂的路径透明化 + 数组 + 联动综合示例
- 添加了完整的 Schema 配置和逻辑路径解析示例
- 详细说明了混合使用 flattenPath 和普通对象时的路径生成规则

### v2.4 (2025-12-29)
- 重要更新：修复了 SchemaParser 中的路径计算逻辑
- 新增 `buildFieldPath` 方法，正确处理 flattenPath 链中的路径生成
- 更新了 6.2 节的 SchemaParser 实现示例，展示完整的路径生成逻辑
- 添加了路径生成规则的详细说明

### v2.3 (2025-12-29)
- 重要更新：逻辑路径现在使用 `~~` 分隔符（如 `auth~~content~~key`），避免路径冲突
- 新增统一的路径生成工具函数 `buildLogicalPath` 和 `buildPhysicalPath`
- 更新了 SchemaParser 实现，使用统一的路径生成函数
- 更新了 PathTransformer 示例，展示正确的逻辑路径格式

### v2.2 (2025-12-28)
- 更新了 PathTransformer 工具类文档，新增基于 Schema 的转换方法说明
- 将 `nestedToFlatWithSchema` 和 `flatToNestedWithSchema` 标记为推荐方法
- 更新了 DynamicForm 组件集成代码示例，使用基于 Schema 的转换方法
- 说明了简单转换方法（`nestedToFlat`/`flatToNested`）不适用于 `flattenPath` 场景

### v2.1 (2025-12-27)
- 更新了实现方案，明确了路径透明化不会渲染 Card 和 NestedFormWidget
- 添加了 SchemaParser.hasFlattenPath() 方法说明
- 更新了 DynamicForm 组件集成方式，支持自动检测和数据转换
- 补充了基本类型数组的包装/解包处理说明
- 补充了数据过滤机制（filterValueWithNestedSchemas）的说明
- 添加了嵌套表单和路径透明化混合使用的示例
- 补充了 Card 渲染行为的说明
