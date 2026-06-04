import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Select } from '../Select';
import type { SelectOption } from '../types';

describe('Select', () => {
  const mockOptions: SelectOption[] = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Orange', value: 'orange' },
  ];

  it('应该渲染 Select 组件', () => {
    render(<Select options={mockOptions} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('应该显示占位符', () => {
    render(<Select options={mockOptions} placeholder="选择水果" />);
    expect(screen.getByText('选择水果')).toBeInTheDocument();
  });

  it('点击 Trigger 应该打开下拉菜单', () => {
    render(<Select options={mockOptions} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('选择选项后应该调用 onChange', () => {
    const handleChange = jest.fn();
    render(<Select options={mockOptions} onChange={handleChange} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Apple'));

    expect(handleChange).toHaveBeenCalledWith('apple');
  });

  it('应该显示选中的值', () => {
    render(<Select options={mockOptions} value="banana" />);
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('选择选项后应该关闭下拉菜单', () => {
    render(<Select options={mockOptions} />);

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Apple')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Apple'));
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
  });
});
