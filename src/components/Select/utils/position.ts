/**
 * 计算下拉菜单的位置
 */
export function calculateDropdownPosition({
  triggerRect,
  dropdownHeight,
  maxHeight = 300,
}: {
  triggerRect: DOMRect;
  dropdownHeight: number;
  maxHeight?: number;
}) {
  const spaceBelow = window.innerHeight - triggerRect.bottom;
  const spaceAbove = triggerRect.top;

  // 优先向下展开，空间不足时向上
  const shouldOpenUpward = spaceBelow < maxHeight && spaceAbove > spaceBelow;

  return {
    left: triggerRect.left,
    top: shouldOpenUpward
      ? triggerRect.top - Math.min(dropdownHeight, maxHeight) - 4
      : triggerRect.bottom + 4,
    width: triggerRect.width,
    direction: shouldOpenUpward ? 'up' : 'down',
  };
}
