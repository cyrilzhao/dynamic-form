# Schema 级别条件验证机制设计方案

## 1. 整体架构

### 1.1 验证层次划分

```Text
┌─────────────────────────────────────────────────────────────┐
│                      表单验证架构                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  字段级别验证 (Field-level Validation)                │    │
│  │  - 处理位置: getValidationRules()                    │    │
│  │  - 验证时机: 字段值变化时                              │    │
│  │  - 访问范围: 仅当前字段值                              │    │
│  │  - 支持规则:                                         │    │
│  │    • required                                       │    │
│  │    • minLength / maxLength                          │    │
│  │    • minimum / maximum                              │    │
│  │    • pattern                                        │    │
│  │    • format (自定义 validate)                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Schema 级别验证 (Schema-level Validation)            │    │
│  │  - 处理位置: SchemaValidator 类                       │    │
│  │  - 验证时机: 表单提交时 / 字段变化时                     │    │
│  │  - 访问范围: 整个表单数据                               │    │
│  │  - 支持规则:                                          │    │
│  │    • dependencies (字段依赖)                          │    │
│  │    • if/then/else (条件分支)                          │    │
│  │    • allOf (逻辑与)                                   │    │
│  │    • anyOf (逻辑或)                                   │    │
│  │    • oneOf (逻辑异或)                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  自定义验证 (Custom Validation)                       │    │
│  │  - 处理位置: 用户提供的 customValidators               │    │
│  │  - 验证时机: 表单提交时                                │    │
│  │  - 访问范围: 整个表单数据 + 外部上下文                   │    │
│  │  - 支持场景:                                         │    │
│  │    • 业务逻辑验证                                     │    │
│  │    • 异步验证 (API 调用)                              │    │
│  │    • 跨表单验证                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 验证流程

```Text
用户输入
   ↓
字段级别验证 (实时)
   ↓
字段验证通过？
   ↓ 是
继续输入 / 提交表单
   ↓
Schema 级别验证 (提交时)
   ↓
Schema 验证通过？
   ↓ 是
自定义验证 (提交时)
   ↓
自定义验证通过？
   ↓ 是
表单提交成功
```

## 2. Schema 级别验证机制详解

### 2.1 核心类设计

#### 2.1.1 构造函数

SchemaValidator 类的构造函数接受两个参数：

```typescript
constructor(schema: ExtendedJSONSchema, rootSchema?: ExtendedJSONSchema)
```

**参数说明**：

- `schema`：当前需要验证的 JSON Schema
- `rootSchema`（可选）：根 Schema，用于在嵌套验证场景中保持对顶层 schema 的引用

**为什么需要 rootSchema？**

在处理嵌套的条件验证（如 `allOf`、`anyOf`、`oneOf` 中包含 `if/then/else`）时，验证器需要创建临时的子验证器实例。如果不传递 `rootSchema`，子验证器将无法访问顶层 schema 中定义的字段标题（`title`），导致错误提示中显示字段名而非友好的标题。

**示例**：

```typescript
// 顶层 schema 定义了字段标题
const schema = {
  properties: {
    age: { type: 'number', title: '年龄' },
    studentId: { type: 'string', title: '学号' },
  },
  allOf: [
    {
      if: { properties: { age: { maximum: 17 } } },
      then: { required: ['studentId'] },
    },
  ],
};

// 当验证 allOf 中的子 schema 时，需要 rootSchema 来获取 'studentId' 的标题 '学号'
// 否则错误提示会显示 "studentId is required" 而不是 "学号 is required"
```

#### 2.1.2 核心方法

SchemaValidator 类负责处理 JSON Schema 中的条件验证机制，主要包含以下方法：

**核心验证方法**：

- `validate(formData)` - 主验证入口，协调所有验证逻辑
- `validateDependencies()` - 处理字段依赖关系
- `validateConditional()` - 处理 if/then/else 条件分支
- `validateAllOf()` - 处理逻辑与验证
- `validateAnyOf()` - 处理逻辑或验证
- `validateOneOf()` - 处理逻辑异或验证

**辅助方法**：

- `hasValue()` - 检查值是否存在
- `getFieldTitle()` - 获取字段标题（用于错误提示，支持嵌套路径查找）
- `findFieldTitle()` - 递归查找字段的 title
- `matchesSchema()` - 检查数据是否匹配 schema
- `validateAgainstSchema()` - 根据 schema 验证数据
- `validateFieldValue()` - 验证单个字段的值

**类型验证方法**：

- `validateString()` - 验证字符串类型
- `validateNumber()` - 验证数字类型
- `validateArray()` - 验证数组类型
- `validateObject()` - 验证对象类型
- `validateFormat()` - 验证格式（email、uri 等）

完整的类实现请参见第 5 节。

### 2.2 与业务组件集成

SchemaValidator 可以直接在业务组件中使用：

**集成流程**：

1. 创建 SchemaValidator 实例
2. 调用 `validator.validate(formData)` 获取验证错误
3. 根据验证结果处理业务逻辑

**使用示例**：

```typescript
import { SchemaValidator } from '@/components/DynamicForm/core/SchemaValidator';

const handleValidation = (schema: ExtendedJSONSchema, formData: Record<string, any>) => {
  const validator = new SchemaValidator(schema);
  const errors = validator.validate(formData);

  if (Object.keys(errors).length > 0) {
    // 处理验证错误
    console.error('Validation errors:', errors);
    return false;
  }

  // 验证通过
  return true;
};
```

## 3. 条件验证机制实现

### 3.1 dependencies（字段依赖）

#### 3.1.1 简单依赖（数组形式）

**Schema 定义**：

```json
{
  "type": "object",
  "properties": {
    "creditCard": { "type": "string", "title": "Card Number" },
    "billingAddress": { "type": "string", "title": "Billing Address" }
  },
  "dependencies": {
    "creditCard": ["billingAddress"]
  }
}
```

#### 3.1.2 Schema 依赖（对象形式）

**Schema 定义**：

```json
{
  "type": "object",
  "properties": {
    "paymentMethod": {
      "type": "string",
      "enum": ["credit_card", "bank_transfer"]
    },
    "cardNumber": { "type": "string" },
    "bankAccount": { "type": "string" }
  },
  "dependencies": {
    "paymentMethod": {
      "oneOf": [
        {
          "properties": {
            "paymentMethod": { "const": "credit_card" },
            "cardNumber": { "pattern": "^[0-9]{16}$" }
          },
          "required": ["cardNumber"]
        },
        {
          "properties": {
            "paymentMethod": { "const": "bank_transfer" },
            "bankAccount": { "pattern": "^[0-9]{10,20}$" }
          },
          "required": ["bankAccount"]
        }
      ]
    }
  }
}
```

#### 3.1.3 完整的验证逻辑

`validateDependencies` 方法同时支持简单依赖和 Schema 依赖：

```typescript
validateDependencies(formData: Record<string, any>, errors: Record<string, string>): void {
  const dependencies = this.schema.dependencies;
  if (!dependencies) return;

  for (const [triggerField, dependentFields] of Object.entries(dependencies)) {
    // 如果触发字段有值
    if (this.hasValue(formData[triggerField])) {
      // 检查依赖字段
      if (Array.isArray(dependentFields)) {
        // 简单依赖：检查依赖字段是否都有值
        for (const dependentField of dependentFields) {
          if (!this.hasValue(formData[dependentField])) {
            errors[dependentField] = `${this.getFieldTitle(dependentField)} is required when ${this.getFieldTitle(triggerField)} is provided`;
          }
        }
      } else if (typeof dependentFields === 'object') {
        // Schema 依赖：验证整个表单数据是否满足依赖 schema
        const dependencyErrors = this.validateAgainstSchema(formData, dependentFields);
        Object.assign(errors, dependencyErrors);
      }
    }
  }
}
```

### 3.2 if/then/else（条件分支）

**Schema 定义**：

```json
{
  "type": "object",
  "properties": {
    "country": { "type": "string", "enum": ["china", "usa"] },
    "idCard": { "type": "string", "title": "ID Card" },
    "ssn": { "type": "string", "title": "SSN" }
  },
  "if": {
    "properties": { "country": { "const": "china" } }
  },
  "then": {
    "required": ["idCard"],
    "properties": {
      "idCard": { "pattern": "^[1-9]\\d{17}$" }
    }
  },
  "else": {
    "required": ["ssn"],
    "properties": {
      "ssn": { "pattern": "^\\d{3}-\\d{2}-\\d{4}$" }
    }
  }
}
```

**验证逻辑**：

```typescript
validateConditional(formData: Record<string, any>, errors: Record<string, string>): void {
  const { if: ifSchema, then: thenSchema, else: elseSchema } = this.schema;

  if (!ifSchema) return;

  // 检查 if 条件是否满足
  const ifMatches = this.matchesSchema(formData, ifSchema);

  // 根据条件选择对应的 schema
  const targetSchema = ifMatches ? thenSchema : elseSchema;

  if (targetSchema) {
    // 验证表单数据是否满足目标 schema
    const conditionalErrors = this.validateAgainstSchema(formData, targetSchema);
    Object.assign(errors, conditionalErrors);
  }
}
```

### 3.3 allOf（逻辑与）

**Schema 定义**：

```json
{
  "type": "object",
  "properties": {
    "isStudent": { "type": "boolean", "title": "是否学生" },
    "age": { "type": "integer", "title": "年龄" },
    "studentId": { "type": "string", "title": "学号" },
    "school": { "type": "string", "title": "学校" },
    "guardianPhone": { "type": "string", "title": "监护人电话" }
  },
  "allOf": [
    {
      "if": { "properties": { "isStudent": { "const": true } } },
      "then": { "required": ["studentId", "school"] }
    },
    {
      "if": { "properties": { "age": { "maximum": 17 } } },
      "then": { "required": ["guardianPhone"] }
    }
  ]
}
```

**验证逻辑**：

```typescript
validateAllOf(formData: Record<string, any>, errors: Record<string, string>): void {
  const allOf = this.schema.allOf;
  if (!allOf || !Array.isArray(allOf)) return;

  // 必须满足所有子 schema
  for (const subSchema of allOf) {
    const subErrors = this.validateAgainstSchema(formData, subSchema);
    Object.assign(errors, subErrors);
  }
}
```

### 3.4 anyOf（逻辑或）

**Schema 定义**：

```json
{
  "type": "object",
  "properties": {
    "email": { "type": "string", "title": "Email", "format": "email" },
    "phone": { "type": "string", "title": "Phone" },
    "wechat": { "type": "string", "title": "WeChat" }
  },
  "anyOf": [{ "required": ["email"] }, { "required": ["phone"] }, { "required": ["wechat"] }]
}
```

**验证逻辑**：

```typescript
validateAnyOf(formData: Record<string, any>, errors: Record<string, string>): void {
  const anyOf = this.schema.anyOf;
  if (!anyOf || !Array.isArray(anyOf)) return;

  // 至少满足一个子 schema
  const allSubErrors: Record<string, string>[] = [];
  let hasMatch = false;

  for (const subSchema of anyOf) {
    const subErrors = this.validateAgainstSchema(formData, subSchema);
    if (Object.keys(subErrors).length === 0) {
      hasMatch = true;
      break;
    }
    allSubErrors.push(subErrors);
  }

  // 如果没有任何一个 schema 匹配，收集所有错误
  if (!hasMatch) {
    // 合并所有子 schema 的错误信息
    const combinedErrors: Record<string, string[]> = {};
    for (const subErrors of allSubErrors) {
      for (const [field, message] of Object.entries(subErrors)) {
        if (!combinedErrors[field]) {
          combinedErrors[field] = [];
        }
        combinedErrors[field].push(message);
      }
    }

    // 生成友好的错误提示
    for (const [field, messages] of Object.entries(combinedErrors)) {
      errors[field] = `Must satisfy at least one of the following conditions: ${messages.join(' or ')}`;
    }
  }
}
```

### 3.5 oneOf（逻辑异或）

**Schema 定义**：

```json
{
  "type": "object",
  "properties": {
    "accountType": { "type": "string", "enum": ["personal", "business"] },
    "idCard": { "type": "string", "title": "ID Card" },
    "businessLicense": { "type": "string", "title": "营业执照号" }
  },
  "oneOf": [
    {
      "properties": { "accountType": { "const": "personal" } },
      "required": ["idCard"]
    },
    {
      "properties": { "accountType": { "const": "business" } },
      "required": ["businessLicense"]
    }
  ]
}
```

**验证逻辑**：

```typescript
validateOneOf(formData: Record<string, any>, errors: Record<string, string>): void {
  const oneOf = this.schema.oneOf;
  if (!oneOf || !Array.isArray(oneOf)) return;

  // 有且仅有一个子 schema 匹配
  let matchCount = 0;
  let lastMatchErrors: Record<string, string> = {};

  for (const subSchema of oneOf) {
    const subErrors = this.validateAgainstSchema(formData, subSchema);
    if (Object.keys(subErrors).length === 0) {
      matchCount++;
    } else {
      lastMatchErrors = subErrors;
    }
  }

  if (matchCount === 0) {
    // 没有任何 schema 匹配
    Object.assign(errors, lastMatchErrors);
  } else if (matchCount > 1) {
    // 多个 schema 匹配（互斥条件冲突）
    errors['_schema'] = 'Data matches multiple mutually exclusive conditions';
  }
  // matchCount === 1 时验证通过，不添加错误
}
```

## 4. 辅助方法实现

### 4.1 核心辅助方法

```typescript
/**
 * 检查值是否存在（非空、非 undefined、非空字符串）
 */
private hasValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * 获取字段的标题（用于错误提示）
 * 支持嵌套路径查找，如 "address.city"
 */
private getFieldTitle(fieldName: string, schema?: ExtendedJSONSchema): string {
  // 优先从根 schema 查找（包含所有字段的 title）
  const title = this.findFieldTitle(fieldName, this.rootSchema);
  if (title) return title;

  // 如果根 schema 没找到，再从传入的 schema 查找
  if (schema) {
    const schemaTitle = this.findFieldTitle(fieldName, schema);
    if (schemaTitle) return schemaTitle;
  }

  return fieldName;
}

/**
 * 递归查找字段的 title
 */
private findFieldTitle(fieldName: string, schema: ExtendedJSONSchema): string | null {
  if (!schema.properties) return null;

  // 直接查找当前层级
  const fieldSchema = schema.properties[fieldName];
  if (fieldSchema && typeof fieldSchema === 'object' && 'title' in fieldSchema) {
    const title = fieldSchema.title;
    if (title && typeof title === 'string') {
      return title;
    }
  }

  // 递归查找嵌套的 object 类型字段
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    if (typeof propSchema === 'object' && propSchema.type === 'object' && propSchema.properties) {
      const nestedTitle = this.findFieldTitle(fieldName, propSchema);
      if (nestedTitle) return nestedTitle;
    }
  }

  return null;
}

/**
 * 检查数据是否匹配指定的 schema
 */
private matchesSchema(formData: Record<string, any>, schema: ExtendedJSONSchema): boolean {
  const errors = this.validateAgainstSchema(formData, schema);
  return Object.keys(errors).length === 0;
}

/**
 * 根据 schema 验证表单数据
 * 这是核心验证方法，递归处理各种验证规则
 */
private validateAgainstSchema(
  formData: Record<string, any>,
  schema: ExtendedJSONSchema
): Record<string, string> {
  const errors: Record<string, string> = {};

  // 1. 验证 required 字段
  if (schema.required && Array.isArray(schema.required)) {
    for (const requiredField of schema.required) {
      if (!this.hasValue(formData[requiredField])) {
        errors[requiredField] = `${this.getFieldTitle(requiredField, schema)} is required`;
      }
    }
  }

  // 2. 验证 properties 中的约束
  if (schema.properties) {
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      if (typeof fieldSchema === 'boolean') continue;

      const fieldValue = formData[fieldName];
      const fieldErrors = this.validateFieldValue(fieldValue, fieldSchema, fieldName, schema);
      Object.assign(errors, fieldErrors);
    }
  }

  // 3. 处理 oneOf/anyOf/allOf/if（如果传入的 schema 包含这些字段）
  if (schema.oneOf || schema.anyOf || schema.allOf || schema.if) {
    // 创建临时验证器来处理嵌套的条件验证，传入 rootSchema 以保持对顶层 schema 的引用
    const nestedValidator = new SchemaValidator(schema, this.rootSchema);
    const nestedErrors = nestedValidator.validate(formData);
    Object.assign(errors, nestedErrors);
  }

  return errors;
}

/**
 * 验证单个字段的值
 */
private validateFieldValue(
  value: any,
  schema: ExtendedJSONSchema,
  fieldName: string,
  parentSchema?: ExtendedJSONSchema
): Record<string, string> {
  const errors: Record<string, string> = {};

  // 如果值不存在，跳过验证（required 已在上层处理）
  if (!this.hasValue(value)) return errors;

  // 验证 const（常量值）
  if (schema.const !== undefined && value !== schema.const) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} must be ${schema.const}`;
    return errors;
  }

  // 验证 enum（枚举值）
  if (schema.enum && !schema.enum.includes(value)) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} must be one of: ${schema.enum.join(', ')}`;
    return errors;
  }

  // 根据类型验证
  switch (schema.type) {
    case 'string':
      this.validateString(value, schema, fieldName, errors, parentSchema);
      break;
    case 'number':
    case 'integer':
      this.validateNumber(value, schema, fieldName, errors, parentSchema);
      break;
    case 'array':
      this.validateArray(value, schema, fieldName, errors, parentSchema);
      break;
    case 'object':
      this.validateObject(value, schema, fieldName, errors, parentSchema);
      break;
  }

  return errors;
}

```

### 4.2 类型验证方法

```typescript
/**
 * 验证字符串类型
 */
private validateString(
  value: string,
  schema: ExtendedJSONSchema,
  fieldName: string,
  errors: Record<string, string>,
  parentSchema?: ExtendedJSONSchema
): void {
  // 验证最小长度
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} minimum length is ${schema.minLength} characters`;
  }

  // 验证最大长度
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} maximum length is ${schema.maxLength} characters`;
  }

  // 验证正则表达式
  if (schema.pattern) {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} invalid format`;
    }
  }

  // 验证格式（format）
  if (schema.format) {
    const formatError = this.validateFormat(value, schema.format, fieldName, parentSchema);
    if (formatError) {
      errors[fieldName] = formatError;
    }
  }
}

/**
 * 验证数字类型
 */
private validateNumber(
  value: number,
  schema: ExtendedJSONSchema,
  fieldName: string,
  errors: Record<string, string>,
  parentSchema?: ExtendedJSONSchema
): void {
  // 验证最小值
  if (schema.minimum !== undefined && value < schema.minimum) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} minimum value is ${schema.minimum}`;
  }

  // 验证最大值
  if (schema.maximum !== undefined && value > schema.maximum) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} maximum value is ${schema.maximum}`;
  }

  // 验证排他最小值
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} must be greater than ${schema.exclusiveMinimum}`;
  }

  // 验证排他最大值
  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} must be less than ${schema.exclusiveMaximum}`;
  }

  // 验证倍数
  if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} must be a multiple of ${schema.multipleOf}`;
  }
}

/**
 * 验证数组类型
 */
private validateArray(
  value: any[],
  schema: ExtendedJSONSchema,
  fieldName: string,
  errors: Record<string, string>,
  parentSchema?: ExtendedJSONSchema
): void {
  // 验证最小项数
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} requires at least ${schema.minItems} items`;
  }

  // 验证最大项数
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} allows at most ${schema.maxItems} items`;
  }

  // 验证唯一性
  if (schema.uniqueItems) {
    const uniqueValues = new Set(value.map(v => JSON.stringify(v)));
    if (uniqueValues.size !== value.length) {
      errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} must not contain duplicate items`;
    }
  }
}

/**
 * 验证对象类型
 */
private validateObject(
  value: Record<string, any>,
  schema: ExtendedJSONSchema,
  fieldName: string,
  errors: Record<string, string>,
  parentSchema?: ExtendedJSONSchema
): void {
  // 验证最小属性数
  if (schema.minProperties !== undefined) {
    const propCount = Object.keys(value).length;
    if (propCount < schema.minProperties) {
      errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} requires at least ${schema.minProperties} properties`;
    }
  }

  // 验证最大属性数
  if (schema.maxProperties !== undefined) {
    const propCount = Object.keys(value).length;
    if (propCount > schema.maxProperties) {
      errors[fieldName] = `${this.getFieldTitle(fieldName, parentSchema)} allows at most ${schema.maxProperties} properties`;
    }
  }
}

/**
 * 验证格式（format）
 */
private validateFormat(
  value: string,
  format: string,
  fieldName: string,
  parentSchema?: ExtendedJSONSchema
): string | null {
  const formatValidators: Record<string, RegExp> = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    uri: /^https?:\/\/.+/,
    ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    time: /^\d{2}:\d{2}:\d{2}$/,
    'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
  };

  const validator = formatValidators[format];
  if (validator && !validator.test(value)) {
    return `${this.getFieldTitle(fieldName, parentSchema)} invalid format (expected: ${format})`;
  }

  return null;
}
```

## 5. 完整的 SchemaValidator 类实现

```typescript
import type { ExtendedJSONSchema } from '../types/schema';

/**
 * Schema 级别验证器
 * 负责处理 JSON Schema 中的条件验证机制
 */
export class SchemaValidator {
  private schema: ExtendedJSONSchema;
  private rootSchema: ExtendedJSONSchema;

  constructor(schema: ExtendedJSONSchema, rootSchema?: ExtendedJSONSchema) {
    this.schema = schema;
    this.rootSchema = rootSchema || schema;
  }

  /**
   * 验证整个表单数据
   */
  validate(formData: Record<string, any>): Record<string, string> {
    const errors: Record<string, string> = {};

    // 1. 处理 dependencies
    this.validateDependencies(formData, errors);

    // 2. 处理 if/then/else
    this.validateConditional(formData, errors);

    // 3. 处理 allOf
    this.validateAllOf(formData, errors);

    // 4. 处理 anyOf
    this.validateAnyOf(formData, errors);

    // 5. 处理 oneOf
    this.validateOneOf(formData, errors);

    return errors;
  }

  // ... 所有验证方法的实现（见第 4 节）
  // 包括：validateDependencies, validateConditional, validateAllOf,
  // validateAnyOf, validateOneOf, validateAgainstSchema, validateFieldValue,
  // validateString, validateNumber, validateArray, validateObject, validateFormat,
  // hasValue, getFieldTitle, findFieldTitle, matchesSchema
}
```

## 6. 与业务组件集成

### 6.1 直接使用 SchemaValidator

在业务组件中直接使用 SchemaValidator 进行表单验证：

```typescript
import { SchemaValidator } from '@/components/DynamicForm/core/SchemaValidator';
import type { ExtendedJSONSchema } from '@/components/DynamicForm/types/schema';

// 在表单提交前进行验证
const handleSubmit = (schema: ExtendedJSONSchema, formData: Record<string, any>) => {
  const validator = new SchemaValidator(schema);
  const errors = validator.validate(formData);

  if (Object.keys(errors).length > 0) {
    // 显示验证错误
    return { success: false, errors };
  }

  // 验证通过，继续提交
  return { success: true, errors: {} };
};
```

### 6.2 在 NodeConfigModal 中的实际使用

项目中 `NodeConfigModal` 组件展示了 SchemaValidator 的实际使用方式：

```typescript
import { SchemaValidator } from '@/components/DynamicForm/core/SchemaValidator';

const NodeConfigModal = ({ schema, onSubmit }) => {
  const handleValidation = (formData: Record<string, any>) => {
    // 使用 SchemaValidator 进行验证
    const validator = new SchemaValidator(schema.inputSchema);
    const errors = validator.validate(formData);

    if (Object.keys(errors).length > 0) {
      // 处理验证错误
      return false;
    }

    // 验证通过
    onSubmit(formData);
    return true;
  };

  // ...
};
```

## 7. 使用示例

### 7.1 示例 1：支付方式依赖验证

```typescript
const paymentSchema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    paymentMethod: {
      type: 'string',
      title: '支付方式',
      enum: ['credit_card', 'bank_transfer', 'alipay'],
      enumNames: ['Credit Card', 'Bank Transfer', 'Alipay'],
    },
    cardNumber: { type: 'string', title: '信用卡号' },
    bankAccount: { type: 'string', title: '银行账号' },
    alipayAccount: { type: 'string', title: '支付宝账号' },
  },
  dependencies: {
    paymentMethod: {
      oneOf: [
        {
          properties: {
            paymentMethod: { const: 'credit_card' },
            cardNumber: { pattern: '^[0-9]{16}$' },
          },
          required: ['cardNumber'],
        },
        {
          properties: {
            paymentMethod: { const: 'bank_transfer' },
            bankAccount: { pattern: '^[0-9]{10,20}$' },
          },
          required: ['bankAccount'],
        },
        {
          properties: {
            paymentMethod: { const: 'alipay' },
            alipayAccount: { format: 'email' },
          },
          required: ['alipayAccount'],
        },
      ],
    },
  },
};
```

### 7.2 示例 2：条件分支验证（if/then/else）

```typescript
const userSchema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    country: {
      type: 'string',
      title: '国家',
      enum: ['china', 'usa', 'other'],
      enumNames: ['China', 'USA', 'Other'],
    },
    idCard: { type: 'string', title: '身份证号' },
    ssn: { type: 'string', title: '社会安全号' },
    passport: { type: 'string', title: '护照号' },
  },
  if: {
    properties: { country: { const: 'china' } },
  },
  then: {
    required: ['idCard'],
    properties: {
      idCard: { pattern: '^[1-9]\\d{17}$' },
    },
  },
  else: {
    if: {
      properties: { country: { const: 'usa' } },
    },
    then: {
      required: ['ssn'],
      properties: {
        ssn: { pattern: '^\\d{3}-\\d{2}-\\d{4}$' },
      },
    },
    else: {
      required: ['passport'],
      properties: {
        passport: { pattern: '^[A-Z]\\d{8}$' },
      },
    },
  },
};
```

### 7.3 示例 3：至少填写一项（anyOf）

```typescript
const contactSchema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', title: '邮箱', format: 'email' },
    phone: { type: 'string', title: '手机号' },
    wechat: { type: 'string', title: '微信号' },
  },
  anyOf: [{ required: ['email'] }, { required: ['phone'] }, { required: ['wechat'] }],
};
```

## 8. 最佳实践

### 8.1 错误提示优化

**问题**：默认的错误提示可能不够友好。

**解决方案**：在 Schema 中使用 `ui.errorMessages` 自定义错误提示。

```typescript
const schema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      title: 'Email',
      format: 'email',
      ui: {
        errorMessages: {
          required: 'Please enter email address',
          format: 'Please enter a valid email address',
        },
      },
    },
  },
  required: ['email'],
};
```

### 8.2 性能优化

**问题**：复杂的嵌套条件验证可能影响性能。

**解决方案**：

1. **避免过深的嵌套**：建议不超过 3 层
2. **优先使用简单依赖**：`dependencies` 数组形式比对象形式更高效
3. **缓存验证器实例**：避免重复创建 SchemaValidator

```typescript
// ❌ 不推荐：每次渲染都创建新实例
const MyForm = () => {
  const resolver = createSchemaResolver(schema);
  // ...
};

// ✅ 推荐：使用 useMemo 缓存
const MyForm = () => {
  const resolver = useMemo(() => createSchemaResolver(schema), [schema]);
  // ...
};
```

### 8.3 条件验证 vs UI 联动

**重要**：条件验证机制是**数据验证规则**，不是 UI 联动逻辑。

| 功能         | 条件验证                 | UI 联动                      |
| ------------ | ------------------------ | ---------------------------- |
| **触发时机** | 表单提交时               | 字段值变化时                 |
| **作用范围** | 数据校验                 | 界面显示/隐藏                |
| **实现方式** | SchemaValidator          | useLinkageManager            |
| **示例**     | 当选择信用卡时，卡号必填 | 当选择信用卡时，显示卡号字段 |

**正确的使用方式**：

```typescript
// 1. 使用条件验证确保数据合法性
const schema = {
  dependencies: {
    paymentMethod: {
      oneOf: [
        {
          properties: { paymentMethod: { const: 'credit_card' } },
          required: ['cardNumber'],
        },
      ],
    },
  },
};

// 2. 使用 UI 联动控制字段显示
const linkageRules = [
  {
    conditions: [{ field: 'paymentMethod', operator: 'eq', value: 'credit_card' }],
    effects: [{ targetField: 'cardNumber', action: 'show' }],
  },
];
```

## 9. 实现计划

### 9.1 第一阶段：核心验证器实现

**目标**：实现 SchemaValidator 类的核心功能

**任务**：

1. 创建 `SchemaValidator` 类文件
2. 实现 `dependencies` 验证（简单依赖 + Schema 依赖）
3. 实现 `if/then/else` 验证
4. 实现 `allOf`、`anyOf`、`oneOf` 验证
5. 实现辅助方法（`hasValue`、`getFieldTitle`、`matchesSchema`）
6. 实现类型验证方法（`validateString`、`validateNumber`、`validateArray`、`validateObject`）

**文件位置**：

- `src/components/DynamicForm/core/SchemaValidator.ts`

### 9.2 第二阶段：集成到业务组件

**目标**：将 SchemaValidator 集成到业务组件中

**任务**：

1. 在需要验证的组件中引入 SchemaValidator
2. 在表单提交前调用验证方法
3. 处理验证错误的显示
4. 确保与现有字段级别验证兼容

**文件位置**：

- `src/components/Workflow/NodeConfigModal.tsx`（实际使用示例）

### 9.3 第三阶段：测试和文档

**目标**：确保功能正确性和可维护性

**任务**：

1. 编写单元测试（覆盖所有条件验证机制）
2. 编写集成测试（测试与 DynamicForm 的集成）
3. 更新使用文档
4. 添加示例代码

**文件位置**：

- `src/components/DynamicForm/core/__tests__/SchemaValidator.test.ts`
- `doc/DynamicForm/SCHEMA_VALIDATION_USAGE.md`

## 10. 总结

### 10.1 核心要点

1. **验证层次清晰**：
   - 字段级别验证：处理单个字段的独立约束
   - Schema 级别验证：处理跨字段的条件逻辑
   - 自定义验证：处理复杂的业务逻辑

2. **条件验证机制完整**：
   - `dependencies`：字段依赖关系
   - `if/then/else`：条件分支逻辑
   - `allOf`：逻辑与（全部满足）
   - `anyOf`：逻辑或（至少一个）
   - `oneOf`：逻辑异或（有且仅有一个）

3. **与现有系统兼容**：
   - 不影响现有的字段级别验证
   - 与 react-hook-form 无缝集成
   - 支持自定义错误提示

### 10.2 注意事项

1. **条件验证 ≠ UI 联动**：
   - 条件验证只负责数据校验，不控制字段显示/隐藏
   - UI 联动需要使用 `useLinkageManager`

2. **性能考虑**：
   - 避免过深的嵌套（建议不超过 3 层）
   - 使用 `useMemo` 缓存验证器实例
   - 优先使用简单依赖而非复杂的 Schema 依赖

3. **错误提示友好性**：
   - 使用 `ui.errorMessages` 自定义错误提示
   - 提供清晰的字段标题（`title`）
   - 错误信息应该告诉用户如何修正

4. **测试覆盖**：
   - 为每种条件验证机制编写单元测试
   - 测试边界情况和错误场景
   - 确保与现有功能的兼容性

### 10.3 后续优化方向

1. **支持异步验证**：
   - 支持 API 调用验证（如检查用户名是否已存在）
   - 支持防抖优化

2. **支持更多 JSON Schema 特性**：
   - `patternProperties`：动态键名验证
   - `contains`：数组包含性检查
   - `$ref`：Schema 引用和复用

3. **性能优化**：
   - 增量验证（只验证变化的字段）
   - 验证结果缓存
   - 并行验证

4. **开发者体验优化**：
   - 提供 Schema 可视化编辑器
   - 提供验证规则调试工具
   - 提供更详细的错误堆栈信息

---

**文档版本**：v1.0
**最后更新**：2026-01-01
**作者**：Claude Code
