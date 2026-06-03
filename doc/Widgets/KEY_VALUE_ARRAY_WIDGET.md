# KeyValueArrayWidget 使用文档

## 概述

`KeyValueArrayWidget` 是一个专门用于渲染和编辑键值对数组的自定义 widget，适用于配置映射、参数设置等场景。

## 特性

- ✅ 表格式布局，简洁美观
- ✅ 支持自定义键/值字段名
- ✅ 支持自定义列标题和占位符
- ✅ 支持添加、删除操作
- ✅ 支持最小/最大项数限制
- ✅ 支持禁用和只读模式
- ✅ 空状态提示

## 基本用法

### Schema 配置

```json
{
  "type": "object",
  "properties": {
    "outputMappings": {
      "type": "array",
      "title": "Output Variable Mapping",
      "items": {
        "type": "object",
        "properties": {
          "target": {
            "type": "string",
            "title": "Variable Name"
          },
          "source": {
            "type": "string",
            "title": "Expression"
          }
        },
        "required": ["target", "source"]
      },
      "ui": {
        "widget": "key-value-array",
        "widgetProps": {
          "keyField": "target",
          "valueField": "source",
          "keyLabel": "Variable Name",
          "valueLabel": "Expression",
          "keyPlaceholder": "Enter variable name",
          "valuePlaceholder": "Enter expression",
          "addButtonText": "Add Mapping",
          "emptyText": "No output mappings configured"
        }
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
    outputMappings: {
      type: 'array',
      title: 'Output Variable Mapping',
      items: {
        type: 'object',
        properties: {
          target: { type: 'string' },
          source: { type: 'string' }
        }
      },
      ui: {
        widget: 'key-value-array',
        widgetProps: {
          keyField: 'target',
          valueField: 'source',
          keyLabel: 'Variable Name',
          valueLabel: 'Expression'
        }
      }
    }
  }
};

const MyForm = () => {
  const handleSubmit = (data: any) => {
    console.log('Form data:', data);
    // data.outputMappings: [{ target: 'var1', source: 'expr1' }, ...]
  };

  return (
    <DynamicForm
      schema={schema}
      onSubmit={handleSubmit}
      defaultValues={{
        outputMappings: [
          { target: 'result', source: '$.output' }
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
| `keyField` | `string` | `'key'` | 键字段名称 |
| `valueField` | `string` | `'value'` | 值字段名称 |
| `keyLabel` | `string` | `'Key'` | 键列标题 |
| `valueLabel` | `string` | `'Value'` | 值列标题 |
| `keyPlaceholder` | `string` | 同 `keyLabel` | 键输入框占位符 |
| `valuePlaceholder` | `string` | 同 `valueLabel` | 值输入框占位符 |
| `addButtonText` | `string` | `'Add'` | 添加按钮文本 |
| `emptyText` | `string` | - | 空状态提示文本 |

### Schema 级别配置

| 属性 | 类型 | 说明 |
|------|------|------|
| `minItems` | `number` | 最小项数（删除按钮会在达到最小值时禁用） |
| `maxItems` | `number` | 最大项数（添加按钮会在达到最大值时禁用） |

## 使用场景

### 1. 变量映射配置

```json
{
  "outputMappings": {
    "type": "array",
    "title": "Output Mappings",
    "items": {
      "type": "object",
      "properties": {
        "target": { "type": "string" },
        "source": { "type": "string" }
      }
    },
    "ui": {
      "widget": "key-value-array",
      "widgetProps": {
        "keyField": "target",
        "valueField": "source",
        "keyLabel": "Variable Name",
        "valueLabel": "Expression"
      }
    }
  }
}
```

### 2. 环境变量配置

```json
{
  "envVars": {
    "type": "array",
    "title": "Environment Variables",
    "items": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "value": { "type": "string" }
      }
    },
    "minItems": 1,
    "ui": {
      "widget": "key-value-array",
      "widgetProps": {
        "keyField": "name",
        "valueField": "value",
        "keyLabel": "Name",
        "valueLabel": "Value",
        "emptyText": "No environment variables configured"
      }
    }
  }
}
```

### 3. HTTP Headers 配置

```json
{
  "headers": {
    "type": "array",
    "title": "HTTP Headers",
    "items": {
      "type": "object",
      "properties": {
        "key": { "type": "string" },
        "value": { "type": "string" }
      }
    },
    "ui": {
      "widget": "key-value-array",
      "widgetProps": {
        "keyLabel": "Header Name",
        "valueLabel": "Header Value",
        "addButtonText": "Add Header"
      }
    }
  }
}
```

## 数据格式

### 输入数据格式

```typescript
[
  { target: 'var1', source: 'expr1' },
  { target: 'var2', source: 'expr2' }
]
```

### 输出数据格式

与输入格式相同，保持标准的对象数组格式。

## 样式定制

Widget 使用 SCSS 样式文件 `KeyValueArrayWidget.scss`，可以通过覆盖以下 CSS 类来定制样式：

- `.key-value-array-widget` - 根容器
- `.key-value-array-header` - 表头
- `.key-value-array-item` - 每一行
- `.key-value-array-empty` - 空状态

## 与 ArrayFieldWidget 的区别

| 特性 | KeyValueArrayWidget | ArrayFieldWidget |
|------|---------------------|------------------|
| **适用场景** | 键值对数组 | 通用数组 |
| **布局** | 表格式（固定两列） | 灵活布局 |
| **复杂度** | 简单（仅支持字符串输入） | 复杂（支持任意类型） |
| **嵌套支持** | ❌ 不支持 | ✅ 支持 |
| **性能** | 更轻量 | 功能更全 |

## 最佳实践

1. **字段命名**：使用语义化的字段名（如 `source`/`target`、`name`/`value`）
2. **必填验证**：在 `items.required` 中指定必填字段
3. **最小项数**：对于必须至少有一项的场景，设置 `minItems: 1`
4. **空状态提示**：提供友好的 `emptyText` 提示用户
5. **占位符**：使用清晰的占位符文本引导用户输入

## 注意事项

1. **仅支持字符串类型**：当前版本仅支持字符串类型的键值对
2. **不支持嵌套**：不适用于复杂的嵌套对象场景
3. **字段名必须匹配**：`keyField` 和 `valueField` 必须与 `items.properties` 中的字段名一致

## 未来改进

- [ ] 支持不同的输入类型（number、select 等）
- [ ] 支持字段验证规则
- [ ] 支持拖拽排序
- [ ] 支持批量导入/导出

---

**文档版本**：v1.0
**最后更新**：2026-01-16
