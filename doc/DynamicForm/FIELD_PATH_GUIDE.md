# 动态表单字段路径完全指南

## 目录

1. [概述](#1-概述)
2. [路径类型总览](#2-路径类型总览)
3. [表单数据路径](#3-表单数据路径)
4. [联动依赖路径](#4-联动依赖路径)
5. [路径透明化](#5-路径透明化)
6. [数组场景的路径处理](#6-数组场景的路径处理)
7. [路径转换工具](#7-路径转换工具)
8. [完整示例](#8-完整示例)
9. [常见问题](#9-常见问题)

---

## 1. 概述

在动态表单系统中，"路径"是一个核心概念，用于定位和引用表单中的字段。由于表单支持嵌套对象、数组、路径透明化等复杂场景，系统中存在多种路径格式，各有其适用场景。

### 1.1 为什么需要理解路径

- **字段定位**：表单数据是嵌套结构，需要路径来定位具体字段
- **联动配置**：字段之间的联动依赖需要通过路径引用
- **视觉透明化**：路径透明化场景下，UI 层级与数据结构保持一致
- **数组处理**：数组元素的路径包含动态索引，需要特殊处理

### 1.2 路径的两个维度

| 维度             | 说明                                      | 示例                                     |
| ---------------- | ----------------------------------------- | ---------------------------------------- |
| **表单数据路径** | 用于 react-hook-form 的字段注册和数据访问 | `contacts.0.name`                        |
| **联动依赖路径** | 用于 Schema 中配置字段间的依赖关系        | `./type` 或 `#/properties/enableVip`     |

**v3.0 重要变更**：
- 统一使用标准 `.` 分隔符
- 移除了"逻辑路径"和"物理路径"的区分
- flattenPath 字段通过透明容器实现视觉扁平化，数据结构保持标准嵌套格式

---

## 2. 路径类型总览

### 2.1 路径格式速查表

| 路径格式         | 语法               | 使用场景               | 示例                     |
| ---------------- | ------------------ | ---------------------- | ------------------------ |
| **点号路径**     | `a.b.c`            | 表单数据访问、字段注册 | `user.address.city`      |
| **数组索引路径** | `a.0.b`            | 数组元素字段访问       | `contacts.0.name`        |
| **相对路径**     | `./field`          | 数组元素内部联动       | `./type`                 |
| **JSON Pointer** | `#/properties/...` | 跨层级联动依赖         | `#/properties/enableVip` |

**v3.0 变更说明**：
- 移除了"逻辑路径"和"物理路径"的概念
- 所有路径统一使用标准 `.` 分隔符
- flattenPath 字段的路径与普通嵌套字段完全相同

### 2.2 路径格式对比

```
Schema 定义                    表单数据                      联动配置
─────────────────────────────────────────────────────────────────────────
properties:                    {                             dependencies:
  user:                          user: {                       - './age'        (相对路径)
    properties:                    name: 'John',               - '#/properties/user/age' (JSON Pointer)
      name: { type: 'string' }     age: 25
      age: { type: 'number' }    }
                               }

字段路径: user.name            数据路径: user.name           依赖路径: ./age 或 #/properties/user/age
```

---

## 3. 表单数据路径

表单数据路径是最基础的路径格式，用于 react-hook-form 的字段注册和数据访问。

### 3.1 基本格式

使用点号（`.`）分隔嵌套层级：

```typescript
// 简单字段
'name'; // → formData.name

// 嵌套对象
'user.name'; // → formData.user.name
'user.address.city'; // → formData.user.address.city

// 数组元素
'contacts.0'; // → formData.contacts[0]
'contacts.0.name'; // → formData.contacts[0].name
'contacts.1.phone'; // → formData.contacts[1].phone

// 嵌套数组
'departments.0.employees.1.name'; // → formData.departments[0].employees[1].name
```

### 3.2 数组索引路径

数组元素使用数字索引：

```typescript
// 判断是否是数组元素路径
function isArrayElementPath(path: string): boolean {
  const parts = path.split('.');
  return parts.some(part => /^\d+$/.test(part));
}

// 示例
isArrayElementPath('contacts.0.name'); // true
isArrayElementPath('contacts.name'); // false
isArrayElementPath('items.2.details.0.value'); // true
```

### 3.3 提取数组信息

```typescript
// 从路径中提取数组信息
function extractArrayInfo(path: string) {
  // 'contacts.0.name' → { arrayPath: 'contacts', index: 0, fieldPath: 'name' }
  // 'departments.1.employees.2.name' → { arrayPath: 'departments', index: 1, fieldPath: 'employees.2.name' }
}
```

---

## 4. 联动依赖路径

联动依赖路径用于在 Schema 中配置字段间的依赖关系。系统支持两种格式：**相对路径**和 **JSON Pointer**。

### 4.1 相对路径（`./fieldName`）

**适用场景**：引用同一对象内的兄弟字段（同级字段）

**语法**：以 `./` 开头，后跟字段名

```typescript
// Schema 配置
{
  contacts: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['personal', 'work']
        },
        companyName: {
          type: 'string',
          ui: {
            linkages: [
              {
                type: 'visibility',
                dependencies: ['./type'],  // ✅ 相对路径：引用同级的 type 字段
                when: {
                  field: './type',
                  operator: '==',
                  value: 'work'
                }
              }
            ]
          }
        }
      }
    }
  }
}
```

**运行时解析**：

```typescript
// 当前字段路径: contacts.0.companyName
// 相对路径: ./type
// 解析结果: contacts.0.type

// 当前字段路径: contacts.1.companyName
// 相对路径: ./type
// 解析结果: contacts.1.type
```

**限制**：

- ✅ 只支持 `./fieldName` 格式
- ❌ 不支持 `../fieldName`（父级相对路径）
- ❌ 不支持 `../../fieldName`（祖父级相对路径）

### 4.2 JSON Pointer（`#/properties/...`）

**适用场景**：引用任意层级的字段（跨层级依赖）

**语法**：以 `#/` 开头，使用 `/properties/` 分隔对象层级，使用 `/items/` 表示数组元素

```typescript
// 基本格式
'#/properties/fieldName'; // 顶层字段
'#/properties/parent/properties/child'; // 嵌套字段
'#/properties/array/items/properties/field'; // 数组元素字段
```

**示例**：

```typescript
// 1. 引用顶层字段
{
  enableVip: { type: 'boolean' },
  contacts: {
    type: 'array',
    items: {
      properties: {
        vipLevel: {
          type: 'string',
          ui: {
            linkages: [
              {
                dependencies: ['#/properties/enableVip'],  // ✅ 引用顶层字段
                when: {
                  field: '#/properties/enableVip',
                  operator: '==',
                  value: true
                }
              }
            ]
          }
        }
      }
    }
  }
}

// 2. 引用父数组元素的字段
{
  departments: {
    type: 'array',
    items: {
      properties: {
        type: { type: 'string', enum: ['tech', 'sales'] },
        employees: {
          type: 'array',
          items: {
            properties: {
              techStack: {
                type: 'string',
                ui: {
                  linkages: [
                    {
                      // 引用父数组元素的 type 字段
                      dependencies: ['#/properties/departments/items/properties/type'],
                      when: {
                        field: '#/properties/departments/items/properties/type',
                        operator: '==',
                        value: 'tech'
                      }
                    }
                  ]
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

### 4.3 JSON Pointer 转换规则

| JSON Pointer                                  | 表单数据路径                                           | 说明         |
| --------------------------------------------- | ------------------------------------------------------ | ------------ |
| `#/properties/name`                           | `name`                                                 | 顶层字段     |
| `#/properties/user/properties/age`            | `user.age`                                             | 嵌套字段     |
| `#/properties/contacts/items/properties/name` | `contacts.name`（模板）<br>`contacts.0.name`（运行时） | 数组元素字段 |

**转换函数**：

```typescript
// JSON Pointer → 表单数据路径
function parseJsonPointer(pointer: string): string {
  // '#/properties/contacts/items/properties/type'
  // → 'contacts.type'

  const segments = pointer.slice(2).split('/');
  const logicalSegments = segments.filter(s => s !== 'properties' && s !== 'items');
  return logicalSegments.join('.');
}
```

### 4.4 路径格式选择指南

| 场景                     | 推荐格式     | 示例                                             |
| ------------------------ | ------------ | ------------------------------------------------ |
| 同一对象内的字段依赖     | 相对路径     | `./type`                                         |
| 数组元素内部字段依赖     | 相对路径     | `./status`                                       |
| 依赖顶层字段             | JSON Pointer | `#/properties/enableFeature`                     |
| 依赖父数组元素字段       | JSON Pointer | `#/properties/departments/items/properties/type` |
| 依赖整个数组（聚合计算） | JSON Pointer | `#/properties/items`                             |

---

## 5. 路径透明化

路径透明化（Field Path Flattening）用于解决深层嵌套参数显示冗余的问题。

### 5.1 核心概念（v3.0）

当 Schema 中某个对象字段设置了 `flattenPath: true`，该层级在 UI 上会被"跳过"（不显示 Card 容器和标题），但数据结构保持标准的嵌套格式。

**v3.0 重要变更**：
- flattenPath 字段会渲染 NestedFormWidget，但使用透明容器（无 Card、无标题）
- 字段路径使用标准 `.` 分隔符，与普通嵌套字段完全相同
- 数据结构保持标准嵌套格式，无需路径转换
- 移除了"逻辑路径"和"物理路径"的区分

```typescript
// Schema 定义
{
  group: {
    type: 'object',
    ui: { flattenPath: true },  // 透明化此层级
    properties: {
      category: {
        type: 'object',
        ui: { flattenPath: true },  // 透明化此层级
        properties: {
          contacts: {
            type: 'array',
            items: { /* ... */ }
          }
        }
      }
    }
  }
}

// 字段路径（v3.0）: group.category.contacts
// 数据结构: { group: { category: { contacts: [...] } } }
// UI 表现: contacts 字段直接显示，不显示 group 和 category 的 Card 容器
```

### 5.2 路径示例（v3.0）

在 v3.0 方案中，flattenPath 字段的路径与普通嵌套字段完全相同：

```typescript
// Schema 结构
region (flattenPath: true)
  └─ market (flattenPath: true)
      └─ contacts (array)
          └─ items[0]
              ├─ category (flattenPath: true)
              │   └─ group (flattenPath: true)
              │       └─ name (string)
              └─ auth (object)
                  └─ apiKey (string)

// 生成的字段路径（统一使用 . 分隔符）
'region.market.contacts'                    // flattenPath 字段
'region.market.contacts.0'                  // 数组索引
'region.market.contacts.0.category.group.name'  // 嵌套 flattenPath 字段
'region.market.contacts.0.auth.apiKey'      // 普通嵌套字段

// 数据结构（标准嵌套格式）
{
  region: {
    market: {
      contacts: [
        {
          category: {
            group: {
              name: 'xxx'
            }
          },
          auth: {
            apiKey: 'yyy'
          }
        }
      ]
    }
  }
}
```

### 5.3 flattenPrefix 功能

`flattenPrefix` 用于在路径透明化时，将父级字段的标题作为前缀添加到子字段的标题中：

```typescript
// Schema 定义
{
  service: {
    type: 'object',
    title: 'Service',
    ui: {
      flattenPath: true,
      flattenPrefix: true  // 启用标题前缀
    },
    properties: {
      auth: {
        type: 'object',
        title: 'Auth',
        ui: {
          flattenPath: true,
          flattenPrefix: true
        },
        properties: {
          username: { type: 'string', title: 'Username' },
          password: { type: 'string', title: 'Password' }
        }
      }
    }
  }
}

// 字段路径: service.auth.username, service.auth.password
// 显示标题: "Service - Auth - Username", "Service - Auth - Password"
// 数据结构: { service: { auth: { username: 'xxx', password: 'yyy' } } }
```

---

## 6. 数组场景的路径处理

数组是路径处理中最复杂的场景，涉及动态索引和模板路径的概念。

### 6.1 模板路径 vs 运行时路径

| 概念           | 定义                            | 示例                                 |
| -------------- | ------------------------------- | ------------------------------------ |
| **模板路径**   | Schema 解析时的路径（不含索引） | `contacts.name`                      |
| **运行时路径** | 实际数组元素的路径（含索引）    | `contacts.0.name`, `contacts.1.name` |

```typescript
// Schema 定义（模板）
{
  contacts: {
    type: 'array',
    items: {
      properties: {
        name: { type: 'string' },
        type: { type: 'string' }
      }
    }
  }
}

// 模板路径: contacts.name, contacts.type

// 运行时路径（假设有 3 个元素）:
// contacts.0.name, contacts.0.type
// contacts.1.name, contacts.1.type
// contacts.2.name, contacts.2.type
```

### 6.2 数组联动的路径解析

数组元素内部的联动配置使用模板路径定义，运行时动态解析为实际路径：

```typescript
// Schema 中的联动配置（模板）
{
  contacts: {
    items: {
      properties: {
        type: { type: 'string' },
        companyName: {
          ui: {
            linkages: [
              {
                dependencies: ['./type'],  // 模板：相对路径
                when: { field: './type', operator: '==', value: 'work' }
              }
            ]
          }
        }
      }
    }
  }
}

// 运行时解析
// 对于 contacts.0.companyName:
//   dependencies: ['contacts.0.type']
//   when.field: 'contacts.0.type'

// 对于 contacts.1.companyName:
//   dependencies: ['contacts.1.type']
//   when.field: 'contacts.1.type'
```

### 6.3 嵌套数组的路径

嵌套数组的路径包含多个索引：

```typescript
// Schema
{
  departments: {
    type: 'array',
    items: {
      properties: {
        name: { type: 'string' },
        employees: {
          type: 'array',
          items: {
            properties: {
              name: { type: 'string' },
              skills: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }
}

// 路径示例
'departments.0.name'                    // 第 1 个部门的名称
'departments.0.employees.0.name'        // 第 1 个部门的第 1 个员工的名称
'departments.1.employees.2.skills.0'    // 第 2 个部门的第 3 个员工的第 1 个技能
```

### 6.4 跨数组层级的依赖

子数组元素依赖父数组元素字段时，系统会自动匹配正确的索引：

```typescript
// 依赖配置
dependencies: ['#/properties/departments/items/properties/type'];

// 当前路径: departments.0.employees.1.techStack
// 解析结果: departments.0.type  // 自动匹配父数组索引 0

// 当前路径: departments.2.employees.0.techStack
// 解析结果: departments.2.type  // 自动匹配父数组索引 2
```

---

## 7. 路径转换工具

系统提供了多个工具类和函数用于路径处理。

### 7.1 PathResolver

用于 JSON Pointer 路径的解析和转换：

```typescript
import { PathResolver } from '@/utils/pathResolver';

// 解析 JSON Pointer 获取值
PathResolver.resolve('#/properties/user/age', { user: { age: 25 } });
// → 25

// 标准化路径
PathResolver.normalize('user.age');
// → '#/properties/user/age'

// JSON Pointer → 表单数据路径
PathResolver.toFieldPath('#/properties/user/age');
// → 'user.age'

// 获取嵌套值
PathResolver.getNestedValue({ user: { age: 25 } }, 'user.age');
// → 25
```

### 7.2 pathTransformer（v3.0 简化版）

在 v3.0 方案中，pathTransformer 已大幅简化，仅保留相对路径解析功能：

```typescript
import { resolveRelativePath } from '@/utils/pathTransformer';

// 解析相对路径
resolveRelativePath('./type', 'contacts.0.companyName');
// → 'contacts.0.type'
```

**v3.0 变更说明**：
- 移除了 PathTransformer 类和路径映射相关功能
- 移除了 `~~` 分隔符相关的工具函数
- 数据无需转换，保持标准嵌套格式

### 7.3 schemaLinkageParser（v3.0 简化版）

用于解析 Schema 中的联动配置：

```typescript
import {
  parseSchemaLinkages,
  transformToAbsolutePaths,
} from '@/utils/schemaLinkageParser';

// 解析 Schema
const { linkages } = parseSchemaLinkages(schema);

// 转换为绝对路径（用于嵌套表单）
transformToAbsolutePaths(linkages, 'contacts.0');
```

**v3.0 变更说明**：
- 移除了 pathMappings 返回值
- 移除了 physicalToLogicalPath 和 logicalToPhysicalPath 函数
- 所有路径统一使用标准 `.` 分隔符

### 7.4 arrayLinkageHelper

用于数组联动场景的路径处理：

```typescript
import {
  isArrayElementPath,
  extractArrayInfo,
  parseJsonPointer,
  resolveRelativePath,
  resolveDependencyPath,
  resolveArrayElementLinkage,
} from '@/utils/arrayLinkageHelper';

// 判断是否是数组元素路径
isArrayElementPath('contacts.0.name'); // true

// 提取数组信息
extractArrayInfo('contacts.0.name');
// → { arrayPath: 'contacts', index: 0, fieldPath: 'name' }

// 解析 JSON Pointer
parseJsonPointer('#/properties/contacts/items/properties/type');
// → 'contacts.type'

// 解析相对路径
resolveRelativePath('./type', 'contacts.0.companyName');
// → 'contacts.0.type'

// 解析依赖路径（核心函数）
resolveDependencyPath({ depPath: './type', currentPath: 'contacts.0.companyName', schema });
// → 'contacts.0.type'

resolveDependencyPath({
  depPath: '#/properties/enableVip',
  currentPath: 'contacts.0.vipLevel',
  schema,
});
// → 'enableVip'
```

---

## 8. 完整示例

### 8.1 示例 1：简单嵌套表单

```typescript
// Schema
const schema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        name: { type: 'string', title: '姓名' },
        age: { type: 'number', title: '年龄' },
        isAdult: {
          type: 'boolean',
          title: '是否成年',
          ui: {
            linkages: [
              {
                type: 'value',
                dependencies: ['./age'], // 相对路径
                fulfill: { function: 'checkAdult' },
              }
            ],
          },
        },
      },
    },
  },
};

// 表单数据路径
// user.name → formData.user.name
// user.age → formData.user.age
// user.isAdult → formData.user.isAdult

// 联动解析
// 当前路径: user.isAdult
// 依赖路径: ./age → user.age
```

### 8.2 示例 2：数组联动

```typescript
// Schema
const schema = {
  type: 'object',
  properties: {
    enableVip: { type: 'boolean', title: '启用 VIP' },
    contacts: {
      type: 'array',
      title: '联系人',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['personal', 'work'],
            title: '类型',
          },
          companyName: {
            type: 'string',
            title: '公司名称',
            ui: {
              linkages: [
                {
                  type: 'visibility',
                  dependencies: ['./type'], // 相对路径：同级字段
                  when: { field: './type', operator: '==', value: 'work' },
                }
              ],
            },
          },
          vipLevel: {
            type: 'string',
            title: 'VIP 等级',
            ui: {
              linkages: [
                {
                  type: 'visibility',
                  dependencies: ['#/properties/enableVip'], // JSON Pointer：顶层字段
                  when: { field: '#/properties/enableVip', operator: '==', value: true },
                }
              ],
            },
          },
        },
      },
    },
  },
};

// 运行时路径解析（假设有 2 个联系人）

// contacts.0.companyName 的联动:
//   dependencies: ['contacts.0.type']
//   when.field: 'contacts.0.type'

// contacts.1.companyName 的联动:
//   dependencies: ['contacts.1.type']
//   when.field: 'contacts.1.type'

// contacts.0.vipLevel 的联动:
//   dependencies: ['enableVip']
//   when.field: 'enableVip'
```

### 8.3 示例 3：复杂的路径透明化 + 数组 + 联动（v3.0）

这是一个综合示例，展示了路径透明化、数组字段和联动配置的组合使用。

```typescript
// Schema
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
      ui: {
        flattenPath: true,
        flattenPrefix: true,
      },
      properties: {
        market: {
          type: 'object',
          title: '市场',
          ui: {
            flattenPath: true,
          },
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
                    ui: {
                      flattenPath: true,
                      flattenPrefix: true,
                    },
                    properties: {
                      group: {
                        type: 'object',
                        title: '分组',
                        ui: {
                          flattenPath: true,
                          flattenPrefix: true,
                        },
                        properties: {
                          type: {
                            type: 'string',
                            title: '类型',
                            enum: ['vip', 'normal'],
                          },
                          name: { type: 'string', title: '名称' },
                          vipLevel: {
                            type: 'string',
                            title: 'VIP等级',
                            ui: {
                              linkages: [
                                {
                                  type: 'visibility',
                                  dependencies: ['./type'],
                                  when: { field: './type', operator: '==', value: 'vip' },
                                }
                              ],
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
    },
  },
};
```

**生成的字段路径（v3.0 - 统一使用 . 分隔符）**：

```typescript
// 顶层字段
'enableRegion'

// 数组字段（region 和 market 都是 flattenPath）
'region.market.contacts'

// 数组元素内部字段（假设索引为 0）
'region.market.contacts.0.auth.apiKey'
'region.market.contacts.0.auth.apiSecret'
'region.market.contacts.0.category.group.type'
'region.market.contacts.0.category.group.name'
'region.market.contacts.0.category.group.vipLevel'
```

**数据结构（标准嵌套格式）**：

```typescript
{
  enableRegion: true,
  region: {
    market: {
      contacts: [
        {
          auth: {
            apiKey: 'xxx',
            apiSecret: 'yyy'
          },
          category: {
            group: {
              type: 'vip',
              name: 'VIP Group',
              vipLevel: 'Gold'
            }
          }
        }
      ]
    }
  }
}
```

**联动路径解析**（运行时）：

```typescript
// vipLevel 字段的联动配置
// 模板路径: './type'
// 当前字段: 'region.market.contacts.0.category.group.vipLevel'
// 解析结果: 'region.market.contacts.0.category.group.type'
```

### 8.4 示例 4：简单的路径透明化（v3.0）

```typescript
// Schema
const schema = {
  type: 'object',
  properties: {
    config: {
      type: 'object',
      ui: { flattenPath: true },  // 跳过此层级
      properties: {
        auth: {
          type: 'object',
          ui: { flattenPath: true },  // 跳过此层级
          properties: {
            apiKey: { type: 'string', title: 'API Key' },
            apiSecret: { type: 'string', title: 'API Secret' }
          }
        }
      }
    }
  }
};

// 字段路径（v3.0）: config.auth.apiKey, config.auth.apiSecret
// 数据结构: { config: { auth: { apiKey: 'xxx', apiSecret: 'yyy' } } }
// UI 表现: apiKey 和 apiSecret 直接显示，不显示 config 和 auth 的 Card 容器
```

---

## 9. 常见问题

### 9.1 为什么不支持 `../` 相对路径？

**原因**：

1. 语义不清晰：在多层嵌套中，`../` 的含义容易混淆
2. 维护困难：Schema 结构变化时，相对路径需要同步修改
3. JSON Pointer 更强大：可以引用任意层级的字段

**解决方案**：使用 JSON Pointer 替代

```typescript
// ❌ 不支持
dependencies: ['../type'];

// ✅ 使用 JSON Pointer
dependencies: ['#/properties/departments/items/properties/type'];
```

### 9.2 路径透明化时联动不生效？（v3.0 已解决）

**v3.0 说明**：在 v3.0 方案中，所有路径统一使用标准 `.` 分隔符，不再有"逻辑路径"和"物理路径"的区分，因此不会出现路径格式不匹配的问题。

```typescript
// v3.0 方案：统一使用标准路径
// Schema 中 group.category 设置了 flattenPath: true

// ✅ 正确：使用标准路径
dependencies: ['group.category.enableFeature'];

// ✅ 或使用 JSON Pointer
dependencies: ['#/properties/group/properties/category/properties/enableFeature'];
```

### 9.3 数组元素联动只对第一个元素生效？

**可能原因**：使用了固定索引而非相对路径

**解决方案**：使用相对路径 `./`

```typescript
// ❌ 错误：固定索引
dependencies: ['contacts.0.type'];

// ✅ 正确：相对路径
dependencies: ['./type'];
```

### 9.4 如何调试路径问题？

**方法 1**：打印联动配置（v3.0）

```typescript
const { linkages } = parseSchemaLinkages(schema);
console.log('联动配置:', linkages);
```

**方法 2**：检查运行时解析结果

```typescript
const resolved = resolveDependencyPath({ depPath, currentPath, schema });
console.log(`${depPath} → ${resolved}`);
```

**v3.0 变更说明**：
- 移除了 pathMappings 相关的调试方法
- 所有路径统一使用标准 `.` 分隔符，调试更简单

---

## 附录：路径相关文件索引

| 文件                                              | 职责                                            |
| ------------------------------------------------- | ----------------------------------------------- |
| `src/utils/pathResolver.ts`                       | JSON Pointer 解析和转换                         |
| `src/utils/pathTransformer.ts`                    | 路径透明化数据转换                              |
| `src/utils/schemaLinkageParser.ts`                | Schema 联动配置解析、路径映射、统一路径生成函数 |
| `src/utils/arrayLinkageHelper.ts`                 | 数组联动路径处理                                |
| `src/components/DynamicForm/core/SchemaParser.ts` | Schema 解析、字段配置生成、逻辑路径计算         |
| `src/hooks/useLinkageManager.ts`                  | 联动状态管理                                    |
| `src/hooks/useArrayLinkageManager.ts`             | 数组联动状态管理                                |

---

**创建日期**: 2025-12-28
**最后更新**: 2026-01-10
**版本**: 2.0 (v3.0 方案)
**文档状态**: 已更新至 v3.0 方案

**更新内容**:

### v2.0 (2026-01-10) - v3.0 方案重大更新

- **重大变更**：文档已全面更新以反映 v3.0 路径透明化方案
- 移除了"逻辑路径"和"物理路径"的概念
- 统一使用标准 `.` 分隔符，移除了 `~~` 分隔符相关内容
- 更新了所有示例代码以使用标准路径格式
- 简化了路径转换工具的说明（移除了 PathTransformer 类）
- 更新了 flattenPath 的实现说明（透明容器方案）
- 新增了 flattenPrefix 功能的说明
- 更新了常见问题解答以反映 v3.0 的变化

### v1.3 (2025-12-29)

- 新增 8.3 节：复杂的路径透明化 + 数组 + 联动综合示例
- 添加了完整的 Schema 配置和逻辑路径解析示例
- 详细说明了混合使用 flattenPath 和普通对象时的路径生成规则

### v1.2 (2025-12-29)

- 新增 5.2 节：详细说明逻辑路径生成规则
- 更新了逻辑路径示例，包含数组元素内部 flattenPath 的情况
- 新增 SchemaParser.buildFieldPath 方法的说明
- 更新了路径相关文件索引，添加 SchemaParser.ts

### v1.1 (2025-12-29)

- 更新了逻辑路径示例，使用 `~~` 分隔符
- 新增统一路径生成函数 `buildLogicalPath`、`buildPhysicalPath`、`isInFlattenPathChain` 的说明
- 更新了 schemaLinkageParser 工具函数列表
