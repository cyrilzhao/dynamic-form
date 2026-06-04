# 数组字段联动设计方案

## 目录

1. [概述](#1-概述)
2. [核心挑战](#2-核心挑战)
3. [解决方案架构](#3-解决方案架构)
4. [基础场景](#4-基础场景)
5. [复杂场景](#5-复杂场景)
6. [实现方案](#6-实现方案)
7. [最佳实践](#7-最佳实践)

---

## 1. 概述

数组字段的联动是动态表单系统中最复杂的场景之一，涉及到相对路径、动态索引、嵌套依赖等多个技术难点。本文档详细描述了数组字段联动的各种场景和完整的实现方案。

### 1.1 为什么需要专门处理

数组字段联动与普通字段联动的主要区别：

| 特性       | 普通字段联动  | 数组字段联动         |
| ---------- | ------------- | -------------------- |
| 路径类型   | 静态路径      | 动态路径（包含索引） |
| 依赖关系   | 绝对路径      | 相对路径 + 绝对路径  |
| 实例化时机 | Schema 解析时 | 运行时动态生成       |
| 复杂度     | 低            | 高                   |

### 1.2 适用范围

本文档涵盖以下场景：

- ✅ 数组元素内部字段之间的联动（相对路径）
- ✅ 数组元素字段依赖外部字段（绝对路径）
- ✅ 混合依赖（相对路径 + 绝对路径）
- ✅ 跨数组依赖（oneOf/anyOf/allOf）
- ✅ 嵌套数组联动（父子数组）
- ✅ 数组聚合计算
- ✅ 菱形依赖和循环依赖

---

## 2. 核心挑战

### 2.1 相对路径依赖

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

### 2.2 动态索引

**问题**：数组索引是运行时动态的，无法在 Schema 解析时确定

```typescript
// Schema 解析时：contacts.companyName
// 运行时实例化：
// - contacts.0.companyName
// - contacts.1.companyName
// - contacts.2.companyName
// ...
```

### 2.3 菱形依赖

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

## 3. 解决方案架构

### 3.1 嵌套表单联动状态传递方案

#### 3.1.1 核心挑战

当 ArrayFieldWidget 渲染对象类型数组元素时，通过 NestedFormWidget 创建了新的 DynamicForm 实例。这带来了联动状态传递的挑战：

- 外层 DynamicForm 通过 `useArrayLinkageManager` 计算联动状态
- 内层 DynamicForm（NestedFormWidget 内部）需要访问这些联动状态
- 如何高效、可扩展地在父子 DynamicForm 之间传递联动状态？

#### 3.1.2 解决方案：分层计算联动状态

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

### 3.2 模板依赖图方案

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

### 3.3 路径规范（重要）

为了保证路径引用的清晰性和一致性，我们采用以下路径规范：

#### 3.3.1 路径类型

| 路径类型         | 语法                         | 适用场景                   | 示例                     |
| ---------------- | ---------------------------- | -------------------------- | ------------------------ |
| **相对路径**     | `./fieldName`                | 仅用于同一数组元素内的字段 | `./type`                 |
| **JSON Pointer** | `#/properties/path/to/field` | 所有跨层级的依赖           | `#/properties/enableVip` |

#### 3.3.2 核心规则

**✅ 允许的路径格式**：

- `./fieldName` - 同级字段（同一个数组元素对象内）
- `#/properties/fieldName` - 顶层字段
- `#/properties/arrayName/items/properties/fieldName` - 数组元素字段
- `#/properties/parent/items/properties/child/items/properties/field` - 嵌套数组字段

**❌ 禁止的路径格式**：

- `../fieldName` - 不允许使用父级相对路径
- `../../fieldName` - 不允许使用祖父级相对路径
- `fieldName` - 不允许使用简单字段名（歧义）

#### 3.3.3 设计理由

1. **语义清晰**：路径类型一目了然，相对路径只用于同级，绝对路径用于跨层级
2. **易于维护**：Schema 重构时，JSON Pointer 路径不需要修改
3. **减少错误**：消除路径解析的歧义，避免层级计算错误
4. **标准化**：符合 JSON Schema 标准，工具支持更好

### 3.4 关键组件

| 组件                     | 职责                     | 文件位置                              |
| ------------------------ | ------------------------ | ------------------------------------- |
| `schemaLinkageParser`    | 解析 Schema 中的联动配置 | `src/components/DynamicForm/utils/schemaLinkageParser.ts`    |
| `arrayLinkageHelper`     | 数组联动辅助工具         | `src/components/DynamicForm/utils/arrayLinkageHelper.ts`     |
| `useArrayLinkageManager` | 数组联动管理器 Hook      | `src/components/DynamicForm/hooks/useArrayLinkageManager.ts` |
| `useLinkageManager`      | 基础联动管理器 Hook      | `src/components/DynamicForm/hooks/useLinkageManager.ts`      |

---

## 4. 基础场景

### 4.1 场景 1：相对路径依赖

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

### 4.2 场景 2：绝对路径依赖（数组内依赖外部）

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

### 4.3 场景 3：菱形依赖（复杂依赖关系）

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

## 5. 复杂场景

### 5.1 场景 4：混合依赖（外部 + 内部相对路径）

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

### 5.2 场景 5：跨数组元素联动

这类场景指的是**数组 A 的状态影响数组 B 的元素**，或者**数组 B 的元素依赖数组 A 的聚合状态**。

#### 5.2.1 数组 A 的聚合状态 → 数组 B 的所有元素

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

#### 5.2.2 数组 A 的特定元素 → 数组 B 的所有元素

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

### 5.3 场景 6：嵌套数组联动

#### 5.3.1 子数组元素依赖父数组元素字段

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

#### 5.3.2 子数组元素依赖外部字段 + 父数组元素字段（混合依赖）

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

#### 5.3.3 父数组元素依赖子数组（聚合计算）

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

### 5.4 场景 8：数组聚合计算（外部字段）

#### 5.4.1 外部字段依赖整个数组（求和、计数等）

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

#### 5.4.2 外部字段依赖数组的特定条件元素

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

#### 5.4.3 数组元素依赖数组聚合结果（双向依赖）

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

### 5.5 场景总结

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

## 6. 实现方案

### 6.0 类型定义

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

### 6.1 核心工具函数

#### 6.1.1 路径判断和解析

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

#### 6.1.2 JSON Pointer 解析

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

#### 6.1.3 依赖路径解析（核心算法）

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

#### 6.1.4 联动配置解析

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

### 6.2 Schema 解析

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

#### 6.2.1 路径转换辅助函数（支持嵌套表单）

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

### 6.3 运行时联动管理

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

#### 6.3.1 性能优化措施

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

### 6.4 集成到 DynamicForm

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

## 7. 最佳实践

### 7.1 路径引用规范（重要）

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

### 7.2 路径类型对照表

| 场景       | 旧语法（已废弃） | 新语法（推荐）                                      |
| ---------- | ---------------- | --------------------------------------------------- |
| 同级字段   | `./type`         | `./type` ✅                                         |
| 外部字段   | `enableVip`      | `#/properties/enableVip` ✅                         |
| 父数组字段 | `../type`        | `#/properties/departments/items/properties/type` ✅ |
| 祖父级字段 | `../../items`    | `#/properties/items` ✅                             |
| 整个数组   | `items`          | `#/properties/items` ✅                             |

### 7.3 性能优化建议

1. **避免过深的嵌套**：最多 2-3 层嵌套数组
2. **使用 useMemo 缓存计算结果**：特别是聚合计算
3. **避免循环依赖**：使用依赖图检测工具
4. **批量更新**：使用 `setValue` 的批量模式

### 7.3.1 联动结果缓存策略

**核心思想**：通过缓存联动计算结果，避免重复计算，提升性能。

#### 缓存复用场景分析

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

#### 缓存键生成算法

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

#### 缓存策略总结表

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

#### 性能权衡分析

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

### 7.4 调试技巧

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

### 7.5 常见问题

#### 问题 1：路径格式错误

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

#### 问题 2：JSON Pointer 路径错误

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

#### 问题 3：数组元素联动未触发

**症状**：数组元素变化时联动不生效

**原因**：动态联动配置未正确生成

**解决方案**：

```typescript
// 检查动态联动配置
console.log('动态联动配置:', dynamicLinkages);
```

#### 问题 4：性能问题

**症状**：数组元素较多时表单卡顿

**解决方案**：

- 使用虚拟滚动（react-window）
- 减少联动计算频率（防抖）
- 优化聚合函数性能

---

## 8. 总结

### 8.1 关键技术点

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

### 8.2 适用场景

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

### 8.3 相关文档

- [ArrayFieldWidget 设计方案](./ARRAY_FIELD_WIDGET.md)
- [UI 联动设计方案](./UI_LINKAGE_DESIGN.md)
- [嵌套表单设计](./NESTED_FORM.md)
- [字段路径透明化](./FIELD_PATH_FLATTENING.md)

---

## 9. 变更历史

### v3.0 (2026-01-10)

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

### v2.4 (2025-12-30) - 已废弃

**注意**：此版本的路径解析逻辑已在 v3.0 中被完全重构，不再使用 `~~` 分隔符

### v2.3 (2025-12-29)

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

### v2.2 (2025-12-28)

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

### v2.1 (2025-12-28)

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

### v2.0 (2025-12-28)

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

### v1.0 (2025-12-28)

初始版本，支持基础数组字段联动功能。

---

**文档版本**: 2.4
**最后更新**: 2025-12-30
**文档状态**: 已完成
**作者**: Claude Code
