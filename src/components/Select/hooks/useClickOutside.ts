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
      if (!ref.current?.contains(event.target as Node)) {
        handler();
      }
    };

    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}
