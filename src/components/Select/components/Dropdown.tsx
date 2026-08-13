import React, { useLayoutEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Option } from "./Option";
import { OptionGroup } from "./OptionGroup";
import { calculateDropdownPosition } from "../utils/position";
import type { SelectOption } from "../types";

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
  className = "",
  maxHeight = 300,
  loading = false,
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    let animationFrameId: number | null = null;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const dropdownHeight =
        dropdownRef.current?.getBoundingClientRect().height ?? 0;
      const nextPosition = calculateDropdownPosition({
        triggerRect,
        dropdownHeight,
        maxHeight,
      });

      setPosition({
        top: nextPosition.top + window.scrollY,
        left: nextPosition.left + window.scrollX,
        width: nextPosition.width,
      });
    };

    const schedulePositionUpdate = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        updatePosition();
      });
    };

    updatePosition();
    window.addEventListener("scroll", schedulePositionUpdate, true);
    window.addEventListener("resize", schedulePositionUpdate);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedulePositionUpdate);

    if (resizeObserver) {
      if (triggerRef.current) {
        resizeObserver.observe(triggerRef.current);
      }
      if (dropdownRef.current) {
        resizeObserver.observe(dropdownRef.current);
      }
    }

    return () => {
      window.removeEventListener("scroll", schedulePositionUpdate, true);
      window.removeEventListener("resize", schedulePositionUpdate);
      resizeObserver?.disconnect();

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isOpen, maxHeight, triggerRef]);

  // 分组选项
  const groupedOptions = useMemo(() => {
    const groups: Record<string, SelectOption[]> = {};
    const ungrouped: SelectOption[] = [];

    options.forEach((option) => {
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

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={dropdownRef}
      className={`select-dropdown ${className}`}
      style={{
        position: "absolute",
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
              isSelected={selectedValues.some((v) => v == option.value)}
              isFocused={index === focusedIndex}
              onClick={() => onSelect(option)}
            />
          ))}
          {/* 渲染分组的选项 */}
          {Object.entries(groupedOptions.groups).map(
            ([groupName, groupOptions]) => {
              const groupStartIndex = groupedOptions.ungrouped.length;
              return (
                <OptionGroup key={groupName} label={groupName}>
                  {groupOptions.map((option, index) => (
                    <Option
                      key={option.value}
                      option={option}
                      isSelected={selectedValues.some((v) => v == option.value)}
                      isFocused={groupStartIndex + index === focusedIndex}
                      onClick={() => onSelect(option)}
                    />
                  ))}
                </OptionGroup>
              );
            },
          )}
        </>
      )}
    </div>,
    document.body,
  );
};
