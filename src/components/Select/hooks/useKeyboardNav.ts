import { useEffect } from 'react';
import type { SelectOption } from '../types';

interface UseKeyboardNavParams {
  isOpen: boolean;
  options: SelectOption[];
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  onSelect: (option: SelectOption) => void;
  onClose: () => void;
}

/**
 * 键盘导航 Hook
 */
export function useKeyboardNav({
  isOpen,
  options,
  focusedIndex,
  setFocusedIndex,
  onSelect,
  onClose,
}: UseKeyboardNavParams) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(Math.min(focusedIndex + 1, options.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(Math.max(focusedIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            onSelect(options[focusedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, options, focusedIndex, setFocusedIndex, onSelect, onClose]);
}
