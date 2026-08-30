import type React from "react";

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

/**
 * Trigger 自定义渲染 props
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

/**
 * Option 自定义渲染 props
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

/**
 * Select 组件 props
 */
export interface SelectProps {
  /** 当前选中的值（单选时为 string/number，多选时为数组） */
  value?: string | number | Array<string | number>;
  /** 值改变时的回调函数 */
  onChange?: (
    value: string | number | Array<string | number> | undefined,
  ) => void;
  /** 选项列表 */
  options: SelectOption[];
  /** 占位符文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否支持多选 */
  multiple?: boolean;
  /** 是否可搜索 */
  searchable?: boolean;
  /** 是否可清除（显示清除按钮） */
  clearable?: boolean;
  /** 是否加载中 */
  loading?: boolean;
  /** 自定义 Trigger 渲染函数 */
  renderTrigger?: (props: TriggerRenderProps) => React.ReactElement;
  /** 自定义 Option 渲染函数 */
  renderOption?: (
    option: SelectOption,
    props: OptionRenderProps,
  ) => React.ReactNode;
  /** 自定义已选中值的显示 */
  renderValue?: (value: SelectOption | SelectOption[]) => React.ReactNode;
  /** 容器样式类名 */
  className?: string;
  /** 容器自定义样式 */
  style?: React.CSSProperties;
  /** 下拉菜单样式类名 */
  dropdownClassName?: string;
  /** 下拉菜单最大高度（像素） */
  maxHeight?: number;
  /** 下拉菜单最小宽度，默认 180px */
  minWidth?: number | string;
  /** 搜索框占位符 */
  searchPlaceholder?: string;
  /** 无数据时的提示文本 */
  noOptionsMessage?: string;
  /** 自定义搜索函数，返回异步搜索结果 */
  onSearch?: (term: string) => Promise<SelectOption[]>;
}
