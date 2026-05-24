# Error Scroll Example

## 概述

这个示例展示了 DynamicForm 组件在数组字段验证失败时，自动滚动到第一个错误项的功能。

## 功能特性

### 1. 自动错误定位
- 当表单验证失败时，自动滚动到第一个包含错误的数组项
- 支持嵌套对象数组和基本类型数组
- 错误信息实时显示在对应字段下方

### 2. 两种渲染模式

#### 普通渲染模式
- 适用场景：数组项数量较少（< 20 项）
- 特点：所有项直接渲染在 DOM 中
- 滚动方式：使用 `scrollIntoView` API

#### 虚拟滚动模式
- 适用场景：数组项数量较多（≥ 20 项）
- 特点：只渲染可见区域的项，性能更好
- 滚动方式：使用 Virtuoso 的 `scrollToIndex` API
- 启用方式：设置 `enableVirtualScroll={true}`

## 使用方法

### 访问示例

在浏览器中访问：`http://localhost:5173/error-scroll`

### 测试步骤

#### 普通渲染模式测试
1. 切换到 "Normal Rendering" 标签页
2. 向下滚动查看所有 15 个用户项
3. 注意第 10 项（索引 9）的必填字段为空
4. 点击 "Validate" 按钮
5. 页面自动滚动到第 10 项，显示错误信息

#### 虚拟滚动模式测试
1. 切换到 "Virtual Scroll" 标签页
2. 注意有 100 个产品项
3. 第 50 项（索引 49）的必填字段为空
4. 点击 "Validate" 按钮
5. 虚拟滚动自动跳转到第 50 项，显示错误信息

## 技术实现

### 核心机制

1. **错误检测**：使用 React Hook Form 的 `formState.errors` 检测验证错误
2. **状态订阅**：显式订阅 `isValidating` 和 `isValid` 状态
3. **错误定位**：查找第一个包含错误的数组项索引
4. **自动滚动**：根据渲染模式选择合适的滚动方法

### 关键代码

```typescript
// 显式订阅 formState 属性
const { errors, isValidating, isValid } = formState;

// 监听验证状态变化
useEffect(() => {
  if (isValidating || isValid) return;

  const arrayErrors = errors[name] as any;
  if (arrayErrors && Array.isArray(arrayErrors)) {
    const firstErrorIndex = arrayErrors.findIndex(error => error !== undefined);

    if (firstErrorIndex !== -1) {
      // 执行滚动
      scrollToError(firstErrorIndex);
    }
  }
}, [isValidating, isValid, errors]);
```

## 相关文件

- 示例组件：`/src/pages/examples/ErrorScrollExample.tsx`
- 数组字段组件：`/src/components/DynamicForm/widgets/ArrayFieldWidget.tsx`
- 节点配置弹窗：`/src/components/Workflow/NodeConfigModal.tsx`

## 注意事项

1. **性能考虑**：当数组项超过 20 个时，建议启用虚拟滚动模式
2. **DOM 更新延迟**：滚动操作使用 `setTimeout` 延迟 100ms，确保 DOM 已更新
3. **错误优先级**：始终滚动到第一个错误项，而不是最后一个
4. **浏览器兼容性**：`scrollIntoView` 的 `behavior: 'smooth'` 在某些旧浏览器中可能不支持

## 扩展阅读

- [React Hook Form - Form State](https://react-hook-form.com/docs/useform/formstate)
- [Virtuoso - Scroll To Index](https://virtuoso.dev/scroll-to-index/)
- [MDN - Element.scrollIntoView()](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView)
