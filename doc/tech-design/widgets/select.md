# Select 组件技术设计文档

> **状态：部分实现。** 本文完整保留 Select 的组件设计和扩展方案。当前已实现单选、多选、本地/异步搜索、分组、清除和基础键盘导航；`renderTrigger`/`renderOption`/`renderValue`、`noOptionsMessage`、Backspace 删除和文档列出的部分子组件仍是类型预留或提案。

## 1. 概述

本文档描述了一个功能完整的自定义 Select 组件的设计与实现方案。该组件参考 react-select 的设计理念，提供单一组件入口，支持单选、多选、搜索、分组等功能，同时提供灵活的定制能力。

### 1.1 设计目标

- **功能完整**：支持单选、多选、搜索、分组等核心功能
- **易用性**：单一组件入口，API 简洁清晰
- **可定制性**：通过 props 提供 Trigger、Option 等部分的自定义渲染能力
- **无障碍性**：支持键盘导航，符合无障碍访问标准
- **性能优化**：合理的状态管理和渲染优化

### 1.2 技术栈

- React 18.3+
- TypeScript 5.9+
- React Hooks
- Portal API（下拉菜单悬浮）
- SCSS（样式）

## 2. 整体架构

### 2.1 组件结构

虽然对外只暴露一个 `Select` 组件，但内部采用模块化设计，拆分为多个职责清晰的子模块：

```
Select（主组件）
├── useSelectState（状态管理 Hook）
├── Trigger（触发器组件）
│   ├── DefaultTrigger（默认 UI）
│   └── CustomTrigger（自定义渲染）
├── Dropdown（下拉菜单组件）
│   ├── Portal（悬浮层）
│   ├── SearchBox（搜索框）
│   ├── OptionList（选项列表）
│   │   ├── OptionGroup（分组）
│   │   └── Option（选项）
│   └── EmptyState（无数据状态）
└── Hooks
    ├── useClickOutside（点击外部关闭）
    ├── useKeyboardNav（键盘导航）
    └── useSearch（搜索过滤）
```

### 2.2 数据流

```
用户交互 → 事件处理 → 状态更新 → UI 重新渲染
     ↓
   onChange 回调 → 父组件
```

## 3. 核心类型定义

### 3.1 SelectOption

```typescript
/**
 * Select 选项数据结构
 */
export interface SelectOption {
  /** 选项显示文本 */
  label: string;
  /** 选项值 */
  value: string | number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 分组名称（用于选项分组） */
  group?: string;
  /** 自定义数据（可选） */
  data?: any;
}
```

### 3.2 SelectProps

```typescript
/**
 * Select 组件属性
 */
export interface SelectProps {
  // ========== 基础属性 ==========
  /** 当前选中的值（单选时为 string/number，多选时为数组） */
  value?: string | number | Array<string | number>;

  /** 值改变时的回调函数 */
  onChange?: (value: string | number | Array<string | number>) => void;

  /** 选项列表 */
  options: SelectOption[];

  /** 占位符文本 */
  placeholder?: string;

  /** 是否禁用 */
  disabled?: boolean;

  // ========== 功能开关 ==========
  /** 是否支持多选 */
  multiple?: boolean;

  /** 是否可搜索 */
  searchable?: boolean;

  /** 是否可清除（显示清除按钮） */
  clearable?: boolean;

  /** 是否加载中 */
  loading?: boolean;

  // ========== 自定义渲染 ==========
  /** 自定义 Trigger 渲染函数（提案/类型预留） */
  renderTrigger?: (props: TriggerRenderProps) => React.ReactNode;

  /** 自定义 Option 渲染函数（提案/类型预留） */
  renderOption?: (option: SelectOption, props: OptionRenderProps) => React.ReactNode;

  /** 自定义已选中值的显示（提案/类型预留） */
  renderValue?: (value: SelectOption | SelectOption[]) => React.ReactNode;

  // ========== 样式相关 ==========
  /** 容器样式类名 */
  className?: string;

  /** 下拉菜单样式类名 */
  dropdownClassName?: string;

  /** 下拉菜单最大高度（像素） */
  maxHeight?: number;

  // ========== 其他 ==========
  /** 搜索框占位符 */
  searchPlaceholder?: string;

  /** 无数据时的提示文本（当前类型预留，未接入空状态渲染） */
  noOptionsMessage?: string;
}
```

### 3.3 TriggerRenderProps

```typescript
/**
 * Trigger 自定义渲染时的 props
 */
export interface TriggerRenderProps {
  /** 是否打开下拉菜单 */
  isOpen: boolean;
  /** 当前选中的选项对象 */
  selectedOptions: SelectOption[];
  /** 占位符文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 点击事件处理 */
  onClick: () => void;
  /** ref（用于定位下拉菜单） */
  ref: React.RefObject<HTMLElement>;
}
```

### 3.4 OptionRenderProps

```typescript
/**
 * Option 自定义渲染时的 props
 */
export interface OptionRenderProps {
  /** 是否选中 */
  isSelected: boolean;
  /** 是否聚焦（键盘导航） */
  isFocused: boolean;
  /** 是否禁用 */
  isDisabled: boolean;
  /** 点击事件处理 */
  onClick: () => void;
}
```

## 4. 核心组件设计

### 4.1 Select 主组件（现行核心；自定义 render props 为提案）

**职责**：
- 管理组件的整体状态
- 协调子组件的渲染
- 处理用户交互事件

**核心状态**：
```typescript
interface SelectState {
  isOpen: boolean;              // 下拉菜单是否打开
  searchTerm: string;           // 搜索关键词
  focusedIndex: number;         // 键盘导航的焦点索引
  selectedValues: Array<string | number>; // 选中的值
}
```

**关键方法**：
- `toggleDropdown()` - 切换下拉菜单开关
- `selectOption(value)` - 选择选项
- `clearValue()` - 清除选中值
- `handleSearch(term)` - 处理搜索

### 4.2 Trigger 组件

**职责**：
- 显示当前选中的值
- 响应用户点击打开下拉菜单
- 支持自定义渲染

**默认 UI**：
```
┌─────────────────────────────┐
│ 已选中的值...          ▼   │
└─────────────────────────────┘
```

**展开时**：
```
┌─────────────────────────────┐
│ 已选中的值...          ▲   │
└─────────────────────────────┘
```

### 4.3 Dropdown 组件

**职责**：
- 使用 Portal 渲染到 body
- 根据 Trigger 位置计算下拉菜单位置
- 包含搜索框和选项列表

**位置计算逻辑**：
```typescript
function calculatePosition(triggerRect: DOMRect) {
  const spaceBelow = window.innerHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;

  // 优先向下展开，空间不足时向上
  const direction = spaceBelow >= 200 ? 'down' : 'up';

  return {
    left: triggerRect.left,
    top: direction === 'down'
      ? triggerRect.bottom + 4
      : triggerRect.top - dropdownHeight - 4,
    width: triggerRect.width,
  };
}
```

### 4.4 Option 组件

**职责**：
- 渲染单个选项
- 处理选项的选中/取消选中
- 支持自定义渲染

**状态样式**：
- 普通状态
- 选中状态（✓ 图标或背景色）
- 聚焦状态（键盘导航时高亮）
- 禁用状态（灰色、不可点击）

## 5. 实现细节

### 5.1 useClickOutside Hook

**功能**：检测点击外部区域，自动关闭下拉菜单

```typescript
function useClickOutside({
  ref,
  handler,
}: {
  ref: React.RefObject<HTMLElement>;
  handler: () => void;
}) {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}
```

### 5.2 useKeyboardNav Hook

**功能**：实现键盘导航

**支持的按键**：
- `ArrowDown` - 向下移动焦点
- `ArrowUp` - 向上移动焦点
- `Enter` - 选择当前焦点项
- `Escape` - 关闭下拉菜单
- `Backspace` - 删除最后一个选中项（提案/未实现）

```typescript
function useKeyboardNav({
  isOpen,
  options,
  focusedIndex,
  setFocusedIndex,
  onSelect,
  onClose,
}: KeyboardNavParams) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, options.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0) {
            onSelect(options[focusedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, options, focusedIndex]);
}
```

### 5.3 useSearch Hook

**功能**：实现搜索过滤

```typescript
function useSearch({
  options,
  searchTerm,
}: {
  options: SelectOption[];
  searchTerm: string;
}) {
  return useMemo(() => {
    if (!searchTerm) return options;

    const term = searchTerm.toLowerCase();
    return options.filter(option =>
      option.label.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);
}
```

### 5.4 Portal 实现

**功能**：将下拉菜单渲染到 body，确保不被遮挡

```typescript
import { createPortal } from 'react-dom';

function DropdownPortal({ children, triggerRef, isOpen }) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="select-dropdown"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 9999,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
```

## 6. 使用示例

### 6.1 基础单选

```tsx
import { Select } from '@/components/Select';

function BasicExample() {
  const [value, setValue] = useState<string>();

  const options = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Orange', value: 'orange' },
  ];

  return (
    <Select
      options={options}
      value={value}
      onChange={setValue}
      placeholder="Select a fruit..."
    />
  );
}
```

### 6.2 多选模式

```tsx
function MultiSelectExample() {
  const [values, setValues] = useState<string[]>([]);

  return (
    <Select
      options={options}
      value={values}
      onChange={setValues}
      multiple
      placeholder="Select multiple fruits..."
    />
  );
}
```

#### 6.2.1 DynamicForm 多选值契约

在 DynamicForm 中，多选 Select 使用基本类型数组作为受控值：

```typescript
const schema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    permissions: {
      type: 'array',
      title: 'Permissions',
      items: { type: 'string' },
      ui: {
        widget: 'select',
        widgetProps: {
          multiple: true,
        },
      },
    },
  },
};

formRef.current?.setValues({
  permissions: ['approve', 'reject'],
});
```

`SelectWidget` 会把 `Controller` 提供的 `value` 原样传给 `Select`。因此，多选字段在表单内部也必须保持 `Array<string | number>`，不能使用动态基本类型数组的 `{ value }[]` 包装格式。

数组转换边界会根据 `ui.widget === 'select'` 且 `ui.widgetProps.multiple === true` 跳过包装。这样可以保证：

- `setValues`、`reset(values)` 接受基本类型数组；
- `getValue`、`getValues`、`onChange` 和 `onSubmit` 返回基本类型数组；
- option value 校验直接比较字符串或数字，不会因为对象包装误清空已选值；
- 普通 `ArrayFieldWidget` 动态数组仍可继续使用 `{ value }[]` 作为内部实现。

### 6.3 搜索 + 分组

```tsx
function SearchGroupExample() {
  const options = [
    { label: 'Apple', value: 'apple', group: 'Fruits' },
    { label: 'Banana', value: 'banana', group: 'Fruits' },
    { label: 'Carrot', value: 'carrot', group: 'Vegetables' },
    { label: 'Potato', value: 'potato', group: 'Vegetables' },
  ];

  return (
    <Select
      options={options}
      value={value}
      onChange={setValue}
      searchable
      searchPlaceholder="Search..."
      placeholder="Select food..."
    />
  );
}
```

### 6.4 自定义 Trigger

```tsx
function CustomTriggerExample() {
  return (
    <Select
      options={options}
      value={value}
      onChange={setValue}
      // renderTrigger 当前只有类型预留，以下为目标 API 示例
      renderTrigger={({ isOpen, selectedOptions, onClick, ref }) => (
        <button
          ref={ref}
          onClick={onClick}
          className="custom-trigger"
        >
          <span>
            {selectedOptions.length > 0
              ? selectedOptions.map(opt => opt.label).join(', ')
              : 'Choose...'}
          </span>
          <span className="arrow">{isOpen ? '▲' : '▼'}</span>
        </button>
      )}
    />
  );
}
```

### 6.5 自定义 Option 渲染

```tsx
function CustomOptionExample() {
  return (
    <Select
      options={options}
      value={value}
      onChange={setValue}
      renderOption={(option, { isSelected, isFocused, onClick }) => (
        <div
          onClick={onClick}
          className={`custom-option ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
        >
          {isSelected && <CheckIcon />}
          <span>{option.label}</span>
          {option.data?.badge && <Badge>{option.data.badge}</Badge>}
        </div>
      )}
    />
  );
}
```

### 6.6 在 DynamicForm 中集成

```tsx
// 修改 SelectWidget.tsx，使用新的 Select 组件
import { forwardRef } from 'react';
import { Select } from '@/components/Select';
import type { FieldWidgetProps } from '../types';

export const SelectWidget = forwardRef<HTMLElement, FieldWidgetProps>(
  (
    { name, placeholder, disabled, readonly, options = [], value, onChange, ...rest },
    ref
  ) => {
    return (
      <Select
        options={options.map(opt => ({
          label: opt.label,
          value: opt.value,
          disabled: opt.disabled,
        }))}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled || readonly}
        {...rest}
      />
    );
  }
);

SelectWidget.displayName = 'SelectWidget';
```

## 7. 实现计划

### 7.1 第一阶段：核心功能

**任务清单**：
1. 创建类型定义文件 `src/components/Select/types.ts`
2. 实现 `useSelectState` Hook
3. 实现基础的 `Select` 主组件
4. 实现默认的 `Trigger` 组件
5. 实现 `Dropdown` 组件（使用 Portal）
6. 实现 `Option` 组件
7. 单选功能测试

**预计产出**：
- 可用的单选 Select 组件
- 基础样式（SCSS）

### 7.2 第二阶段：增强功能

**任务清单**：
1. 实现多选功能
2. 实现 `useSearch` Hook 和搜索框
3. 实现选项分组（`OptionGroup`）
4. 实现 `useClickOutside` Hook
5. 添加清除按钮（clearable）
6. 添加加载状态（loading）

**预计产出**：
- 完整功能的 Select 组件

### 7.3 第三阶段：交互优化

**任务清单**：
1. 实现 `useKeyboardNav` Hook
2. 添加键盘导航支持
3. 优化下拉菜单位置计算（处理上下翻转）
4. 添加动画效果（展开/收起）
5. 性能优化（useMemo、useCallback）

**预计产出**：
- 完善的交互体验

### 7.4 第四阶段：定制化

**任务清单**：
1. 实现 `renderTrigger` 自定义渲染
2. 实现 `renderOption` 自定义渲染
3. 实现 `renderValue` 自定义渲染
4. 编写完整的使用文档
5. 编写单元测试

**预计产出**：
- 高度可定制的 Select 组件
- 完整的文档和测试

### 7.5 第五阶段：集成

**任务清单**：
1. 修改 `SelectWidget` 使用新的 Select 组件
2. 确保与 DynamicForm 的兼容性
3. 回归测试
4. 性能测试

**预计产出**：
- 完成与现有系统的集成

## 8. 目录结构

```
src/components/Select/
├── index.ts                    # 导出入口
├── Select.tsx                  # 主组件
├── Select.scss                 # 样式
├── types.ts                    # 类型定义
├── components/
│   ├── Trigger.tsx            # 触发器组件
│   ├── Dropdown.tsx           # 下拉菜单组件
│   ├── Option.tsx             # 选项组件
│   ├── OptionGroup.tsx        # 分组组件
│   ├── SearchBox.tsx          # 搜索框组件
│   └── EmptyState.tsx         # 空状态组件
├── hooks/
│   ├── useSelectState.ts      # 状态管理
│   ├── useClickOutside.ts     # 点击外部检测
│   ├── useKeyboardNav.ts      # 键盘导航
│   └── useSearch.ts           # 搜索过滤
├── utils/
│   └── position.ts            # 位置计算工具
└── __tests__/
    ├── Select.test.tsx
    ├── Trigger.test.tsx
    ├── Dropdown.test.tsx
    └── hooks/
        ├── useSelectState.test.ts
        ├── useClickOutside.test.ts
        └── useKeyboardNav.test.ts
```

## 9. 总结

本设计文档详细描述了一个功能完整、高度可定制的 Select 组件的实现方案。该组件：

1. **对外简洁**：单一组件入口，API 清晰易用
2. **对内模块化**：职责清晰的内部组件和 Hooks
3. **功能完整**：支持单选、多选、搜索、分组等核心功能
4. **高度可定制**：通过 props 提供灵活的自定义能力
5. **用户友好**：支持键盘导航，符合无障碍访问标准
6. **性能优化**：合理使用 useMemo 和 useCallback

通过分阶段实现，可以逐步交付可用的功能，降低开发风险。

---

**文档版本**：v1.1
**创建日期**：2026-06-04
**最后更新**：2026-08-12
**维护者**：项目团队

### v1.1 (2026-08-12)

- 补充 DynamicForm 多选 Select 的基本类型数组契约
- 说明数组转换边界必须跳过多选 Select 的 `{ value }[]` 包装
- 修正 `SelectWidget` 示例，保持 `value` 原样透传
