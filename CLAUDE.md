# CLAUDE.md

本文档为 Claude Code 提供项目特定的编码规范和最佳实践指南。

## 项目概述

这是一个基于 React + TypeScript + Vite 的前端项目，主要功能包括动态表单系统和工作流管理。

**技术栈**：
- React 18.3
- TypeScript 5.9
- Vite 7.2
- React Hook Form 7.69
- Blueprint.js 6.4
- Zustand 5.0
- React Query 5.90

## 编码规范

### 1. TypeScript 规范

#### 1.1 函数参数规范

**规则**：当函数参数超过 2 个时，必须使用对象解构的方式传递参数。

**原因**：
- 提高代码可读性，参数名称自解释
- 避免参数顺序错误
- 方便添加可选参数
- 便于重构和维护

**示例**：

```typescript
// ❌ 不推荐：参数过多，顺序容易混淆
function validateFieldValue(
  value: any,
  schema: ExtendedJSONSchema,
  fieldName: string,
  errors: Record<string, string>,
  parentSchema?: ExtendedJSONSchema
): void {
  // ...
}

// ✅ 推荐：使用对象参数
function validateFieldValue({
  value,
  schema,
  fieldName,
  errors,
  parentSchema,
}: {
  value: any;
  schema: ExtendedJSONSchema;
  fieldName: string;
  errors: Record<string, string>;
  parentSchema?: ExtendedJSONSchema;
}): void {
  // ...
}

// ✅ 更好：定义参数类型
interface ValidateFieldValueParams {
  value: any;
  schema: ExtendedJSONSchema;
  fieldName: string;
  errors: Record<string, string>;
  parentSchema?: ExtendedJSONSchema;
}

function validateFieldValue(params: ValidateFieldValueParams): void {
  const { value, schema, fieldName, errors, parentSchema } = params;
  // ...
}
```

**例外情况**：

以下情况可以使用位置参数：
- 参数不超过 2 个
- 工具函数（如 `map`、`filter` 的回调）
- 符合通用约定的函数（如 `setState(value, callback)`）
- React 组件的 props（已经是对象形式）

```typescript
// ✅ 允许：参数不超过 2 个
function hasValue(value: any): boolean {
  return value !== null && value !== undefined;
}

function getFieldTitle(fieldName: string, schema?: ExtendedJSONSchema): string {
  // ...
}

// ✅ 允许：数组方法回调
array.map((item, index) => item * 2);
```

#### 1.2 类型定义规范

**规则**：
- 优先使用 `interface` 定义对象类型
- 使用 `type` 定义联合类型、交叉类型或工具类型
- 避免使用 `any`，必要时使用 `unknown`
- 为复杂的参数对象定义独立的类型

```typescript
// ✅ 推荐
interface UserProfile {
  id: string;
  name: string;
  email: string;
}

type Status = 'pending' | 'approved' | 'rejected';

// ❌ 不推荐
const processData = (data: any) => { /* ... */ };

// ✅ 推荐
const processData = (data: unknown) => {
  if (typeof data === 'object' && data !== null) {
    // 类型守卫
  }
};
```

#### 1.3 命名规范

**规则**：
- 组件名：PascalCase（如 `DynamicForm`、`SchemaValidator`）
- 函数/变量名：camelCase（如 `validateFieldValue`、`hasValue`）
- 常量：UPPER_SNAKE_CASE（如 `MAX_RETRY_COUNT`）
- 类型/接口：PascalCase（如 `ExtendedJSONSchema`、`ValidationError`）
- 私有方法：camelCase，使用 `private` 修饰符

```typescript
// ✅ 推荐
export class SchemaValidator {
  private readonly schema: ExtendedJSONSchema;

  constructor(schema: ExtendedJSONSchema) {
    this.schema = schema;
  }

  public validate(formData: Record<string, any>): ValidationErrors {
    return this.performValidation(formData);
  }

  private performValidation(data: Record<string, any>): ValidationErrors {
    // ...
  }
}
```

### 2. React 规范

#### 2.1 组件定义

**规则**：
- 使用函数组件 + Hooks
- 组件 props 使用 `interface` 定义
- 导出组件使用命名导出

```typescript
// ✅ 推荐
interface DynamicFormProps {
  schema: ExtendedJSONSchema;
  onSubmit: (data: Record<string, any>) => void;
  defaultValues?: Record<string, any>;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  schema,
  onSubmit,
  defaultValues,
}) => {
  // ...
};
```

#### 2.2 Hooks 使用规范

**规则**：
- 自定义 Hook 必须以 `use` 开头
- Hook 只能在组件顶层调用
- 使用 `useMemo` 和 `useCallback` 优化性能

```typescript
// ✅ 推荐
export const useLinkageManager = (schema: ExtendedJSONSchema) => {
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());

  const evaluateConditions = useCallback((formData: Record<string, any>) => {
    // ...
  }, [schema]);

  return { visibleFields, evaluateConditions };
};
```

### 3. 文件组织规范

#### 3.1 目录结构

```
src/
├── components/          # React 组件
│   └── DynamicForm/
│       ├── core/       # 核心逻辑类
│       ├── fields/     # 字段组件
│       ├── hooks/      # 自定义 Hooks
│       ├── utils/      # 工具函数
│       └── __tests__/  # 测试文件
├── hooks/              # 全局 Hooks
├── types/              # 类型定义
├── utils/              # 工具函数
└── stores/             # 状态管理
```

#### 3.2 文件命名

- 组件文件：PascalCase（如 `DynamicForm.tsx`）
- 工具文件：camelCase（如 `createSchemaResolver.ts`）
- 类型文件：camelCase（如 `schema.ts`）
- 测试文件：与源文件同名 + `.test.ts`（如 `SchemaValidator.test.ts`）

### 4. 注释规范

#### 4.1 JSDoc 注释

**规则**：
- 公共 API 必须添加 JSDoc 注释
- 复杂逻辑添加行内注释说明
- 注释使用中文

```typescript
/**
 * Schema 级别验证器
 * 负责处理 JSON Schema 中的条件验证机制
 */
export class SchemaValidator {
  /**
   * 验证整个表单数据
   * @param formData - 表单数据对象
   * @returns 验证错误对象，键为字段名，值为错误信息
   */
  validate(formData: Record<string, any>): Record<string, string> {
    // ...
  }
}
```

### 5. 测试规范

#### 5.1 测试文件组织

**规则**：
- 测试文件与源文件放在同一目录的 `__tests__` 文件夹中
- 测试文件命名：`[源文件名].test.ts`
- 使用 `describe` 和 `it` 组织测试用例

```typescript
describe('SchemaValidator', () => {
  describe('dependencies 验证', () => {
    it('当触发字段有值时，依赖字段必填', () => {
      // ...
    });
  });
});
```

### 6. 代码质量

#### 6.1 避免调试代码

**规则**：
- 提交前移除所有 `console.log`、`console.info` 等调试代码
- 使用专门的日志工具（如果需要）

```typescript
// ❌ 不推荐：调试代码残留
console.info('cyril lastMatchErrors: ', lastMatchErrors);

// ✅ 推荐：移除调试代码或使用日志工具
// logger.debug('Validation errors:', lastMatchErrors);
```

#### 6.2 错误处理

**规则**：
- 使用明确的错误类型
- 提供友好的错误提示
- **错误信息使用英文**（面向用户的所有内容都使用英文）

```typescript
// ✅ 推荐：错误信息使用英文
if (!this.hasValue(formData[requiredField])) {
  errors[requiredField] = `${this.getFieldTitle(requiredField)} is required`;
}

// ❌ 不推荐：错误信息使用中文
if (!this.hasValue(formData[requiredField])) {
  errors[requiredField] = `${this.getFieldTitle(requiredField)} 是必填项`;
}
```

### 7. 项目特定规范

#### 7.1 DynamicForm 组件规范

**Schema 定义**：
- 使用 `ExtendedJSONSchema` 类型
- 字段必须包含 `title` 属性（用于错误提示）
- 使用 `ui` 字段定义 UI 相关配置

```typescript
const schema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    email: {
      type: 'string',
      title: 'Email Address',
      format: 'email',
      ui: {
        placeholder: 'Please enter your email',
      },
    },
  },
  required: ['email'],
};
```

#### 7.2 验证机制规范

**层次划分**：
- **字段级别验证**：处理单个字段的独立约束（required, minLength, pattern 等）
- **Schema 级别验证**：处理跨字段的条件逻辑（dependencies, if/then/else, allOf/anyOf/oneOf）
- **自定义验证**：处理复杂的业务逻辑

**重要**：条件验证机制是数据验证规则，不是 UI 联动逻辑。

```typescript
// ✅ 正确：使用条件验证确保数据合法性
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

// ✅ 正确：使用 UI 联动控制字段显示
const linkageRules = [
  {
    conditions: [{ field: 'paymentMethod', operator: 'eq', value: 'credit_card' }],
    effects: [{ targetField: 'cardNumber', action: 'show' }],
  },
];
```

### 8. 文档规范

#### 8.1 文档语言

**规则**：
- 代码注释：使用中文
- 用户面向内容（错误提示、UI 文本）：使用英文
- 技术文档：使用中文
- README：使用中文

#### 8.2 文档结构

技术设计文档应包含以下部分：
1. 整体架构
2. 核心类/组件设计
3. 实现细节
4. 使用示例
5. 最佳实践
6. 实现计划
7. 总结

### 9. 性能优化

#### 9.1 React 性能优化

**规则**：
- 使用 `useMemo` 缓存复杂计算结果
- 使用 `useCallback` 缓存函数引用
- 避免在渲染函数中创建新对象/数组

```typescript
// ✅ 推荐：缓存验证器实例
const MyForm = () => {
  const resolver = useMemo(() => createSchemaResolver(schema), [schema]);
  // ...
};

// ❌ 不推荐：每次渲染都创建新实例
const MyForm = () => {
  const resolver = createSchemaResolver(schema);
  // ...
};
```

#### 9.2 验证性能优化

**规则**：
- 避免过深的嵌套验证（建议不超过 3 层）
- 优先使用简单依赖而非复杂的 Schema 依赖
- 缓存验证器实例

### 10. 总结

本文档定义了项目的核心编码规范，重点包括：

1. **函数参数规范**：超过 2 个参数时使用对象解构
2. **类型安全**：避免使用 `any`，优先使用 `interface`
3. **命名规范**：遵循 PascalCase/camelCase 约定
4. **代码质量**：移除调试代码，提供友好的错误提示
5. **性能优化**：合理使用 `useMemo` 和 `useCallback`

遵循这些规范可以提高代码的可读性、可维护性和一致性。

---

**文档版本**：v1.0
**最后更新**：2026-01-01
**维护者**：项目团队
