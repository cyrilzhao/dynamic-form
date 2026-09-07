import React, { forwardRef } from 'react'
import type { SelectOption } from '../types'

interface TriggerProps {
  selectedOptions: SelectOption[]
  placeholder?: string
  isOpen: boolean
  disabled?: boolean
  clearable?: boolean
  loading?: boolean
  onClick: () => void
  onClear?: () => void
  searchable?: boolean
  multiple?: boolean
  searchTerm?: string
  onSearchChange?: (value: string) => void
  onRemoveTag?: (value: string | number) => void
  searchInputRef?: React.RefObject<HTMLInputElement>
  searchPlaceholder?: string
  renderValue?: (value: SelectOption | SelectOption[]) => React.ReactNode
}

export const Trigger = forwardRef<HTMLDivElement, TriggerProps>(
  (
    {
      selectedOptions,
      placeholder,
      isOpen,
      disabled,
      clearable,
      loading,
      onClick,
      onClear,
      searchable,
      multiple,
      searchTerm,
      onSearchChange,
      onRemoveTag,
      searchInputRef,
      searchPlaceholder,
      renderValue,
    },
    ref
  ) => {
    const displayText =
      selectedOptions.length > 0
        ? selectedOptions.map((opt) => opt.label).join(', ')
        : placeholder || 'Select...'

    const showClearButton =
      clearable && selectedOptions.length > 0 && !disabled && !loading
    // 多选 + 可搜索：始终显示 tags + input 区域
    const showTagsInput = searchable && multiple
    // 单选 + 可搜索 + 已打开：显示单行 input
    const showSearchInput = searchable && !multiple && isOpen

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      onClear?.()
    }

    return (
      <div
        ref={ref}
        className={`select-trigger ${isOpen ? 'select-trigger--open' : ''} ${
          disabled || loading ? 'select-trigger--disabled' : ''
        }`}
        role="button"
        onClick={disabled || loading ? undefined : onClick}
        aria-disabled={disabled || loading}
        aria-expanded={isOpen}
      >
        {showTagsInput ? (
          <div className="select-trigger__tags-input">
            {selectedOptions.map((opt) => (
              <span key={opt.value} className="select-trigger__tag">
                <span className="select-trigger__tag-label">{opt.label}</span>
                <span
                  className="select-trigger__tag-remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveTag?.(opt.value)
                  }}
                >
                  ×
                </span>
              </span>
            ))}
            {isOpen && (
              <input
                ref={searchInputRef}
                type="text"
                className="select-trigger__search-input--inline"
                value={searchTerm ?? ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder={
                  selectedOptions.length === 0
                    ? (searchPlaceholder ?? placeholder ?? 'Search...')
                    : ''
                }
                disabled={disabled}
              />
            )}
            {!isOpen && selectedOptions.length === 0 && (
              <span className="select-trigger__placeholder">
                {placeholder || 'Select...'}
              </span>
            )}
          </div>
        ) : showSearchInput ? (
          <input
            ref={searchInputRef}
            type="text"
            className="select-trigger__search-input"
            value={searchTerm ?? ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder={searchPlaceholder ?? placeholder ?? 'Search...'}
            disabled={disabled}
          />
        ) : (
          <span className="select-trigger__value">
            {renderValue
              ? renderValue(
                  selectedOptions.length === 1
                    ? selectedOptions[0]
                    : selectedOptions
                )
              : displayText}
          </span>
        )}
        <div
          className="select-trigger__icons"
          style={{ borderLeft: '1px solid #d1d5db', paddingLeft: '8px' }}
        >
          {loading && <span className="select-trigger__loading">⟳</span>}
          {showClearButton && (
            <span className="select-trigger__clear" onClick={handleClear}>
              ×
            </span>
          )}
          {!loading && (
            <span className="select-trigger__arrow">{isOpen ? '▲' : '▼'}</span>
          )}
        </div>
      </div>
    )
  }
)

Trigger.displayName = 'Trigger'
