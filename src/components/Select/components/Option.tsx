import React from 'react'
import type { OptionRenderProps, SelectOption } from '../types'

interface OptionProps {
  option: SelectOption
  isSelected?: boolean
  isFocused?: boolean
  onClick: () => void
  renderOption?: (
    option: SelectOption,
    props: OptionRenderProps,
  ) => React.ReactNode
}

export const Option: React.FC<OptionProps> = ({
  option,
  isSelected = false,
  isFocused = false,
  onClick,
  renderOption,
}) => {
  const handleClick = () => {
    if (!option.disabled) {
      onClick()
    }
  }

  const renderProps: OptionRenderProps = {
    isSelected,
    isFocused,
    isDisabled: Boolean(option.disabled),
    onClick: handleClick,
  }

  return (
    <div
      className={`select-option ${isSelected ? 'select-option--selected' : ''} ${
        isFocused ? 'select-option--focused' : ''
      } ${option.disabled ? 'select-option--disabled' : ''}`}
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
      aria-disabled={option.disabled}
    >
      {renderOption ? renderOption(option, renderProps) : option.label}
    </div>
  )
}
