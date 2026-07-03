# 动态表单 UI 联动设计方案

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

详细的路径系统说明请参考：[字段路径完全指南](./FIELD_PATH_GUIDE.md)

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
- 更多详细场景和算法请参考：[数组字段联动设计方案 - 7.3.1 联动结果缓存策略](./ARRAY_FIELD_LINKAGE.md#731-联动结果缓存策略)

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

1. **Schema 更新范围**：返回的 schema 只会更新以下字段，不会覆盖原有的 `ui.linkage` 配置：
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

- `ui.linkage` 控制 `address` 字段的显示/隐藏（UI 层面）
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

**异步联动的完整实现方案**（包括竞态条件处理、串行依赖执行、死循环防护等）请参考：[异步联动实现方案](./ASYNC_LINKAGE.md)

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

**详细文档**：[数组字段联动设计方案](./ARRAY_FIELD_LINKAGE.md)

### 8.2 路径透明化场景

当使用 `flattenPath` 时，联动配置中的路径会自动处理 `~~` 分隔符。

**详细文档**：[字段路径透明化设计方案](./FIELD_PATH_FLATTENING.md)

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

**完整的异步联动实现方案请参考**：[异步联动实现方案](./ASYNC_LINKAGE.md)

该文档详细介绍了：

- **竞态条件处理**：使用 AsyncSequenceManager 确保异步结果的正确性
- **串行依赖执行**：使用任务队列管理器处理复杂的依赖关系
- **死循环防护**：防止 setValue 触发 watch 导致的无限循环
- **开发者最佳实践**：使用异步联动时的注意事项

---

## 11. 常见问题

### Q1: 如何调试联动不生效的问题？

请参考 [动态表单常见问题](./DYNAMIC_FORM_PART6.md) 第 9.1 节 Q5。

### Q2: 如何处理循环依赖？

系统会在构建依赖图时自动检测循环依赖并在控制台输出警告。

### Q3: 联动函数可以是异步的吗？

可以。系统完整支持异步联动函数，详见 [异步联动实现方案](./ASYNC_LINKAGE.md)。

### Q4: Schema 联动会覆盖原有的 ui.linkage 配置吗？

不会。Schema 联动只会更新以下字段：

- `properties`：字段定义
- `required`：必填字段
- 校验相关字段：`minProperties`、`maxProperties`、`dependencies`、`if/then/else`、`allOf/anyOf/oneOf/not`

原有的 `ui` 配置（包括 `ui.linkage`）会被完整保留。详见第 3.5 节。

### Q5: 如何处理异步联动函数的竞态条件？

系统会自动处理异步请求的竞态条件。当用户快速切换依赖字段时，只有最后一次请求的结果会被应用，之前的过期结果会被自动丢弃。详见 [异步联动实现方案](./ASYNC_LINKAGE.md) 第 2 章。

### Q6: 串行依赖的异步联动是否能正常工作？

系统使用任务队列管理器来处理串行依赖的异步联动。详见 [异步联动实现方案](./ASYNC_LINKAGE.md) 第 3 章的完整说明。

### Q7: 值联动在实际使用中会有问题吗？

值联动（`type: 'value'`）在某些场景下可能需要特别注意，特别是当异步联动函数执行时间较长且用户快速连续输入时。详见 [异步联动实现方案](./ASYNC_LINKAGE.md) 第 4 章和第 5 章的完整分析和解决方案。

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
4. 详细示例请参考 [RefreshLinkage Example](/src/pages/examples/RefreshLinkageExample.tsx)

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

- [异步联动实现方案](./ASYNC_LINKAGE.md)
- [数组字段联动设计方案](./ARRAY_FIELD_LINKAGE.md)
- [字段路径透明化设计方案](./FIELD_PATH_FLATTENING.md)
- [字段路径完全指南](./FIELD_PATH_GUIDE.md)
- [动态表单常见问题](./DYNAMIC_FORM_PART6.md)

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

- [RefreshLinkage Example](/src/pages/examples/RefreshLinkageExample.tsx)

### v2.4 (2026-01-10)

**重大重构**：将异步联动内容独立为单独的技术文档

**主要变更**：

1. **文档结构优化**
   - ✅ 将原第 10 章的异步联动内容（~850 行）独立为 [异步联动实现方案](./ASYNC_LINKAGE.md)
   - ✅ 第 10 章改为简要说明并引用独立文档
   - ✅ 减少文档规模，提高可维护性

2. **内容更新**
   - ✅ 更新第 6.9 节：异步函数支持，引用独立文档
   - ✅ 更新常见问题 Q3、Q5、Q6、Q7，引用独立文档
   - ✅ 更新相关文档列表，添加 ASYNC_LINKAGE.md

3. **文档定位**
   - ✅ LINKAGE.md：UI 联动设计方案总览
   - ✅ ASYNC_LINKAGE.md：异步联动实现方案详解

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
