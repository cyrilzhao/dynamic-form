import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Option } from '../../components/Option';
import type { SelectOption } from '../../types';

describe('Option', () => {
  const mockOption: SelectOption = { label: 'Apple', value: 'apple' };

  it('应该渲染选项标签', () => {
    render(<Option option={mockOption} onClick={() => {}} />);
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('点击时应该调用 onClick', () => {
    const handleClick = jest.fn();
    render(<Option option={mockOption} onClick={handleClick} />);
    fireEvent.click(screen.getByText('Apple'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('应该显示选中状态', () => {
    const { container } = render(
      <Option option={mockOption} onClick={() => {}} isSelected />
    );
    expect(container.firstChild).toHaveClass('select-option--selected');
  });

  it('禁用时不应该可点击', () => {
    const handleClick = jest.fn();
    render(
      <Option option={{ ...mockOption, disabled: true }} onClick={handleClick} />
    );
    fireEvent.click(screen.getByText('Apple'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('应该显示聚焦状态', () => {
    const { container } = render(
      <Option option={mockOption} onClick={() => {}} isFocused />
    );
    expect(container.firstChild).toHaveClass('select-option--focused');
  });
});
