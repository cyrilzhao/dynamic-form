import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Trigger } from './components/Trigger';
import { Dropdown } from './components/Dropdown';
import { useClickOutside } from './hooks/useClickOutside';
import { useSearch } from './hooks/useSearch';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import type { SelectProps, SelectOption } from './types';

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  multiple = false,
  searchable = false,
  clearable = false,
  loading = false,
  className = '',
  dropdownClassName,
  maxHeight,
  searchPlaceholder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  const handleClickOutside = useCallback(() => {
    setIsOpen(false);
    setSearchTerm(''); // 关闭时清空搜索
    setFocusedIndex(-1); // 重置焦点
  }, []);

  useClickOutside({ ref: containerRef, handler: handleClickOutside });

  // 搜索过滤选项
  const filteredOptions = useSearch({ options, searchTerm });

  // 规范化选中的值为数组格式
  const selectedValues = useMemo(() => {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // 获取选中的选项对象
  const selectedOptions = useMemo(() => {
    return options.filter(opt => selectedValues.includes(opt.value));
  }, [options, selectedValues]);

  const handleSelect = useCallback(
    (option: SelectOption) => {
      if (multiple) {
        const newValues = selectedValues.includes(option.value)
          ? selectedValues.filter(v => v !== option.value)
          : [...selectedValues, option.value];
        onChange?.(newValues);
      } else {
        onChange?.(option.value);
        setIsOpen(false);
      }
    },
    [multiple, selectedValues, onChange]
  );

  // 键盘导航
  useKeyboardNav({
    isOpen,
    options: filteredOptions,
    focusedIndex,
    setFocusedIndex,
    onSelect: handleSelect,
    onClose: () => {
      setIsOpen(false);
      setSearchTerm('');
      setFocusedIndex(-1);
    },
  });

  const handleToggle = () => {
    if (!disabled && !loading) {
      setIsOpen(!isOpen);
    }
  };

  const handleClear = useCallback(() => {
    onChange?.(multiple ? [] : undefined);
  }, [multiple, onChange]);

  return (
    <div ref={containerRef} className={`select ${className}`}>
      <Trigger
        ref={triggerRef}
        selectedOptions={selectedOptions}
        placeholder={placeholder}
        isOpen={isOpen}
        disabled={disabled}
        clearable={clearable}
        loading={loading}
        onClick={handleToggle}
        onClear={handleClear}
      />
      <Dropdown
        isOpen={isOpen}
        options={filteredOptions}
        selectedValues={selectedValues}
        focusedIndex={focusedIndex}
        onSelect={handleSelect}
        triggerRef={triggerRef}
        className={dropdownClassName}
        maxHeight={maxHeight}
        searchable={searchable}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={searchPlaceholder}
      />
    </div>
  );
};
