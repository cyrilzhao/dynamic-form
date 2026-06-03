# TableArrayWidget 使用文档

## 概述

`TableArrayWidget` 是一个专门用于以表格形式渲染和编辑对象数组的自定义 widget，支持虚拟滚动优化，适用于处理大量数据的场景。

## 特性

- ✅ 表格形式展示对象数组
- ✅ 支持虚拟滚动（处理大量数据）
- ✅ 自动根据 schema 生成列
- ✅ 支持自定义列顺序
- ✅ 支持添加、删除行
- ✅ 支持禁用和只读模式
- ✅ 支持最小/最大项数限制
- ✅ 空状态提示

## 基本用法

### Schema 配置

```json
{
  "type": "object",
  "properties": {
    "users": {
      "type": "array",
      "title": "User List",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "title": "Name"
          },
          "age": {
            "type": "number",
            "title": "Age"
          },
          "email": {
            "type": "string",
            "title": "Email",
            "format": "email"
          }
        }
      },
      "ui": {
        "widget": "table-array"
      }
    }
  }
}
```

### 使用示例

```typescript
import { DynamicForm } from '@/components/DynamicForm';

const schema = {
  type: 'object',
  properties: {
    users: {
      type: 'array',
      title: 'User List',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Name' },
          age: { type: 'number', title: 'Age' },
          email: { type: 'string', title: 'Email' }
        }
      },
      ui: {
        widget: 'table-array'
      }
    }
  }
};

const MyForm = () => {
  const handleSubmit = (data: any) => {
    console.log('Form data:', data);
  };

  return (
    <DynamicForm
      schema={schema}
      onSubmit={handleSubmit}
      defaultValues={{
        users: [
          { name: 'Alice', age: 25, email: 'alice@example.com' },
          { name: 'Bob', age: 30, email: 'bob@example.com' }
        ]
      }}
    />
  );
};
```

## 配置选项

### widgetProps 配置

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enableVirtualScroll` | `boolean` | `false` | 是否启用虚拟滚动 |
| `virtualScrollHeight` | `number` | `400` | 虚拟滚动容器高度（像素） |
| `columns` | `string[]` | - | 列顺序（可选，默认按 properties 顺序） |
| `addButtonText` | `string` | `'Add Row'` | 添加按钮文本 |
| `emptyText` | `string` | `'No data'` | 空状态提示文本 |

### Schema 级别配置

| 属性 | 类型 | 说明 |
|------|------|------|
| `minItems` | `number` | 最小项数（删除按钮会在达到最小值时禁用） |
| `maxItems` | `number` | 最大项数（添加按钮会在达到最大值时禁用） |

## 使用场景

### 1. 启用虚拟滚动（大量数据）

```json
{
  "users": {
    "type": "array",
    "title": "User List",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "title": "Name" },
        "email": { "type": "string", "title": "Email" }
      }
    },
    "ui": {
      "widget": "table-array",
      "widgetProps": {
        "enableVirtualScroll": true,
        "virtualScrollHeight": 500
      }
    }
  }
}
```

### 2. 自定义列顺序

```json
{
  "products": {
    "type": "array",
    "title": "Product List",
    "items": {
      "type": "object",
      "properties": {
        "id": { "type": "string", "title": "ID" },
        "name": { "type": "string", "title": "Name" },
        "price": { "type": "number", "title": "Price" },
        "stock": { "type": "number", "title": "Stock" }
      }
    },
    "ui": {
      "widget": "table-array",
      "widgetProps": {
        "columns": ["name", "price", "stock"]
      }
    }
  }
}
```

### 3. 限制最小/最大项数

```json
{
  "contacts": {
    "type": "array",
    "title": "Contact List",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "title": "Name" },
        "phone": { "type": "string", "title": "Phone" }
      }
    },
    "minItems": 1,
    "maxItems": 10,
    "ui": {
      "widget": "table-array"
    }
  }
}
```

## 数据格式

### 输入数据格式

```typescript
[
  { name: 'Alice', age: 25, email: 'alice@example.com' },
  { name: 'Bob', age: 30, email: 'bob@example.com' }
]
```

### 输出数据格式

与输入格式相同，保持标准的对象数组格式。

## 与其他 Array Widget 的对比

| 特性 | TableArrayWidget | ArrayFieldWidget | KeyValueArrayWidget |
|------|------------------|------------------|---------------------|
| **适用场景** | 对象数组（表格展示） | 通用数组 | 键值对数组 |
| **布局** | 表格式 | 卡片式/列表式 | 表格式（固定两列） |
| **虚拟滚动** | ✅ 支持 | ✅ 支持 | ❌ 不支持 |
| **列定义** | 自动生成 | 自动生成 | 固定两列 |
| **复杂度** | 中等 | 高（支持嵌套） | 简单 |
| **性能** | 优秀（虚拟滚动） | 优秀（虚拟滚动） | 良好 |


## 最佳实践

1. **虚拟滚动优化**：当数组项数量超过 50 时，建议启用虚拟滚动
2. **列顺序**：使用 `columns` 配置控制重要列的显示顺序
3. **字段类型**：确保 `items.type` 为 `object` 且包含 `properties`
4. **列标题**：为每个属性设置清晰的 `title`
5. **最小项数**：对于必须至少有一项的场景，设置 `minItems: 1`

## 注意事项

1. **仅支持对象数组**：`items.type` 必须为 `object`
2. **不支持嵌套对象**：列中的字段应为基本类型（string、number、boolean）
3. **虚拟滚动高度**：需要根据实际场景设置合适的 `virtualScrollHeight`
4. **列宽自适应**：所有列等宽，使用 flex 布局


## 样式定制

Widget 使用 SCSS 样式文件 `TableArrayWidget.scss`，可以通过覆盖以下 CSS 类来定制样式：

- `.table-array-widget` - 根容器
- `.table-container` - 表格容器
- `.table-header` - 表头
- `.table-body` - 表体
- `.table-row` - 表格行
- `.table-cell` - 表格单元格
- `.index-cell` - 索引列
- `.action-cell` - 操作列

## 未来改进

- [ ] 支持列宽自定义
- [ ] 支持列排序
- [ ] 支持行拖拽排序
- [ ] 支持单元格内联编辑
- [ ] 支持批量操作

---

**文档版本**：v1.0
**最后更新**：2026-01-16
