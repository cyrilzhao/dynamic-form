import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Trigger } from '../../components/Trigger';
import type { SelectOption } from '../../types';

describe('Trigger', () => {
  it('未选择时应该显示占位符', () => {
    render(
      <Trigger
        selectedOptions={[]}
        placeholder="Select..."
        isOpen={false}
        onClick={() => {}}
      />
    );
    expect(screen.getByText('Select...')).toBeInTheDocument();
  });

  it('应该显示选中的值', () => {
    const selected: SelectOption[] = [{ label: 'Apple', value: 'apple' }];
    render(
      <Trigger selectedOptions={selected} isOpen={false} onClick={() => {}} />
    );
    expect(screen.getByText('Apple')).toBeInTheDocument();
  });

  it('打开时应该显示向上箭头', () => {
    const { container } = render(
      <Trigger selectedOptions={[]} isOpen={true} onClick={() => {}} />
    );
    expect(container.querySelector('.select-trigger__arrow')).toHaveTextContent('▲');
  });

  it('关闭时应该显示向下箭头', () => {
    const { container } = render(
      <Trigger selectedOptions={[]} isOpen={false} onClick={() => {}} />
    );
    expect(container.querySelector('.select-trigger__arrow')).toHaveTextContent('▼');
  });

  it('点击时应该调用 onClick', () => {
    const handleClick = jest.fn();
    render(
      <Trigger selectedOptions={[]} isOpen={false} onClick={handleClick} />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('禁用时不应该调用 onClick', () => {
    const handleClick = jest.fn();
    render(
      <Trigger
        selectedOptions={[]}
        isOpen={false}
        onClick={handleClick}
        disabled
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('多个选中值应该用逗号分隔', () => {
    const selected: SelectOption[] = [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
    ];
    render(
      <Trigger selectedOptions={selected} isOpen={false} onClick={() => {}} />
    );
    expect(screen.getByText('Apple, Banana')).toBeInTheDocument();
  });
});
