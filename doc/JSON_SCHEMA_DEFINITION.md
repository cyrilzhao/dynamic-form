JSON Schema 是一种基于 JSON 格式的声明性语言，用于描述、验证 JSON 数据的结构和约束。它在 API 测试、表单生成、配置文件验证等场景中非常通用。

以下是标准 JSON Schema 中核心字段的含义、用法及使用场景的详细分类解释：

---

### 1. 元数据关键字 (Meta-schema)

这些字段用于描述 Schema 本身，而不是被验证的数据。

| 字段              | 含义                                                  | 使用场景                                                  |
| :---------------- | :---------------------------------------------------- | :-------------------------------------------------------- |
| **`$schema`**     | 声明使用的 JSON Schema 版本（如 draft-07, 2020-12）。 | **版本控制**：告诉验证器用哪套规则来解析这个文件。        |
| **`$id`**         | Schema 的唯一标识符（通常是一个 URI）。               | **引用解析**：当其他 Schema 需要引用此 Schema 时使用。    |
| **`title`**       | Schema 的简短名称。                                   | **文档生成**：用于生成 API 文档的标题或前端表单的 Label。 |
| **`description`** | 详细说明。                                            | **文档/提示**：用于生成 Tooltip 或帮助文本。              |
| **`default`**     | 默认值。                                              | **表单填充**：如果数据缺失，前端可以使用此值预填充。      |
| **`examples`**    | 示例数据列表。                                        | **Mock 数据**：用于生成模拟数据或展示示例。               |

---

### 2. 通用验证关键字

适用于任何类型的字段。

| 字段        | 含义                                                                                        | 使用场景                                                          |
| :---------- | :------------------------------------------------------------------------------------------ | :---------------------------------------------------------------- |
| **`type`**  | 指定数据类型。可选值：`string`, `number`, `integer`, `object`, `array`, `boolean`, `null`。 | **基础类型检查**：确保传进来的是数字而不是字符串。                |
| **`enum`**  | 枚举，值必须是列表中的一个。                                                                | **下拉菜单**：限制状态（如 `["active", "inactive"]`）或国家代码。 |
| **`const`** | 常量，值必须完全匹配。                                                                      | **固定参数**：如协议版本号必须是 `v1`。                           |

---

### 3. 字符串 (String) 相关

当 `type: "string"` 时使用的约束。

| 字段                              | 含义                                                                    | 使用场景                                                         |
| :-------------------------------- | :---------------------------------------------------------------------- | :--------------------------------------------------------------- |
| **`minLength`** / **`maxLength`** | 最小/最大长度。                                                         | **输入限制**：用户名长度限制（如 6-20 字符）。                   |
| **`pattern`**                     | 正则表达式。                                                            | **格式校验**：手机号、身份证号、自定义编码规则。                 |
| **`format`**                      | 预定义的语义格式。常见值：`date-time`, `email`, `ipv4`, `uri`, `uuid`。 | **语义校验**：验证是否为合法的邮箱地址或日期时间，无需手写正则。 |

---

### 4. 数值 (Number/Integer) 相关

当 `type: "number"` 或 `"integer"` 时使用的约束。

| 字段                                            | 含义                        | 使用场景                                                    |
| :---------------------------------------------- | :-------------------------- | :---------------------------------------------------------- |
| **`minimum`** / **`maximum`**                   | 最小值/最大值（包含边界）。 | **范围限制**：年龄必须在 0 到 120 之间。                    |
| **`exclusiveMinimum`** / **`exclusiveMaximum`** | 不包含边界的极值。          | **数学区间**：如 `x > 0`。                                  |
| **`multipleOf`**                                | 必须是该值的倍数。          | **精度控制**：货币金额（0.01 的倍数）或时间步长（15分钟）。 |

---

### 5. 对象 (Object) 相关

当 `type: "object"` 时使用的约束，这是定义复杂结构的核心。

| 字段                                        | 含义                                                      | 使用场景                                                               |
| :------------------------------------------ | :-------------------------------------------------------- | :--------------------------------------------------------------------- |
| **`properties`**                            | 定义对象中每个字段的 Schema。                             | **结构定义**：定义 `user` 对象包含 `name` 和 `age`。                   |
| **`required`**                              | 必须存在的字段名列表（数组）。                            | **必填项检查**：注册时 `email` 和 `password` 必填。                    |
| **`additionalProperties`**                  | 布尔值或 Schema。若为 `false`，则不允许出现未定义的字段。 | **严格模式**：防止 API 接收未知参数（通常设为 false 以保证数据纯净）。 |
| **`patternProperties`**                     | 使用正则匹配属性名。                                      | **动态键名**：如 CSS 类名验证，或键名是 UUID 的字典结构。              |
| **`minProperties`** / **`maxProperties`**   | 属性数量限制。                                            | **容量限制**：限制上传的元数据标签数量。                               |
| **`dependencies`** (或 `dependentRequired`) | 字段间的依赖关系。                                        | **逻辑依赖**：如果填了 `credit_card`，则必须填 `cvv`。                 |

---

### 6. 数组 (Array) 相关

当 `type: "array"` 时使用的约束。

| 字段                            | 含义                                                                           | 使用场景                                                               |
| :------------------------------ | :----------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| **`items`**                     | 定义数组内元素的 Schema。可以是单个 Schema（所有元素相同）或数组（元组验证）。 | **列表定义**：定义一个包含 User 对象的列表。                           |
| **`minItems`** / **`maxItems`** | 数组长度限制。                                                                 | **数量限制**：购物车至少有 1 个商品，最多 100 个。                     |
| **`uniqueItems`**               | 布尔值，是否要求元素唯一。                                                     | **去重**：如标签（Tags）列表，不能包含重复标签。                       |
| **`contains`**                  | 数组中至少有一个元素匹配此 Schema。                                            | **存在性检查**：由管理员列表组成的数组中，必须包含至少一个 root 用户。 |

---

### 7. 逻辑组合与重用 (Logic & Reusability)

用于构建复杂的验证逻辑。

| 字段                             | 含义                                          | 使用场景                                                                           |
| :------------------------------- | :-------------------------------------------- | :--------------------------------------------------------------------------------- |
| **`$ref`**                       | 引用定义好的 Schema 片段。                    | **代码复用**：在多个地方引用同一个 Address 定义，减少重复。                        |
| **`definitions`** (或 `$defs`)   | 存放可复用 Schema 的容器，不会直接参与验证。  | **组件库**：定义 `address`, `user` 等基础模型供 `$ref` 调用。                      |
| **`allOf`**                      | 必须满足列表中的**所有** Schema（AND 逻辑）。 | **继承/组合**：验证数据既要是 Object，又要包含特定字段（常用于组合多个模型）。     |
| **`anyOf`**                      | 满足列表中**至少一个** Schema（OR 逻辑）。    | **多类型兼容**：字段既可以是字符串，也可以是数字（如 ID）。                        |
| **`oneOf`**                      | 满足列表中**恰好一个** Schema（XOR 逻辑）。   | **互斥逻辑**：支付方式只能是“信用卡”或“支付宝”结构中的一种，不能混用。             |
| **`not`**                        | 不能匹配该 Schema。                           | **黑名单**：字段类型不能是 String。                                                |
| **`if`**, **`then`**, **`else`** | 条件验证。                                    | **动态验证**：如果 `country` 是 "US"，则 `zipcode` 必须是 5 位数字；否则是字符串。 |

---

### 综合示例

下面是一个包含上述多种字段的 User 对象 Schema 示例：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://example.com/user.schema.json",
  "title": "用户",
  "description": "用户注册信息的验证规则",
  "type": "object",
  "required": ["id", "username", "email"],
  "properties": {
    "id": {
      "type": "integer",
      "minimum": 1
    },
    "username": {
      "type": "string",
      "minLength": 4,
      "maxLength": 20,
      "pattern": "^[a-zA-Z0-9_]+$"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "role": {
      "type": "string",
      "enum": ["admin", "editor", "viewer"],
      "default": "viewer"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "uniqueItems": true
    },
    "contact_info": {
      "$ref": "#/definitions/address"
    }
  },
  "additionalProperties": false,
  "definitions": {
    "address": {
      "type": "object",
      "properties": {
        "city": { "type": "string" },
        "street": { "type": "string" }
      }
    }
  }
}
```

### 总结

- **基础字段** (`type`, `properties`, `required`)：决定了 JSON 的骨架。
- **约束字段** (`minLength`, `maximum`, `pattern`)：决定了数据的合法性范围。
- **逻辑字段** (`oneOf`, `$ref`, `if`)：赋予了 Schema 处理复杂业务逻辑和复用代码的能力。

---

## 基础类型详解

### 字符串类型 (string)

字符串类型用于表示文本数据，支持丰富的验证规则。

**基础示例**：

```json
{
  "type": "string",
  "title": "用户名",
  "description": "请输入用户名",
  "minLength": 2,
  "maxLength": 20,
  "pattern": "^[a-zA-Z0-9_]+$",
  "default": "",
  "examples": ["john_doe", "user123"]
}
```

**支持的验证规则**：

- `minLength`: 最小长度
- `maxLength`: 最大长度
- `pattern`: 正则表达式
- `format`: 预定义格式（email, uri, date-time 等）
- `enum`: 枚举值

**常用格式 (format)**：

| 格式值 | 说明 | 示例 |
|--------|------|------|
| `email` | 邮箱地址 | `user@example.com` |
| `uri` | URI 地址 | `https://example.com` |
| `date` | 日期 | `2024-01-01` |
| `date-time` | 日期时间 | `2024-01-01T12:00:00Z` |
| `time` | 时间 | `12:00:00` |
| `ipv4` | IPv4 地址 | `192.168.1.1` |
| `ipv6` | IPv6 地址 | `2001:0db8::1` |
| `uuid` | UUID | `550e8400-e29b-41d4-a716-446655440000` |

### 数字类型 (number/integer)

数字类型用于表示数值数据，`integer` 要求整数，`number` 允许小数。

**基础示例**：

```json
{
  "type": "integer",
  "title": "年龄",
  "minimum": 0,
  "maximum": 120,
  "multipleOf": 1,
  "default": 18
}
```

**支持的验证规则**：

- `minimum`: 最小值（包含边界）
- `maximum`: 最大值（包含边界）
- `exclusiveMinimum`: 排他最小值（不包含边界）
- `exclusiveMaximum`: 排他最大值（不包含边界）
- `multipleOf`: 必须是该值的倍数

**示例：价格字段（保留两位小数）**：

```json
{
  "type": "number",
  "title": "价格",
  "minimum": 0.01,
  "maximum": 99999.99,
  "multipleOf": 0.01
}
```

### 布尔类型 (boolean)

布尔类型用于表示真/假值。

**基础示例**：

```json
{
  "type": "boolean",
  "title": "是否同意协议",
  "default": false
}
```

**常用场景**：

- 开关选项
- 同意/不同意
- 启用/禁用功能

### 数组类型 (array)

数组类型用于表示列表数据，可以包含相同类型或不同类型的元素。

**基础示例**：

```json
{
  "type": "array",
  "title": "标签列表",
  "items": {
    "type": "string"
  },
  "minItems": 1,
  "maxItems": 10,
  "uniqueItems": true
}
```

**支持的验证规则**：

- `items`: 数组项的 schema 定义
- `minItems`: 最小项数
- `maxItems`: 最大项数
- `uniqueItems`: 是否要求唯一值
- `contains`: 数组中至少有一个元素匹配此 Schema

**枚举数组示例**：

```json
{
  "type": "array",
  "title": "兴趣爱好",
  "items": {
    "type": "string",
    "enum": ["reading", "sports", "music", "travel"],
    "enumNames": ["阅读", "运动", "音乐", "旅行"]
  },
  "uniqueItems": true
}
```

**对象数组示例**：

```json
{
  "type": "array",
  "title": "联系人列表",
  "items": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "title": "姓名" },
      "phone": { "type": "string", "title": "电话" },
      "email": { "type": "string", "title": "邮箱", "format": "email" }
    },
    "required": ["name", "phone"]
  },
  "minItems": 1
}
```

### 对象类型 (object)

对象类型用于表示结构化数据，可以包含多个属性。

**基础示例**：

```json
{
  "type": "object",
  "title": "地址信息",
  "properties": {
    "province": { "type": "string", "title": "省份" },
    "city": { "type": "string", "title": "城市" },
    "detail": { "type": "string", "title": "详细地址" }
  },
  "required": ["province", "city"],
  "additionalProperties": false
}
```

**支持的验证规则**：

- `properties`: 定义对象中每个字段的 Schema
- `required`: 必须存在的字段名列表
- `additionalProperties`: 是否允许未定义的字段
- `patternProperties`: 使用正则匹配属性名
- `minProperties`: 最小属性数量
- `maxProperties`: 最大属性数量
- `dependencies`: 字段间的依赖关系

---

## 条件验证机制

JSON Schema 提供了多种条件验证机制，用于定义"在什么条件下，数据需要满足什么验证规则"。

> **重要说明**：条件验证属于 **JSON Schema 标准的数据验证机制**，用于在提交时校验数据的合法性。这不是 UI 联动逻辑！

### dependencies（字段依赖）

`dependencies` 用于表达"当某个字段存在或有特定值时，其他字段的约束条件"。

#### 简单依赖（数组形式）

简单依赖使用数组形式，只能表达"当字段 A 有值时，数据提交时必须同时包含字段 B、C、D... 的值"。

**示例：信用卡依赖账单地址**

```json
{
  "type": "object",
  "properties": {
    "creditCard": { "type": "string", "title": "信用卡号" },
    "billingAddress": { "type": "string", "title": "账单地址" }
  },
  "dependencies": {
    "creditCard": ["billingAddress"]
  }
}
```

**含义**：当 `creditCard` 有值时，提交数据时必须同时校验 `billingAddress` 的必填状态。

**示例 2：多个依赖字段**

```json
{
  "type": "object",
  "properties": {
    "enableNotification": {
      "type": "boolean",
      "title": "启用通知"
    },
    "email": {
      "type": "string",
      "title": "邮箱"
    },
    "phone": {
      "type": "string",
      "title": "手机号"
    }
  },
  "dependencies": {
    "enableNotification": ["email", "phone"]
  }
}
```

**含义**：当 `enableNotification` 有值时，提交数据必须同时包含 `email` 和 `phone` 的值。

**示例 3：多个字段的依赖关系**

```json
{
  "type": "object",
  "properties": {
    "firstName": { "type": "string", "title": "名" },
    "lastName": { "type": "string", "title": "姓" },
    "middleName": { "type": "string", "title": "中间名" }
  },
  "dependencies": {
    "firstName": ["lastName"],
    "lastName": ["firstName"]
  }
}
```

**含义**：`firstName` 和 `lastName` 互相依赖，提交时如果其中一个有值，另一个也必须有值。

#### Schema 依赖（对象形式）

Schema 依赖使用对象形式，可以配置任意 JSON Schema 验证规则，包括必填、长度、格式、数值范围等。

**示例：支付方式依赖**

```json
{
  "type": "object",
  "properties": {
    "paymentMethod": {
      "type": "string",
      "title": "支付方式",
      "enum": ["credit_card", "bank_transfer", "alipay"]
    },
    "cardNumber": { "type": "string", "title": "信用卡号" },
    "bankAccount": { "type": "string", "title": "银行账号" },
    "alipayAccount": { "type": "string", "title": "支付宝账号" }
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
        },
        {
          "properties": {
            "paymentMethod": { "const": "alipay" },
            "alipayAccount": { "format": "email" }
          },
          "required": ["alipayAccount"]
        }
      ]
    }
  }
}
```

**含义**：根据选择的支付方式，对应的账号字段必填且需满足特定格式要求。

**示例 2：数值范围校验 - 会员等级依赖**

```json
{
  "type": "object",
  "properties": {
    "membershipLevel": {
      "type": "string",
      "title": "会员等级",
      "enum": ["basic", "premium", "vip"]
    },
    "discountRate": {
      "type": "number",
      "title": "折扣率"
    }
  },
  "dependencies": {
    "membershipLevel": {
      "oneOf": [
        {
          "properties": {
            "membershipLevel": { "const": "basic" },
            "discountRate": {
              "minimum": 0.9,
              "maximum": 0.95
            }
          },
          "required": ["discountRate"]
        },
        {
          "properties": {
            "membershipLevel": { "const": "premium" },
            "discountRate": {
              "minimum": 0.8,
              "maximum": 0.9
            }
          },
          "required": ["discountRate"]
        },
        {
          "properties": {
            "membershipLevel": { "const": "vip" },
            "discountRate": {
              "minimum": 0.5,
              "maximum": 0.8
            }
          },
          "required": ["discountRate"]
        }
      ]
    }
  }
}
```

**含义**：根据会员等级，折扣率必须在对应的范围内（基础会员 90-95%，高级会员 80-90%，VIP 会员 50-80%）。

**示例 3：多字段联合校验 - 发票信息依赖**

```json
{
  "type": "object",
  "properties": {
    "needInvoice": {
      "type": "boolean",
      "title": "是否需要发票"
    },
    "invoiceType": {
      "type": "string",
      "title": "发票类型",
      "enum": ["personal", "company"]
    },
    "invoiceTitle": { "type": "string", "title": "发票抬头" },
    "taxNumber": { "type": "string", "title": "税号" }
  },
  "dependencies": {
    "needInvoice": {
      "oneOf": [
        {
          "properties": {
            "needInvoice": { "const": true },
            "invoiceTitle": { "minLength": 2, "maxLength": 100 }
          },
          "required": ["invoiceType", "invoiceTitle"]
        }
      ]
    },
    "invoiceType": {
      "oneOf": [
        {
          "properties": {
            "invoiceType": { "const": "company" },
            "taxNumber": {
              "pattern": "^[A-Z0-9]{15,20}$"
            }
          },
          "required": ["taxNumber"]
        }
      ]
    }
  }
}
```

**含义**：
- 当 `needInvoice` 为 `true` 时，必须填写发票类型和发票抬头（2-100字符）
- 当 `invoiceType` 为 `company` 时，必须填写税号（15-20位字母或数字）

**示例 4：嵌套对象校验 - 配送信息依赖**

```json
{
  "type": "object",
  "properties": {
    "deliveryMethod": {
      "type": "string",
      "title": "配送方式",
      "enum": ["express", "self_pickup"]
    },
    "shippingAddress": {
      "type": "object",
      "title": "配送地址",
      "properties": {
        "province": { "type": "string", "title": "省份" },
        "city": { "type": "string", "title": "城市" },
        "detail": { "type": "string", "title": "详细地址" }
      }
    },
    "pickupStore": { "type": "string", "title": "自提门店" }
  },
  "dependencies": {
    "deliveryMethod": {
      "oneOf": [
        {
          "properties": {
            "deliveryMethod": { "const": "express" },
            "shippingAddress": {
              "type": "object",
              "properties": {
                "province": { "minLength": 2 },
                "city": { "minLength": 2 },
                "detail": { "minLength": 5, "maxLength": 200 }
              },
              "required": ["province", "city", "detail"]
            }
          },
          "required": ["shippingAddress"]
        },
        {
          "properties": {
            "deliveryMethod": { "const": "self_pickup" },
            "pickupStore": {
              "minLength": 1
            }
          },
          "required": ["pickupStore"]
        }
      ]
    }
  }
}
```

**含义**：
- 当选择快递配送时，必须填写完整的配送地址（省份、城市至少2字符，详细地址5-200字符）
- 当选择自提时，必须选择自提门店

#### Schema 依赖的结构解析

为了更好地理解 Schema 依赖的工作原理，我们以示例 3（发票信息依赖）为例进行详细解析：

**整体结构**：

```json
"dependencies": {
  "needInvoice": {  // ← 第一层：触发字段
    "oneOf": [      // ← 第二层：逻辑组合
      {             // ← 第三层：具体的校验规则
        "properties": { ... },
        "required": [ ... ]
      }
    ]
  }
}
```

**第一层：触发字段**

```json
"dependencies": {
  "needInvoice": { ... }
}
```

**含义**：当表单数据中存在 `needInvoice` 字段（无论值是什么）时，就会触发内部的校验规则。

**第二层：oneOf 逻辑组合**

```json
"needInvoice": {
  "oneOf": [ ... ]
}
```

**含义**：表单数据必须**有且仅有一个** `oneOf` 数组中的 schema 被满足。

> **为什么需要 oneOf？**
>
> - 这是为了处理"当 `needInvoice` 为 `true` 时才校验"的场景
> - 如果 `needInvoice` 为 `false` 或不存在，这个 schema 就不会被满足，校验会通过
> - 如果不使用 `oneOf`，只要 `needInvoice` 字段存在（无论值是什么），校验规则都会生效

**第三层：具体的校验规则**

```json
{
  "properties": {
    "needInvoice": { "const": true },
    "invoiceTitle": { "minLength": 2, "maxLength": 100 }
  },
  "required": ["invoiceType", "invoiceTitle"]
}
```

这是一个完整的 JSON Schema 对象，包含两个部分：

1. **`properties` - 字段约束**
   - `needInvoice: { "const": true }` - 这是**触发条件**，只有当 `needInvoice` 的值为 `true` 时，这个 schema 才会被满足
   - `invoiceTitle: { "minLength": 2, "maxLength": 100 }` - 这是**验证规则**，对 `invoiceTitle` 字段的长度进行约束

2. **`required` - 必填字段**
   - 当这个 schema 生效时（即 `needInvoice` 为 `true`），`invoiceType` 和 `invoiceTitle` 字段必须存在且有值

**完整的校验逻辑**

下表展示了不同情况下的校验结果：

| needInvoice 值 | invoiceType 值 | invoiceTitle 值 | 校验结果 | 原因 |
|---------------|---------------|----------------|---------|------|
| `true` | 未填写 | 未填写 | ❌ 失败 | `required` 要求必填 |
| `true` | `"personal"` | `"A"` (1字符) | ❌ 失败 | 不满足 `minLength: 2` |
| `true` | `"personal"` | `"AB"` (2字符) | ✅ 通过 | 满足所有条件 |
| `true` | `"personal"` | 超过100字符 | ❌ 失败 | 超过 `maxLength: 100` |
| `false` | 未填写 | 未填写 | ✅ 通过 | `needInvoice` 不为 `true`，依赖不生效 |
| 未填写 | 未填写 | 未填写 | ✅ 通过 | `needInvoice` 不存在，依赖不生效 |

#### Schema 依赖的关键要点

1. **触发字段**：`dependencies` 的键（如 `needInvoice`）是触发字段，当该字段存在时触发校验
2. **oneOf 的作用**：用于实现"只在特定值时生效"的逻辑，配合 `const` 实现条件判断
3. **properties 中的 const**：定义触发条件（如 `needInvoice: { "const": true }`）
4. **properties 中的其他字段**：定义验证规则（如长度、格式、范围等）
5. **required 数组**：定义在条件满足时哪些字段必填
6. **验证规则合并**：`dependencies` 中的验证规则会与基础 schema 定义合并
7. **多层级依赖**：可以同时定义多个字段的依赖关系，它们会独立生效
8. **嵌套对象支持**：可以对嵌套对象的内部字段进行校验

**适用场景**：这种模式非常适合"当某个开关字段为特定值时，其他字段才需要校验"的场景。

### if/then/else（条件分支）

`if/then/else` 是 JSON Schema Draft-07+ 引入的条件验证关键字，提供了更清晰的条件分支语义。

**示例：根据国家选择证件类型**

```json
{
  "type": "object",
  "properties": {
    "country": {
      "type": "string",
      "enum": ["china", "usa"]
    },
    "idCard": { "type": "string", "title": "身份证号" },
    "ssn": { "type": "string", "title": "社会安全号" }
  },
  "if": {
    "properties": { "country": { "const": "china" } }
  },
  "then": {
    "required": ["idCard"]
  },
  "else": {
    "required": ["ssn"]
  }
}
```

**含义**：如果国家是中国，身份证号必填；否则社会安全号必填。

**示例 2：格式校验 - 根据年龄段校验手机号格式**

```json
{
  "type": "object",
  "properties": {
    "ageGroup": {
      "type": "string",
      "title": "年龄段",
      "enum": ["child", "adult"]
    },
    "phone": {
      "type": "string",
      "title": "联系电话"
    }
  },
  "if": {
    "properties": { "ageGroup": { "const": "child" } }
  },
  "then": {
    "properties": {
      "phone": {
        "pattern": "^1[3-9]\\d{9}$",
        "description": "儿童需填写监护人手机号"
      }
    },
    "required": ["phone"]
  },
  "else": {
    "properties": {
      "phone": {
        "pattern": "^(1[3-9]\\d{9}|\\d{3,4}-\\d{7,8})$",
        "description": "成人可填写手机号或座机号"
      }
    }
  }
}
```

**含义**：儿童必须填写监护人手机号（11位），成人可以填写手机号或座机号。

**示例 3：数值范围校验 - 根据会员类型限制购买数量**

```json
{
  "type": "object",
  "properties": {
    "memberType": {
      "type": "string",
      "title": "会员类型",
      "enum": ["regular", "vip"]
    },
    "quantity": {
      "type": "integer",
      "title": "购买数量"
    }
  },
  "if": {
    "properties": { "memberType": { "const": "vip" } }
  },
  "then": {
    "properties": {
      "quantity": {
        "minimum": 1,
        "maximum": 100
      }
    }
  },
  "else": {
    "properties": {
      "quantity": {
        "minimum": 1,
        "maximum": 10
      }
    }
  }
}
```

**含义**：VIP 会员可购买 1-100 件，普通会员只能购买 1-10 件。

**示例 4：枚举值限制 - 根据用户角色限制可选操作**

```json
{
  "type": "object",
  "properties": {
    "userRole": {
      "type": "string",
      "title": "用户角色",
      "enum": ["admin", "editor", "viewer"]
    },
    "operation": {
      "type": "string",
      "title": "操作类型"
    }
  },
  "if": {
    "properties": { "userRole": { "const": "admin" } }
  },
  "then": {
    "properties": {
      "operation": {
        "enum": ["create", "edit", "delete", "view"]
      }
    }
  },
  "else": {
    "if": {
      "properties": { "userRole": { "const": "editor" } }
    },
    "then": {
      "properties": {
        "operation": {
          "enum": ["create", "edit", "view"]
        }
      }
    },
    "else": {
      "properties": {
        "operation": {
          "enum": ["view"]
        }
      }
    }
  }
}
```

**含义**：根据用户角色限制可选操作（管理员可执行所有操作，编辑者可创建/编辑/查看，查看者只能查看）。

### allOf（逻辑与）

`allOf` 要求数据同时满足所有子 schema，用于组合多个独立的验证规则。

**示例：多条件必填校验**

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

**含义**：如果是学生，学号和学校必填；如果年龄小于18岁，监护人电话必填。这两个条件独立生效。

**示例 2：多条件格式和范围校验**

```json
{
  "type": "object",
  "properties": {
    "hasPromotion": { "type": "boolean", "title": "是否参与促销" },
    "productType": { "type": "string", "title": "商品类型", "enum": ["digital", "physical"] },
    "promoCode": { "type": "string", "title": "促销码" },
    "shippingAddress": { "type": "string", "title": "配送地址" },
    "price": { "type": "number", "title": "价格" }
  },
  "allOf": [
    {
      "if": { "properties": { "hasPromotion": { "const": true } } },
      "then": {
        "required": ["promoCode"],
        "properties": {
          "promoCode": { "pattern": "^[A-Z0-9]{8}$" }
        }
      }
    },
    {
      "if": { "properties": { "productType": { "const": "physical" } } },
      "then": {
        "required": ["shippingAddress"],
        "properties": {
          "shippingAddress": { "minLength": 10 }
        }
      }
    },
    {
      "properties": {
        "price": { "minimum": 0.01, "maximum": 99999 }
      }
    }
  ]
}
```

**含义**：
1. 如果参与促销，必须填写8位促销码（大写字母或数字）
2. 如果是实体商品，必须填写配送地址（至少10字符）
3. 价格必须在 0.01-99999 之间（这是无条件的约束）

### anyOf（逻辑或）

`anyOf` 要求数据至少满足其中一个子 schema，用于"多选一"的验证场景。

**示例：至少填写一种联系方式**

```json
{
  "type": "object",
  "properties": {
    "email": { "type": "string", "title": "邮箱", "format": "email" },
    "phone": { "type": "string", "title": "手机号" },
    "wechat": { "type": "string", "title": "微信号" }
  },
  "anyOf": [
    { "required": ["email"] },
    { "required": ["phone"] },
    { "required": ["wechat"] }
  ]
}
```

**含义**：用户必须至少填写邮箱、手机号、微信号中的一个。

**示例 2：格式校验 - 至少提供一种有效的身份证明**

```json
{
  "type": "object",
  "properties": {
    "idCard": { "type": "string", "title": "身份证号" },
    "passport": { "type": "string", "title": "护照号" },
    "driverLicense": { "type": "string", "title": "驾驶证号" }
  },
  "anyOf": [
    {
      "properties": {
        "idCard": { "pattern": "^[1-9]\\d{17}$" }
      },
      "required": ["idCard"]
    },
    {
      "properties": {
        "passport": { "pattern": "^[A-Z]\\d{8}$" }
      },
      "required": ["passport"]
    },
    {
      "properties": {
        "driverLicense": { "pattern": "^\\d{12}$" }
      },
      "required": ["driverLicense"]
    }
  ]
}
```

**含义**：至少提供一种有效的身份证明，且必须符合对应的格式要求（身份证18位、护照1字母+8数字、驾驶证12位数字）。

**示例 3：数值范围校验 - 至少满足一种折扣条件**

```json
{
  "type": "object",
  "properties": {
    "totalAmount": { "type": "number", "title": "订单总额" },
    "itemCount": { "type": "integer", "title": "商品数量" },
    "memberYears": { "type": "integer", "title": "会员年限" }
  },
  "anyOf": [
    {
      "properties": {
        "totalAmount": { "minimum": 1000 }
      }
    },
    {
      "properties": {
        "itemCount": { "minimum": 10 }
      }
    },
    {
      "properties": {
        "memberYears": { "minimum": 3 }
      }
    }
  ]
}
```

**含义**：至少满足一个条件才能享受折扣（订单总额≥1000 或 商品数量≥10 或 会员年限≥3年）。

### oneOf（逻辑异或）

`oneOf` 要求数据有且仅有一个子 schema 被满足，用于互斥选择场景。

**示例：账户类型互斥选择**

```json
{
  "type": "object",
  "properties": {
    "accountType": { "type": "string", "title": "账户类型", "enum": ["personal", "business"] },
    "idCard": { "type": "string", "title": "身份证号" },
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

**含义**：如果是个人账户，必须填写身份证号；如果是企业账户，必须填写营业执照号。不能同时满足两个条件。

**示例 2：格式校验 - 支付方式互斥选择**

```json
{
  "type": "object",
  "properties": {
    "paymentType": { "type": "string", "title": "支付类型", "enum": ["card", "bank", "wallet"] },
    "cardNumber": { "type": "string", "title": "银行卡号" },
    "bankAccount": { "type": "string", "title": "银行账号" },
    "walletId": { "type": "string", "title": "钱包ID" }
  },
  "oneOf": [
    {
      "properties": {
        "paymentType": { "const": "card" },
        "cardNumber": { "pattern": "^[0-9]{16,19}$" }
      },
      "required": ["cardNumber"]
    },
    {
      "properties": {
        "paymentType": { "const": "bank" },
        "bankAccount": { "pattern": "^[0-9]{10,20}$" }
      },
      "required": ["bankAccount"]
    },
    {
      "properties": {
        "paymentType": { "const": "wallet" },
        "walletId": { "minLength": 8, "maxLength": 32 }
      },
      "required": ["walletId"]
    }
  ]
}
```

**含义**：根据支付类型，只能填写对应的支付账号，且必须符合格式要求。不能同时填写多种支付方式。

**示例 3：对象属性互斥 - 配送方式的互斥约束**

```json
{
  "type": "object",
  "properties": {
    "deliveryType": { "type": "string", "enum": ["express", "pickup", "digital"] },
    "address": {
      "type": "object",
      "properties": { "city": { "type": "string" }, "street": { "type": "string" } }
    },
    "storeId": { "type": "string" },
    "email": { "type": "string" }
  },
  "oneOf": [
    {
      "properties": {
        "deliveryType": { "const": "express" },
        "address": {
          "required": ["city", "street"],
          "properties": {
            "city": { "minLength": 2 },
            "street": { "minLength": 5 }
          }
        }
      },
      "required": ["address"]
    },
    {
      "properties": {
        "deliveryType": { "const": "pickup" },
        "storeId": { "pattern": "^STORE-\\d{4}$" }
      },
      "required": ["storeId"]
    },
    {
      "properties": {
        "deliveryType": { "const": "digital" },
        "email": { "format": "email" }
      },
      "required": ["email"]
    }
  ]
}
```

**含义**：根据配送方式，只能填写对应的信息（快递需地址、自提需门店ID、数字商品需邮箱），且格式必须正确。

### 嵌套条件判断

嵌套条件判断用于处理多层级的条件逻辑，适用于"先判断 A，再根据 A 的值判断 B"的场景。

**示例 1：基础嵌套必填校验 - 用户类型和国家**

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
      "enum": ["china", "usa", "other"]
    },
    "chinaIdCard": { "type": "string", "title": "中国身份证" },
    "usaSsn": { "type": "string", "title": "美国SSN" },
    "passport": { "type": "string", "title": "护照号" },
    "companyName": { "type": "string", "title": "公司名称" },
    "businessLicense": { "type": "string", "title": "营业执照" }
  },
  "if": {
    "properties": { "userType": { "const": "individual" } }
  },
  "then": {
    "allOf": [
      {
        "if": {
          "properties": { "country": { "const": "china" } }
        },
        "then": {
          "required": ["chinaIdCard"],
          "properties": {
            "chinaIdCard": { "pattern": "^[1-9]\\d{17}$" }
          }
        }
      },
      {
        "if": {
          "properties": { "country": { "const": "usa" } }
        },
        "then": {
          "required": ["usaSsn"],
          "properties": {
            "usaSsn": { "pattern": "^\\d{3}-\\d{2}-\\d{4}$" }
          }
        }
      },
      {
        "if": {
          "properties": { "country": { "const": "other" } }
        },
        "then": {
          "required": ["passport"],
          "properties": {
            "passport": { "pattern": "^[A-Z]\\d{8}$" }
          }
        }
      }
    ]
  },
  "else": {
    "required": ["companyName", "businessLicense"]
  }
}
```

**含义**：
- 如果是个人用户，根据国家填写对应证件并满足格式要求：
  - 中国：身份证号必填，18位数字格式
  - 美国：SSN 必填，格式为 XXX-XX-XXXX
  - 其他：护照号必填，格式为 1个大写字母+8位数字
- 如果是企业用户，必须填写公司名称和营业执照

### 条件验证机制对比

| 机制 | 语义 | 使用场景 | 示例 |
|------|------|----------|------|
| **dependencies** | 字段间依赖关系 | 当字段A存在/有值时，字段B的约束 | 填写信用卡时必须填写账单地址 |
| **if/then/else** | 条件分支 | 根据条件选择不同的验证规则 | 中国用户填身份证，美国用户填SSN |
| **allOf** | 逻辑与（全部满足） | 同时应用多个独立条件 | 学生要填学号，未成年要填监护人电话 |
| **anyOf** | 逻辑或（至少一个） | 至少满足一个条件 | 至少填写邮箱、手机、微信之一 |
| **oneOf** | 逻辑异或（仅一个） | 互斥选择，只能满足一个 | 个人账户或企业账户（二选一） |

**选择建议**：

1. 简单的字段依赖 → 使用 `dependencies`
2. 条件分支逻辑 → 使用 `if/then/else`
3. 多个独立条件同时生效 → 使用 `allOf`
4. 至少满足一个条件 → 使用 `anyOf`
5. 互斥选择 → 使用 `oneOf`

### 最佳实践和注意事项

**1. 数据验证 vs UI 联动**

> **重要**：条件验证是**数据验证规则**，不是 UI 联动逻辑。
> - ✅ 验证规则：在表单提交时校验数据是否符合要求
> - ❌ UI 联动：字段不会根据条件自动显示/隐藏或改变状态

**2. 正则表达式转义**

在 JSON 中使用正则表达式时，需要双重转义反斜杠：

```json
{
  "pattern": "^\\d{3}-\\d{4}$"  // JSON 中需要 \\d，实际正则为 \d
}
```

**3. 格式校验的局限性**

示例中的格式校验（如信用卡号、手机号）仅用于演示，生产环境建议：
- 信用卡号：使用 Luhn 算法校验
- 手机号：根据国家/地区使用不同的正则
- 邮箱：使用 `format: "email"` 而非自定义正则
- 身份证号：需要校验校验位算法

**4. 条件验证的性能考虑**

复杂的嵌套条件会影响验证性能，建议：
- 避免过深的嵌套（建议不超过 3 层）
- 优先使用简单的 `dependencies` 而非复杂的 `if/then/else`
- 对于复杂业务逻辑，考虑在后端进行验证

**5. 错误提示的友好性**

JSON Schema 的默认错误提示可能不够友好，建议：
- 使用 `description` 字段提供字段说明
- 使用 `errorMessage` 扩展（如 ajv-errors）自定义错误提示
- 在 UI Schema 中配置更友好的错误信息

**6. 常见陷阱**

- ❌ **错误**：在 `dependencies` 中使用 `if` 判断字段是否存在

  ```json
  "dependencies": {
    "field": {
      "if": { "required": ["field"] }  // 错误：dependencies 已经隐含了字段存在
    }
  }
  ```

- ✅ **正确**：直接使用 `const` 判断字段值
  ```json
  "dependencies": {
    "field": {
      "oneOf": [
        { "properties": { "field": { "const": true } } }
      ]
    }
  }
  ```
