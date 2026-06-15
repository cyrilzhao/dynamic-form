import { useEffect } from 'react';

interface UseClickOutsideParams {
  ref: React.RefObject<HTMLElement>;
  handler: () => void;
}

/**
 * 检测点击外部区域
 */
export function useClickOutside({ ref, handler }: UseClickOutsideParams) {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      const target = event.target as Node;

      // 检查是否点击在 ref 容器内
      if (ref.current?.contains(target)) {
        return;
      }

      // 检查是否点击在下拉菜单内（通过 portal 渲染到 body）
      const clickedElement = target as HTMLElement;
      if (clickedElement.closest?.('.select-dropdown')) {
        return;
      }

      handler();
    };

    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}
