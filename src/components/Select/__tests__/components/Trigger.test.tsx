import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
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

  it('多个选中值应该用逗号分隔（非 multiple 模式）', () => {
    const selected: SelectOption[] = [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
    ];
    render(
      <Trigger selectedOptions={selected} isOpen={false} onClick={() => {}} />
    );
    expect(screen.getByText('Apple, Banana')).toBeInTheDocument();
  });

  // ─── searchable 单选 ───────────────────────────────────────────────
  describe('searchable（单选）', () => {
    it('searchable + 打开时应该显示 input 而非 span', () => {
      render(
        <Trigger
          selectedOptions={[]}
          isOpen={true}
          searchable
          searchTerm=""
          onClick={() => {}}
        />
      );
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.queryByText('Select...')).not.toBeInTheDocument();
    });

    it('searchable + 关闭时应该显示 span 而非 input', () => {
      render(
        <Trigger
          selectedOptions={[]}
          isOpen={false}
          searchable
          placeholder="Select..."
          onClick={() => {}}
        />
      );
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Select...')).toBeInTheDocument();
    });

    it('input 的 value 应该反映 searchTerm', () => {
      render(
        <Trigger
          selectedOptions={[]}
          isOpen={true}
          searchable
          searchTerm="app"
          onClick={() => {}}
        />
      );
      expect(screen.getByRole('textbox')).toHaveValue('app');
    });

    it('input 输入应该调用 onSearchChange', () => {
      const onSearchChange = jest.fn();
      render(
        <Trigger
          selectedOptions={[]}
          isOpen={true}
          searchable
          searchTerm=""
          onSearchChange={onSearchChange}
          onClick={() => {}}
        />
      );
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ban' } });
      expect(onSearchChange).toHaveBeenCalledWith('ban');
    });

    it('点击 input 不应该触发外层 onClick（避免关闭下拉框）', () => {
      const onClick = jest.fn();
      render(
        <Trigger
          selectedOptions={[]}
          isOpen={true}
          searchable
          searchTerm=""
          onClick={onClick}
        />
      );
      fireEvent.click(screen.getByRole('textbox'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  // ─── multiple + searchable（tag 模式）─────────────────────────────
  describe('multiple + searchable（tag 模式）', () => {
    const selected: SelectOption[] = [
      { label: 'Apple', value: 'apple' },
      { label: 'Banana', value: 'banana' },
    ];

    it('应该渲染每个已选项的 tag', () => {
      const { container } = render(
        <Trigger
          selectedOptions={selected}
          isOpen={false}
          multiple
          searchable
          onClick={() => {}}
        />
      );
      const tags = container.querySelectorAll('.select-trigger__tag');
      expect(tags).toHaveLength(2);
      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('Banana')).toBeInTheDocument();
    });

    it('每个 tag 应该有 × 删除按钮', () => {
      const { container } = render(
        <Trigger
          selectedOptions={selected}
          isOpen={false}
          multiple
          searchable
          onClick={() => {}}
        />
      );
      expect(container.querySelectorAll('.select-trigger__tag-remove')).toHaveLength(2);
    });

    it('点击 tag × 应该调用 onRemoveTag 并传入正确的 value', () => {
      const onRemoveTag = jest.fn();
      const { container } = render(
        <Trigger
          selectedOptions={selected}
          isOpen={false}
          multiple
          searchable
          onRemoveTag={onRemoveTag}
          onClick={() => {}}
        />
      );
      const removeButtons = container.querySelectorAll('.select-trigger__tag-remove');
      fireEvent.click(removeButtons[0]);
      expect(onRemoveTag).toHaveBeenCalledWith('apple');
    });

    it('点击 tag × 不应该触发外层 onClick', () => {
      const onClick = jest.fn();
      const { container } = render(
        <Trigger
          selectedOptions={selected}
          isOpen={false}
          multiple
          searchable
          onClick={onClick}
        />
      );
      const removeButton = container.querySelectorAll('.select-trigger__tag-remove')[0];
      fireEvent.click(removeButton);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('打开时应该在 tags 后显示 inline input', () => {
      render(
        <Trigger
          selectedOptions={selected}
          isOpen={true}
          multiple
          searchable
          searchTerm=""
          onClick={() => {}}
        />
      );
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('关闭时不应该显示 input', () => {
      render(
        <Trigger
          selectedOptions={selected}
          isOpen={false}
          multiple
          searchable
          onClick={() => {}}
        />
      );
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('无已选项且关闭时应该显示 placeholder', () => {
      render(
        <Trigger
          selectedOptions={[]}
          isOpen={false}
          multiple
          searchable
          placeholder="请选择"
          onClick={() => {}}
        />
      );
      expect(screen.getByText('请选择')).toBeInTheDocument();
    });
  });
});

