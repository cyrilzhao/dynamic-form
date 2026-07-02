import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Option } from './Option';
import { OptionGroup } from './OptionGroup';
import type { SelectOption } from '../types';

interface DropdownProps {
  isOpen: boolean;
  options: SelectOption[];
  selectedValues: Array<string | number>;
  focusedIndex?: number;
  onSelect: (option: SelectOption) => void;
  triggerRef: React.RefObject<HTMLElement>;
  className?: string;
  maxHeight?: number;
  loading?: boolean;
}

export const Dropdown: React.FC<DropdownProps> = ({
  isOpen,
  options,
  selectedValues,
  focusedIndex = -1,
  onSelect,
  triggerRef,
  className = '',
  maxHeight = 300,
  loading = false,
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen, triggerRef]);

  // 分组选项
  const groupedOptions = useMemo(() => {
    const groups: Record<string, SelectOption[]> = {};
    const ungrouped: SelectOption[] = [];

    options.forEach(option => {
      if (option.group) {
        if (!groups[option.group]) {
          groups[option.group] = [];
        }
        groups[option.group].push(option);
      } else {
        ungrouped.push(option);
      }
    });

    return { groups, ungrouped };
  }, [options]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`select-dropdown ${className}`}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight,
        zIndex: 9999,
      }}
    >
      {loading ? (
        <div className="select-dropdown__loading">Loading...</div>
      ) : (
        <>
          {/* 渲染未分组的选项 */}
          {groupedOptions.ungrouped.map((option, index) => (
            <Option
              key={option.value}
              option={option}
              isSelected={selectedValues.some(v => v == option.value)}
              isFocused={index === focusedIndex}
              onClick={() => onSelect(option)}
            />
          ))}
          {/* 渲染分组的选项 */}
          {Object.entries(groupedOptions.groups).map(([groupName, groupOptions]) => {
            const groupStartIndex = groupedOptions.ungrouped.length;
            return (
              <OptionGroup key={groupName} label={groupName}>
                {groupOptions.map((option, index) => (
                  <Option
                    key={option.value}
                    option={option}
                    isSelected={selectedValues.some(v => v == option.value)}
                    isFocused={groupStartIndex + index === focusedIndex}
                    onClick={() => onSelect(option)}
                  />
                ))}
              </OptionGroup>
            );
          })}
        </>
      )}
    </div>,
    document.body
  );
};
