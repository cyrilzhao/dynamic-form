# 动态表单联动系统设计

> **文档定位：** 本文是 UI 联动的唯一现行设计入口，统一收录基础模型、执行架构、异步机制和数组联动。JSON Schema 条件验证不属于 UI 联动，参见 [Schema 与验证设计](./schema-and-validation.md)。

> **现行 API 勘误（2026-08-10）：** 当前只支持 `ui.linkages[]`，不支持单个 `ui.linkage`。联动函数签名为 `({ formData, context, helpers }) => value | Promise<value>`，`context` 包含 `externalData`。文中仍出现的 `ui.linkage`、`fn(formData, context)`、`async (formData)` 和旧 `src/types`/`src/utils` 路径均作为历史内容阅读。
>
> 多规则合并以当前 `useLinkageManager.ts` 为准：visibility 使用 AND，disabled/readonly 使用 OR，value/options 后者覆盖，schema 按顺序浅合并。竞态控制以 `linkageOperationController.ts` 的运行令牌和版本检查为准，早期仅使用序列号或“状态直接合并”的说明不再代表当前实现。

## 阅读导航

- [基础模型与配置](#1-设计原则)：联动职责、类型、条件和效果。
- [实现架构](#6-实现方案)：解析、依赖图、分层计算和 DynamicForm 集成。
- [异步联动详细设计](#13-异步联动详细设计)：竞态、串行依赖和死循环防护。
- [数组联动详细设计](#14-数组联动详细设计)：相对路径、动态索引、嵌套数组和聚合。
- [历史问题记录](../archive/README.md#已解决问题)：已修复的闭包和竞态问题。

## 来源说明

本文合并原 `LINKAGE.md`、`ASYNC_LINKAGE.md` 和 `ARRAY_FIELD_LINKAGE.md`。原章节正文保留在对应分区，跨文档链接统一改为文内入口。

## 1. 设计原则

### 1.1 职责分离

- **JSON Schema**：负责数据验证（Validation）
  - 使用标准的 `required`、`minLength`、`pattern` 等进行数据校验
  - 使用 `dependencies`、`if/then/else`、`allOf/anyOf/oneOf` 进行条件验证

- **UI 扩展（ui 字段）**：负责 UI 联动逻辑（UI Logic）
  - 字段的显示/隐藏
  - 字段的禁用/启用
  - 字段的只读状态
  - 字段值的自动计算
  - 字段选项的动态变化

### 1.2 与 react-hook-form 的集成

利用 react-hook-form 的核心 API：

- `watch(fieldName)` - 监听字段变化
- `setValue(fieldName, value)` - 设置字段值
- `trigger(fieldName)` - 触发字段验证
- `getValues()` - 获取所有表单值

## 2. UI 联动配置规范

### 2.1 基础结构

```typescript
interface UILinkageConfig {
  // 联动类型
  type: 'visibility' | 'disabled' | 'readonly' | 'value' | 'options' | 'schema';

  // 依赖的字段
  dependencies: string[];

  // options 联动发现当前值不在新选项中时的处理策略，默认 'clear'
  invalidValuePolicy?: 'clear' | 'retain' | 'fallback';

  // invalidValuePolicy 为 'fallback' 时的替代值，必须存在于最终 options 中
  fallbackValue?: unknown;

  // 条件表达式或函数名（描述"什么时候触发联动"）
  when?: ConditionExpression | string;

  // 条件满足时的效果（描述"触发后做什么"）
  fulfill?: LinkageEffect;

  // 条件不满足时的效果
  otherwise?: LinkageEffect;

  // 是否启用缓存（默认 false，禁用缓存）
  // 建议仅为异步联动（如 API 调用）启用缓存
  enableCache?: boolean;
}

interface LinkageEffect {
  // 状态变更
  state?: {
    visible?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
  };
  // 直接指定值（用于 value 类型）
  value?: any;
  // 直接指定选项（用于 options 类型）
  options?: Array<{ label: string; value: any }>;
  // 通过函数计算（根据 linkage.type 决定计算结果的用途）
  function?: string;
  // 直接指定 schema（用于 schema 类型，不推荐，建议使用 function）
  schema?: any;
}
```

**设计说明**：

- **职责分离**：`when` 描述条件（什么时候触发），`fulfill/otherwise` 描述效果（触发后做什么）
- **统一接口**：`function` 字段根据 `linkage.type` 自动适配：
  - `value` 类型：函数返回值赋给 `result.value`
  - `options` 类型：函数返回值赋给 `result.options`
  - `schema` 类型：函数返回值赋给 `result.schema`（支持异步加载）
  - `visibility`/`disabled`/`readonly` 类型：函数返回值转为 boolean
- **灵活性**：支持直接指定值/选项/schema（`value`/`options`/`schema`），也支持函数计算（`function`）
- **异步支持**：所有联动函数都支持异步操作，系统会自动处理异步竞态条件
- **缓存优化**：默认禁用联动结果缓存，可通过 `enableCache: true` 为异步联动启用缓存
- **历史值策略**：`invalidValuePolicy` 仅由 `options` 联动使用。默认 `clear` 会清空单选失效值、过滤多选失效项；`retain` 保留历史值，适用于业务永久禁用但仍允许提交历史数据的字段；`fallback` 对单选字段写入配置的有效替代值

### 2.2 条件表达式语法

支持简单的条件表达式，避免使用 eval：

```typescript
// 单条件表达式
interface SingleCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

// 逻辑组合表达式
interface LogicalCondition {
  and?: ConditionExpression[];
  or?: ConditionExpression[];
}

// 条件表达式（联合类型）
export type ConditionExpression = SingleCondition | LogicalCondition;

// 条件操作符
type ConditionOperator =
  | '=='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'in'
  | 'notIn'
  | 'includes'
  | 'notIncludes'
  | 'isEmpty'
  | 'isNotEmpty';
```

**说明**：使用联合类型确保类型安全，单条件和逻辑组合不能混用。

### 2.3 路径引用格式

联动配置中的字段引用支持以下格式：

| 格式             | 语法               | 使用场景               | 示例                               |
| ---------------- | ------------------ | ---------------------- | ---------------------------------- |
| **JSON Pointer** | `#/properties/...` | 跨层级字段引用（推荐） | `#/properties/user/properties/age` |
| **相对路径**     | `./fieldName`      | 数组元素内部字段引用   | `./type`                           |
| **简单字段名**   | `fieldName`        | 同级字段引用（不推荐） | `age`                              |

**推荐使用 JSON Pointer 格式**，它提供了明确的路径语义，避免歧义。

**JSON Pointer 路径规范**：

路径段含义由上下文状态决定，系统使用状态机解析：

- `properties` 总是关键字，下一段是字段名（无论叫什么）
- `items` 在字段名之后出现时是数组关键字，下一段仍是关键字
- `items` 在 `properties` 之后出现时是字段名（如 `#/properties/items`）

| 路径 | 解析结果 | 说明 |
|------|---------|------|
| `#/properties/items` | `items` | `items` 紧跟 `properties`，是字段名 |
| `#/properties/arr/items/properties/name` | `arr.name` | `items` 紧跟 `arr`，是数组关键字 |
| `#/properties/properties/properties` | `properties` | 中间的 `properties` 紧跟关键字，是字段名 |

**注意**：只支持严格格式，不支持省略中间 `properties` 的简化格式（如 `#/properties/user/age` 是非法的，应写为 `#/properties/user/properties/age`）。

详细的路径系统说明请参考：[字段路径完全指南](../guides/field-path.md)

## 3. 使用示例

### 3.1 字段显示/隐藏

```json
{
  "type": "object",
  "properties": {
    "hasAddress": {
      "type": "boolean",
      "title": "是否填写地址"
    },
    "address": {
      "type": "string",
      "title": "详细地址",
      "ui": {
        "linkages": [
          {
            "type": "visibility",
            "dependencies": ["#/properties/hasAddress"],
            "when": {
              "field": "#/properties/hasAddress",
              "operator": "==",
              "value": true
            },
            "fulfill": {
              "state": { "visible": true }
            },
            "otherwise": {
              "state": { "visible": false }
            }
          }
        ]
      }
    }
  }
}
```

### 3.2 字段禁用/启用

```json
{
  "type": "object",
  "properties": {
    "accountType": {
      "type": "string",
      "title": "账户类型",
      "enum": ["free", "premium"]
    },
    "advancedFeatures": {
      "type": "boolean",
      "title": "高级功能",
      "ui": {
        "linkages": [
          {
            "type": "disabled",
            "dependencies": ["#/properties/accountType"],
            "when": {
              "field": "#/properties/accountType",
              "operator": "==",
              "value": "free"
            },
            "fulfill": {
              "state": { "disabled": true }
            },
            "otherwise": {
              "state": { "disabled": false }
            }
          }
        ]
      }
    }
  }
}
```

### 3.3 字段值自动计算

```json
{
  "type": "object",
  "properties": {
    "price": {
      "type": "number",
      "title": "单价"
    },
    "quantity": {
      "type": "number",
      "title": "数量"
    },
    "total": {
      "type": "number",
      "title": "总价",
      "ui": {
        "readonly": true,
        "linkages": [
          {
            "type": "value",
            "dependencies": ["#/properties/price", "#/properties/quantity"],
            "fulfill": {
              "function": "calculateTotal"
            }
          }
        ]
      }
    }
  }
}
```

对应的计算函数：

```typescript
const linkageFunctions = {
  calculateTotal: (formData: any, context?: LinkageFunctionContext) => {
    return (formData.price || 0) * (formData.quantity || 0);
  },
};
```

### 3.4 动态选项

```json
{
  "type": "object",
  "properties": {
    "country": {
      "type": "string",
      "title": "国家",
      "enum": ["china", "usa"]
    },
    "province": {
      "type": "string",
      "title": "省份/州",
      "ui": {
        "linkages": [
          {
            "type": "options",
            "dependencies": ["#/properties/country"],
            "fulfill": {
              "function": "getProvinceOptions"
            }
          }
        ]
      }
    }
  }
}
```

对应的选项函数：

```typescript
const linkageFunctions = {
  getProvinceOptions: (formData: any, context?: LinkageFunctionContext) => {
    if (formData.country === 'china') {
      return [
        { label: '北京', value: 'beijing' },
        { label: '上海', value: 'shanghai' },
      ];
    } else if (formData.country === 'usa') {
      return [
        { label: 'California', value: 'ca' },
        { label: 'New York', value: 'ny' },
      ];
    }
    return [];
  },
};
```

**Options 联动的实现机制**：

1. **联动计算**：当依赖字段变化时，`useArrayLinkageManager` 调用 `getProvinceOptions` 函数计算新的选项列表
2. **状态存储**：计算结果存储在 `linkageStates[fieldName].options` 中
3. **选项合并**：在 `DynamicForm.tsx` 渲染字段时，将 `linkageState.options` 合并到 `field.options`：
   ```typescript
   // 合并联动状态中的 options 到 field 中
   if (linkageState?.options) {
     field.options = linkageState.options;
   }
   ```
4. **传递给 Widget**：`FormField` 组件将 `field.options` 传递给具体的 Widget（如 SelectWidget）进行渲染

这种机制确保了动态选项能够正确显示在 UI 中。

### 3.5 启用缓存（异步联动）

默认情况下联动结果缓存是禁用的。对于异步联动（如 API 调用），建议启用缓存以避免重复的网络请求：

```json
{
  "type": "object",
  "properties": {
    "country": {
      "type": "string",
      "title": "国家",
      "enum": ["china", "usa"]
    },
    "province": {
      "type": "string",
      "title": "省份/州",
      "ui": {
        "linkages": [
          {
            "type": "options",
            "dependencies": ["#/properties/country"],
            "enableCache": true,
            "fulfill": {
              "function": "loadProvinceOptions"
            }
          }
        ]
      }
    }
  }
}
```

对应的异步函数：

```typescript
const linkageFunctions = {
  // 异步函数：从 API 加载省份选项
  loadProvinceOptions: async (formData: any) => {
    const { country } = formData;
    if (!country) return [];

    // API 调用成本高，建议启用缓存
    const response = await fetch(`/api/provinces?country=${country}`);
    const data = await response.json();
    return data.provinces;
  },
};
```

### 3.5.1 数组字段的缓存策略

数组字段的联动缓存需要特殊处理，因为依赖关系可能涉及同级字段、外部字段、父数组字段等多种情况。

**核心原则**：根据依赖类型选择性移除数组索引，实现跨元素缓存复用。

**场景 1：同级字段依赖**

```typescript
// contacts.0.companyName 依赖 contacts.0.type="work"
// contacts.1.companyName 依赖 contacts.1.type="work"
// 缓存键：companyName:type="work"
// ✅ 可跨元素复用
```

**场景 2：外部字段依赖**

```typescript
// contacts.0.vipLevel 依赖 enableVip=true
// contacts.1.vipLevel 依赖 enableVip=true
// 缓存键：vipLevel:enableVip=true
// ✅ 可跨元素复用
```

**场景 3：父数组字段依赖（嵌套数组）**

```typescript
// departments.0.employees.0.techStack 依赖 departments.0.type="tech"
// departments.0.employees.1.techStack 依赖 departments.0.type="tech"
// 缓存键：techStack:departments.0.type="tech"
// ⚠️ 只能在同一父元素内复用
```

**详细说明**：

- **场景1、2**：移除所有数组索引，实现完全跨元素复用
- **场景3**：保留父数组索引，移除子数组索引，在同一父元素内复用
- 更多详细场景和算法请参考：[数组字段联动设计方案 - 7.3.1 联动结果缓存策略](./linkage.md#14-数组联动详细设计)

### 3.6 动态 Schema（异步加载）

```json
{
  "type": "object",
  "properties": {
    "productType": {
      "type": "string",
      "title": "Product Type",
      "enum": ["laptop", "smartphone", "tablet"],
      "enumNames": ["Laptop", "Smartphone", "Tablet"]
    },
    "configuration": {
      "type": "object",
      "title": "Product Configuration",
      "properties": {},
      "ui": {
        "widget": "nested-form",
        "linkages": [
          {
            "type": "schema",
            "dependencies": ["#/properties/productType"],
            "when": {
              "field": "#/properties/productType",
              "operator": "isNotEmpty"
            },
            "fulfill": {
              "function": "loadProductSchema"
            }
          }
        ]
      }
    }
  },
  "required": ["productType"]
}
```

对应的 schema 加载函数：

```typescript
const linkageFunctions = {
  /**
   * 异步加载产品配置 schema
   */
  loadProductSchema: async (formData: any, context?: LinkageFunctionContext) => {
    const productType = formData?.productType;

    if (!productType) {
      return { type: 'object', properties: {} };
    }

    // 模拟 API 调用
    const response = await fetch(`/api/products/${productType}/schema`);
    const schema = await response.json();

    return schema;
  },
};
```

**重要说明**：

1. **Schema 更新范围**：返回的 schema 只会更新以下字段，不会覆盖原有的 `ui.linkages` 配置：
   - `properties`：字段定义
   - `required`：必填字段
   - 校验相关字段：`minProperties`、`maxProperties`、`dependencies`、`if/then/else`、`allOf/anyOf/oneOf/not`

2. **异步竞态条件处理**：系统会自动处理异步请求的竞态条件。当用户快速切换 `productType` 时，只有最后一次请求的结果会被应用，之前的过期结果会被自动丢弃。

3. **使用场景**：
   - 根据用户选择动态加载表单结构
   - 从服务器获取配置化的表单定义
   - 实现多步骤表单的动态流程

## 4. 复杂联动场景

### 4.1 多字段联动

```json
{
  "type": "object",
  "properties": {
    "age": {
      "type": "integer",
      "title": "年龄"
    },
    "income": {
      "type": "number",
      "title": "年收入"
    },
    "loanAmount": {
      "type": "number",
      "title": "可贷款额度",
      "ui": {
        "linkages": [
          {
            "type": "visibility",
            "dependencies": ["#/properties/age", "#/properties/income"],
            "when": {
              "and": [
                {
                  "field": "#/properties/age",
                  "operator": ">=",
                  "value": 18
                },
                {
                  "field": "#/properties/income",
                  "operator": ">=",
                  "value": 50000
                }
              ]
            },
            "fulfill": {
              "state": { "visible": true }
            },
            "otherwise": {
              "state": { "visible": false }
            }
          }
        ]
      }
    }
  }
}
```

### 4.2 嵌套条件

```json
{
  "type": "object",
  "properties": {
    "userType": {
      "type": "string",
      "title": "用户类型",
      "enum": ["individual", "company"]
    },
    "country": {
      "type": "string",
      "title": "国家",
      "enum": ["china", "japan", "usa"]
    },
    "age": {
      "type": "integer",
      "title": "年龄"
    },
    "idCard": {
      "type": "string",
      "title": "身份证号",
      "ui": {
        "linkages": [
          {
            "type": "visibility",
            "dependencies": ["#/properties/userType", "#/properties/country", "#/properties/age"],
            "when": {
              "and": [
                {
                  "field": "#/properties/userType",
                  "operator": "==",
                  "value": "individual"
                },
                {
                  "or": [
                    {
                      "and": [
                        {
                          "field": "#/properties/country",
                          "operator": "==",
                          "value": "china"
                        },
                        {
                          "field": "#/properties/age",
                          "operator": ">=",
                          "value": 16
                        }
                      ]
                    },
                    {
                      "and": [
                        {
                          "field": "#/properties/country",
                          "operator": "==",
                          "value": "japan"
                        },
                        {
                          "field": "#/properties/age",
                          "operator": ">=",
                          "value": 20
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        ]
      }
    }
  }
}
```

**说明**：用户类型必须是"个人" **且**（国家是中国 **且** 年龄 ≥ 16）**或**（国家是日本 **且** 年龄 ≥ 20）

## 5. 与 JSON Schema 验证的配合

UI 联动和数据验证是独立的：

```json
{
  "type": "object",
  "properties": {
    "hasAddress": {
      "type": "boolean",
      "title": "是否填写地址"
    },
    "address": {
      "type": "string",
      "title": "详细地址",
      "minLength": 5,
      "ui": {
        "linkages": [
          {
            "type": "visibility",
            "dependencies": ["#/properties/hasAddress"],
            "when": {
              "field": "#/properties/hasAddress",
              "operator": "==",
              "value": true
            }
          }
        ]
      }
    }
  },
  "if": {
    "properties": { "hasAddress": { "const": true } }
  },
  "then": {
    "required": ["address"]
  }
}
```

**说明**：

- `ui.linkages[]` 控制 `address` 字段的显示/隐藏（UI 层面）
- `if/then` 控制当 `hasAddress` 为 true 时，`address` 必填（验证层面）
- 两者配合使用，职责清晰

---

## 6. 实现方案

### 6.1 类型定义

**实际实现**：`src/types/linkage.ts`

```typescript
/**
 * 联动类型
 */
export type LinkageType = 'visibility' | 'disabled' | 'readonly' | 'value' | 'options' | 'schema';

/**
 * 条件操作符
 */
export type ConditionOperator =
  | '=='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'in'
  | 'notIn'
  | 'includes'
  | 'notIncludes'
  | 'isEmpty'
  | 'isNotEmpty';

/**
 * 单条件表达式
 */
interface SingleCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

/**
 * 逻辑组合表达式
 */
interface LogicalCondition {
  and?: ConditionExpression[];
  or?: ConditionExpression[];
}

/**
 * 条件表达式（联合类型）
 */
export type ConditionExpression = SingleCondition | LogicalCondition;

/**
 * 联动效果定义
 */
export interface LinkageEffect {
  state?: {
    visible?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
  };
  value?: any;
  options?: Array<{ label: string; value: any }>;
  schema?: any; // 直接指定 schema（用于 schema 类型，不推荐，建议使用 function）
  function?: string;
}

/**
 * 联动配置
 */
export interface LinkageConfig {
  type: LinkageType;
  dependencies: string[];
  when?: ConditionExpression | string;
  fulfill?: LinkageEffect;
  otherwise?: LinkageEffect;
  /** 是否启用联动结果缓存（默认 false），建议仅为异步联动启用 */
  enableCache?: boolean;
}

/**
 * 联动结果
 */
export interface LinkageResult {
  visible?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  value?: any;
  options?: Array<{ label: string; value: any }>;
  schema?: any; // ExtendedJSONSchema，用于 schema 类型联动
}

/**
 * 联动函数上下文信息
 */
export interface LinkageFunctionContext {
  /** 当前字段的完整路径（如 'contacts.0.companyName'） */
  fieldPath: string;
  /** 当前字段在数组中的索引（如果是数组元素字段） */
  arrayIndex?: number;
  /** 当前字段所在的数组路径（如果是数组元素字段，如 'contacts'） */
  arrayPath?: string;
}

/**
 * 联动函数签名（支持同步和异步函数）
 */
export type LinkageFunction = (
  formData: Record<string, any>,
  context?: LinkageFunctionContext
) => any | Promise<any>;
```

### 6.2 条件表达式求值器

**实际实现**：`src/utils/conditionEvaluator.ts`

```typescript
import type { ConditionExpression, ConditionOperator } from '@/types/linkage';
import { PathResolver } from './pathResolver';

/**
 * 条件表达式求值器
 */
export class ConditionEvaluator {
  /**
   * 求值条件表达式
   */
  static evaluate(condition: ConditionExpression, formData: Record<string, any>): boolean {
    // 处理逻辑组合 - and
    if ('and' in condition && condition.and) {
      return condition.and.every(c => this.evaluate(c, formData));
    }

    // 处理逻辑组合 - or
    if ('or' in condition && condition.or) {
      return condition.or.some(c => this.evaluate(c, formData));
    }

    // 单条件求值
    if ('field' in condition) {
      const fieldValue = PathResolver.resolve(condition.field, formData);
      return this.evaluateOperator(fieldValue, condition.operator, condition.value);
    }

    return false;
  }

  /**
   * 求值操作符
   */
  private static evaluateOperator(
    fieldValue: any,
    operator: ConditionOperator,
    compareValue: any
  ): boolean {
    switch (operator) {
      case '==':
        return fieldValue === compareValue;
      case '!=':
        return fieldValue !== compareValue;
      case '>':
        return fieldValue > compareValue;
      case '<':
        return fieldValue < compareValue;
      case '>=':
        return fieldValue >= compareValue;
      case '<=':
        return fieldValue <= compareValue;
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue);
      case 'notIn':
        return Array.isArray(compareValue) && !compareValue.includes(fieldValue);
      case 'includes':
        return Array.isArray(fieldValue) && fieldValue.includes(compareValue);
      case 'notIncludes':
        return Array.isArray(fieldValue) && !fieldValue.includes(compareValue);
      case 'isEmpty':
        return (
          fieldValue === null ||
          fieldValue === undefined ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      case 'isNotEmpty':
        return (
          fieldValue !== null &&
          fieldValue !== undefined &&
          fieldValue !== '' &&
          (!Array.isArray(fieldValue) || fieldValue.length > 0)
        );
      default:
        return false;
    }
  }
}
```

**关键特性**：

- ✅ 使用 `PathResolver.resolve()` 统一处理字段路径
- ✅ 支持简单字段名、点号路径和 JSON Pointer 格式
- ✅ 支持 `and`/`or` 逻辑组合的递归求值
- ✅ 完整的操作符支持（包括 `isEmpty`/`isNotEmpty`）

### 6.3 联动管理器

**实际实现**：`src/components/DynamicForm/hooks/useLinkageManager.ts`

核心功能：

1. **构建依赖图**：使用 `DependencyGraph` 管理字段依赖关系（支持多联动类型数组格式）
2. **初始化联动状态**：按拓扑层级并行计算所有字段的初始状态
3. **任务队列**：`LinkageTaskQueue` 保证串行依赖执行、任务合并，防止死循环
4. **监听字段变化**：watch 回调精确计算受影响字段，并通过级联检查支持合法级联
5. **自动值更新**：`value` 类型联动调用 `form.setValue`（`shouldValidate: false, shouldDirty: false`）

**关键签名**：

```typescript
export function useLinkageManager({
  form,
  linkages, // Record<string, LinkageConfig[]>，支持多联动类型数组
  linkageFunctions = {},
}: LinkageManagerOptions): { linkageStates: Record<string, LinkageResult>; refresh: () => void }
```

**执行架构（简要）**：

```
初始化阶段：
  evaluateLinkagesByLayers(所有字段)
    └─ getTopologicalLayers() → 按拓扑层分组
    └─ 层间串行，层内 Promise.allSettled 并行
    └─ 每层结果写入 formData，供下层使用

watch 触发阶段：
  字段变化（如 items.0.price）
    ↓ getAffectedFields(name)
    ↓ 若无受影响字段，逐级检查父路径（items.0 → items）
    ↓ 级联传播检查（isFieldUpdating + hasCascadeTargets）
    ↓ taskQueue.enqueue(name, affectedFields)
    ↓ processQueue()
      └─ 取出任务 → evaluateLinkagesByLayers(task.affectedFields)
      └─ 预标记所有 affectedFields → 批量 setValue
      └─ await Promise(resolve, 0) → clearUpdatingFields
```

**关键特性**：

- ✅ 拓扑层级并行计算：层内 `Promise.allSettled` 并行，层间串行，正确处理串行依赖
- ✅ 任务队列串行化：防止并发执行，自动合并重复任务
- ✅ 预标记机制：批量 setValue 前预标记所有受影响字段，防止 cascade 重复求值
- ✅ 级联传播支持：合法的下游级联（A→B→C）仍能传播，只有真正的循环才被阻断
- ✅ 序列号隔离：每种联动类型使用独立序列号键（`fieldPath:type`），避免并行类型互相干扰
- ✅ 支持刷新：返回 `refresh()` 方法，用于数据异步加载后手动触发联动重新初始化

### 6.4 分层计算策略

联动计算以**数组字段**为分层边界，而不是以 DynamicForm 的嵌套层级为边界。

**核心规则**：

联动分层以**数组字段**为边界，形成递归的层级结构：

- 每层 DynamicForm 只负责**本层数组边界以内、下一层数组边界以外**的联动
- 根级 DynamicForm 负责根字段和普通嵌套对象字段的联动（直到遇到第一个数组边界）
- 每个对象数组元素对应一个独立的 DynamicForm，负责该元素内部、其下一层数组边界以外的联动
- 每层通过 `parentLinkages` 将自己负责的联动配置传给内层，内层过滤后不再重复计算

**实现机制**：

分层并不是通过判断 `asNestedForm && pathPrefix` 是否来自数组字段来完成的。实际机制分为两步：

1. `parseSchemaLinkages(schema)` 在解析联动配置时会递归普通对象字段，但遇到数组字段时停止递归。因此外层 DynamicForm 会解析普通嵌套对象内的联动，但不会解析数组元素内部的联动。
2. 内层 DynamicForm 会先用 `pathPrefix` 将相对联动路径转换为绝对路径，再根据 `parentLinkages` 过滤父级已经负责的联动。普通嵌套对象的联动会被过滤掉；数组元素内部的联动因为父级没有解析到，会被保留下来。

也就是说，`asNestedForm && pathPrefix` 只表示“当前 DynamicForm 是嵌套渲染出来的，需要做路径转换和去重过滤”，并不等价于“当前层一定是数组元素层”。

**`pathPrefix` 的生成链路**：

`pathPrefix` 来自字段渲染路径，而不是联动系统单独生成的路径。

普通嵌套对象场景：

```text
FormField(name="ocr")
  → NestedFormWidget(name="ocr")
  → fullPath = joinPath(parentPathPrefix, name)
  → DynamicForm(pathPrefix="ocr", asNestedForm=true)
```

对象数组元素场景：

```text
ArrayFieldWidget(name="contacts")
  → ArrayItem(name={`${name}.${index}`})
  → ArrayItem(name="contacts.0")
  → NestedFormWidget(name="contacts.0")
  → fullPath = joinPath(parentPathPrefix, name)
  → DynamicForm(pathPrefix="contacts.0", asNestedForm=true)
```

如果数组位于普通嵌套对象或另一层数组元素内，路径前缀会先体现在内层 DynamicForm 解析出的字段名上，再由 ArrayFieldWidget 继续拼接数组索引。当前实现中，`asNestedForm=true` 的 DynamicForm 会把字段名转换为 `${pathPrefix}.${field.name}`，同时给子级 `PathPrefixProvider` 传空前缀，避免再次重复拼接。例如 `departments.0.employees.0` 的生成链路是：

```text
根级 DynamicForm
  → departments 数组字段
  → ArrayItem(name="departments.0")
  → NestedFormWidget fullPath="departments.0"
  → DynamicForm(pathPrefix="departments.0", asNestedForm=true)
      → fields 中的 employees 被转换为 departments.0.employees
      → ArrayFieldWidget(name="departments.0.employees")
      → ArrayItem(name="departments.0.employees.0")
      → NestedFormWidget fullPath="departments.0.employees.0"
      → DynamicForm(pathPrefix="departments.0.employees.0", asNestedForm=true)
```

**分层边界示意**（嵌套数组场景）：

```text
根级 DynamicForm 管理范围
├── username（根字段）
├── ocr.format（普通嵌套对象字段，根级管理）
└── departments（数组边界 #1，根级停止解析元素内部）
    └── departments.0 的 DynamicForm 管理范围
        ├── departments.0.name
        ├── departments.0.type
        └── departments.0.employees（数组边界 #2，departments.0 层停止解析元素内部）
            └── departments.0.employees.0 的 DynamicForm 管理范围
                ├── departments.0.employees.0.role
                ├── departments.0.employees.0.level
                └── departments.0.employees.0.techStack
```

**嵌套数组的所有权示例**：

| 联动目标 | 依赖字段 | 负责计算的 DynamicForm | 说明 |
|---|---|---|---|
| `ocr.format` | `ocr.model` | 根级 | 普通嵌套对象会被根级递归解析 |
| `departments.0.name` | `departments.0.type` | `departments.0` 层 | 根级在 `departments` 数组处停止，元素内部由元素层负责 |
| `departments.0.employees.0.techStack` | `departments.0.employees.0.level` | `departments.0.employees.0` 层 | `departments.0` 层在 `employees` 数组处停止，员工元素内部由员工元素层负责 |
| `departments.0.employeeSummary` | `departments.0.employees` | `departments.0` 层 | 目标字段位于 `departments.0` 层的下一层数组边界之外 |
| `departmentCount` | `departments` | 根级 | 目标字段位于根级，依赖整个数组也由根级处理 |

**关于普通嵌套对象（如 `ocr`）**：

虽然 `NestedFormWidget` 在渲染 `ocr` 字段时也会创建一个 `asNestedForm=true`、`pathPrefix="ocr"` 的子级 DynamicForm，但这个子级 DynamicForm 的联动配置会被**完全过滤掉**：

1. 根级 `parseSchemaLinkages(rootSchema)` 会递归普通对象字段，得到 `ocr.model`、`ocr.format` 等绝对联动配置。
2. `ocr` 子级 DynamicForm 解析自己的 `ocrSchema`，得到相对配置 `model`、`format`。
3. 子级通过 `transformToAbsolutePaths(rawLinkages, 'ocr')` 转换为 `ocr.model`、`ocr.format`。
4. 子级发现这些 key 已存在于 `parentLinkages`，因此全部过滤。

因此普通嵌套对象的子级 DynamicForm 只负责渲染字段，不参与联动计算；对象数组元素的子级 DynamicForm 才会保留父级未解析到的元素内部联动。

**Context 定义**：

```typescript
interface LinkageStateContextValue {
  /** 父级联动状态（运行时，用于子级读取和合并结果） */
  parentLinkageStates: Record<string, LinkageResult>;
  /** 父级联动配置（静态，用于子级过滤，避免时序依赖） */
  parentLinkages: Record<string, LinkageConfig[]>;
  form: UseFormReturn<any>;
  rootSchema: ExtendedJSONSchema;
  pathPrefix?: string;
  linkageFunctions?: Record<string, LinkageFunction>;
}
```

**为什么需要 `parentLinkages`**：

子级 DynamicForm 初始化时，需要过滤掉父级已负责的联动配置，避免同一字段被两个管理器重复计算。过滤依据**不能**使用 `parentLinkageStates`（运行时状态），因为子级初始化时父级的 `refreshLinkage` 可能尚未执行，导致 `parentLinkageStates` 为空，过滤失败，子级会错误接管本该由父级管理的联动，最终产生空对象覆盖有效状态的问题。

`parentLinkages` 是静态配置，在父级 `useMemo` 时即可确定，子级初始化时立即可读，彻底消除时序依赖。

### 6.5 DynamicForm 集成

**实际实现**：`src/components/DynamicForm/DynamicForm.tsx`

#### 步骤 1：Context 获取（集中管理）

```typescript
const parentFormContext = useFormContext();
const linkageStateContext = useLinkageStateContext();
const nestedSchemaRegistry = useNestedSchemaRegistryOptional();
```

#### 步骤 2：联动配置解析

```typescript
// 解析 schema 中的联动配置
const { linkages: rawLinkages } = useMemo(() => {
  const parsed = parseSchemaLinkages(schema);
  return parsed;
}, [schema, pathPrefix, asNestedForm]);
```

**说明**：

- `parseSchemaLinkages` 解析 Schema，提取联动配置

#### 步骤 3：路径转换和过滤

```typescript
// 统一处理联动配置：路径转换 -> 过滤父级联动
const { processedLinkages, formToUse, effectiveLinkageFunctions } = useMemo(() => {
  // 步骤3.1: 路径转换
  let linkages = rawLinkages;
  if (asNestedForm && pathPrefix) {
    // 将相对路径转换为绝对路径
    const transformed = transformToAbsolutePaths(rawLinkages, pathPrefix);

    // 步骤3.2: 过滤父级已计算的联动
    // 使用 parentLinkages（静态配置）而非 parentLinkageStates（运行时状态）
    // 原因：子级初始化时父级 refreshLinkage 可能尚未执行，parentLinkageStates 为空，
    //       导致过滤失败。parentLinkages 是静态配置，在 useMemo 时即可读取，无时序问题。
    if (linkageStateContext?.parentLinkages) {
      const filtered: Record<string, LinkageConfig> = {};
      Object.entries(transformed).forEach(([key, value]) => {
        // 如果父级没有配置过这个字段的联动，才保留
        if (!(key in linkageStateContext.parentLinkages)) {
          filtered[key] = value;
        }
      });
      linkages = filtered;
    } else {
      linkages = transformed;
    }
  }

  // 步骤3.3: 确定使用的表单实例和联动函数
  return {
    processedLinkages: linkages,
    formToUse: linkageStateContext?.form || methods,
    effectiveLinkageFunctions:
      linkageFunctions || linkageStateContext?.linkageFunctions || EMPTY_LINKAGE_FUNCTIONS,
  };
}, [
  rawLinkages,
  asNestedForm,
  pathPrefix,
  linkageStateContext?.parentLinkageStates,
  linkageStateContext?.form,
  linkageStateContext?.linkageFunctions,
  linkageFunctions,
  methods,
]);
```

**说明**：

- **路径转换**：嵌套表单中，将相对路径转换为绝对路径
- **过滤父级联动**：避免重复计算已在父级计算过的联动
- **共享表单实例**：子级使用父级的表单实例，确保数据一致

#### 步骤 4：计算和合并联动状态

```typescript
// 步骤4.1: 计算自己的联动状态
const ownLinkageStates = useArrayLinkageManager({
  form: formToUse,
  baseLinkages: processedLinkages,
  linkageFunctions: effectiveLinkageFunctions,
  schema,
});

// 步骤4.2: 合并父级和自己的联动状态
const linkageStates = useMemo(() => {
  if (linkageStateContext?.parentLinkageStates) {
    const merged = { ...linkageStateContext.parentLinkageStates, ...ownLinkageStates };
    return merged;
  }
  return ownLinkageStates;
}, [linkageStateContext?.parentLinkageStates, ownLinkageStates, pathPrefix]);
```

**说明**：

- **计算自己的状态**：使用 `useArrayLinkageManager` 计算当前层级的联动
- **合并状态**：父级状态 + 自己的状态，确保完整的联动效果
- **调试日志**：开发环境下输出详细日志，便于调试

#### 步骤 5：渲染字段并传递 Context

```typescript
const renderFields = () => {
  const fieldsContent = (
    <div className="dynamic-form__fields">
      {fields.map(field => {
        const linkageState = linkageStates[field.name];

        // 使用统一的路径工具检查字段是否被隐藏
        if (isFieldHiddenByLinkage(field.name, linkageStates)) {
          return null;
        }

        return (
          <FormField
            key={field.name}
            field={field}
            disabled={disabled || field.disabled || loading || linkageState?.disabled}
            readonly={readonly || field.readonly || linkageState?.readonly}
            widgets={stableWidgets}
            linkageState={linkageState}
            layout={layout}
            labelWidth={labelWidth}
          />
        );
      })}
    </div>
  );

  // 如果不是嵌套表单，提供 LinkageStateContext
  if (!asNestedForm) {
    return (
      <LinkageStateProvider
        value={{
          parentLinkageStates: linkageStates,
          form: methods,
          rootSchema: schema,
          pathPrefix: pathPrefix,
          linkageFunctions: effectiveLinkageFunctions,
        }}
      >
        {fieldsContent}
      </LinkageStateProvider>
    );
  }

  return fieldsContent;
};
```

**说明**：

- **应用联动状态**：根据 `linkageState` 控制字段的显示、禁用、只读
- **传递 Context**：根 DynamicForm 通过 Provider 传递状态给子级
- **嵌套表单处理**：子级不再创建新的 Provider，直接使用父级的 Context

### 6.7 依赖图优化（DAG）

**实际实现**：`src/utils/dependencyGraph.ts`

依赖图用于优化联动字段的更新顺序和性能。

**关键特性**：

- ✅ 精确计算受影响的字段（`getAffectedFields`）
- ✅ 循环依赖检测（`detectCycle`）
- ✅ 支持拓扑层级划分（`getTopologicalLayers`）：层内并行执行，层间串行，正确处理串行依赖

### 6.8 联动结果的应用位置

各联动类型的计算结果在不同环节应用到表单，职责明确分离：

| 联动类型 | 应用位置 | 方式 |
|---|---|---|
| `value` | `useLinkageManager`（init effect + processQueue） | `form.setValue`（`shouldValidate: false, shouldDirty: false`，有死循环防护） |
| `visibility` | `DynamicForm.tsx` 渲染阶段 | 条件渲染（`isFieldHiddenByLinkage` 返回 true 时不渲染字段） |
| `disabled` | `FormField` props | 传入 `disabled` prop |
| `readonly` | `FormField` props | 传入 `readonly` prop |
| `options` | `DynamicForm.tsx` 渲染阶段 | 覆盖 `field.options`，再传入 `FormField` |
| `schema` | `DynamicForm.tsx` 渲染阶段 | 在渲染字段前合并到 `fieldSchema`，支持所有字段类型 |

**关键设计原则**：`value` 联动的表单写入**只发生在 `useLinkageManager` 中**，`FormField` 不应主动调用 `setValue`。

### 6.9 options 联动的失效值策略

`options` 联动先计算并合并当前选项，再由 `useLinkageManager` 检查既有表单值是否仍在选项集合中。`invalidValuePolicy` 控制这一检查后的写回行为：

| 策略 | 单选失效值 | 多选失效项 | 适用场景 |
|---|---|---|---|
| `clear`（默认） | 写入 `undefined` | 过滤失效项 | 字段可由用户重新选择，要求提交值始终属于当前 options |
| `retain` | 保留原值 | 保留全部原数组 | 字段被业务永久禁用，但历史值仍须保存和提交 |
| `fallback` | 写入 `fallbackValue`，无效时清空 | 按 `clear` 过滤失效项 | 单选字段存在业务明确且安全的替代值 |

示例：

```typescript
{
  type: 'options',
  dependencies: ['#/properties/status'],
  invalidValuePolicy: 'retain',
  fulfill: { function: 'getAvailableAssignees' },
}
```

`retain` 不会把历史值加入当前 options，也不会让用户再次选择该值；它只跳过联动引擎的自动清除。配置方必须确保 Schema 校验和后端接口允许这类历史值提交。

`fallback` 必须同时配置 `fallbackValue`，且该值必须属于本轮最终 options；不满足时联动引擎会清空失效单选值，不会写入非法替代值。多选字段暂不支持自动替代，仍按 `clear` 的过滤语义处理。

异步 options 函数返回 `undefined` 表示结果未就绪。该结果不会覆盖上一轮 options，也不会触发失效值清理，从而保护 Schema 默认值和已有选择。`[]` 仅表示异步加载已完成且确实没有可选项，此时仍按当前策略处理失效值。

同一字段有多条 `options` 联动时，options 结果按配置顺序以后者覆盖，`invalidValuePolicy` 也取最后一条 `options` 联动配置，保证选项与清理策略来自同一最终规则。

**原因**：`FormField` 中若存在监听 `linkageState.value` 变化并调用 `setValue` 的 useEffect，会绕过任务队列的死循环防护机制，导致：

```
useLinkageManager 计算完成
  → setLinkageStates(states)        ← 更新联动状态
  → setValue('field', value)        ← 写入表单（有保护）
  → FormField 收到新 linkageState
  → FormField useEffect 触发
  → setValue('field', value)        ← 再次写入（无保护）
  → watch 触发 → 重新入队 → 重新计算 → 死循环
```

#### 6.8.1 Schema 联动的统一处理机制

**设计目标**：

Schema 联动应该支持所有类型的字段（string、number、boolean、object、array 等），而不仅限于 object 类型的嵌套字段。这样可以实现：

- 动态改变字段的校验规则（pattern、format、minLength、maximum 等）
- 动态改变字段的 UI 配置（widget、placeholder、errorMessages 等）
- 动态改变字段的元信息（title、description）

**核心思路**：

在 DynamicForm 渲染字段之前，统一检查并合并 schema 联动结果，使所有类型的字段都能受益：

```typescript
// 伪代码示意
const renderField = (fieldName: string, fieldSchema: ExtendedJSONSchema) => {
  // 1. 获取联动 schema
  const linkageSchema = linkageStates[fieldName]?.schema;

  // 2. 如果存在，合并到字段 schema
  const effectiveSchema = linkageSchema
    ? mergeSchemaWithLinkage(fieldSchema, linkageSchema)
    : fieldSchema;

  // 3. 使用合并后的 schema 渲染字段
  return <FieldComponent schema={effectiveSchema} ... />;
};
```

**合并策略**：

`mergeSchemaWithLinkage` 函数负责将联动 schema 合并到原始 schema，遵循以下规则：

1. **校验属性**：联动覆盖原始（pattern、format、min/max、enum、required、dependencies、if/then/else、allOf/anyOf/oneOf 等）
2. **UI 配置**：浅层合并，联动覆盖原始的同名属性，但保留原始的 `ui.linkages`
3. **元信息**：联动覆盖原始（title、description）
4. **类型**：保持原始（不允许动态改变字段类型，避免类型不一致）
5. **Object 特殊处理**：对于 type='object' 的字段，联动 schema 的 properties 会完全替换原始 properties

**实现示例**：

```typescript
function mergeSchemaWithLinkage(
  originalSchema: ExtendedJSONSchema,
  linkageSchema: Partial<ExtendedJSONSchema>
): ExtendedJSONSchema {
  const validationProps = [
    'pattern', 'format',
    'minLength', 'maxLength',
    'minimum', 'maximum',
    'exclusiveMinimum', 'exclusiveMaximum',
    'multipleOf',
    'enum', 'enumNames', 'const',
    'minItems', 'maxItems', 'uniqueItems',
    'minProperties', 'maxProperties',
    'required',
    'allOf', 'anyOf', 'oneOf', 'not',
    'if', 'then', 'else',
    'dependencies'
  ];

  const merged: ExtendedJSONSchema = { ...originalSchema };

  // 1. 覆盖校验属性
  validationProps.forEach(prop => {
    if (prop in linkageSchema) {
      merged[prop] = linkageSchema[prop];
    }
  });

  // 2. 覆盖元信息
  if (linkageSchema.title !== undefined) {
    merged.title = linkageSchema.title;
  }
  if (linkageSchema.description !== undefined) {
    merged.description = linkageSchema.description;
  }

  // 3. 合并 ui 配置（保留原始的 linkages）
  if (linkageSchema.ui) {
    const originalLinkages = originalSchema.ui?.linkages;
    merged.ui = {
      ...originalSchema.ui,
      ...linkageSchema.ui,
      linkages: originalLinkages
    };
  }

  // 4. 对于 object 类型，替换 properties
  if (originalSchema.type === 'object' && linkageSchema.properties) {
    merged.properties = linkageSchema.properties;
  }

  return merged;
}
```

**应用场景示例**：

场景 1：根据输入类型动态改变校验规则

```typescript
{
  inputType: {
    type: 'string',
    enum: ['phone', 'email', 'url']
  },
  inputValue: {
    type: 'string',
    title: 'Input Value',
    ui: {
      linkages: [{
        type: 'schema',
        dependencies: ['#/properties/inputType'],
        fulfill: { function: 'getInputSchema' }
      }]
    }
  }
}

// 联动函数
const getInputSchema = (formData) => {
  switch (formData.inputType) {
    case 'phone':
      return {
        pattern: '^\\d{11}$',
        ui: {
          placeholder: 'Enter 11-digit phone number',
          errorMessages: { pattern: 'Invalid phone format' }
        }
      };
    case 'email':
      return {
        format: 'email',
        ui: { placeholder: 'Enter email address' }
      };
    case 'url':
      return {
        format: 'uri',
        ui: { placeholder: 'Enter URL' }
      };
  }
};
```

场景 2：动态改变字段 widget 和相关配置

```typescript
{
  fieldMode: {
    type: 'string',
    enum: ['normal', 'password', 'textarea']
  },
  fieldValue: {
    type: 'string',
    title: 'Field Value',
    ui: {
      linkages: [{
        type: 'schema',
        dependencies: ['#/properties/fieldMode'],
        fulfill: { function: 'getFieldUI' }
      }]
    }
  }
}

// 联动函数
const getFieldUI = (formData) => {
  return {
    ui: {
      widget: formData.fieldMode,
      placeholder: `Enter text in ${formData.fieldMode} mode`
    }
  };
};
```

**与 NestedFormWidget 的关系**：

在统一处理机制下，NestedFormWidget 被简化：

- **移除**：所有 schema 联动相关的状态管理（currentSchema、linkageSchema）
- **移除**：从 linkageStateContext 读取和处理 schema 的逻辑
- **保留**：嵌套表单渲染逻辑和默认值提取逻辑
- **结果**：NestedFormWidget 只负责渲染嵌套表单，schema 联动由 DynamicForm 统一处理后传入

**架构优势**：

1. **统一性**：所有类型字段的 schema 联动在同一位置处理
2. **扩展性**：原始类型字段自动获得 schema 联动支持，无需修改各个 widget
3. **简洁性**：NestedFormWidget 代码大幅简化，职责更清晰
4. **可维护性**：联动逻辑集中，易于理解和修改

### 6.9 异步函数支持

联动系统完整支持异步函数，适用于需要调用 API、执行异步计算等场景。

**示例**：

```typescript
const linkageFunctions = {
  fetchProvinceOptions: async (formData: any) => {
    const response = await fetch(`/api/provinces?country=${formData.country}`);
    const data = await response.json();
    return data.provinces;
  },
};
```

**异步联动的完整实现方案**（包括竞态条件处理、串行依赖执行、死循环防护等）请参考：[异步联动实现方案](./linkage.md#13-异步联动详细设计)

---

## 7. 完整的端到端示例

### 7.1 场景描述

实现一个订单表单，包含以下功能：

1. 根据用户类型显示不同的折扣字段
2. 自动计算总价
3. 动态加载省份选项
4. 支持多个商品项

### 7.2 Schema 定义

```typescript
const orderSchema = {
  type: 'object',
  properties: {
    // 用户类型
    userType: {
      type: 'string',
      title: '用户类型',
      enum: ['individual', 'company'],
      enumNames: ['个人', '企业'],
      default: 'individual',
    },

    // 企业折扣（仅企业用户显示）
    companyDiscount: {
      type: 'number',
      title: '企业折扣（%）',
      minimum: 0,
      maximum: 50,
      ui: {
        linkages: [
          {
            type: 'visibility',
            dependencies: ['#/properties/userType'],
            when: {
              field: '#/properties/userType',
              operator: '==',
              value: 'company',
            },
            fulfill: {
              state: { visible: true },
            },
            otherwise: {
              state: { visible: false },
            },
          },
        ],
      },
    },

    // 配送地址
    country: {
      type: 'string',
      title: '国家',
      enum: ['china', 'usa'],
      enumNames: ['中国', '美国'],
    },

    province: {
      type: 'string',
      title: '省份/州',
      ui: {
        linkages: [
          {
            type: 'options',
            dependencies: ['#/properties/country'],
            fulfill: {
              function: 'loadProvinceOptions',
            },
          },
        ],
      },
    },

    // 商品列表
    items: {
      type: 'array',
      title: '商品列表',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            title: '商品名称',
          },
          price: {
            type: 'number',
            title: '单价',
            minimum: 0,
          },
          quantity: {
            type: 'integer',
            title: '数量',
            minimum: 1,
            default: 1,
          },
          subtotal: {
            type: 'number',
            title: '小计',
            ui: {
              readonly: true,
              linkages: [
                {
                  type: 'value',
                  dependencies: ['./price', './quantity'],
                  fulfill: {
                    function: 'calculateSubtotal',
                  },
                },
              ],
            },
          },
        },
        required: ['productName', 'price', 'quantity'],
      },
    },

    // 总价（自动计算）
    totalAmount: {
      type: 'number',
      title: '总价',
      ui: {
        readonly: true,
        linkages: [
          {
            type: 'value',
            dependencies: ['#/properties/items', '#/properties/companyDiscount'],
            fulfill: {
              function: 'calculateTotal',
            },
          },
        ],
      },
    },
  },
  required: ['userType', 'country', 'province', 'items'],
};
```

### 7.3 联动函数实现

```typescript
const linkageFunctions = {
  /**
   * 异步加载省份选项
   */
  loadProvinceOptions: async (formData: any) => {
    const { country } = formData;

    if (!country) {
      return [];
    }

    try {
      // 模拟 API 调用
      const response = await fetch(`/api/provinces?country=${country}`);
      const data = await response.json();
      return data.provinces;
    } catch (error) {
      console.error('加载省份失败:', error);

      // 降级方案：返回静态数据
      if (country === 'china') {
        return [
          { label: '北京', value: 'beijing' },
          { label: '上海', value: 'shanghai' },
          { label: '广东', value: 'guangdong' },
        ];
      } else if (country === 'usa') {
        return [
          { label: 'California', value: 'ca' },
          { label: 'New York', value: 'ny' },
          { label: 'Texas', value: 'tx' },
        ];
      }
      return [];
    }
  },

  /**
   * 计算商品小计
   */
  calculateSubtotal: (formData: any, context?: LinkageFunctionContext) => {
    // context.fieldPath 示例: 'items.0.subtotal'
    // 需要获取同一数组元素的 price 和 quantity

    if (!context?.arrayPath || context.arrayIndex === undefined) {
      return 0;
    }

    const item = formData[context.arrayPath]?.[context.arrayIndex];
    if (!item) {
      return 0;
    }

    const price = item.price || 0;
    const quantity = item.quantity || 0;
    return price * quantity;
  },

  /**
   * 计算订单总价
   */
  calculateTotal: (formData: any) => {
    const { items = [], companyDiscount = 0, userType } = formData;

    // 计算所有商品的小计总和
    const subtotal = items.reduce((sum: number, item: any) => {
      const price = item.price || 0;
      const quantity = item.quantity || 0;
      return sum + price * quantity;
    }, 0);

    // 应用企业折扣
    if (userType === 'company' && companyDiscount > 0) {
      return subtotal * (1 - companyDiscount / 100);
    }

    return subtotal;
  },
};
```

### 7.4 组件使用

```typescript
import { DynamicForm } from '@/components/DynamicForm';

function OrderForm() {
  const handleSubmit = (data: any) => {
    console.log('提交订单:', data);
    // 发送到后端 API
  };

  return (
    <DynamicForm
      schema={orderSchema}
      linkageFunctions={linkageFunctions}
      onSubmit={handleSubmit}
      defaultValues={{
        userType: 'individual',
        country: 'china',
        items: [
          {
            productName: '商品A',
            price: 100,
            quantity: 2
          }
        ]
      }}
    />
  );
}
```

### 7.5 运行效果

**初始状态**（用户类型：个人）：

```
┌─────────────────────────────────────┐
│ 用户类型: [个人 ▼]                  │
│ 国家: [中国 ▼]                      │
│ 省份/州: [北京 ▼]                   │
│                                     │
│ 商品列表:                           │
│ ┌─────────────────────────────────┐ │
│ │ 商品名称: [商品A]               │ │
│ │ 单价: [100]                     │ │
│ │ 数量: [2]                       │ │
│ │ 小计: 200 (只读，自动计算)      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 总价: 200 (只读，自动计算)          │
└─────────────────────────────────────┘
```

**切换为企业用户后**：

```
┌─────────────────────────────────────┐
│ 用户类型: [企业 ▼]                  │
│ 企业折扣(%): [10]  ← 新显示的字段   │
│ 国家: [中国 ▼]                      │
│ 省份/州: [北京 ▼]                   │
│                                     │
│ 商品列表:                           │
│ ┌─────────────────────────────────┐ │
│ │ 商品名称: [商品A]               │ │
│ │ 单价: [100]                     │ │
│ │ 数量: [2]                       │ │
│ │ 小计: 200                       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 总价: 180 (应用10%折扣后)           │
└─────────────────────────────────────┘
```

### 7.6 联动执行流程

**场景 1：用户切换用户类型**

```
用户操作: 选择 "企业"
    ↓
watch 监听到 userType 变化
    ↓
dependencyGraph.getAffectedFields('userType')
    → 返回: ['companyDiscount', 'totalAmount']
    ↓
并行计算联动状态:
    ├─ companyDiscount:
    │   ├─ 求值 when 条件: userType == 'company' → true
    │   ├─ 应用 fulfill.state: { visible: true }
    │   └─ 结果: 字段显示
    │
    └─ totalAmount:
        ├─ 调用 calculateTotal(formData)
        ├─ 计算: 200 * (1 - 10/100) = 180
        ├─ 调用 form.setValue('totalAmount', 180)
        └─ 结果: 字段值更新为 180
```

**场景 2：用户修改商品数量**

```
用户操作: 将数量从 2 改为 3
    ↓
watch 监听到 items.0.quantity 变化
    ↓
dependencyGraph.getAffectedFields('items.0.quantity')
    → 返回: ['items.0.subtotal', 'totalAmount']
    ↓
并行计算联动状态:
    ├─ items.0.subtotal:
    │   ├─ 调用 calculateSubtotal(formData, context)
    │   │   context = {
    │   │     fieldPath: 'items.0.subtotal',
    │   │     arrayPath: 'items',
    │   │     arrayIndex: 0
    │   │   }
    │   ├─ 计算: 100 * 3 = 300
    │   ├─ 调用 form.setValue('items.0.subtotal', 300)
    │   └─ 结果: 小计更新为 300
    │
    └─ totalAmount:
        ├─ 调用 calculateTotal(formData)
        ├─ 计算: 300 * (1 - 10/100) = 270
        ├─ 调用 form.setValue('totalAmount', 270)
        └─ 结果: 总价更新为 270
```

### 7.7 关键要点总结

---

## 8. 特殊场景

### 8.1 数组字段联动

数组字段的联动涉及相对路径、动态索引等复杂场景。

**快速示例**：

```typescript
{
  contacts: {
    type: 'array',
    items: {
      properties: {
        type: { type: 'string', enum: ['personal', 'work'] },
        companyName: {
          type: 'string',
          ui: {
            linkages: [{
              type: 'visibility',
              dependencies: ['./type'],
              when: { field: './type', operator: '==', value: 'work' }
            }]
          }
        }
      }
    }
  }
}
```

**详细文档**：[数组字段联动设计方案](./linkage.md#14-数组联动详细设计)

### 8.2 路径透明化场景

当使用 `flattenPath` 时，联动配置中的路径会自动处理 `~~` 分隔符。

**详细文档**：[字段路径透明化设计方案](./field-path.md)

---

## 9. 设计总结

### 9.1 职责分离

| 层面                | 负责内容     | 实现方式                              |
| ------------------- | ------------ | ------------------------------------- |
| **JSON Schema**     | 数据验证     | `required`, `minLength`, `pattern` 等 |
| **UI 扩展**         | UI 联动逻辑  | `visibility`, `disabled`, `value` 等  |
| **react-hook-form** | 表单状态管理 | `watch`, `setValue`, `getValues`      |

### 9.2 核心优势

1. **职责清晰**：验证逻辑和 UI 逻辑分离
2. **标准兼容**：遵循 JSON Schema 标准
3. **性能优化**：依赖图 + 并行计算 + 精确更新
4. **类型安全**：完整的 TypeScript 类型定义
5. **易于扩展**：支持自定义联动函数
6. **异步支持**：完整支持同步和异步联动函数
7. **竞态条件处理**：自动处理异步请求的竞态条件，确保结果正确性
8. **动态 Schema**：支持基于表单数据异步加载 schema 结构
9. **分层计算**：嵌套表单自动分层，避免重复计算
10. **路径透明化**：自动处理 flattenPath 场景

---

## 10. 异步联动实现方案

异步联动是动态表单系统的重要特性，允许联动函数执行异步操作（如 API 调用、复杂计算等）。

**完整的异步联动实现方案请参考**：[异步联动实现方案](./linkage.md#13-异步联动详细设计)

该文档详细介绍了：

- **竞态条件处理**：使用 AsyncSequenceManager 确保异步结果的正确性
- **串行依赖执行**：使用任务队列管理器处理复杂的依赖关系
- **死循环防护**：防止 setValue 触发 watch 导致的无限循环
- **开发者最佳实践**：使用异步联动时的注意事项

---

## 11. 常见问题

### Q1: 如何调试联动不生效的问题？

请参考 [动态表单常见问题](../../README.md#troubleshooting) 第 9.1 节 Q5。

### Q2: 如何处理循环依赖？

系统会在构建依赖图时自动检测循环依赖并在控制台输出警告。

### Q3: 联动函数可以是异步的吗？

可以。系统完整支持异步联动函数，详见 [异步联动实现方案](./linkage.md#13-异步联动详细设计)。

### Q4: Schema 联动会覆盖原有的 ui.linkages 配置吗？

不会。Schema 联动只会更新以下字段：

- `properties`：字段定义
- `required`：必填字段
- 校验相关字段：`minProperties`、`maxProperties`、`dependencies`、`if/then/else`、`allOf/anyOf/oneOf/not`

原有的 `ui` 配置（包括 `ui.linkages`）会被完整保留。详见第 3.5 节。

### Q5: 如何处理异步联动函数的竞态条件？

系统会自动处理异步请求的竞态条件。当用户快速切换依赖字段时，只有最后一次请求的结果会被应用，之前的过期结果会被自动丢弃。详见 [异步联动实现方案](./linkage.md#13-异步联动详细设计) 第 2 章。

### Q6: 串行依赖的异步联动是否能正常工作？

系统使用任务队列管理器来处理串行依赖的异步联动。详见 [异步联动实现方案](./linkage.md#13-异步联动详细设计) 第 3 章的完整说明。

### Q7: 值联动在实际使用中会有问题吗？

值联动（`type: 'value'`）在某些场景下可能需要特别注意，特别是当异步联动函数执行时间较长且用户快速连续输入时。详见 [异步联动实现方案](./linkage.md#13-异步联动详细设计) 第 4 章和第 5 章的完整分析和解决方案。

### Q8: 如何在异步数据加载后手动触发联动初始化？

当联动函数依赖于异步加载的数据时（如从 API 加载的选项列表），可以使用 `refreshLinkage()` 方法手动重新触发联动计算。

**使用方法**：

```typescript
const formRef = useRef<DynamicFormRef>(null);

// 在数据加载完成后调用
useEffect(() => {
  async function loadData() {
    const data = await fetchData();
    setData(data);

    // 重新触发联动初始化
    await formRef.current?.refreshLinkage();
  }
  loadData();
}, []);
```

**注意事项**：

1. `refreshLinkage()` 是异步方法，返回 Promise
2. 应该在数据状态更新完成后调用（在 useEffect 中）
3. 它会重新计算所有字段的联动状态
4. 详细示例请参考 [RefreshLinkage Example](../../src/examples/RefreshLinkageExample.tsx)

**常见的闭包陷阱**：

如果直接在数据加载后立即调用 `refreshLinkage()`，联动函数可能仍然捕获旧的空数据。正确的做法是使用状态标志：

```typescript
const [shouldRefreshLinkage, setShouldRefreshLinkage] = useState(false);

// 数据加载
useEffect(() => {
  async function loadData() {
    const data = await fetchData();
    setData(data);
    setShouldRefreshLinkage(true); // 设置标志
  }
  loadData();
}, []);

// 在数据状态更新后触发刷新
useEffect(() => {
  if (shouldRefreshLinkage && data.length > 0) {
    formRef.current?.refreshLinkage();
    setShouldRefreshLinkage(false);
  }
}, [shouldRefreshLinkage, data]);
```

---

## 12. 多联动类型支持（Multiple Linkage Types）

### 12.1 背景与需求

#### 12.1.1 当前限制

在当前的联动系统中，每个字段只能配置一种联动类型：

```typescript
interface UILinkageConfig {
  type: 'visibility' | 'disabled' | 'readonly' | 'value' | 'options' | 'schema';
  // ...
}
```

**限制说明**：

- ❌ 无法同时配置 `value` 和 `options` 联动
- ❌ 无法同时配置 `visibility` 和 `disabled` 联动
- ❌ 需要在联动函数内手动调用 `form.setValue()` 来实现值清空

#### 12.1.2 实际业务场景

**场景 1：Category-Action 联动**

```
需求：
1. 当 category 变化时，清空 action 的值
2. 同时根据 category 异步加载 action 的选项列表
```

**场景 2：条件性字段显示与禁用**

```
需求：
1. 当 userType = 'vip' 时，显示 vipLevel 字段
2. 当 vipExpired = true 时，禁用 vipLevel 字段
```

**场景 3：动态表单与值联动**

```
需求：
1. 根据 productType 动态加载配置表单的 schema
2. 同时根据 productType 设置默认的配置值
```

### 12.2 设计方案

#### 12.2.1 方案对比

我们考虑了三种可能的实现方案：

| 方案                             | 描述                                 | 优点                   | 缺点                   | 推荐度     |
| -------------------------------- | ------------------------------------ | ---------------------- | ---------------------- | ---------- |
| **方案 1：数组配置**             | `linkage` 改为数组，支持多个联动配置 | 简单直观，易于理解     | 配置冗余，依赖关系重复 | ⭐⭐⭐⭐⭐ |
| **方案 2：联动组**               | 新增 `linkageGroup` 字段，统一管理   | 依赖关系统一，减少重复 | 配置复杂，学习成本高   | ⭐⭐⭐     |
| **方案 3：联动函数返回多种结果** | 单个函数返回包含多种类型的结果对象   | 配置简洁               | 函数逻辑复杂，难以维护 | ⭐⭐       |

**推荐方案：方案 1（数组配置）**

#### 12.2.2 方案 1：数组配置（推荐）

**核心思想**：使用 `ui.linkages` 数组，支持配置多个联动规则。

**类型定义**：

```typescript
// 类型定义
interface UISchema {
  // 多个联动配置
  linkages?: LinkageConfig[];

  // 其他 UI 配置...
}
```

**执行规则**：

1. 所有联动规则并行执行，使用 `Promise.allSettled` 确保错误隔离
2. 结果按类型智能合并（状态类型直接合并，值/选项/schema 类型后者覆盖前者）
3. 每个联动规则独立配置，职责单一

### 12.3 使用示例

#### 12.3.1 场景 1：Category-Action 联动（value + options）

**需求**：当 category 变化时，清空 action 的值并加载新的选项列表。

```json
{
  "type": "object",
  "properties": {
    "category": {
      "type": "string",
      "title": "Category",
      "enum": ["user", "product", "order"]
    },
    "action": {
      "type": "string",
      "title": "Action",
      "ui": {
        "widget": "select",
        "linkages": [
          {
            "type": "value",
            "dependencies": ["#/properties/category"],
            "fulfill": {
              "value": ""
            }
          },
          {
            "type": "options",
            "dependencies": ["#/properties/category"],
            "enableCache": true,
            "fulfill": {
              "function": "loadActionOptions"
            }
          }
        ]
      }
    }
  }
}
```

**联动函数**：

```typescript
const linkageFunctions = {
  loadActionOptions: async (formData: any) => {
    const { category } = formData;
    if (!category) return [];

    const response = await fetch(`/api/actions?category=${category}`);
    const data = await response.json();
    return data.actions;
  },
};
```

**执行顺序**：

1. 当 `category` 变化时，两个联动规则都会被触发
2. `value` 联动先执行，清空 `action` 的值
3. `options` 联动随后执行，加载新的选项列表
4. 由于启用了缓存，相同的 `category` 不会重复请求

#### 12.3.2 场景 2：条件性字段显示与禁用（visibility + disabled）

**需求**：vipLevel 字段在 userType='vip' 时显示，在 vipExpired=true 时禁用。

```json
{
  "type": "object",
  "properties": {
    "userType": {
      "type": "string",
      "title": "User Type",
      "enum": ["normal", "vip"],
      "enumNames": ["Normal User", "VIP User"]
    },
    "vipExpired": {
      "type": "boolean",
      "title": "VIP Expired",
      "default": false
    },
    "vipLevel": {
      "type": "string",
      "title": "VIP Level",
      "enum": ["silver", "gold", "platinum"],
      "ui": {
        "widget": "select",
        "linkages": [
          {
            "type": "visibility",
            "dependencies": ["#/properties/userType"],
            "when": {
              "field": "#/properties/userType",
              "operator": "==",
              "value": "vip"
            },
            "fulfill": {
              "state": { "visible": true }
            },
            "otherwise": {
              "state": { "visible": false }
            }
          },
          {
            "type": "disabled",
            "dependencies": ["#/properties/vipExpired"],
            "when": {
              "field": "#/properties/vipExpired",
              "operator": "==",
              "value": true
            },
            "fulfill": {
              "state": { "disabled": true }
            },
            "otherwise": {
              "state": { "disabled": false }
            }
          }
        ]
      }
    }
  }
}
```

**状态合并**：

- 两个联动规则的结果会被合并到同一个 `linkageState` 中
- `visible` 和 `disabled` 状态独立控制，互不影响

#### 12.3.3 场景 3：动态表单与值联动（schema + value）

**需求**：根据 productType 动态加载配置表单，并设置默认值。

```json
{
  "type": "object",
  "properties": {
    "productType": {
      "type": "string",
      "title": "Product Type",
      "enum": ["laptop", "smartphone", "tablet"]
    },
    "configuration": {
      "type": "object",
      "title": "Product Configuration",
      "properties": {},
      "ui": {
        "widget": "nested-form",
        "linkages": [
          {
            "type": "schema",
            "dependencies": ["#/properties/productType"],
            "enableCache": true,
            "fulfill": {
              "function": "loadProductSchema"
            }
          },
          {
            "type": "value",
            "dependencies": ["#/properties/productType"],
            "fulfill": {
              "function": "getDefaultConfiguration"
            }
          }
        ]
      }
    }
  }
}
```

**联动函数**：

```typescript
const linkageFunctions = {
  loadProductSchema: async (formData: any) => {
    const { productType } = formData;
    if (!productType) return { type: 'object', properties: {} };

    const response = await fetch(`/api/products/${productType}/schema`);
    return await response.json();
  },

  getDefaultConfiguration: (formData: any) => {
    const { productType } = formData;
    const defaults: Record<string, any> = {
      laptop: { cpu: 'Intel i5', ram: 8, storage: 256 },
      smartphone: { brand: 'Apple', model: 'iPhone 14' },
      tablet: { screenSize: 10.5, storage: 64 },
    };
    return defaults[productType] || {};
  },
};
```

### 12.4 实现细节

#### 12.4.1 类型定义扩展

**修改文件**：`src/components/DynamicForm/types/schema.ts`

```typescript
/**
 * UI Schema 扩展（支持多联动类型）
 */
export interface UIConfig {
  // 多个联动配置
  linkages?: LinkageConfig[];

  // 其他 UI 配置...
  widget?: WidgetType | string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  // ...
}
```

#### 12.4.2 Schema 解析逻辑

**修改文件**：`src/components/DynamicForm/utils/schemaLinkageParser.ts`

```typescript
/**
 * 解析 Schema 中的联动配置
 * 只支持 linkages 数组格式
 */
export function parseSchemaLinkages(schema: ExtendedJSONSchema): {
  linkages: Record<string, LinkageConfig[]>;
} {
  const result: Record<string, LinkageConfig[]> = {};

  function traverse(currentSchema: ExtendedJSONSchema, path: string = '') {
    if (!currentSchema || typeof currentSchema !== 'object') return;

    // 处理当前字段的联动配置
    if (currentSchema.ui) {
      const { linkages } = currentSchema.ui;
      const fieldPath = path || 'root';

      // 只解析 linkages 数组配置
      if (linkages && Array.isArray(linkages) && linkages.length > 0) {
        result[fieldPath] = linkages;
      }
    }

    // 递归处理子字段
    if (currentSchema.properties) {
      Object.entries(currentSchema.properties).forEach(([key, subSchema]) => {
        const newPath = path ? `${path}.${key}` : key;
        traverse(subSchema as ExtendedJSONSchema, newPath);
      });
    }

    // 处理数组项（停止递归，由子 DynamicForm 处理）
    if (currentSchema.type === 'array' && currentSchema.items) {
      // 数组元素内部的联动由 NestedFormWidget 创建的子 DynamicForm 独立解析
    }
  }

  traverse(schema);
  return { linkages: result };
}
```

#### 12.4.3 联动管理器修改

**修改文件**：`src/hooks/useArrayLinkageManager.ts`

核心修改点：

1. **接受联动配置数组**：将 `baseLinkages: Record<string, LinkageConfig>` 改为 `baseLinkages: Record<string, LinkageConfig[]>`
2. **遍历多个联动规则**：对每个字段的多个联动规则分别计算
3. **合并联动结果**：将多个联动规则的结果合并到同一个 `LinkageResult` 中

```typescript
/**
 * 计算单个字段的所有联动规则
 */
async function evaluateFieldLinkages({
  fieldName,
  linkageConfigs,
  formData,
  linkageFunctions,
}: {
  fieldName: string;
  linkageConfigs: LinkageConfig[];
  formData: Record<string, any>;
  linkageFunctions: Record<string, LinkageFunction>;
}): Promise<LinkageResult> {
  const result: LinkageResult = {};

  // 并行计算所有联动规则
  const results = await Promise.allSettled(
    linkageConfigs.map(config => evaluateLinkage(config, formData, linkageFunctions, fieldName))
  );

  // 合并结果
  results.forEach((promiseResult, index) => {
    if (promiseResult.status === 'fulfilled') {
      const linkageResult = promiseResult.value;
      const linkageType = linkageConfigs[index].type;

      // 根据联动类型合并结果
      if (
        linkageType === 'visibility' ||
        linkageType === 'disabled' ||
        linkageType === 'readonly'
      ) {
        // 状态类型：直接合并
        Object.assign(result, linkageResult);
      } else if (linkageType === 'value') {
        // 值类型：后面的覆盖前面的
        result.value = linkageResult.value;
      } else if (linkageType === 'options') {
        // 选项类型：后面的覆盖前面的
        result.options = linkageResult.options;
      } else if (linkageType === 'schema') {
        // Schema 类型：后面的覆盖前面的
        result.schema = linkageResult.schema;
      }
    }
  });

  return result;
}
```

### 12.5 关键注意事项

#### 12.5.1 执行顺序

多个联动规则的执行顺序：

1. **并行执行**：同一字段的多个联动规则会并行计算
2. **结果合并**：所有联动规则计算完成后，结果会被合并
3. **覆盖规则**：
   - 状态类型（visibility/disabled/readonly）：直接合并，互不影响
   - 值类型（value）：后面的覆盖前面的
   - 选项类型（options）：后面的覆盖前面的
   - Schema 类型（schema）：后面的覆盖前面的

#### 12.5.2 依赖关系处理

当多个联动规则依赖相同的字段时：

```json
{
  "linkages": [
    {
      "type": "value",
      "dependencies": ["#/properties/category"]
    },
    {
      "type": "options",
      "dependencies": ["#/properties/category"]
    }
  ]
}
```

- ✅ 依赖图会自动去重，避免重复监听
- ✅ 当 `category` 变化时，两个联动规则都会被触发
- ✅ 使用 `Promise.allSettled` 确保单个规则失败不影响其他规则

#### 12.5.3 性能优化

**缓存策略**：

- 每个联动规则可以独立配置 `enableCache`
- 建议为异步联动（如 API 调用）启用缓存
- 缓存键基于依赖字段的值生成

**并行执行**：

- 同一字段的多个联动规则并行计算，提高性能
- 使用 `Promise.allSettled` 避免阻塞

**避免过度联动**：

- ❌ 不推荐：为同一字段配置超过 3 个联动规则
- ✅ 推荐：合理拆分联动逻辑，保持简洁

### 12.6 最佳实践

#### 12.6.1 合理使用多联动类型

**推荐场景**：

1. **value + options**：清空值并加载新选项（如 Category-Action）
2. **visibility + disabled**：条件性显示和禁用（如 VIP 字段）
3. **schema + value**：动态表单与默认值（如产品配置）

**不推荐场景**：

- ❌ 配置过多联动规则（超过 3 个）
- ❌ 联动规则之间存在冲突（如同时设置不同的 value）
- ❌ 复杂的嵌套联动（建议拆分为多个字段）

### 12.7 总结

#### 12.7.1 核心优势

1. **灵活性**：支持为单个字段配置多种联动类型
2. **性能优化**：并行执行，独立缓存
3. **易于维护**：配置清晰，逻辑独立
4. **职责分离**：每个联动规则单一职责，易于理解和调试

#### 12.7.2 实现要点

| 组件            | 修改内容                          | 关键点                |
| --------------- | --------------------------------- | --------------------- |
| **类型定义**    | 使用 `linkages?: LinkageConfig[]` | 只支持数组格式        |
| **Schema 解析** | 只解析 `linkages` 数组            | 移除单个 linkage 支持 |
| **联动管理器**  | 遍历多个联动规则并合并结果        | 并行执行，错误隔离    |
| **依赖图**      | 自动去重依赖关系                  | 避免重复监听          |

#### 12.7.3 实现状态

1. ✅ **类型定义扩展**：已修改 `src/components/DynamicForm/types/schema.ts`，使用 `linkages` 字段
2. ✅ **Schema 解析器**：已修改 `schemaLinkageParser.ts`，只支持解析 `linkages` 数组配置
3. ✅ **联动管理器**：已修改 `useLinkageManager.ts` 和 `useArrayLinkageManager.ts`，实现多联动规则并行计算和合并
4. ✅ **示例代码**：已创建 `MultipleLinkagesExample.tsx`，演示多联动类型的使用场景
5. ⏳ **文档更新**：正在更新相关文档，移除向后兼容内容

---

## 相关文档

- [异步联动实现方案](./linkage.md#13-异步联动详细设计)
- [数组字段联动设计方案](./linkage.md#14-数组联动详细设计)
- [字段路径透明化设计方案](./field-path.md)
- [字段路径完全指南](../guides/field-path.md)
- [动态表单常见问题](../../README.md#troubleshooting)

---

**文档版本**: 2.7
**创建日期**: 2025-12-26
**最后更新**: 2026-07-02
**文档状态**: 已更新

## 变更历史

### v2.7 (2026-07-02)

**新增内容**：补充分层计算策略中的路径生成机制和嵌套数组场景说明

**主要变更**：

1. **补充 `pathPrefix` 生成链路**
   - ✅ 说明普通嵌套对象场景下 `pathPrefix="ocr"` 的来源
   - ✅ 说明对象数组元素场景下 `pathPrefix="contacts.0"` 的来源
   - ✅ 说明嵌套数组场景下 `departments.0.employees.0` 的逐层生成过程

2. **澄清分层计算的实际机制**
   - ✅ 明确 `asNestedForm && pathPrefix` 不等价于数组元素层判断
   - ✅ 说明真正的数组边界来自 `parseSchemaLinkages` 遇到数组字段时停止递归
   - ✅ 说明内层 DynamicForm 通过 `parentLinkages` 过滤父级已负责的联动

3. **补充嵌套数组所有权示例**
   - ✅ 对比普通嵌套对象、一级对象数组、二级嵌套对象数组的联动归属
   - ✅ 说明跨数组边界场景中目标字段由哪一层 DynamicForm 负责

### v2.6 (2026-01-16)

**新增内容**：多联动类型支持设计方案

**主要变更**：

1. **新增第 12 章：多联动类型支持（Multiple Linkage Types）**
   - ✅ 12.1 节：背景与需求分析
   - ✅ 12.2 节：设计方案对比（数组配置、联动组、函数返回多种结果）
   - ✅ 12.3 节：三个典型使用场景示例
   - ✅ 12.4 节：实现细节（类型定义、Schema 解析、联动管理器）
   - ✅ 12.5 节：关键注意事项（执行顺序、依赖处理、性能优化）
   - ✅ 12.6 节：最佳实践
   - ✅ 12.7 节：总结和实现状态

2. **设计方案核心特性**
   - ✅ 支持 `linkages` 数组配置，允许单个字段配置多种联动类型
   - ✅ 并行执行多个联动规则，提高性能
   - ✅ 智能合并联动结果，避免冲突
   - ✅ 每个联动规则职责单一，易于维护

3. **典型使用场景**
   - ✅ Category-Action 联动（value + options）
   - ✅ 条件性字段显示与禁用（visibility + disabled）
   - ✅ 动态表单与值联动（schema + value）

**文档规模**：~2280 行（新增约 540 行）

### v2.5 (2026-01-16)

**新增内容**：Options 联动实现机制说明和 refreshLinkage 使用指南

**主要变更**：

1. **Options 联动实现机制**
   - ✅ 在第 3.4 节添加 Options 联动的实现机制说明
   - ✅ 详细说明从联动计算到 UI 渲染的完整流程
   - ✅ 解释 `linkageState.options` 如何合并到 `field.options`

2. **新增常见问题 Q8**
   - ✅ 如何在异步数据加载后手动触发联动初始化
   - ✅ 提供 `refreshLinkage()` 的使用方法和注意事项
   - ✅ 说明常见的闭包陷阱及解决方案
   - ✅ 提供完整的代码示例

3. **文档交叉引用**
   - ✅ 添加到 RefreshLinkageExample 的引用链接
   - ✅ 与 USAGE.md 的 API Reference 部分保持一致

**相关示例**：

- [RefreshLinkage Example](../../src/examples/RefreshLinkageExample.tsx)

### v2.4 (2026-01-10)

**重大重构**：将异步联动内容独立为单独的技术文档

**主要变更**：

1. **文档结构优化**
   - ✅ 将原第 10 章的异步联动内容（~850 行）独立为 [异步联动实现方案](./linkage.md#13-异步联动详细设计)
   - ✅ 第 10 章改为简要说明并引用独立文档
   - ✅ 减少文档规模，提高可维护性

2. **内容更新**
   - ✅ 更新第 6.9 节：异步函数支持，引用独立文档
   - ✅ 更新常见问题 Q3、Q5、Q6、Q7，引用独立文档
   - ✅ 更新相关文档列表，增加异步联动专题入口

3. **文档定位**
   - ✅ LINKAGE.md：UI 联动设计方案总览
   - ✅ 增加异步联动实现方案详解

**文档规模**：~1650 行（精简约 850 行）

### v2.3 (2026-01-10)

**新增内容**：串行依赖异步联动问题分析与解决方案

**主要变更**：

1. **新增第 10.1 节：串行依赖中的异步联动问题**
   - ✅ 详细分析串行依赖场景的三个严重问题
   - ✅ 问题 1：并行执行而非串行
   - ✅ 问题 2：formData 快照陈旧
   - ✅ 问题 3：所有异步结果都过期
   - ✅ 提供测试验证和执行日志分析

2. **三种解决方案对比**
   - ✅ 方案 1：递归触发依赖字段
   - ✅ 方案 2：任务队列管理（推荐）
   - ✅ 方案 3：全局标志位
   - ✅ 详细对比表格和适用场景

3. **推荐方案：任务队列管理**
   - ✅ 任务队列管理器实现
   - ✅ 队列处理器实现
   - ✅ watch 集成代码
   - ✅ 完整的执行流程示例

4. **实施建议**
   - ⚠️ 短期：当前实现存在严重问题
   - 🔧 中期：实施任务队列方案
   - 🔧 长期：添加防抖和 loading 状态

5. **更新常见问题**
   - ✅ 新增 Q6：串行依赖的异步联动是否能正常工作？
   - ✅ 提供问题说明和临时建议

**文档规模**：~2300 行（新增约 300 行）

### v2.2 (2026-01-10)

**新增内容**：值联动潜在问题分析与解决方案

**主要变更**：

1. **新增第 10 章：已知问题与解决方案**
   - ✅ 详细分析值联动触发 watch 的两个问题
   - ✅ 问题 A：setValue 触发 watch 的死循环风险
   - ✅ 问题 B：测试环境中的 watch 多次触发
   - ✅ 提供完整的问题场景示例和代码演示

2. **当前缓解措施说明**
   - ✅ 标志位机制防止死循环（已实现）
   - ✅ 测试中增加等待时间（已实现）
   - ✅ 说明当前实现的状态和效果

3. **实际使用场景风险评估**
   - ✅ 分析用户快速连续输入的风险
   - ✅ 分析多个字段同时变化的风险
   - ✅ 提供风险等级评估表

4. **三种解决方案对比**
   - ✅ 方案 1：添加防抖机制（推荐）
   - ✅ 方案 2：改进异步序列管理器
   - ✅ 方案 3：混合方案（最佳实践）
   - ✅ 每个方案的优缺点和适用场景

5. **实施建议和开发者注意事项**
   - ✅ 短期、中期、长期的实施路线图
   - ✅ 开发者使用值联动时的注意事项
   - ✅ 临时解决方案（缓存、debounce 包装）

6. **更新常见问题**
   - ✅ 新增 Q6：值联动在实际使用中会有问题吗？
   - ✅ 提供简要说明和风险评估

**文档规模**：~2000 行（新增约 340 行）

### v2.1 (2026-01-09)

**新增功能**：Schema 联动和异步竞态条件处理

**主要变更**：

1. **新增 Schema 联动类型**
   - ✅ 扩展 `LinkageType` 支持 `'schema'` 类型
   - ✅ 支持基于表单数据异步加载 schema 结构
   - ✅ Schema 更新只影响 properties 和校验字段，保留原有 ui 配置
   - ✅ 新增第 3.5 节：动态 Schema（异步加载）示例

2. **异步竞态条件处理**
   - ✅ 实现 AsyncSequenceManager 序列号管理器
   - ✅ 自动处理异步请求的竞态条件
   - ✅ 确保只有最新的异步结果会被应用
   - ✅ 新增第 6.9 节：异步竞态条件处理详细说明

3. **文档更新**
   - ✅ 更新类型定义，添加 `schema` 字段到 `LinkageResult`
   - ✅ 更新设计说明，补充异步支持和竞态条件处理
   - ✅ 新增 Q4 和 Q5 常见问题
   - ✅ 更新核心优势列表

**实现文件**：

- `src/components/DynamicForm/types/linkage.ts`
- `src/components/DynamicForm/hooks/useLinkageManager.ts`
- `src/components/DynamicForm/widgets/NestedFormWidget.tsx`
- `src/pages/examples/NestedForm/SchemaLoaderExample.tsx`

### v2.0 (2025-12-30)

**重大重构**：精简文档，优化章节结构，补充关键实现细节

**主要变更**：

1. **修正类型定义**
   - ✅ 使用联合类型 `ConditionExpression = SingleCondition | LogicalCondition`
   - ✅ 确保类型安全，单条件和逻辑组合不能混用

2. **优化章节结构**
   - ✅ 将分层计算、DynamicForm 集成合并到第 6 节（实现方案）
   - ✅ 调整章节顺序：端到端示例前置到第 7 节
   - ✅ 删除"高级特性"标题，避免误导

3. **补充关键实现细节**
   - ✅ 6.4 节：分层计算策略和工作流程
   - ✅ 6.5 节：DynamicForm 集成（五步流程）
   - ✅ 6.6 节：依赖图优化
   - ✅ 6.7 节：异步函数支持
   - ✅ 第 7 节：完整的端到端示例

4. **精简重复内容**
   - ✅ 删除与专题文档重复的详细说明
   - ✅ 改为引用相关文档链接

**文档规模**：~900 行（精简 55%，但内容更充实）

### v1.0 (2025-12-26)

初始版本，包含完整的 UI 联动设计方案。

## 13. 异步联动详细设计

### 1. 概述

异步联动是动态表单系统的重要特性，允许联动函数执行异步操作（如 API 调用、复杂计算等）。本文档介绍异步联动的完整实现方案，包括竞态条件处理、串行依赖执行和死循环防护。

#### 本文档内容结构

- **2. 竞态条件处理** - 使用序列号管理器确保异步结果的正确性
- **3. 串行依赖执行** - 使用任务队列管理器处理复杂的依赖关系
- **4. 死循环防护** - 防止 setValue 触发 watch 导致的无限循环
- **5. 开发者最佳实践** - 使用异步联动时的注意事项

#### 核心设计原则

1. **结果正确性**：确保只应用最新的异步结果，丢弃过期结果
2. **执行顺序**：保证串行依赖按正确顺序执行，后续字段使用最新值
3. **性能优化**：合并重复任务，避免不必要的计算
4. **稳定性**：防止死循环和无限递归

---

### 2. 竞态条件处理

#### 2.1 使用场景

当用户快速切换依赖字段时，可能会同时触发多个异步联动函数。由于异步操作的完成顺序不确定，可能导致旧的结果覆盖新的结果。

**示例场景**：动态加载产品配置 schema

```typescript
const linkageFunctions = {
  loadProductSchema: async (formData: any) => {
    const productType = formData?.productType;
    const response = await fetch(`/api/products/${productType}/schema`);
    return await response.json();
  },
};
```

**执行时间线**：

```
t0: 用户选择 "laptop"
  → 发起请求 A（耗时 200ms）

t1: 用户快速切换到 "smartphone"（50ms 后）
  → 发起请求 B（耗时 100ms）

t2: 请求 B 完成（150ms）
  → 显示 smartphone 的 schema ✅

t3: 请求 A 完成（200ms）
  → 如果没有保护机制，会错误地显示 laptop 的 schema ❌
```

---

#### 2.2 解决方案：AsyncSequenceManager

使用**序列号管理器**为每个字段的异步操作分配递增的序列号，只应用最新序列号的结果。

**核心实现**：

```typescript
class AsyncSequenceManager {
  private sequences: Map<string, number> = new Map();

  // 为字段生成新的序列号
  next(fieldName: string): number {
    const current = this.sequences.get(fieldName) || 0;
    const next = current + 1;
    this.sequences.set(fieldName, next);
    return next;
  }

  // 检查序列号是否是最新的
  isLatest(fieldName: string, sequence: number): boolean {
    const current = this.sequences.get(fieldName) || 0;
    return sequence === current;
  }
}
```

**使用方式**：

```typescript
// 使用 fieldPath:type 作为序列号键，而非单纯的 fieldPath。
// 原因：同一字段的不同联动类型（options、value、schema 等）在 evaluateLinkagesByLayers
// 中并行执行（Promise.allSettled）。若共享同一 fieldPath 键，后一次 next() 调用会
// 使前一次的序列号失效，导致 options 等类型永远抛出 StaleResultError。
// 分开追踪后，每种类型独立判断是否被更新的计算所取代，互不干扰。
const sequenceKey = `${fieldPath}:${linkage.type}`;

// 1. 在调用异步函数之前生成序列号
const sequence = asyncSequenceManager.next(sequenceKey);

// 2. 执行异步函数
const fnResult = await fn(formData, context);

// 3. 异步函数返回后，检查序列号是否仍然是最新的
if (!asyncSequenceManager.isLatest(sequenceKey, sequence)) {
  // 丢弃过期的结果
  throw new StaleResultError(sequenceKey, sequence);
}

// 4. 只有最新的结果才会被应用
result.schema = fnResult;
```

**执行效果**：

```
t0: 用户选择 "laptop"
  → 生成序列号 1，发起请求 A

t1: 用户快速切换到 "smartphone"
  → 生成序列号 2，发起请求 B

t2: 请求 B 完成
  → 检查序列号 2 是最新的 ✅
  → 更新 schema

t3: 请求 A 完成
  → 检查序列号 1 不是最新的 ❌
  → 丢弃结果
```

**适用范围**：所有异步联动类型（schema、options、value 等）

---

### 3. 串行依赖执行

#### 3.1 使用场景

在串行依赖场景中（例如 B 依赖 A，C 依赖 A 和 B），当 A 变化时，系统需要：

1. 先计算 B 的联动
2. 等待 B 完成后，再计算 C 的联动（使用最新的 B 值）

**挑战**：

- React Hook Form 的 `watch` 会在每次 `setValue` 时触发，可能导致多个联动链并行执行
- 需要确保后续字段使用最新的依赖字段值
- 用户可能在联动执行期间快速连续修改字段

---

#### 3.2 解决方案：任务队列管理

使用**任务队列**确保联动按正确顺序串行执行，并自动合并重复任务。

**核心思想**：

1. 将所有联动请求放入队列
2. 确保同一时间只有一个联动链在执行
3. 自动合并相同字段的任务（只保留最新的）
4. 每次处理时获取最新的表单数据

**任务队列管理器实现**：

```typescript
class LinkageTaskQueue {
  private queue: Array<{ fieldName: string; timestamp: number; affectedFields: string[] }> = [];
  private isProcessing = false;
  private latestTaskMap = new Map<string, number>();

  /**
   * 将字段任务加入队列
   * 如果队列中已有相同字段的任务，更新其 timestamp（任务合并）
   * @param fieldName - 触发变化的字段名
   * @param affectedFields - 受影响的字段列表（由调用方预先计算并传入）
   */
  enqueue(fieldName: string, affectedFields: string[]) {
    const timestamp = Date.now();
    const existingIndex = this.queue.findIndex(t => t.fieldName === fieldName);

    if (existingIndex >= 0) {
      // 队列中已有该字段的任务，更新 timestamp 和 affectedFields
      this.queue[existingIndex].timestamp = timestamp;
      this.queue[existingIndex].affectedFields = affectedFields;
    } else {
      // 队列中没有该字段的任务，添加新任务
      this.queue.push({ fieldName, timestamp, affectedFields });
    }

    // 记录该字段的最新 timestamp
    this.latestTaskMap.set(fieldName, timestamp);
  }

  dequeue() {
    return this.queue.shift();
  }

  /**
   * 检查任务是否有效（是否是该字段的最新任务）
   * 用于处理任务合并：只有最新的 timestamp 才有效
   */
  isTaskValid(fieldName: string, timestamp: number) {
    return this.latestTaskMap.get(fieldName) === timestamp;
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  getProcessing() {
    return this.isProcessing;
  }

  setProcessing(value: boolean) {
    this.isProcessing = value;
  }
}
```

**任务合并机制说明**：

`timestamp` 和 `latestTaskMap` 配合实现任务版本控制：

1. **入队时**：
   - 如果队列中已有该字段的任务，更新其 timestamp（任务合并）
   - 如果队列中没有该字段的任务，添加新任务
   - 同时在 `latestTaskMap` 中记录该字段的最新 timestamp

2. **处理时**：
   - 通过 `isTaskValid(fieldName, timestamp)` 检查任务是否有效
   - 只有 timestamp 与 `latestTaskMap` 中记录的最新值相同时才有效
   - 这样确保只处理最新版本的任务

3. **场景示例**：
   - 用户快速修改 A=2 → A=3 → A=4
   - 如果队列正在处理其他任务，新的修改会在队列中累积
   - 队列中可能同时存在多个字段 A 的任务（不同 timestamp）
   - 但只有最新 timestamp 的任务会被真正执行

**队列处理器实现**：

```typescript
async function processQueue() {
  // 如果已经在处理中，直接返回（避免并发执行）
  if (taskQueue.getProcessing()) return;

  taskQueue.setProcessing(true);

  try {
    while (!taskQueue.isEmpty()) {
      const task = taskQueue.dequeue();
      if (!task) break;

      // 检查任务是否仍然有效（可能已被更新的任务替代）
      if (!taskQueue.isTaskValid(task.fieldName, task.timestamp)) {
        continue;
      }

      // 获取最新的表单数据
      const formData = { ...getValues() };

      // 直接使用任务中预存的 affectedFields，避免重复调用 getAffectedFields
      const affectedFields = task.affectedFields;

      // 按拓扑层级并行计算：同层字段并行执行（Promise.allSettled），层间串行执行
      // 与旧的 topologicalSort + for 循环相比，同层字段可以并行计算，性能更好
      const { states: newStates, updatedFormData } = await evaluateLinkagesByLayers({
        fields: affectedFields,
        linkages,
        formData,
        linkageFunctions,
        asyncSequenceManager,
        dependencyGraph,
        cache,
      });

      // 批量更新状态和表单（见下面的死循环防护部分）
      updateFormAndStates(affectedFields, newStates, updatedFormData);
    }
  } finally {
    taskQueue.setProcessing(false);
  }
}
```

**`evaluateLinkagesByLayers` 核心逻辑**：

```typescript
async function evaluateLinkagesByLayers({ fields, ... }) {
  // 1. 使用拓扑层级划分（getTopologicalLayers），将字段分为多个层
  //    同一层内的字段之间无依赖关系，可安全并行；层间串行保证顺序
  const layers = dependencyGraph.getTopologicalLayers(fields);

  for (const layer of layers) {
    // 2. 层内并行计算（Promise.allSettled）
    const layerResults = await Promise.allSettled(
      layer.map(fieldName => evaluateLinkage({ fieldName, formData, ... }))
    );

    // 3. 收集结果，并将 value 联动的值写入 formData 供后续层使用
    layerResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value.result) {
        states[fieldName] = result.value.result;
        if (result.value.result.value !== undefined) {
          formData[fieldName] = result.value.result.value;
        }
      }
    });
  }
}
```

**关键说明**：

这个实现中，`processQueue()` 会在每次 `enqueue` 后立即被调用。但由于：

1. `isProcessing` 标志位确保同一时间只有一个队列在处理
2. 在处理期间，新的 `enqueue` 会更新队列中已有任务的 timestamp
3. 当第一轮处理完成后，队列中仍有任务（timestamp 已更新），会继续处理
4. 此时获取的是最新的表单数据，确保使用用户的最终输入值

#### 3.3 执行流程示例

**场景**：用户快速连续修改同一字段，触发多次联动计算

**依赖关系**：
- A → B → C（A 变化触发 B，B 变化触发 C）

**联动函数**（均为异步，耗时 100ms）：
- B: `b = a * 2`
- C: `c = a + b`

**为什么需要队列？**
- 用户快速修改 A 时，每次修改都会触发 A→B→C 的联动链
- 如果没有队列，多个联动链会并发执行，导致：
  - formData 快照不一致（C 可能使用旧的 B 值）
  - setValue 触发的 watch 导致连锁反应
  - 最终结果不可预测
- 队列确保同一时间只有一个联动链在执行

```
时间线：
t0 (0ms): 用户修改 A = 2
  → watch 触发 → taskQueue.enqueue('a', timestamp=t0)
  → 队列: [{ fieldName: 'a', timestamp: t0 }]
  → latestTaskMap: { 'a': t0 }
  → processQueue() 开始执行
  → 取出任务 { fieldName: 'a', timestamp: t0 }，队列变空
  → 检查 isTaskValid('a', t0) = true ✅
  → 开始计算 A → B → C...

t1 (50ms): 用户修改 A = 3（第一轮联动正在执行中）
  → watch 触发 → taskQueue.enqueue('a', timestamp=t1)
  → 队列: [{ fieldName: 'a', timestamp: t1 }]  ← 新任务入队
  → latestTaskMap: { 'a': t1 }  ← 更新 A 的最新版本
  → processQueue() 正在执行，跳过

t2 (100ms): 用户修改 A = 4（第一轮联动仍在执行）
  → watch 触发 → taskQueue.enqueue('a', timestamp=t2)
  → 队列中已有 'a'，更新其 timestamp
  → 队列: [{ fieldName: 'a', timestamp: t2 }]  ← 任务合并
  → latestTaskMap: { 'a': t2 }  ← 更新 A 的最新版本

t3 (200ms): 第一轮处理完成
  → A → B → C 的计算完成（使用 a=2）
  → 应用结果：b = 4, c = 6
  → while 循环继续，队列不为空
  → 取出任务 { fieldName: 'a', timestamp: t2 }
  → 检查 isTaskValid('a', t2) = true ✅
  → 获取最新的 formData: { a: 4 }
  → 开始计算 A → B → C...

t4 (400ms): 第二轮处理完成
  → 计算完成：b = 8, c = 12
  → 应用结果（覆盖第一轮结果）
  → 队列为空，处理结束

最终结果：a = 4, b = 8, c = 12 ✅
```

**关键机制解释**：

1. **队列的作用**：
   - 防止同一字段的多次修改导致的并发执行
   - 确保同一时间只有一个联动链在执行
   - 通过 `isProcessing` 标志位实现串行控制

2. **任务合并机制**：
   - t1 时创建新任务入队（队列中有 'a'）
   - t2 时队列中已有 'a'，更新其 timestamp（任务合并）
   - 通过 `latestTaskMap` 记录每个字段的最新 timestamp
   - 最终只执行两轮计算（而不是三轮）

3. **执行流程**：
   - t0-t3: 执行第一轮 A→B→C（使用 a=2），应用结果
   - t3-t4: 执行第二轮 A→B→C（使用 a=4），覆盖第一轮结果

4. **为什么需要队列？**
   - 如果没有队列，t0、t1、t2 的三次修改会触发三个并发的联动链
   - 这三个链会同时执行，可能导致：
     - C 使用的 B 值不确定（可能是旧值）
     - formData 快照不一致
     - 最终结果不可预测
   - 队列确保串行执行，每次都使用最新的 formData

**关键特性**：

- ✅ 防止同一字段的并发联动执行
- ✅ 任务合并优化（三次修改只执行两轮）
- ✅ 每条依赖链内部保证串行（C 使用最新的 B 值）
- ⚠️ 中间结果会被应用但随后被覆盖（可通过防抖优化）

---

### 4. 死循环防护

#### 4.1 使用场景

值联动（`type: 'value'`）会调用 `form.setValue()` 更新表单字段值。即使设置了 `shouldValidate: false` 和 `shouldDirty: false`，React Hook Form 的 `watch` 仍然会被触发，可能导致死循环：

```
用户修改字段 A
  ↓
watch 触发，计算字段 B 的联动
  ↓
调用 setValue(B, newValue)
  ↓
setValue 触发 watch
  ↓
watch 再次触发，重新计算字段 B
  ↓
无限循环...
```

---

#### 4.2 解决方案：与任务队列集成的防护机制

结合任务队列方案，实现完整的死循环防护。

**核心思想**：

1. **批量更新机制**：在一轮联动计算完成后，批量调用 setValue
2. **队列状态控制**：批量更新期间，暂停 watch 的处理
3. **明确的状态管理**：使用队列的 `isProcessing` 状态来控制

**完整实现**：

```typescript
// 在 watch 回调中
const subscription = watch((_, { name }) => {
  if (!name) return;

  // 精确监听优化：仅处理被联动依赖的字段
  const affectedFields = dependencyGraph.getAffectedFields(name);
  if (affectedFields.length === 0) return;

  // 级联传播控制：字段正在被联动的 setValue 更新时，仍允许触发下游依赖（非自身）的联动。
  // 仅当所有下游字段也都在被更新时（循环依赖），才完全跳过，防止死循环。
  if (taskQueue.isFieldUpdating(name)) {
    const hasCascadeTargets = affectedFields.some(f => !taskQueue.isFieldUpdating(f));
    if (!hasCascadeTargets) return;
  }

  // 将任务（含预计算的 affectedFields）加入队列
  taskQueue.enqueue(name, affectedFields);

  // 如果队列正在处理中，不重复触发（队列会自动继续处理）
  if (taskQueue.getProcessing()) return;

  processQueue();
});
```

**任务队列管理器关键方法**：

```typescript
class LinkageTaskQueue {
  private updatingFields = new Set<string>(); // 正在被联动 setValue 更新的字段集合

  // 标记字段正在被联动更新
  markFieldUpdating(fieldName: string) {
    this.updatingFields.add(fieldName);
  }

  // 检查字段是否正在被联动更新
  isFieldUpdating(fieldName: string): boolean {
    return this.updatingFields.has(fieldName);
  }

  // 清除所有字段的更新标记
  clearUpdatingFields() {
    this.updatingFields.clear();
  }
}
```

**队列处理器中的批量更新（预标记机制）**：

```typescript
// 联动计算完成后，批量更新表单
// 关键：在任何 setValue 调用之前，预先标记所有受影响字段
// 背景：evaluateLinkagesByLayers 已按拓扑层处理完所有字段（含间接下游）。
// 若不预标记，setValue('apiId') 触发的 cascade 会再次对 content 求值，
// 产生 StaleResultError（两次并发调用序列号错位）。
taskQueue.setUpdatingForm(true);

// 预标记所有受影响字段，防止 setValue 触发的 cascade 重复求值
affectedFields.forEach(fieldName => taskQueue.markFieldUpdating(fieldName));

// 批量更新表单（仅 value 类型联动需要写入表单）
affectedFields.forEach(fieldName => {
  const hasValueLinkage = linkages[fieldName]?.some(l => l.type === 'value');
  if (hasValueLinkage && updatedFormData[fieldName] !== undefined) {
    const currentValue = getValues(fieldName);
    if (currentValue !== updatedFormData[fieldName]) {
      setValue(fieldName, updatedFormData[fieldName], {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }
});

// 等待 watch 回调执行完成（所有 setValue 触发的 watch 都已处理）
await new Promise(resolve => setTimeout(resolve, 0));

// 清除所有字段的更新标记
taskQueue.clearUpdatingFields();
taskQueue.setUpdatingForm(false);
```

---

#### 4.3 防护机制的完整性保证

**为什么这个方案能确保不会死循环且不丢失用户修改**：

1. **预标记机制（核心防护）**：
   - 在任何 `setValue` 调用之前，预先将所有 `affectedFields` 标记为 "正在更新"
   - watch 回调检查 `isFieldUpdating(name)` 时，会进入级联传播检查
   - 仅当该字段的所有下游字段也都在更新中时（循环依赖），才完全跳过
   - 若存在未被标记的下游字段（合法级联），仍允许继续处理

2. **级联传播保证**：
   - `hasCascadeTargets` 检查确保合法的级联仍然传播（如 A→B→C 中，setValue(B) 仍能触发 C）
   - 只有真正形成循环时（所有下游都已标记），才阻断，防止死循环

3. **批量更新的清理**：
   - 所有 `setValue` 完成后，`await new Promise(resolve => setTimeout(resolve, 0))` 等待 watch 回调执行完成
   - 然后调用 `clearUpdatingFields()` 清除所有标记，恢复正常监听
   - 批量更新完成后队列中的新任务（用户修改或合法级联）将正常处理

4. **场景覆盖**：
   - 同步联动：预标记立即生效，setValue 触发的 watch 正确执行级联检查
   - 异步联动：任务队列确保串行执行，不会并发
   - 快速连续输入：任务合并机制避免重复计算
   - 菱形依赖：拓扑层级执行保证每个字段只计算一次，使用正确的上游值

**执行流程示例**：

```
场景：category → apiId（options + value）→ content（schema）

t0: 用户切换 category
  → watch 触发，affectedFields = ['apiId', 'content']
  → evaluateLinkagesByLayers 计算完成
  → 预标记：markFieldUpdating('apiId'), markFieldUpdating('content')
  → setValue('apiId', newValue)  ← 触发 watch
    → watch: isFieldUpdating('apiId') = true
      → hasCascadeTargets = ['content'].some(f => !isFieldUpdating(f)) = false
      → ❌ 跳过（防止已处理字段重复求值）

  注：'content' 无 value 联动，不调用 setValue('content')

  → await new Promise(...)  ← 等待所有 watch 回调
  → clearUpdatingFields()  ← 清除标记
```

---

### 5. 开发者最佳实践

#### 5.1 性能优化建议

**1. 为慢速异步联动添加防抖**

对于执行时间较长的异步联动（> 500ms），建议添加防抖机制：

```typescript
import { debounce } from 'lodash';

const linkageFunctions = {
  // 为慢速 API 调用添加防抖
  loadProductSchema: debounce(async (formData: any) => {
    const response = await fetch(`/api/products/${formData.productType}/schema`);
    return await response.json();
  }, 300),
};
```

**2. 使用缓存减少重复计算**

```typescript
const cache = new Map();

const linkageFunctions = {
  calculateTotal: async (formData: any) => {
    const cacheKey = `${formData.price}-${formData.quantity}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const result = await expensiveCalculation(formData);
    cache.set(cacheKey, result);
    return result;
  },
};
```

**3. 添加 loading 状态提示**

对于用户可感知的异步操作，建议添加 loading 状态：

```typescript
const linkageFunctions = {
  loadOptions: async (formData: any, context: any) => {
    context.setLoading?.(true);
    try {
      const options = await fetchOptions(formData.category);
      return options;
    } finally {
      context.setLoading?.(false);
    }
  },
};
```

---

#### 5.2 常见场景处理

**场景 1：串行依赖的异步联动**

✅ **推荐**：使用任务队列方案（本章介绍的方案）

```typescript
// B 依赖 A，C 依赖 A 和 B
const linkages = {
  b: {
    type: 'value',
    dependencies: ['a'],
    fulfill: { function: 'calculateB' },
  },
  c: {
    type: 'value',
    dependencies: ['a', 'b'],
    fulfill: { function: 'calculateC' },
  },
};
```

任务队列会自动处理串行依赖，确保 C 使用最新的 B 值。

---

**场景 2：用户快速连续输入**

✅ **推荐**：为输入字段添加防抖

```typescript
// 在 DynamicForm 组件中
const debouncedHandleChange = useMemo(
  () =>
    debounce((fieldName: string) => {
      taskQueue.enqueue(fieldName);
      processQueue();
    }, 300),
  []
);
```

---

**场景 3：复杂的异步依赖**

❌ **避免**：过深的嵌套依赖（> 3 层）

```typescript
// 不推荐：A → B → C → D → E
```

✅ **推荐**：扁平化依赖结构

```typescript
// 推荐：A → B, A → C, A → D
```

---

#### 5.3 调试和监控

**1. 启用调试日志**

```typescript
// 在开发环境启用详细日志
if (process.env.NODE_ENV === 'development') {
  console.log('Linkage executed:', fieldName, result);
  console.log('Queue status:', taskQueue.getStatus());
}
```

**2. 监控异步结果过期**

如果控制台频繁出现"检测到过期的异步结果"，说明：

- 异步函数执行时间过长
- 用户输入过快
- 需要添加防抖机制

**3. 性能分析**

```typescript
const startTime = performance.now();
const result = await linkageFunction(formData);
const duration = performance.now() - startTime;

if (duration > 500) {
  console.warn(`Slow linkage function: ${fieldName}, duration: ${duration}ms`);
}
```

---

#### 5.4 最佳实践总结

**✅ 推荐做法**：

- 使用本文档介绍的三个核心方案（序列号管理、任务队列、死循环防护）
- 为慢速异步函数添加防抖和 loading 状态
- 使用缓存减少重复计算
- 保持依赖结构扁平化（不超过 3 层）
- 在开发环境启用调试日志

**❌ 避免做法**：

- 执行时间过长的异步函数（> 1s）
- 过深的嵌套依赖（> 3 层）
- 在联动函数中执行副作用操作
- 忽略控制台中的性能警告

---

### 总结

本文档介绍了异步联动的完整实现方案：

1. **竞态条件处理**：使用 AsyncSequenceManager 确保只应用最新的异步结果
2. **串行依赖执行**：使用任务队列管理器确保正确的执行顺序和任务合并
3. **死循环防护**：通过队列状态控制防止 setValue 触发 watch 导致的无限循环

这三个方案相互配合，构成了一个完整、稳定、高性能的异步联动系统。开发者在使用时应遵循最佳实践，确保系统的稳定性和性能。

## 14. 数组联动详细设计

### 目录

1. [概述](#1-概述)
2. [核心挑战](#2-核心挑战)
3. [解决方案架构](#3-解决方案架构)
4. [基础场景](#4-基础场景)
5. [复杂场景](#5-复杂场景)
6. [实现方案](#6-实现方案)
7. [最佳实践](#7-最佳实践)

---

### 1. 概述

数组字段的联动是动态表单系统中最复杂的场景之一，涉及到相对路径、动态索引、嵌套依赖等多个技术难点。本文档详细描述了数组字段联动的各种场景和完整的实现方案。

#### 1.1 为什么需要专门处理

数组字段联动与普通字段联动的主要区别：

| 特性       | 普通字段联动  | 数组字段联动         |
| ---------- | ------------- | -------------------- |
| 路径类型   | 静态路径      | 动态路径（包含索引） |
| 依赖关系   | 绝对路径      | 相对路径 + 绝对路径  |
| 实例化时机 | Schema 解析时 | 运行时动态生成       |
| 复杂度     | 低            | 高                   |

#### 1.2 适用范围

本文档涵盖以下场景：

- ✅ 数组元素内部字段之间的联动（相对路径）
- ✅ 数组元素字段依赖外部字段（绝对路径）
- ✅ 混合依赖（相对路径 + 绝对路径）
- ✅ 跨数组依赖（oneOf/anyOf/allOf）
- ✅ 嵌套数组联动（父子数组）
- ✅ 数组聚合计算
- ✅ 菱形依赖和循环依赖

---

### 2. 核心挑战

#### 2.1 相对路径依赖

**问题**：数组元素内部使用 `./fieldName` 引用同一元素的其他字段

```typescript
// Schema 定义
{
  contacts: {
    type: 'array',
    items: {
      properties: {
        type: { type: 'string' },
        companyName: {
          type: 'string',
          ui: {
            linkages: [
              {
                dependencies: ['./type']  // 相对路径
              }
            ]
          }
        }
      }
    }
  }
}

// 运行时需要解析为：
// contacts.0.companyName → contacts.0.type
// contacts.1.companyName → contacts.1.type
```

#### 2.2 动态索引

**问题**：数组索引是运行时动态的，无法在 Schema 解析时确定

```typescript
// Schema 解析时：contacts.companyName
// 运行时实例化：
// - contacts.0.companyName
// - contacts.1.companyName
// - contacts.2.companyName
// ...
```

#### 2.3 菱形依赖

**问题**：数组元素内部可能存在复杂的依赖关系，需要正确的拓扑排序

```
type (A)
    /      \
   /        \
  ↓          ↓
showCompany showDepartment
  (B)        (C)
   \        /
    \      /
     ↓    ↓
   workInfo (D)
```

---

### 3. 解决方案架构

#### 3.1 嵌套表单联动状态传递方案

##### 3.1.1 核心挑战

当 ArrayFieldWidget 渲染对象类型数组元素时，通过 NestedFormWidget 创建了新的 DynamicForm 实例。这带来了联动状态传递的挑战：

- 外层 DynamicForm 通过 `useArrayLinkageManager` 计算联动状态
- 内层 DynamicForm（NestedFormWidget 内部）需要访问这些联动状态
- 如何高效、可扩展地在父子 DynamicForm 之间传递联动状态？

##### 3.1.2 解决方案：分层计算联动状态

**设计原则**：

- **职责分离**：每层 DynamicForm 只计算自己范围内的联动
- **按需计算**：只在组件渲染时才计算该层的联动
- **状态共享**：通过 Context 共享表单实例和顶层联动状态

**实现架构**：

```typescript
// 外层 DynamicForm：计算顶层字段的联动
const ownLinkageStates = useArrayLinkageManager({
  baseLinkages: topLevelLinkages,  // 只包含顶层字段（如 contacts、showContacts）
  form: methods,
  schema,
});

// 通过 Context 提供联动计算能力
<LinkageStateContext.Provider value={{
  parentLinkageStates: ownLinkageStates,  // 父级联动状态
  form: methods,                           // 共享的表单实例
  rootSchema: schema,                      // 完整的 schema
  pathPrefix: '',                          // 当前路径前缀
}}>
  {renderFields()}
</LinkageStateContext.Provider>

// 内层 DynamicForm（NestedFormWidget 内部）：计算自己范围内的联动
const context = useContext(LinkageStateContext);

// 1. 解析自己范围内的联动配置
const ownLinkages = useMemo(() => {
  const parsed = parseSchemaLinkages(itemSchema);
  // 转换为绝对路径（如 contacts.0.companyName）
  return transformToAbsolutePaths(parsed.linkages, pathPrefix);
}, [itemSchema, pathPrefix]);

// 2. 使用父表单实例计算联动
const ownLinkageStates = useLinkageManager({
  form: context.form,  // 关键：使用父表单实例
  linkages: ownLinkages,
});

// 3. 合并父子联动状态
const finalStates = useMemo(() => ({
  ...context.parentLinkageStates,
  ...ownLinkageStates
}), [context.parentLinkageStates, ownLinkageStates]);
```

**关键优势**：

1. **性能可扩展**：
   - 外层只计算顶层字段（如 `contacts`、`showContacts`）
   - 每个数组元素独立计算自己的联动（如 `contacts.0.companyName`）
   - 100 个数组元素：外层计算 1 次，每个元素计算 1 次（按需）

2. **架构可扩展**：
   - 支持任意深度的嵌套数组（`departments.employees.skills`）
   - 每层独立计算，自动递归支持

3. **内存友好**：
   - Context 只传递表单实例引用和顶层状态
   - 不会随数组元素数量增长

4. **职责清晰**：
   - 符合组件化原则：每层管理自己的联动
   - 易于测试和维护

#### 3.2 模板依赖图方案

**核心思想**：在 Schema 解析阶段构建模板依赖图，在运行时为每个数组元素实例化联动配置。

```
Schema 解析阶段
  ↓
识别数组模板联动 (contacts.companyName)
  ↓
构建模板依赖图 (相对路径 → 模板路径)
  ↓
运行时监听数组数据
  ↓
为每个元素实例化联动配置
  ↓
解析为绝对路径并建立依赖关系
  ↓
按拓扑顺序执行联动
```

#### 3.3 路径规范（重要）

为了保证路径引用的清晰性和一致性，我们采用以下路径规范：

##### 3.3.1 路径类型

| 路径类型         | 语法                         | 适用场景                   | 示例                     |
| ---------------- | ---------------------------- | -------------------------- | ------------------------ |
| **相对路径**     | `./fieldName`                | 仅用于同一数组元素内的字段 | `./type`                 |
| **JSON Pointer** | `#/properties/path/to/field` | 所有跨层级的依赖           | `#/properties/enableVip` |

##### 3.3.2 核心规则

**✅ 允许的路径格式**：

- `./fieldName` - 同级字段（同一个数组元素对象内）
- `#/properties/fieldName` - 顶层字段
- `#/properties/arrayName/items/properties/fieldName` - 数组元素字段
- `#/properties/parent/items/properties/child/items/properties/field` - 嵌套数组字段

**❌ 禁止的路径格式**：

- `../fieldName` - 不允许使用父级相对路径
- `../../fieldName` - 不允许使用祖父级相对路径
- `fieldName` - 不允许使用简单字段名（歧义）

##### 3.3.3 设计理由

1. **语义清晰**：路径类型一目了然，相对路径只用于同级，绝对路径用于跨层级
2. **易于维护**：Schema 重构时，JSON Pointer 路径不需要修改
3. **减少错误**：消除路径解析的歧义，避免层级计算错误
4. **标准化**：符合 JSON Schema 标准，工具支持更好

#### 3.4 关键组件

| 组件                     | 职责                     | 文件位置                              |
| ------------------------ | ------------------------ | ------------------------------------- |
| `schemaLinkageParser`    | 解析 Schema 中的联动配置 | `src/components/DynamicForm/utils/schemaLinkageParser.ts`    |
| `arrayLinkageHelper`     | 数组联动辅助工具         | `src/components/DynamicForm/utils/arrayLinkageHelper.ts`     |
| `useArrayLinkageManager` | 数组联动管理器 Hook      | `src/components/DynamicForm/hooks/useArrayLinkageManager.ts` |
| `useLinkageManager`      | 基础联动管理器 Hook      | `src/components/DynamicForm/hooks/useLinkageManager.ts`      |

---

### 4. 基础场景

#### 4.1 场景 1：相对路径依赖

**业务场景**：联系人类型为"工作"时显示公司名称字段

```typescript
{
  contacts: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['personal', 'work'],
          title: '联系人类型'
        },
        companyName: {
          type: 'string',
          title: '公司名称',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['./type'],  // 相对路径
                when: { field: './type', operator: '==', value: 'work' }
              }
            ]
          }
        }
      }
    }
  }
}
```

**依赖关系**：

- `contacts.companyName` → `contacts.type`（模板依赖）
- `contacts.0.companyName` → `contacts.0.type`（运行时实例）
- `contacts.1.companyName` → `contacts.1.type`（运行时实例）

**处理流程**：

1. **Schema 解析**：识别 `contacts.companyName` 的联动配置
2. **模板依赖**：`contacts.companyName` → `contacts.type`
3. **运行时实例化**：
   - 监听 `contacts` 数组变化
   - 为每个元素生成联动配置
   - 解析相对路径为绝对路径

**路径解析示例**：

```typescript
// 当前路径: contacts.0.companyName
// 相对路径: ./type
// 解析结果: contacts.0.type

// 当前路径: contacts.1.companyName
// 相对路径: ./type
// 解析结果: contacts.1.type
```

#### 4.2 场景 2：绝对路径依赖（数组内依赖外部）

**业务场景**：全局开关控制所有联系人的 VIP 等级字段显示

```typescript
{
  enableVip: {
    type: 'boolean',
    title: '启用 VIP 功能'
  },
  contacts: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', title: '姓名' },
        vipLevel: {
          type: 'string',
          title: 'VIP 等级',
          ui: {
            linkages: [{
              type: 'visibility',
              dependencies: ['#/properties/enableVip'],  // JSON Pointer 绝对路径
              when: { field: '#/properties/enableVip', operator: '==', value: true }
            }]
          }
        }
      }
    }
  }
}
```

**依赖关系**：

- `contacts.vipLevel` → `enableVip`（模板依赖）
- `contacts.0.vipLevel` → `enableVip`（运行时实例）
- `contacts.1.vipLevel` → `enableVip`（运行时实例）

**处理流程**：

1. **Schema 解析**：识别 `contacts.vipLevel` 的联动配置
2. **模板依赖**：`contacts.vipLevel` → `enableVip`（外部字段）
3. **运行时实例化**：
   - 所有数组元素的 `vipLevel` 都依赖同一个外部字段
   - 外部字段变化时，所有数组元素的对应字段都需要更新

**特点**：

- 外部字段 → 数组元素字段（一对多）
- 外部字段变化影响所有数组元素

#### 4.3 场景 3：菱形依赖（复杂依赖关系）

**业务场景**：联系人的工作信息字段依赖两个中间计算字段

```typescript
{
  contacts: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['personal', 'work'] },
        showCompany: {
          type: 'boolean',
          ui: {
            linkages: [{
              type: 'value',
              dependencies: ['./type'],
              fulfill: { function: 'calcShowCompany' }
            }]
          }
        },
        showDepartment: {
          type: 'boolean',
          ui: {
            linkages: [{
              type: 'value',
              dependencies: ['./type'],
              fulfill: { function: 'calcShowDepartment' }
            }]
          }
        },
        workInfo: {
          type: 'string',
          ui: {
            linkages: [{
              type: 'visibility',
              dependencies: ['./showCompany', './showDepartment'],
              when: {
                and: [
                  { field: './showCompany', operator: '==', value: true },
                  { field: './showDepartment', operator: '==', value: true }
                ]
              }
            }]
          }
        }
      }
    }
  }
}
```

**依赖关系图**：

```
type (A)
    /      \
   /        \
  ↓          ↓
showCompany showDepartment
  (B)        (C)
   \        /
    \      /
     ↓    ↓
   workInfo (D)
```

**模板依赖图**：

- `contacts.showCompany` → `contacts.type`
- `contacts.showDepartment` → `contacts.type`
- `contacts.workInfo` → `contacts.showCompany`, `contacts.showDepartment`

**拓扑排序**：`type` → `showCompany`, `showDepartment` → `workInfo`

**运行时执行**（假设 `contacts.0.type` 变化）：

1. `contacts.0.type` 变化触发联动
2. 并行计算 `contacts.0.showCompany` 和 `contacts.0.showDepartment`
3. 计算 `contacts.0.workInfo`

---

### 5. 复杂场景

#### 5.1 场景 4：混合依赖（外部 + 内部相对路径）

**业务场景**：高级工作信息字段同时依赖全局开关和联系人类型

```typescript
{
  enableAdvanced: { type: 'boolean', title: '启用高级功能' },

  contacts: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['personal', 'work'] },
        advancedWorkInfo: {
          type: 'string',
          title: '高级工作信息',
          ui: {
            linkages: [{
              type: 'visibility',
              dependencies: ['#/properties/enableAdvanced', './type'],  // 混合：JSON Pointer + 相对路径
              when: {
                and: [
                  { field: '#/properties/enableAdvanced', operator: '==', value: true },
                  { field: './type', operator: '==', value: 'work' }
                ]
              }
            }]
          }
        }
      }
    }
  }
}
```

**依赖关系图**：

```
enableAdvanced (外部)
        \
         \
          ↓
    advancedWorkInfo
          ↑
         /
        /
  type (内部)
```

**模板依赖图**：

- `contacts.advancedWorkInfo` → `enableAdvanced`（外部字段）
- `contacts.advancedWorkInfo` → `contacts.type`（内部字段）

**运行时实例化**：

- `contacts.0.advancedWorkInfo` → `enableAdvanced`, `contacts.0.type`
- `contacts.1.advancedWorkInfo` → `enableAdvanced`, `contacts.1.type`

**关键点**：

- 同时解析绝对路径和相对路径
- 外部字段变化影响所有数组元素
- 内部字段变化只影响当前元素

#### 5.2 场景 5：跨数组元素联动

这类场景指的是**数组 A 的状态影响数组 B 的元素**，或者**数组 B 的元素依赖数组 A 的聚合状态**。

##### 5.2.1 数组 A 的聚合状态 → 数组 B 的所有元素

**业务场景**：当权限列表中存在管理员权限时，功能列表中的所有功能都自动启用

```typescript
{
  permissions: {
    type: 'array',
    title: '权限列表',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', title: '权限名称' },
        isAdmin: { type: 'boolean', title: '是否管理员权限' }
      }
    }
  },
  features: {
    type: 'array',
    title: '功能列表',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', title: '功能名称' },
        enabled: {
          type: 'boolean',
          title: '是否启用',
          ui: {
            linkages: [{
              type: 'value',
              dependencies: ['#/properties/permissions'],
              fulfill: {
                function: 'checkAdminPermission'
              }
            }]
          }
        }
      }
    }
  }
}
```

**依赖关系**：

- `features.enabled` → `permissions`（数组 B 的元素字段依赖数组 A）
- 具体依赖：`features.*.enabled` → `permissions.*.isAdmin`（聚合判断）

**运行时解析**：

```typescript
// features.0.enabled → permissions (检查是否存在 isAdmin=true)
// features.1.enabled → permissions (检查是否存在 isAdmin=true)
// features.2.enabled → permissions (检查是否存在 isAdmin=true)
```

**联动函数实现**：

```typescript
export const checkAdminPermission: LinkageFunction = (
  formData: any,
  context?: LinkageFunctionContext
) => {
  const permissions = formData.permissions || [];

  // 检查是否存在管理员权限
  const hasAdminPermission = permissions.some(p => p.isAdmin === true);

  // 如果有管理员权限，所有功能都启用
  return hasAdminPermission;
};
```

**关键点**：

- 数组 A（`permissions`）的聚合状态影响数组 B（`features`）的所有元素
- 使用 `some()` 进行聚合判断
- 每个 `features` 元素的 `enabled` 字段都会调用同一个函数
- 函数返回值相同，所以所有元素的 `enabled` 值都一致

##### 5.2.2 数组 A 的特定元素 → 数组 B 的所有元素

**业务场景**：当任务列表中存在优先级为"紧急"的任务时，提醒列表中的所有提醒都设置为"立即通知"

```typescript
{
  tasks: {
    type: 'array',
    title: '任务列表',
    items: {
      properties: {
        name: { type: 'string', title: '任务名称' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          title: '优先级'
        }
      }
    }
  },
  reminders: {
    type: 'array',
    title: '提醒列表',
    items: {
      properties: {
        message: { type: 'string', title: '提醒内容' },
        notifyImmediately: {
          type: 'boolean',
          title: '立即通知',
          ui: {
            linkages: [{
              type: 'value',
              dependencies: ['#/properties/tasks'],
              fulfill: {
                function: 'checkUrgentTasks'
              }
            }]
          }
        }
      }
    }
  }
}
```

**联动函数实现**：

```typescript
export const checkUrgentTasks: LinkageFunction = (
  formData: any,
  context?: LinkageFunctionContext
) => {
  const tasks = formData.tasks || [];

  // 检查是否存在紧急任务
  const hasUrgentTask = tasks.some(task => task.priority === 'urgent');

  return hasUrgentTask;
};
```

**关键点**：

- 数组 A（`tasks`）中特定条件的元素影响数组 B（`reminders`）的所有元素
- 使用 `some()` 检查是否存在满足条件的元素
- 这是一种**条件聚合**的跨数组联动

#### 5.3 场景 6：嵌套数组联动

##### 5.3.1 子数组元素依赖父数组元素字段

**业务场景**：部门列表中，员工的某些字段依赖部门类型

```typescript
{
  departments: {
    type: 'array',
    title: '部门列表',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', title: '部门名称' },
        type: {
          type: 'string',
          enum: ['tech', 'sales', 'hr'],
          title: '部门类型'
        },
        employees: {
          type: 'array',
          title: '员工列表',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', title: '姓名' },
              techStack: {
                type: 'string',
                title: '技术栈',
                ui: {
                  linkages: [{
                    type: 'visibility',
                    dependencies: ['#/properties/departments/items/properties/type'],  // JSON Pointer
                    when: {
                      field: '#/properties/departments/items/properties/type',
                      operator: '==',
                      value: 'tech'
                    }
                  }]
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

**依赖关系**：

- `departments.employees.techStack` → `departments.type`（子数组元素依赖父数组元素）
- 路径示例：
  - `departments.0.employees.0.techStack` → `departments.0.type`
  - `departments.0.employees.1.techStack` → `departments.0.type`
  - `departments.1.employees.0.techStack` → `departments.1.type`

**路径解析规则**：

当子数组元素字段依赖父数组元素字段时，系统会自动匹配正确的父数组索引：

```typescript
// 当前路径: departments.0.employees.1.techStack
// 依赖路径: #/properties/departments/items/properties/type
// 解析步骤：
// 1. 识别依赖路径是父数组字段（departments.type）
// 2. 从当前路径提取父数组索引（0）
// 3. 解析结果: departments.0.type
```

**依赖图构建**：

- 父数组元素字段 → 子数组所有元素的对应字段（一对多）
- `departments.0.type` → `departments.0.employees.*.techStack`

##### 5.3.2 子数组元素依赖外部字段 + 父数组元素字段（混合依赖）

**业务场景**：员工的某些字段同时依赖全局开关和部门类型

```typescript
{
  enableAdvanced: { type: 'boolean', title: '启用高级功能' },

  departments: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['tech', 'sales'], title: '部门类型' },
        employees: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', title: '姓名' },
              advancedTechTools: {
                type: 'string',
                title: '高级技术工具',
                ui: {
                  linkages: [{
                    type: 'visibility',
                    dependencies: [
                      '#/properties/enableAdvanced',  // 外部字段
                      '#/properties/departments/items/properties/type'  // 父数组字段
                    ],
                    when: {
                      and: [
                        { field: '#/properties/enableAdvanced', operator: '==', value: true },
                        { field: '#/properties/departments/items/properties/type', operator: '==', value: 'tech' }
                      ]
                    }
                  }]
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

**依赖关系**：

- `departments.employees.advancedTechTools` → `enableAdvanced`（外部字段）+ `departments.type`（父级字段）
- 这是**三层依赖**：外部 → 父数组 → 子数组

**运行时解析**：

```typescript
// departments.0.employees.1.advancedTechTools
//   → enableAdvanced (外部字段，直接使用)
//   → departments.0.type (父数组字段，自动匹配索引)
```

**处理方式**：

- 同时解析 JSON Pointer 绝对路径
- 外部字段直接使用，父数组字段自动匹配索引
- 构建混合依赖图
- 拓扑排序时考虑跨层级依赖

##### 5.3.3 父数组元素依赖子数组（聚合计算）

**业务场景**：部门的员工总数和总薪资依赖该部门下的所有员工

```typescript
{
  departments: {
    type: 'array',
    items: {
      properties: {
        name: { type: 'string', title: '部门名称' },
        employees: {
          type: 'array',
          items: {
            properties: {
              name: { type: 'string', title: '姓名' },
              salary: { type: 'number', title: '薪资' }
            }
          }
        },
        employeeCount: {
          type: 'number',
          title: '员工数量',
          ui: {
            readonly: true,
            linkages: [{
              type: 'value',
              dependencies: ['#/properties/departments/items/properties/employees'],
              fulfill: {
                function: 'countEmployees'
              }
            }]
          }
        },
        totalSalary: {
          type: 'number',
          title: '部门总薪资',
          ui: {
            readonly: true,
            linkages: [{
              type: 'value',
              dependencies: ['#/properties/departments/items/properties/employees'],
              fulfill: {
                function: 'sumSalaries'
              }
            }]
          }
        }
      }
    }
  }
}
```

**依赖关系**：

- `departments.employeeCount` → `departments.employees`（父数组元素依赖子数组）
- `departments.totalSalary` → `departments.employees`（父数组元素依赖子数组）

**运行时解析**：

```typescript
// departments.0.employeeCount → departments.0.employees (整个子数组)
// departments.0.totalSalary → departments.0.employees (整个子数组)
// departments.1.employeeCount → departments.1.employees (整个子数组)
```

**聚合函数实现**：

```typescript
// 统计员工数量
export const countEmployees: LinkageFunction = (
  formData: any,
  context?: LinkageFunctionContext
) => {
  // 使用 context 获取当前部门的索引
  if (!context?.arrayIndex || !context?.arrayPath) {
    return 0;
  }

  // 获取当前部门的员工列表
  const departments = formData[context.arrayPath] || [];
  const currentDepartment = departments[context.arrayIndex];

  if (!currentDepartment) return 0;

  const employees = currentDepartment.employees || [];
  return employees.length;
};

// 计算总薪资
export const sumSalaries: LinkageFunction = (formData: any, context?: LinkageFunctionContext) => {
  // 使用 context 获取当前部门的索引
  if (!context?.arrayIndex || !context?.arrayPath) {
    return 0;
  }

  // 获取当前部门的员工列表
  const departments = formData[context.arrayPath] || [];
  const currentDepartment = departments[context.arrayIndex];

  if (!currentDepartment) return 0;

  const employees = currentDepartment.employees || [];
  return employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);
};
```

**关键点**：

- 父数组元素字段依赖当前元素的子数组
- 子数组的任何变化（增删改）都会触发父字段重新计算
- 通过 `context.arrayIndex` 和 `context.arrayPath` 获取当前部门的索引和路径
- 使用上下文信息可以精确定位到当前部门的员工列表

#### 5.4 场景 8：数组聚合计算（外部字段）

##### 5.4.1 外部字段依赖整个数组（求和、计数等）

**业务场景**：总价依赖商品列表的所有价格

```typescript
{
  items: {
    type: 'array',
    title: '商品列表',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', title: '商品名称' },
        price: { type: 'number', title: '单价' },
        quantity: { type: 'number', title: '数量' }
      }
    }
  },
  totalPrice: {
    type: 'number',
    title: '总价',
    ui: {
      readonly: true,
      linkages: [{
        type: 'value',
        dependencies: ['#/properties/items'],  // JSON Pointer 依赖整个数组
        fulfill: {
          function: 'calculateTotal'
        }
      }]
    }
  }
}
```

**依赖关系**：

- `totalPrice` → `items`（整个数组）
- 具体依赖：`totalPrice` → `items.*.price`, `items.*.quantity`

**聚合函数实现**：

```typescript
// linkageFunctions.ts
export const calculateTotal: LinkageFunction = (formData: any) => {
  const items = formData.items || [];

  return items.reduce((sum, item) => {
    return sum + (item.price || 0) * (item.quantity || 0);
  }, 0);
};
```

**处理方式**：

1. **依赖监听**：监听整个数组的变化
2. **触发时机**：数组元素增删、修改都会触发重新计算
3. **性能优化**：使用 `useMemo` 缓存计算结果

##### 5.4.2 外部字段依赖数组的特定条件元素

**业务场景**：VIP 客户数量（只统计 type='vip' 的联系人）

```typescript
{
  contacts: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', title: '姓名' },
        type: {
          type: 'string',
          enum: ['normal', 'vip'],
          title: '客户类型'
        }
      }
    }
  },
  vipCount: {
    type: 'number',
    title: 'VIP 客户数量',
    ui: {
      readonly: true,
      linkages: [{
        type: 'value',
        dependencies: ['#/properties/contacts'],  // JSON Pointer
        fulfill: {
          function: 'countVip'
        }
      }]
    }
  }
}
```

**聚合函数实现**：

```typescript
export const countVip: LinkageFunction = (formData: any) => {
  const contacts = formData.contacts || [];

  return contacts.filter(contact => contact.type === 'vip').length;
};
```

##### 5.4.3 数组元素依赖数组聚合结果（双向依赖）

**业务场景**：每个商品显示占总价的百分比

```typescript
{
  items: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', title: '商品名称' },
        price: { type: 'number', title: '单价' },
        quantity: { type: 'number', title: '数量' },
        percentage: {
          type: 'number',
          title: '占比 (%)',
          ui: {
            readonly: true,
            linkages: [{
              type: 'value',
              dependencies: [
                './price',
                './quantity',
                '#/properties/items'  // JSON Pointer 依赖整个数组
              ],
              fulfill: {
                function: 'calculatePercentage'
              }
            }]
          }
        }
      }
    }
  }
}
```

**依赖关系**：

- `items.0.percentage` → `items.0.price`, `items.0.quantity`, `items`（整个数组）
- 这是**双向依赖**的特殊情况：数组元素依赖整个数组

**聚合函数实现**：

```typescript
export const calculatePercentage: LinkageFunction = (
  formData: any,
  context?: LinkageFunctionContext
) => {
  // 使用 context 获取当前元素的索引
  if (!context?.arrayIndex) {
    return 0;
  }

  const items = formData.items || [];
  const currentItem = items[context.arrayIndex];

  if (!currentItem) return 0;

  const currentTotal = (currentItem.price || 0) * (currentItem.quantity || 0);
  const grandTotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);

  return grandTotal > 0 ? ((currentTotal / grandTotal) * 100).toFixed(2) : 0;
};
```

**处理难点**：

1. **双向依赖识别**：需要识别数组元素依赖整个数组的情况
2. **执行顺序**：先计算总和，再计算百分比
3. **性能优化**：避免重复计算，使用缓存
4. **索引匹配**：通过 `context.arrayIndex` 获取当前元素的索引

**关键点**：

- 使用 `context` 参数获取当前字段的上下文信息
- `context.arrayIndex` 提供当前元素在数组中的索引
- `context.arrayPath` 提供当前字段所在的数组路径

#### 5.5 场景总结

| 场景类型        | 依赖方向                      | 路径语法                                     | 处理方式                            | 复杂度 |
| --------------- | ----------------------------- | -------------------------------------------- | ----------------------------------- | ------ |
| 相对路径依赖    | 元素内字段 → 元素内字段       | `./field`                                    | `useArrayLinkageManager`            | 中     |
| 绝对路径依赖    | 元素内字段 → 外部字段         | `#/properties/field`                         | `useArrayLinkageManager`            | 中     |
| 菱形依赖        | 元素内多层依赖                | `./field`                                    | `useArrayLinkageManager` + 拓扑排序 | 高     |
| 混合依赖        | 元素内字段 → 外部+内部        | `#/properties/field` + `./field`             | `useArrayLinkageManager`            | 高     |
| 跨数组元素联动  | 数组 A 聚合 → 数组 B 所有元素 | `#/properties/arrayA`                        | `useArrayLinkageManager` + 聚合函数 | 中     |
| 子数组 → 父数组 | 子数组元素 → 父数组元素字段   | `#/properties/parent/items/properties/field` | `useArrayLinkageManager` + 索引匹配 | 高     |
| 父数组 → 子数组 | 父数组元素 → 子数组           | `#/properties/parent/items/properties/child` | `useArrayLinkageManager` + 聚合函数 | 高     |
| 外部聚合计算    | 外部字段 → 整个数组           | `#/properties/array`                         | `useLinkageManager` + 聚合函数      | 中     |
| 双向依赖        | 元素内字段 → 整个数组         | `./field` + `#/properties/array`             | `useArrayLinkageManager` + context  | 极高   |

---

### 6. 实现方案

#### 6.0 类型定义

**文件位置**：`src/components/DynamicForm/types/linkage.ts`

```typescript
/**
 * 联动函数上下文信息
 */
export interface LinkageFunctionContext {
  /** 当前字段的完整路径（如 'contacts.0.companyName'） */
  fieldPath: string;
  /** 当前字段在数组中的索引（如果是数组元素字段） */
  arrayIndex?: number;
  /** 当前字段所在的数组路径（如果是数组元素字段，如 'contacts'） */
  arrayPath?: string;
}

/**
 * 联动函数签名（支持同步和异步函数）
 */
export type LinkageFunction = (
  formData: Record<string, any>,
  context?: LinkageFunctionContext
) => any | Promise<any>;
```

**说明**：

- `context` 参数是可选的，保持向后兼容
- 对于数组元素字段，`context` 会自动包含 `arrayIndex` 和 `arrayPath`
- 对于非数组字段，`context` 只包含 `fieldPath`

#### 6.1 核心工具函数

##### 6.1.1 路径判断和解析

**文件位置**：`src/components/DynamicForm/utils/arrayLinkageHelper.ts`

```typescript
/**
 * 检查路径是否是数组元素路径
 * @example
 * isArrayElementPath('contacts.0.name') // true
 * isArrayElementPath('contacts.name') // false
 */
export function isArrayElementPath(path: string): boolean {
  const parts = path.split('.');
  return parts.some(part => /^\d+$/.test(part));
}

/**
 * 从数组元素路径中提取数组路径和索引
 * @example
 * extractArrayInfo('contacts.0.name')
 * // { arrayPath: 'contacts', index: 0, fieldPath: 'name' }
 */
export function extractArrayInfo(path: string): {
  arrayPath: string;
  index: number;
  fieldPath: string;
} | null {
  const parts = path.split('.');
  const indexPos = parts.findIndex(part => /^\d+$/.test(part));

  if (indexPos === -1) {
    return null;
  }

  return {
    arrayPath: parts.slice(0, indexPos).join('.'),
    index: parseInt(parts[indexPos], 10),
    fieldPath: parts.slice(indexPos + 1).join('.'),
  };
}
```

##### 6.1.2 JSON Pointer 解析

**文件位置**：`src/components/DynamicForm/utils/arrayLinkageHelper.ts`

```typescript
/**
 * 解析 JSON Pointer 为逻辑路径
 * @param pointer - JSON Pointer（如 '#/properties/contacts/items/properties/type'）
 * @returns 逻辑路径（如 'contacts.type'）
 */
export function parseJsonPointer(pointer: string): string {
  if (!pointer.startsWith('#/')) {
    throw new Error(`无效的 JSON Pointer: ${pointer}`);
  }

  // 移除 '#/' 前缀
  const segments = pointer.slice(2).split('/');

  // 过滤掉 'properties' 和 'items' 标记
  const logicalSegments = segments.filter(s => s !== 'properties' && s !== 'items');

  return logicalSegments.join('.');
}

/**
 * 解析相对路径为绝对路径（仅支持同级字段）
 *
 * 注意：此函数实际位于 src/components/DynamicForm/utils/pathTransformer.ts
 * arrayLinkageHelper.ts 通过 import 引入使用
 *
 * @param relativePath - 相对路径（如 './type'）
 * @param currentPath - 当前字段的完整路径（如 'contacts.0.companyName'）
 * @returns 解析后的绝对路径（如 'contacts.0.type'）
 */
export function resolveRelativePath(relativePath: string, currentPath: string): string {
  if (!relativePath.startsWith('./')) {
    throw new Error(`不支持的相对路径格式: ${relativePath}。只允许使用 './fieldName' 引用同级字段`);
  }

  const fieldName = relativePath.slice(2);
  const parts = currentPath.split('.');
  const parentPath = parts.slice(0, -1).join('.');

  return parentPath ? `${parentPath}.${fieldName}` : fieldName;
}
```

**使用示例**：

```typescript
// JSON Pointer 解析
parseJsonPointer('#/properties/contacts/items/properties/type');
// → 'contacts.type'

parseJsonPointer('#/properties/enableVip');
// → 'enableVip'

// 相对路径解析（仅同级）
resolveRelativePath('./type', 'contacts.0.companyName');
// → 'contacts.0.type'

// ❌ 不支持的格式
resolveRelativePath('../type', 'departments.0.employees.1.techStack');
// → 抛出错误
```

##### 6.1.3 依赖路径解析（核心算法）

```typescript
/**
 * 解析依赖路径为运行时绝对路径
 * @param depPath - 依赖路径（相对路径、JSON Pointer 或运行时路径）
 * @param currentPath - 当前字段的完整路径（如 'contacts.0.companyName'）
 * @param schema - Schema 对象（用于识别数组字段）
 * @returns 解析后的绝对路径
 */
export function resolveDependencyPath({
  depPath,
  currentPath,
  schema,
}: {
  depPath: string;
  currentPath: string;
  schema: ExtendedJSONSchema;
}): string {
  // 1. 相对路径：同级字段
  if (depPath.startsWith('./')) {
    return resolveRelativePath(depPath, currentPath);
  }

  // 2. JSON Pointer：绝对路径
  if (depPath.startsWith('#/')) {
    return resolveJsonPointerDependency(depPath, currentPath, schema);
  }

  // 3. 已经是运行时的绝对路径（如 contacts.0.type），直接返回
  // 这种情况发生在联动配置已经被实例化后再次调用 resolveArrayElementLinkage 时
  console.log('[resolveDependencyPath] 路径已是运行时格式，直接返回:', depPath);
  return depPath;
}

/**
 * 解析 JSON Pointer 依赖路径
 */
function resolveJsonPointerDependency(
  pointer: string,
  currentPath: string,
  schema: ExtendedJSONSchema
): string {
  // 1. 解析 JSON Pointer 为逻辑路径
  const logicalPath = parseJsonPointer(pointer);

  // 2. 检查是否需要索引匹配
  const needsIndexMatching = pointer.includes('/items/');

  if (!needsIndexMatching) {
    // 顶层字段，直接返回
    return logicalPath;
  }

  // 3. 分析依赖路径和当前路径的关系
  const relationship = analyzePathRelationship(logicalPath, currentPath, schema);

  switch (relationship.type) {
    case 'child-to-parent':
      // 子数组元素依赖父数组元素字段
      return resolveChildToParent(logicalPath, currentPath, relationship);

    case 'parent-to-child':
      // 父数组元素依赖子数组
      return resolveParentToChild(logicalPath, currentPath, relationship);

    case 'same-level':
      // 同级数组元素（同一数组的不同元素）
      return logicalPath;

    default:
      return logicalPath;
  }
}

/**
 * 分析路径关系
 */
function analyzePathRelationship(
  depLogicalPath: string,
  currentPath: string,
  schema: ExtendedJSONSchema
): PathRelationship {
  const depSegments = depLogicalPath.split('.');
  const currentSegments = currentPath.split('.');

  // 找到共同前缀
  const commonPrefix = findCommonPrefix(depSegments, currentSegments);

  // 判断关系类型
  if (isChildToParentRelation(depSegments, currentSegments, commonPrefix)) {
    return { type: 'child-to-parent', commonPrefix };
  }

  if (isParentToChildRelation(depSegments, currentSegments, commonPrefix)) {
    return { type: 'parent-to-child', commonPrefix };
  }

  return { type: 'other', commonPrefix };
}

/**
 * 解析子数组到父数组的依赖
 * @example
 * depPath: 'departments.type'
 * currentPath: 'departments.0.employees.1.techStack'
 * 返回: 'departments.0.type'
 */
function resolveChildToParent(
  depLogicalPath: string,
  currentPath: string,
  relationship: PathRelationship
): string {
  const depSegments = depLogicalPath.split('.');
  const currentSegments = currentPath.split('.');

  // 找到父数组的索引位置
  const parentArrayIndex = findParentArrayIndex(currentSegments, depSegments);

  if (parentArrayIndex === -1) {
    return depLogicalPath;
  }

  // 插入索引
  const result = [
    ...depSegments.slice(0, parentArrayIndex),
    currentSegments[parentArrayIndex],
    ...depSegments.slice(parentArrayIndex),
  ].join('.');

  return result;
}

/**
 * 解析父数组到子数组的依赖
 * @example
 * depPath: 'departments.employees'
 * currentPath: 'departments.0.totalSalary'
 * 返回: 'departments.0.employees'
 */
function resolveParentToChild(
  depLogicalPath: string,
  currentPath: string,
  relationship: PathRelationship
): string {
  const depSegments = depLogicalPath.split('.');
  const currentSegments = currentPath.split('.');

  // 找到当前元素的索引
  const arrayIndex = findArrayIndexInPath(currentSegments);

  if (arrayIndex === null) {
    return depLogicalPath;
  }

  // 在依赖路径中插入索引
  const arrayFieldPos = depSegments.length - 1;
  const result = [
    ...depSegments.slice(0, arrayFieldPos),
    arrayIndex.toString(),
    depSegments[arrayFieldPos],
  ].join('.');

  return result;
}
```

##### 6.1.4 联动配置解析

```typescript
/**
 * 为数组元素的联动配置解析路径
 * @param linkage - 原始联动配置
 * @param currentPath - 当前字段的完整路径
 * @param schema - Schema 对象（可选，当 depPath 为绝对路径时必填）
 * @returns 解析后的联动配置
 */
export function resolveArrayElementLinkage(
  linkage: LinkageConfig,
  currentPath: string,
  schema?: ExtendedJSONSchema
): LinkageConfig {
  const resolved = { ...linkage };

  // 解析 dependencies 中的路径
  // 统一调用 resolveDependencyPath 处理所有路径类型
  if (resolved.dependencies) {
    resolved.dependencies = resolved.dependencies.map(depPath => {
      return resolveDependencyPath({
        depPath,
        currentPath,
        schema,
      });
    });
  }

  // 解析 when 条件中的路径
  if (resolved.when && typeof resolved.when === 'object') {
    resolved.when = resolveConditionPaths(resolved.when, currentPath, schema);
  }

  return resolved;
}

/**
 * 递归解析条件表达式中的路径
 */
function resolveConditionPaths(
  condition: any,
  currentPath: string,
  schema?: ExtendedJSONSchema
): any {
  const resolved = { ...condition };

  // 解析 field 字段
  if (resolved.field) {
    resolved.field = resolveDependencyPath({
      depPath: resolved.field,
      currentPath,
      schema,
    });
  }

  // 递归处理 and/or
  if (resolved.and) {
    resolved.and = resolved.and.map((c: any) => resolveConditionPaths(c, currentPath, schema));
  }
  if (resolved.or) {
    resolved.or = resolved.or.map((c: any) => resolveConditionPaths(c, currentPath, schema));
  }

  return resolved;
}
```

**关键改进**：

1. **简化逻辑**：移除了重复的路径判断，统一调用 `resolveDependencyPath` 处理所有路径类型
2. **schema 参数可选**：支持 `schema` 为 `undefined`，保持向后兼容
3. **统一路径解析**：所有路径（相对路径、JSON Pointer、运行时路径）都通过 `resolveDependencyPath` 处理

#### 6.2 Schema 解析

**文件位置**：`src/components/DynamicForm/utils/schemaLinkageParser.ts`

```typescript
/**
 * 解析 Schema 中的联动配置
 * 只支持 linkages 数组格式（ui.linkages），不再支持单个 ui.linkage 格式
 */
export function parseSchemaLinkages(schema: ExtendedJSONSchema): {
  linkages: Record<string, LinkageConfig[]>;
} {
  const linkages: Record<string, LinkageConfig[]> = {};

  // 递归解析 schema，收集所有联动配置
  parseSchemaRecursive(schema, '', linkages);

  return { linkages };
}

/**
 * 递归解析 schema，收集联动配置
 */
function parseSchemaRecursive(
  schema: ExtendedJSONSchema,
  parentPath: string,
  linkages: Record<string, LinkageConfig[]>
): void {
  if (!schema.properties) {
    return;
  }

  // 遍历所有字段
  Object.entries(schema.properties).forEach(([fieldName, fieldSchema]) => {
    if (typeof fieldSchema === 'boolean') return;

    const typedSchema = fieldSchema as ExtendedJSONSchema;
    const fullPath = parentPath ? `${parentPath}.${fieldName}` : fieldName;

    // 收集当前字段的联动配置（仅解析 linkages 数组格式）
    if (typedSchema.ui?.linkages && Array.isArray(typedSchema.ui.linkages) && typedSchema.ui.linkages.length > 0) {
      linkages[fullPath] = typedSchema.ui.linkages;
    }

    // 递归处理嵌套对象
    if (typedSchema.type === 'object' && typedSchema.properties) {
      parseSchemaRecursive(typedSchema, fullPath, linkages);
    }

    // 递归处理数组元素
    if (typedSchema.type === 'array' && typedSchema.items) {
      const itemsSchema = typedSchema.items as ExtendedJSONSchema;
      if (itemsSchema.type === 'object' && itemsSchema.properties) {
        // 注意：数组元素的路径不添加索引，在运行时动态处理
        parseSchemaRecursive(itemsSchema, fullPath, linkages);
      }
    }
  });
}
```

**关键点**：

- 递归解析所有嵌套对象和数组
- 数组元素的路径不包含索引（模板路径）
- 在运行时为每个数组元素实例化联动配置

##### 6.2.1 路径转换辅助函数（支持嵌套表单）

除了基本的 Schema 解析功能，`schemaLinkageParser.ts` 还提供了一组辅助函数，用于支持**嵌套表单联动状态传递方案**（第 3.1 节）。这些函数在 NestedFormWidget 创建子 DynamicForm 时使用，将相对路径转换为绝对路径。

```typescript
/**
 * 将联动配置的字段路径转换为绝对路径
 * @param linkages - 原始联动配置（相对路径，数组格式）
 * @param pathPrefix - 路径前缀（如 'contacts.0'）
 * @returns 转换后的联动配置（绝对路径，数组格式）
 */
export function transformToAbsolutePaths(
  linkages: Record<string, LinkageConfig[]>,
  pathPrefix: string
): Record<string, LinkageConfig[]>;

/**
 * 转换联动配置内部的路径引用
 * @param linkage - 原始联动配置
 * @param pathPrefix - 路径前缀
 * @param fieldPath - 当前字段的完整路径（用于相对路径解析）
 * @returns 转换后的联动配置
 */
function transformLinkageConfigPaths(
  linkage: LinkageConfig,
  pathPrefix: string,
  fieldPath: string
): LinkageConfig;

/**
 * 递归转换条件表达式中的路径
 */
function transformConditionPaths(
  condition: any,
  pathPrefix: string,
  fieldPath: string
): any;
```

**使用场景**：当 ArrayFieldWidget 渲染对象类型数组元素时，通过 NestedFormWidget 创建新的 DynamicForm 实例。这些辅助函数将内层 DynamicForm 的相对路径联动配置转换为外层表单可识别的绝对路径。

**示例**：
```typescript
// 原始联动配置（相对路径）
const linkages = {
  'companyName': [{
    type: 'visibility',
    dependencies: ['./type'],
    when: { field: './type', operator: '==', value: 'work' }
  }]
};

// 转换为绝对路径
const absoluteLinkages = transformToAbsolutePaths(linkages, 'contacts.0');
// 结果：
// {
//   'contacts.0.companyName': [{
//     type: 'visibility',
//     dependencies: ['contacts.0.type'],
//     when: { field: 'contacts.0.type', operator: '==', value: 'work' }
//   }]
// }
```

#### 6.3 运行时联动管理

**文件位置**：`src/components/DynamicForm/hooks/useArrayLinkageManager.ts`

```typescript
interface ArrayLinkageManagerOptions {
  form: UseFormReturn<any>;
  baseLinkages: Record<string, LinkageConfig[]>; // 支持多联动类型，值为数组格式
  linkageFunctions?: Record<string, LinkageFunction>;
  schema?: ExtendedJSONSchema;
  /** 检测到循环依赖时的回调 */
  onCycleDetected?: (cycle: string[]) => void;
  /** 是否在检测到循环依赖时抛出错误（默认 false） */
  throwOnCycle?: boolean;
}

/**
 * 数组联动管理器 Hook
 * 扩展基础联动管理器，支持数组元素内部的相对路径联动和 JSON Pointer 路径解析
 */
export function useArrayLinkageManager({
  form,
  baseLinkages,
  linkageFunctions = {},
  schema,
  onCycleDetected,
  throwOnCycle = false,
}: ArrayLinkageManagerOptions) {
  const { watch, getValues } = form;

  // 动态联动配置（包含运行时生成的数组元素联动），值为数组格式
  const [dynamicLinkages, setDynamicLinkages] = useState<Record<string, LinkageConfig[]>>({});

  // 强制刷新计数器，用于触发联动重新初始化
  const [refreshCounter, setRefreshCounter] = useState(0);

  /**
   * 根据当前表单数据生成动态联动配置
   * 此函数被 watch 回调和 refresh 函数调用
   */
  const generateDynamicLinkages = useCallback((): Record<string, LinkageConfig[]> => {
    if (!schema || Object.keys(baseLinkages).length === 0) {
      return {};
    }

    const formData = getValues();
    const newDynamicLinkages: Record<string, LinkageConfig[]> = {};

    Object.entries(baseLinkages).forEach(([fieldPath, linkageArray]) => {
      if (isArrayElementPath(fieldPath)) {
        const resolvedLinkages = linkageArray.map(linkage =>
          resolveArrayElementLinkage(linkage, fieldPath, schema)
        );
        newDynamicLinkages[fieldPath] = resolvedLinkages;
        return;
      }

      const arrayInfo = findArrayInPath(fieldPath, schema);

      if (!arrayInfo) {
        newDynamicLinkages[fieldPath] = linkageArray;
        return;
      }

      const { arrayPath, fieldPathInArray } = arrayInfo;
      const arrayValue = formData[arrayPath];

      if (!Array.isArray(arrayValue)) return;

      arrayValue.forEach((_, index) => {
        const elementFieldPath = `${arrayPath}.${index}.${fieldPathInArray}`;
        const resolvedLinkages = linkageArray.map(linkage =>
          resolveArrayElementLinkage(linkage, elementFieldPath, schema)
        );
        newDynamicLinkages[elementFieldPath] = resolvedLinkages;
      });
    });

    return newDynamicLinkages;
  }, [baseLinkages, schema, getValues]);

  // 合并基础联动和动态联动，并进行循环依赖检测
  const allLinkages = useMemo(() => {
    const merged = { ...baseLinkages, ...dynamicLinkages };

    // 构建临时依赖图进行循环依赖检测
    const tempGraph = new DependencyGraph();
    Object.entries(merged).forEach(([fieldName, linkageArray]) => {
      // 遍历数组中的每个联动配置
      linkageArray.forEach(linkage => {
        linkage.dependencies.forEach(dep => {
          const normalizedDep = PathResolver.toFieldPath(dep);
          tempGraph.addDependency(fieldName, normalizedDep);
        });
      });
    });

    // 检测循环依赖
    const validation = tempGraph.validate();
    if (!validation.isValid && validation.cycle) {
      console.error('[useArrayLinkageManager] 检测到循环依赖:', validation.cycle.join(' -> '));
      if (onCycleDetected) onCycleDetected(validation.cycle);
      if (throwOnCycle) throw new Error(`循环依赖: ${validation.cycle.join(' -> ')}`);
    }

    return merged;
  }, [baseLinkages, dynamicLinkages, onCycleDetected, throwOnCycle, refreshCounter]);

  // 使用基础联动管理器
  const { linkageStates, refresh: baseLinkageRefresh } = useBaseLinkageManager({
    form,
    linkages: allLinkages,
    linkageFunctions,
  });

  // 监听表单数据变化，动态注册数组元素的联动
  // 关键优化：使用 key 集合比对，仅当数组增减元素（keys 集合变化）时才更新 dynamicLinkages，
  // 避免每次 watch 触发都产生新对象引用 → 导致 allLinkages/dependencyGraph 重新计算
  // → 触发 useLinkageManager 初始化 useEffect → value 联动将字段重置为默认值。
  useEffect(() => {
    if (Object.keys(baseLinkages).length === 0) return;

    const subscription = watch(() => {
      setDynamicLinkages(prev => {
        const next = generateDynamicLinkages();
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length === nextKeys.length && nextKeys.every(k => k in prev)) {
          return prev; // key 集合未变化，返回旧引用，避免触发重新初始化
        }
        return next;
      });
    });

    return () => subscription.unsubscribe();
  }, [watch, baseLinkages, generateDynamicLinkages]);

  /**
   * 刷新联动状态：重新生成动态联动配置，并触发联动重新初始化
   * 用于异步数据加载完成后手动触发联动计算
   */
  const refresh = useCallback(() => {
    const newDynamicLinkages = generateDynamicLinkages();
    setDynamicLinkages(newDynamicLinkages);
    setRefreshCounter(prev => prev + 1);
    setTimeout(() => {
      baseLinkageRefresh();
    }, 0);
  }, [generateDynamicLinkages, baseLinkageRefresh]);

  return { linkageStates, refresh };
}
```

**工作流程**：

1. **监听表单数据**：使用 `watch()` 监听所有字段变化
2. **key 集合比对**：比较前后 `dynamicLinkages` 的 key 集合：
   - 若 keys 未变（只有值变化），返回旧引用，避免 `allLinkages` 产生新对象 → 防止初始化 useEffect 重复执行
   - 若 keys 变化（数组增减元素），使用新生成的联动配置
3. **处理已实例化路径**：路径含数字索引时（如 `departments.0.employees.0.techStack`），调用 `resolveArrayElementLinkage` 解析内部 JSON Pointer
4. **识别数组字段**：使用 `findArrayInPath` 查找路径中的数组字段
5. **处理非数组字段**：路径中无数组，直接添加到动态联动配置
6. **实例化数组联动**：为每个数组元素生成具体的联动配置（含多联动类型数组）
7. **循环依赖检测**：在合并联动配置时检测循环依赖
8. **合并联动配置**：动态生成的联动配置与基础联动配置合并
9. **执行联动逻辑**：使用基础联动管理器按拓扑层级并行执行联动

##### 6.3.1 性能优化措施

代码实现中包含了多项性能优化措施，确保大数组场景下的稳定性和性能：

**1. 引用稳定化（Reference Stabilization）**

使用 `useRef` 和深度比对避免不必要的重新计算：

```typescript
const allLinkagesRef = useRef<Record<string, LinkageConfig[]>>({});

const allLinkages = useMemo(() => {
  const candidate = Object.keys(dynamicLinkages).length === 0
    ? baseLinkages
    : { ...baseLinkages, ...dynamicLinkages };

  // 引用稳定化：key 集合和 value 引用双重比对
  const prev = allLinkagesRef.current;
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(candidate);
  const isSame = prevKeys.length === nextKeys.length &&
    nextKeys.every(k => k in prev && prev[k] === candidate[k]);

  if (isSame) {
    return prev; // 返回旧引用，避免触发下游重新计算
  }

  allLinkagesRef.current = candidate;
  return candidate;
}, [baseLinkages, dynamicLinkages, ...]);
```

**2. 避免死循环**

当 `dynamicLinkages` 为空时直接返回 `baseLinkages` 引用，防止 React 18 Strict Mode 重挂载导致的问题：

```typescript
const candidate = Object.keys(dynamicLinkages).length === 0
  ? baseLinkages  // 直接返回引用，避免产生新对象
  : { ...baseLinkages, ...dynamicLinkages };
```

**3. 智能刷新机制**

监听 `allLinkages` keys 变化，自动触发联动刷新，避免重复刷新：

```typescript
useEffect(() => {
  const currentKeys = Object.keys(allLinkages).sort().join(',');
  const prevKeys = allLinkagesKeysRef.current;
  const isKeysChanged = currentKeys !== prevKeys && currentKeys !== '';

  if (isKeysChanged) {
    allLinkagesKeysRef.current = currentKeys;
    baseLinkageRefresh();
  }
}, [allLinkages, baseLinkageRefresh]);
```

**4. Key 集合比对**

在 `watch` 回调中使用函数式更新 + key 集合比对，保持引用稳定：

```typescript
const subscription = watch(() => {
  setDynamicLinkages(prev => {
    const next = generateDynamicLinkages();
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);

    // 只有 keys 集合变化（数组增减元素）时才更新
    if (prevKeys.length === nextKeys.length && nextKeys.every(k => k in prev)) {
      return prev;
    }
    return next;
  });
});
```

**优化效果**：
- 避免不必要的联动初始化 useEffect 重复执行
- 防止 value 联动意外重置字段值
- 提升大数组场景（100+ 元素）的性能和稳定性
- 解决 React 18 Strict Mode 下的死循环问题

#### 6.4 集成到 DynamicForm

**文件位置**：`src/components/DynamicForm/DynamicForm.tsx`

```typescript
// 解析 schema 中的联动配置（仅支持 linkages 数组格式）
const { linkages } = useMemo(() => parseSchemaLinkages(schema), [schema]);

// 使用数组联动管理器（支持数组字段内部的相对路径联动）
const { linkageStates, refresh } = useArrayLinkageManager({
  form: methods,
  baseLinkages: linkages,
  linkageFunctions,
  schema, // 传递 schema 用于 JSON Pointer 路径解析
});
```

---

### 7. 最佳实践

#### 7.1 路径引用规范（重要）

**核心原则**：

- 同级字段使用相对路径 `./fieldName`
- 跨层级字段使用 JSON Pointer `#/properties/path/to/field`
- 禁止使用 `../`、`../../` 等父级相对路径
- 禁止使用简单字段名（歧义）

**推荐做法**：

```typescript
// ✅ 好的做法：使用相对路径引用同级字段
{
  dependencies: ['./type'];
}

// ✅ 好的做法：使用 JSON Pointer 引用外部字段
{
  dependencies: ['#/properties/enableAdvanced'];
}

// ✅ 好的做法：使用 JSON Pointer 引用父数组字段
{
  dependencies: ['#/properties/departments/items/properties/type'];
}

// ✅ 好的做法：混合使用
{
  dependencies: [
    '#/properties/enableAdvanced', // 外部字段
    './type', // 同级字段
  ];
}

// ❌ 不好的做法：使用父级相对路径
{
  dependencies: ['../type']; // 禁止使用
}

// ❌ 不好的做法：使用简单字段名
{
  dependencies: ['type']; // 不明确是同级字段还是外部字段
}
```

#### 7.2 路径类型对照表

| 场景       | 旧语法（已废弃） | 新语法（推荐）                                      |
| ---------- | ---------------- | --------------------------------------------------- |
| 同级字段   | `./type`         | `./type` ✅                                         |
| 外部字段   | `enableVip`      | `#/properties/enableVip` ✅                         |
| 父数组字段 | `../type`        | `#/properties/departments/items/properties/type` ✅ |
| 祖父级字段 | `../../items`    | `#/properties/items` ✅                             |
| 整个数组   | `items`          | `#/properties/items` ✅                             |

#### 7.3 性能优化建议

1. **避免过深的嵌套**：最多 2-3 层嵌套数组
2. **使用 useMemo 缓存计算结果**：特别是聚合计算
3. **避免循环依赖**：使用依赖图检测工具
4. **批量更新**：使用 `setValue` 的批量模式

#### 7.3.1 联动结果缓存策略

**核心思想**：通过缓存联动计算结果，避免重复计算，提升性能。

##### 缓存复用场景分析

数组字段的联动依赖可以分为以下几类，每类的缓存复用策略不同：

**场景 1：同级字段依赖（相对路径）**

```typescript
// Schema 定义
{
  companyName: {
    ui: {
      linkages: [{
        dependencies: ['./type'],  // 相对路径
        // ...
      }]
    }
  }
}

// 运行时实例化
// contacts.0.companyName 依赖 contacts.0.type="work"
// contacts.1.companyName 依赖 contacts.1.type="work"
```

**缓存策略**：✅ **可跨元素复用**

- 移除路径中的数组索引，使用模板字段名
- 缓存键：`companyName:type="work"`
- 所有 type="work" 的元素共享同一个缓存结果

**场景 2：外部字段依赖（绝对路径）**

```typescript
// Schema 定义
{
  vipLevel: {
    ui: {
      linkages: [{
        dependencies: ['#/properties/enableVip'],  // 外部字段
        // ...
      }]
    }
  }
}

// 运行时实例化
// contacts.0.vipLevel 依赖 enableVip=true
// contacts.1.vipLevel 依赖 enableVip=true
```

**缓存策略**：✅ **可跨元素复用**

- 外部字段对所有数组元素都相同
- 缓存键：`vipLevel:enableVip=true`
- 所有元素共享同一个缓存结果

**场景 3：混合依赖（外部 + 同级）**

```typescript
// Schema 定义
{
  advancedWorkInfo: {
    ui: {
      linkages: [{
        dependencies: [
          '#/properties/enableAdvanced',  // 外部字段
          './type'                        // 同级字段
        ],
        // ...
      }]
    }
  }
}

// 运行时实例化
// contacts.0.advancedWorkInfo 依赖 enableAdvanced=true, contacts.0.type="work"
// contacts.1.advancedWorkInfo 依赖 enableAdvanced=true, contacts.1.type="work"
```

**缓存策略**：✅ **可跨元素复用**

- 移除路径中的数组索引
- 缓存键：`advancedWorkInfo:enableAdvanced=true|type="work"`
- 当外部字段和同级字段值都相同时，可以共享缓存

**场景 4：父数组字段依赖（嵌套数组）**

```typescript
// Schema 定义
{
  techStack: {
    ui: {
      linkages: [{
        dependencies: ['#/properties/departments/items/properties/type'],  // 父数组字段
        // ...
      }]
    }
  }
}

// 运行时实例化
// departments.0.employees.0.techStack 依赖 departments.0.type="tech"
// departments.0.employees.1.techStack 依赖 departments.0.type="tech"
// departments.1.employees.0.techStack 依赖 departments.1.type="sales"
```

**缓存策略**：❌ **不可跨父元素复用，但可在同一父元素内复用**

- 需要保留父数组的索引，移除子数组的索引
- 缓存键需要包含父元素标识：`techStack:departments.0.type="tech"`
- `departments.0.employees.0` 和 `departments.0.employees.1` 可以共享缓存
- `departments.0.employees.*` 和 `departments.1.employees.*` 不能共享缓存（依赖不同的父元素）

**场景 5：跨数组依赖（数组聚合）**

```typescript
// Schema 定义
{
  enabled: {
    ui: {
      linkages: [{
        dependencies: ['#/properties/permissions'],  // 整个数组
        // ...
      }]
    }
  }
}

// 运行时实例化
// features.0.enabled 依赖 permissions 数组
// features.1.enabled 依赖 permissions 数组
```

**缓存策略**：✅ **可跨元素复用**

- 依赖整个数组，对所有元素都相同
- 缓存键：`enabled:permissions=[...]`（数组序列化后的值）
- 所有 features 元素共享同一个缓存结果

##### 缓存键生成算法

**核心原则**：

1. **识别依赖类型**：判断依赖字段是同级、外部、父数组还是其他数组
2. **选择性移除索引**：
   - 同级字段：移除所有数组索引
   - 外部字段：移除所有数组索引
   - 父数组字段：保留父数组索引，移除子数组索引
   - 跨数组字段：移除所有数组索引
3. **生成缓存键**：`模板字段名:依赖1=值1|依赖2=值2|...`

**算法伪代码**：

```typescript
/**
 * 生成联动缓存键
 *
 * 实际实现：src/components/DynamicForm/utils/generateCacheKey.ts
 * 路径转换工具：src/components/DynamicForm/utils/pathTransformer.ts
 */
function generateCacheKey(
  fieldName: string,           // 如：departments.0.employees.1.techStack
  dependencies: string[],      // 如：['departments.0.type', 'enableAdvanced']
  formData: Record<string, any>
): string {
  // 1. 将字段名转换为模板路径（移除数组索引）
  const templateFieldName = toTemplatePath(fieldName);
  // 结果：departments.employees.techStack

  // 2. 对依赖字段排序，确保顺序一致
  const sortedDeps = [...dependencies].sort();

  // 3. 构建依赖字段的名称-值映射
  const depPairs = sortedDeps.map(dep => {
    const value = formData[dep];
    const serializedValue = JSON.stringify(value);

    // 智能移除依赖字段名中的数组索引
    // - 场景1-3、5：移除所有索引
    // - 场景4（父数组字段）：保留父数组索引
    const templateDepName = toTemplatePathForCache(dep, fieldName);
    // 例如：
    //   departments.0.type (父数组) -> departments.0.type (保留索引)
    //   enableAdvanced (外部字段) -> enableAdvanced (无索引)

    return `${templateDepName}=${serializedValue}`;
  });

  // 4. 组合成缓存键
  return `${templateFieldName}:${depPairs.join('|')}`;
}

/**
 * 将运行时路径转换为模板路径（移除所有数组索引）
 */
function toTemplatePath(runtimePath: string): string {
  const parts = runtimePath.split('.');
  const templateParts = parts.filter(part => !/^\d+$/.test(part));
  return templateParts.join('.');
}

/**
 * 智能移除数组索引（用于依赖字段）
 *
 * 根据当前字段和依赖字段的数组层级关系，决定保留哪些索引：
 * - 同级字段：移除所有索引
 * - 外部字段：移除所有索引
 * - 父数组字段：保留父数组索引，确保不同父元素的缓存独立
 */
function toTemplatePathForCache(depPath: string, currentFieldPath: string): string {
  const depLevels = extractArrayLevels(depPath);
  const currentLevels = extractArrayLevels(currentFieldPath);

  // 如果依赖字段没有数组索引，直接返回
  if (depLevels.length === 0) return depPath;

  // 如果当前字段没有数组索引，移除依赖字段的所有索引
  if (currentLevels.length === 0) return toTemplatePath(depPath);

  // 判断是否是父数组字段依赖
  const isParentArrayDep =
    depLevels.length < currentLevels.length &&
    currentFieldPath.startsWith(depPath.substring(0, depPath.lastIndexOf('.')));

  if (isParentArrayDep) {
    // 场景4：父数组字段依赖 - 保留所有索引
    return depPath;
  } else {
    // 场景1、2、3、5：移除所有索引
    return toTemplatePath(depPath);
  }
}
```

**实现说明**：

当前实现采用**智能索引移除策略**，根据依赖类型自动处理：

- ✅ **场景1（同级字段）**：移除所有索引
  - `contacts.0.type` → `contacts.type`
- ✅ **场景2（外部字段）**：移除所有索引
  - `enableVip` → `enableVip`
- ✅ **场景3（混合依赖）**：移除所有索引
  - `contacts.0.type` + `enableAdvanced` → `contacts.type` + `enableAdvanced`
- ✅ **场景4（父数组字段）**：保留父数组索引
  - `departments.0.type` → `departments.0.type` （保留索引）
  - `departments.1.type` → `departments.1.type` （保留索引）
  - 确保不同父元素的缓存独立
- ✅ **场景5（跨数组依赖）**：移除所有索引
  - `permissions` → `permissions`

**场景4示例**：

```typescript
// departments.0.employees.1.techStack 依赖 departments.0.type="tech"
// 生成缓存键：departments.employees.techStack:departments.0.type="tech"

// departments.1.employees.0.techStack 依赖 departments.1.type="sales"
// 生成缓存键：departments.employees.techStack:departments.1.type="sales"

// ✅ 两个缓存键不同，不同父元素的缓存独立
```

##### 缓存策略总结表

| 场景 | 依赖类型 | 缓存复用范围 | 缓存键示例 | 当前实现 |
|------|---------|------------|-----------|---------|
| 场景1 | 同级字段 | ✅ 跨所有元素 | `contacts.companyName:contacts.type="work"` | ✅ 支持 |
| 场景2 | 外部字段 | ✅ 跨所有元素 | `contacts.vipLevel:enableVip=true` | ✅ 支持 |
| 场景3 | 混合依赖 | ✅ 跨所有元素 | `contacts.advancedWorkInfo:contacts.type="work"\|enableAdvanced=true` | ✅ 支持 |
| 场景4 | 父数组字段 | ✅ 同一父元素内 | `departments.employees.techStack:departments.0.type="tech"` | ✅ 支持 |
| 场景5 | 跨数组依赖 | ✅ 跨所有元素 | `roles.enabled:permissions=[...]` | ✅ 支持 |

**关键要点**：

1. **所有场景已完整支持**：场景1-5都已正确实现
2. **场景4智能处理**：自动识别父数组依赖，保留父数组索引，确保不同父元素的缓存独立
3. **性能提升显著**：对于100个数组元素，缓存命中率可达99%（场景1-3、5）
4. **场景4缓存独立**：不同父元素的子元素有独立的缓存，避免数据错误

**实施建议**：

- ✅ **已实现并推荐**：所有场景（1-5）都已正确实现
- ✅ **场景4已支持**：智能识别父数组依赖，自动保留父数组索引
- 📊 **监控效果**：通过缓存统计（命中率、命中次数）评估实际效果

##### 性能权衡分析

**关键问题**：数组场景下，缓存键生成的成本可能超过联动计算本身的成本。

**成本对比**：

| 操作 | 成本 | 说明 |
|------|------|------|
| 简单联动计算 | O(1) | 条件判断、简单赋值 |
| 缓存键生成（简单） | O(n) | 字符串分割、正则匹配 |
| 缓存键生成（复杂） | O(n×m) | 路径分析、层级比较、类型判断 |
| 复杂联动计算 | O(k) | 数组聚合、复杂计算 |
| 异步API调用 | O(网络) | 远程请求 |

**结论**：

1. **简单联动不值得缓存**：
   - 条件判断（`type === 'work'`）成本极低
   - 缓存键生成反而更慢
   - ❌ 不建议为简单联动启用缓存

2. **复杂联动可能值得缓存**：
   - 数组聚合、复杂计算成本较高
   - 需要权衡：缓存键生成成本 vs 计算成本
   - ⚠️ 建议通过性能测试决定

3. **异步联动强烈建议缓存**：
   - API调用成本远高于缓存键生成
   - 避免重复的网络请求
   - ✅ 强烈建议启用缓存

**推荐策略**：

```typescript
// ✅ 推荐：为异步联动启用缓存
{
  linkages: [{
    type: 'options',
    dependencies: ['./country'],
    fulfill: { function: 'loadProvinceOptions' }, // 异步API调用
    enableCache: true, // ✅ 异步联动建议启用缓存
  }]
}

// ❌ 不推荐：为简单联动启用缓存
{
  linkages: [{
    type: 'visibility',
    dependencies: ['./type'],
    when: { field: './type', operator: '==', value: 'work' },
    // enableCache: false (默认禁用，简单联动不需要缓存)
  }]
}
```

#### 7.4 调试技巧

```typescript
// 1. 打印依赖图
console.log('依赖图:', dependencyGraph.getSources());

// 2. 打印受影响的字段
const affected = dependencyGraph.getAffectedFields('contacts.0.type');
console.log('受影响的字段:', affected);

// 3. 打印联动状态
console.log('联动状态:', linkageStates);

// 4. 打印路径解析结果
console.log('JSON Pointer 解析:', parseJsonPointer('#/properties/contacts/items/properties/type'));
console.log('依赖路径解析:', resolveDependencyPath(depPath, currentPath, schema));
```

#### 7.5 常见问题

##### 问题 1：路径格式错误

**症状**：联动不生效，控制台报错 "不支持的路径格式"

**原因**：使用了已废弃的路径语法（如 `../type` 或简单字段名）

**解决方案**：

```typescript
// ❌ 错误的写法
dependencies: ['../type'];
dependencies: ['enableVip'];

// ✅ 正确的写法
dependencies: ['#/properties/departments/items/properties/type'];
dependencies: ['#/properties/enableVip'];
```

##### 问题 2：JSON Pointer 路径错误

**症状**：联动不生效，路径解析失败

**原因**：JSON Pointer 格式不正确

**解决方案**：

```typescript
// 检查 JSON Pointer 格式
console.log('当前路径:', currentPath);
console.log('依赖路径:', depPath);
console.log('解析结果:', resolveDependencyPath({ depPath, currentPath, schema }));

// 确保 JSON Pointer 格式正确
// ✅ 正确：#/properties/fieldName
// ✅ 正确：#/properties/array/items/properties/field
// ❌ 错误：#/fieldName (缺少 properties)
// ❌ 错误：properties/fieldName (缺少 #/)
```

##### 问题 3：数组元素联动未触发

**症状**：数组元素变化时联动不生效

**原因**：动态联动配置未正确生成

**解决方案**：

```typescript
// 检查动态联动配置
console.log('动态联动配置:', dynamicLinkages);
```

##### 问题 5：跨数组依赖或外部字段依赖数组内部字段时联动不触发

**症状**：依赖路径写到了数组 items 内部字段（如 `#/properties/permissions/items/properties/isAdmin`），但修改数组内容时联动不生效

**原因**：依赖路径只能写到**数组字段本身**，不能引用 items 内部的具体字段。系统通过前缀匹配机制，当 `permissions.0.isAdmin` 变化时，会触发依赖 `permissions` 的所有联动。但如果路径写到 `permissions.isAdmin`（items 内部），前缀匹配无法命中 `permissions.0.isAdmin`，导致联动失效。

**解决方案**：

```typescript
// ❌ 错误：引用到 items 内部字段
{
  dependencies: ['#/properties/permissions/items/properties/isAdmin'],
  when: { field: '#/properties/permissions/items/properties/isAdmin', operator: '==', value: true }
}

// ✅ 正确：依赖整个数组，通过联动函数访问内部数据
{
  dependencies: ['#/properties/permissions'],
  fulfill: { function: 'checkAdminPermission' }
}

// 联动函数内部访问具体字段
checkAdminPermission: (formData) => {
  return formData.permissions?.some(p => p.isAdmin === true) ?? false
}
```

**规律**：当依赖的是"数组中某些元素的某个字段的聚合结果"时，必须依赖数组本身，并使用联动函数处理逻辑。简单的 `when` 条件只适合依赖单个具体字段。

##### 问题 4：性能问题

**症状**：数组元素较多时表单卡顿

**解决方案**：

- 使用虚拟滚动（react-window）
- 减少联动计算频率（防抖）
- 优化聚合函数性能

---

### 8. 总结

#### 8.1 关键技术点

1. **嵌套表单联动状态传递**：采用分层计算方案，每层 DynamicForm 只计算自己范围内的联动，通过 Context 共享表单实例
2. **路径规范**：统一使用 JSON Pointer 处理跨层级依赖，相对路径仅用于同级字段
3. **模板依赖图**：Schema 解析时构建，运行时实例化
4. **动态索引匹配**：自动匹配父子数组的索引关系
5. **双向依赖支持**：支持父数组→子数组和子数组→父数组的双向依赖
6. **真正的拓扑排序**：使用 Kahn 算法确保字段按依赖顺序计算，解决菱形依赖问题
7. **循环依赖检测与处理**：
   - 静态检测：构建依赖图时使用 DFS 检测循环
   - 动态检测：合并联动配置时再次检测
   - 可配置行为：支持警告、回调或抛出错误
8. **串行执行联动**：按拓扑顺序串行执行，确保依赖字段先计算完成
9. **按需计算**：只在组件渲染时才计算该层的联动，支持虚拟滚动和懒加载

#### 8.2 适用场景

| 场景                 | 是否支持 | 复杂度 |
| -------------------- | -------- | ------ |
| 数组元素内部联动     | ✅       | 中     |
| 数组元素依赖外部字段 | ✅       | 中     |
| 混合依赖             | ✅       | 高     |
| 跨数组依赖           | ✅       | 低-中  |
| 子数组→父数组联动    | ✅       | 高     |
| 父数组→子数组联动    | ✅       | 高     |
| 外部字段聚合计算     | ✅       | 中     |
| 双向依赖             | ✅       | 极高   |

#### 8.3 相关文档

- [ArrayFieldWidget 设计方案](./widgets/array-field.md)
- [UI 联动设计方案](./linkage.md)
- [嵌套表单设计](./nested-form.md)
- [字段路径透明化](./field-path.md)

---

### 9. 变更历史

#### v3.0 (2026-01-10)

**重大变更**：路径透明化方案升级（v3.0）

1. **路径格式统一**
   - ✅ 移除：`~~` 分隔符和路径映射机制
   - ✅ 统一：所有路径使用标准 `.` 分隔符
   - ✅ 简化：flattenPath 字段路径与普通嵌套字段完全相同
   - ✅ 影响：路径解析逻辑大幅简化，无需区分"逻辑路径"和"物理路径"

2. **相对路径解析简化**
   - ✅ 移除：`isLastSeparatorFlatten` 等路径分隔符判断逻辑
   - ✅ 简化：相对路径解析统一使用标准 `.` 分隔符
   - ✅ 优势：代码更简洁，维护成本更低

3. **示例更新**
   - 旧方案路径：`region~~market~~contacts.0.auth.apiKey`
   - v3.0 路径：`region.market.contacts.0.auth.apiKey`
   - 相对依赖：`./enableAuth`
   - 解析结果：`region.market.contacts.0.auth.enableAuth`
   - 说明：所有路径统一使用 `.` 分隔符，无需特殊处理

4. **文档更新**
   - 更新所有路径示例以使用标准 `.` 分隔符
   - 移除路径映射相关说明
   - 简化路径解析逻辑说明

#### v2.4 (2025-12-30) - 已废弃

**注意**：此版本的路径解析逻辑已在 v3.0 中被完全重构，不再使用 `~~` 分隔符

#### v2.3 (2025-12-29)

**重大变更**：嵌套数组联动路径解析优化

1. **`resolveDependencyPath` 函数增强**
   - ✅ 新增：支持运行时绝对路径（如 `contacts.0.type`）
   - ✅ 修复：已实例化的联动配置再次解析时不会报错
   - ✅ 优化：三种路径格式统一处理（相对路径、JSON Pointer、运行时路径）

2. **`useArrayLinkageManager` 优化**
   - ✅ 新增：处理已实例化的联动配置（路径包含数字索引）
   - ✅ 修复：嵌套数组联动中 `when.field` 的 JSON Pointer 路径正确解析
   - ✅ 优化：统一处理数组和非数组字段的联动配置

3. **嵌套数组联动修复**
   - ✅ 修复：子数组元素依赖父数组元素字段时，路径解析错误的问题
   - ✅ 修复：`departments.0.employees.0.techStack` 依赖 `departments.0.type` 现在正常工作
   - ✅ 优化：分层计算方案与路径解析完美配合

4. **文档更新**
   - 更新 `resolveDependencyPath` 函数实现说明
   - 更新 `useArrayLinkageManager` 工作流程
   - 新增已实例化联动配置的处理说明

#### v2.2 (2025-12-28)

**重大变更**：拓扑排序和循环依赖检测优化

1. **拓扑排序优化**
   - ✅ 使用 Kahn 算法实现真正的拓扑排序
   - ✅ 解决菱形依赖场景下的执行顺序问题
   - ✅ 串行执行联动，确保依赖字段先计算完成

2. **循环依赖检测增强**
   - ✅ 新增 `CircularDependencyError` 错误类
   - ✅ 新增 `validate()` 方法返回详细验证结果
   - ✅ `detectCycle()` 支持可选的抛出错误模式
   - ✅ `topologicalSort()` 内置循环检测和回调支持

3. **动态联动循环检测**
   - ✅ `useArrayLinkageManager` 合并配置时检测循环依赖
   - ✅ 支持 `onCycleDetected` 回调和 `throwOnCycle` 选项

4. **文档更新**
   - 更新 DependencyGraph 类的完整实现
   - 更新联动管理器的执行逻辑说明
   - 更新关键技术点列表

#### v2.1 (2025-12-28)

**重大变更**：嵌套表单联动状态传递方案

1. **架构优化**
   - ✅ 新增：分层计算联动状态方案（方案 5）
   - ✅ 解决：NestedFormWidget 内部 DynamicForm 无法访问外层联动状态的问题
   - ✅ 优化：每层 DynamicForm 只计算自己范围内的联动，按需计算

2. **性能提升**
   - ✅ 大数组场景性能提升：从 O(n×m) 优化到 O(m)
   - ✅ 支持虚拟滚动和懒加载
   - ✅ Context 大小固定，不随数组元素数量增长

3. **架构可扩展性**
   - ✅ 支持任意深度的嵌套数组（如 `departments.employees.skills`）
   - ✅ 每层独立计算，自动递归支持
   - ✅ 符合组件化原则，职责清晰

4. **实现方案**
   - 新增 `LinkageStateContext` 用于传递表单实例和父级联动状态
   - 新增 `transformToAbsolutePaths` 函数用于路径转换
   - 更新 DynamicForm 和 NestedFormWidget 的联动计算逻辑

5. **文档更新**
   - 新增"嵌套表单联动状态传递方案"章节（3.1）
   - 新增方案对比和性能分析
   - 更新关键技术点和最佳实践

#### v2.0 (2025-12-28)

**重大变更**：路径规范优化

1. **路径语法规范化**
   - ✅ 保留：`./fieldName` - 同级字段相对路径
   - ✅ 新增：`#/properties/path/to/field` - JSON Pointer 绝对路径
   - ❌ 废弃：`../fieldName` - 父级相对路径
   - ❌ 废弃：`fieldName` - 简单字段名（歧义）

2. **新增场景支持**
   - ✅ 父数组元素依赖子数组（聚合计算）
   - ✅ 子数组元素依赖父数组元素字段（自动索引匹配）
   - ✅ 双向依赖（数组元素依赖整个数组）

3. **实现优化**
   - 新增 `parseJsonPointer` 函数
   - 新增 `resolveDependencyPath` 核心算法
   - 新增 `analyzePathRelationship` 路径关系分析
   - 新增 `resolveChildToParent` 和 `resolveParentToChild` 索引匹配算法

4. **文档更新**
   - 更新所有示例使用新的路径语法
   - 新增路径类型对照表
   - 新增详细的实现算法说明
   - 更新最佳实践和常见问题

#### v1.0 (2025-12-28)

初始版本，支持基础数组字段联动功能。

---

**文档版本**: 2.4
**最后更新**: 2025-12-30
**文档状态**: 已完成
**作者**: Claude Code
