import { renderHook } from '@testing-library/react';
import { useKeyboardNav } from '../../hooks/useKeyboardNav';
import type { SelectOption } from '../../types';

describe('useKeyboardNav', () => {
  const mockOptions: SelectOption[] = [
    { label: 'Option 1', value: '1' },
    { label: 'Option 2', value: '2' },
    { label: 'Option 3', value: '3' },
    { label: 'Option 4', value: '4' },
    { label: 'Option 5', value: '5' },
  ];

  let mockSetFocusedIndex: jest.Mock;
  let mockOnSelect: jest.Mock;
  let mockOnClose: jest.Mock;

  beforeEach(() => {
    mockSetFocusedIndex = jest.fn();
    mockOnSelect = jest.fn();
    mockOnClose = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('当下拉菜单关闭时', () => {
    it('不应该响应键盘事件', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: false,
          options: mockOptions,
          focusedIndex: 0,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      document.dispatchEvent(event);

      expect(mockSetFocusedIndex).not.toHaveBeenCalled();
    });
  });

  describe('ArrowDown 键', () => {
    it('应该将焦点移动到下一个选项', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 1,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      document.dispatchEvent(event);

      expect(mockSetFocusedIndex).toHaveBeenCalledWith(2);
    });

    it('当在最后一个选项时不应该继续向下', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 4, // 最后一个索引
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      document.dispatchEvent(event);

      expect(mockSetFocusedIndex).toHaveBeenCalledWith(4); // 保持在最后一个
    });

    it('应该阻止默认行为', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 0,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('ArrowUp 键', () => {
    it('应该将焦点移动到上一个选项', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 2,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      document.dispatchEvent(event);

      expect(mockSetFocusedIndex).toHaveBeenCalledWith(1);
    });

    it('当在第一个选项时不应该继续向上', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 0, // 第一个索引
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      document.dispatchEvent(event);

      expect(mockSetFocusedIndex).toHaveBeenCalledWith(0); // 保持在第一个
    });

    it('应该阻止默认行为', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 2,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Enter 键', () => {
    it('应该选中当前聚焦的选项', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 2,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      document.dispatchEvent(event);

      expect(mockOnSelect).toHaveBeenCalledWith(mockOptions[2]);
    });

    it('当 focusedIndex 为负数时不应该选中任何选项', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: -1,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      document.dispatchEvent(event);

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('当 focusedIndex 超出范围时不应该选中任何选项', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 10,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      document.dispatchEvent(event);

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('应该阻止默认行为', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 0,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Escape 键', () => {
    it('应该关闭下拉菜单', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 2,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(event);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('应该阻止默认行为', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 0,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      const preventDefaultSpy = jest.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('其他键', () => {
    it('不应该响应其他键盘按键', () => {
      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 2,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      document.dispatchEvent(event);

      expect(mockSetFocusedIndex).not.toHaveBeenCalled();
      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('事件监听器清理', () => {
    it('当组件卸载时应该移除事件监听器', () => {
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');

      const { unmount } = renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: mockOptions,
          focusedIndex: 0,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('当 isOpen 变为 false 时应该移除事件监听器', () => {
      const { rerender } = renderHook(
        ({ isOpen }) =>
          useKeyboardNav({
            isOpen,
            options: mockOptions,
            focusedIndex: 0,
            setFocusedIndex: mockSetFocusedIndex,
            onSelect: mockOnSelect,
            onClose: mockOnClose,
          }),
        { initialProps: { isOpen: true } }
      );

      // 触发键盘事件，验证事件监听器已注册
      const event1 = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      document.dispatchEvent(event1);
      expect(mockSetFocusedIndex).toHaveBeenCalled();

      mockSetFocusedIndex.mockClear();

      // 关闭下拉菜单
      rerender({ isOpen: false });

      // 触发键盘事件，验证事件监听器已移除
      const event2 = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      document.dispatchEvent(event2);
      expect(mockSetFocusedIndex).not.toHaveBeenCalled();
    });
  });

  describe('参数变化', () => {
    it('当 focusedIndex 变化时应该使用新的索引', () => {
      const { rerender } = renderHook(
        ({ focusedIndex }) =>
          useKeyboardNav({
            isOpen: true,
            options: mockOptions,
            focusedIndex,
            setFocusedIndex: mockSetFocusedIndex,
            onSelect: mockOnSelect,
            onClose: mockOnClose,
          }),
        { initialProps: { focusedIndex: 0 } }
      );

      // 按下 Enter 键，应该选中索引 0
      let event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      document.dispatchEvent(event);
      expect(mockOnSelect).toHaveBeenCalledWith(mockOptions[0]);

      mockOnSelect.mockClear();

      // 更新 focusedIndex 到 2
      rerender({ focusedIndex: 2 });

      // 再次按下 Enter 键，应该选中索引 2
      event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      document.dispatchEvent(event);
      expect(mockOnSelect).toHaveBeenCalledWith(mockOptions[2]);
    });

    it('当 options 变化时应该使用新的选项列表', () => {
      const newOptions: SelectOption[] = [
        { label: 'New 1', value: 'n1' },
        { label: 'New 2', value: 'n2' },
      ];

      const { rerender } = renderHook(
        ({ options }) =>
          useKeyboardNav({
            isOpen: true,
            options,
            focusedIndex: 0,
            setFocusedIndex: mockSetFocusedIndex,
            onSelect: mockOnSelect,
            onClose: mockOnClose,
          }),
        { initialProps: { options: mockOptions } }
      );

      // 更新选项列表
      rerender({ options: newOptions });

      // 按下 Enter 键，应该选中新列表中的第一项
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      document.dispatchEvent(event);
      expect(mockOnSelect).toHaveBeenCalledWith(newOptions[0]);
    });
  });

  describe('边界情况', () => {
    it('当选项列表为空时不应该出错', () => {
      expect(() => {
        renderHook(() =>
          useKeyboardNav({
            isOpen: true,
            options: [],
            focusedIndex: 0,
            setFocusedIndex: mockSetFocusedIndex,
            onSelect: mockOnSelect,
            onClose: mockOnClose,
          })
        );

        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        document.dispatchEvent(event);
      }).not.toThrow();

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('应该处理单个选项的情况', () => {
      const singleOption: SelectOption[] = [{ label: 'Only One', value: 'one' }];

      renderHook(() =>
        useKeyboardNav({
          isOpen: true,
          options: singleOption,
          focusedIndex: 0,
          setFocusedIndex: mockSetFocusedIndex,
          onSelect: mockOnSelect,
          onClose: mockOnClose,
        })
      );

      // 按 ArrowDown 应该保持在第一个
      let event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      document.dispatchEvent(event);
      expect(mockSetFocusedIndex).toHaveBeenCalledWith(0);

      mockSetFocusedIndex.mockClear();

      // 按 ArrowUp 应该保持在第一个
      event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      document.dispatchEvent(event);
      expect(mockSetFocusedIndex).toHaveBeenCalledWith(0);
    });
  });
});
