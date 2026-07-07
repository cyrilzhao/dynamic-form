import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { Trigger } from './components/Trigger'
import { Dropdown } from './components/Dropdown'
import { useClickOutside } from './hooks/useClickOutside'
import { useSearch } from './hooks/useSearch'
import { useKeyboardNav } from './hooks/useKeyboardNav'
import type { SelectProps, SelectOption } from './types'

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
  style,
  dropdownClassName,
  maxHeight,
  searchPlaceholder,
  onSearch,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [asyncOptions, setAsyncOptions] = useState<SelectOption[] | null>(null)
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  // 累积异步搜索中出现过的选项，用于在关闭后仍能显示已选项的 label
  const [knownOptions, setKnownOptions] = useState<SelectOption[]>(options)
  const triggerRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch
  // 使用 ref 在 effect 中读取最新值，避免 stale closure
  const selectedOptionsRef = useRef<SelectOption[]>([])
  const multipleRef = useRef(multiple)
  multipleRef.current = multiple

  // 静态 options 变化时同步 knownOptions 基础列表
  useEffect(() => {
    setKnownOptions((prev) => {
      const merged = [...options]
      for (const opt of prev) {
        if (!merged.some((o) => o.value === opt.value)) {
          merged.push(opt)
        }
      }
      return merged
    })
  }, [options])

  // 打开下拉框时 focus 搜索输入框，并为 onSearch 加载初始列表
  useEffect(() => {
    if (isOpen) {
      // 单选：预填已选项的 label；多选：保持空，避免显示大量 label 干扰
      const initialTerm =
        searchable &&
        !multipleRef.current &&
        selectedOptionsRef.current.length > 0
          ? selectedOptionsRef.current[0].label
          : ''
      if (searchable) {
        setSearchTerm(initialTerm)
        // 先 focus，再 select 全选文本，方便用户直接替换
        requestAnimationFrame(() => {
          searchInputRef.current?.focus()
          if (initialTerm) {
            searchInputRef.current?.select()
          }
        })
      }
      if (onSearchRef.current) {
        setIsSearchLoading(true)
        onSearchRef
          .current(initialTerm)
          .then((results) => {
            setAsyncOptions(results)
            setKnownOptions((prev) => {
              const merged = [...prev]
              for (const opt of results) {
                if (!merged.some((o) => o.value === opt.value)) {
                  merged.push(opt)
                }
              }
              return merged
            })
          })
          .finally(() => setIsSearchLoading(false))
      }
    } else {
      setAsyncOptions(null)
      setSearchTerm('')
    }
  }, [isOpen, searchable])

  // 点击外部关闭下拉菜单
  const handleClickOutside = useCallback(() => {
    setIsOpen(false)
    setFocusedIndex(-1)
  }, [])

  useClickOutside({ ref: containerRef, handler: handleClickOutside })

  // 搜索词变化时触发过滤或 onSearch，并将结果合并进 knownOptions
  const handleSearchChange = useCallback(
    async (term: string) => {
      setSearchTerm(term)
      if (onSearch) {
        setIsSearchLoading(true)
        try {
          const results = await onSearch(term)
          setAsyncOptions(results)
          setKnownOptions((prev) => {
            const merged = [...prev]
            for (const opt of results) {
              if (!merged.some((o) => o.value === opt.value)) {
                merged.push(opt)
              }
            }
            return merged
          })
        } finally {
          setIsSearchLoading(false)
        }
      }
    },
    [onSearch]
  )

  // 本地过滤（无 onSearch 时生效）
  const localFilteredOptions = useSearch({
    options,
    searchTerm: onSearch ? '' : searchTerm,
  })
  // 最终展示的选项：有 onSearch 时用异步结果，否则用本地过滤结果
  const filteredOptions = onSearch
    ? (asyncOptions ?? options)
    : localFilteredOptions

  // 规范化选中的值为数组格式
  const selectedValues = useMemo(() => {
    if (value === undefined || value === null) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  // 获取选中的选项对象，从 knownOptions 推导以支持异步选项
  const selectedOptions = useMemo(() => {
    return knownOptions.filter((opt) =>
      selectedValues.some((v) => v == opt.value)
    )
  }, [knownOptions, selectedValues])
  selectedOptionsRef.current = selectedOptions

  const handleSelect = useCallback(
    (option: SelectOption) => {
      if (multiple) {
        const isSelected = selectedValues.some((v) => v == option.value)
        const newValues = isSelected
          ? selectedValues.filter((v) => v != option.value)
          : [...selectedValues, option.value]
        onChange?.(newValues)
      } else {
        onChange?.(option.value)
        setIsOpen(false) // isOpen effect 会自动重置 searchTerm 和 asyncOptions
      }
    },
    [multiple, selectedValues, onChange]
  )

  // 键盘导航
  useKeyboardNav({
    isOpen,
    options: filteredOptions,
    focusedIndex,
    setFocusedIndex,
    onSelect: handleSelect,
    onClose: () => {
      setIsOpen(false)
      setSearchTerm('')
      setFocusedIndex(-1)
    },
  })

  const handleToggle = () => {
    if (!disabled && !loading) {
      setIsOpen(!isOpen)
    }
  }

  const handleClear = useCallback(() => {
    onChange?.(multiple ? [] : undefined)
  }, [multiple, onChange])

  const handleRemoveTag = useCallback(
    (tagValue: string | number) => {
      const newValues = selectedValues.filter((v) => v != tagValue)
      onChange?.(newValues)
    },
    [selectedValues, onChange]
  )

  return (
    <div ref={containerRef} className={`select ${className}`} style={style}>
      <Trigger
        ref={triggerRef}
        selectedOptions={selectedOptions}
        placeholder={placeholder}
        isOpen={isOpen}
        disabled={disabled}
        clearable={clearable}
        loading={loading || isSearchLoading}
        onClick={handleToggle}
        onClear={handleClear}
        searchable={searchable}
        multiple={multiple}
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        onRemoveTag={handleRemoveTag}
        searchInputRef={searchInputRef}
        searchPlaceholder={searchPlaceholder}
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
        loading={isSearchLoading}
      />
    </div>
  )
}
