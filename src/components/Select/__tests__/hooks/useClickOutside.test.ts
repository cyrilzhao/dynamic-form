import { renderHook } from '@testing-library/react';
import { useClickOutside } from '../../hooks/useClickOutside';

describe('useClickOutside', () => {
  it('点击外部时应该调用 handler', () => {
    const handler = jest.fn();
    const ref = { current: document.createElement('div') };

    document.body.appendChild(ref.current);

    renderHook(() => useClickOutside({ ref, handler }));

    // 触发 mousedown 事件
    const event = new MouseEvent('mousedown', { bubbles: true });
    document.body.dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(ref.current);
  });

  it('点击内部时不应该调用 handler', () => {
    const handler = jest.fn();
    const ref = { current: document.createElement('div') };

    document.body.appendChild(ref.current);

    renderHook(() => useClickOutside({ ref, handler }));

    // 点击内部
    ref.current.click();

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(ref.current);
  });
});
