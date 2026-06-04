import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Dropdown } from '../../components/Dropdown';
import type { SelectOption } from '../../types';

describe('Dropdown', () => {
  const mockOptions: SelectOption[] = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
  ];

  const mockTriggerRef = {
    current: document.createElement('div'),
  };

  beforeEach(() => {
    // 模拟 getBoundingClientRect
    mockTriggerRef.current.getBoundingClientRect = jest.fn(() => ({
      bottom: 100,
      left: 50,
      width: 200,
      top: 70,
      right: 250,
      height: 30,
      x: 50,
      y: 70,
      toJSON: () => {},
    }));
  });

  it('关闭时不应该渲染', () => {
    const { container } = render(
      <Dropdown
        isOpen={false}
        options={mockOptions}
        selectedValues={[]}
        onSelect={() => {}}
        triggerRef={mockTriggerRef}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('打开时应该渲染选项', () => {
    render(
      <Dropdown
        isOpen={true}
        options={mockOptions}
        selectedValues={[]}
        onSelect={() => {}}
        triggerRef={mockTriggerRef}
      />
    );
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('点击选项时应该调用 onSelect', () => {
    const handleSelect = jest.fn();
    render(
      <Dropdown
        isOpen={true}
        options={mockOptions}
        selectedValues={[]}
        onSelect={handleSelect}
        triggerRef={mockTriggerRef}
      />
    );
    fireEvent.click(screen.getByText('Apple'));
    expect(handleSelect).toHaveBeenCalledWith(mockOptions[0]);
  });

  it('应该高亮选中的选项', () => {
    render(
      <Dropdown
        isOpen={true}
        options={mockOptions}
        selectedValues={['apple']}
        onSelect={() => {}}
        triggerRef={mockTriggerRef}
      />
    );
    const selectedOption = document.querySelector('.select-option--selected');
    expect(selectedOption).toHaveTextContent('Apple');
  });
});
