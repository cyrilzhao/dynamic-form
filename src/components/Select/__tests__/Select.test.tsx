import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

  // ─── searchable 单选 ───────────────────────────────────────────────
  describe('searchable（单选）', () => {
    it('打开时应该显示搜索输入框', () => {
      render(<Select options={mockOptions} searchable />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('关闭时不应该显示搜索输入框', () => {
      render(<Select options={mockOptions} searchable />);
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('输入搜索词应该过滤选项', () => {
      render(<Select options={mockOptions} searchable />);
      fireEvent.click(screen.getByRole('button'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'app' } });
      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.queryByText('Banana')).not.toBeInTheDocument();
      expect(screen.queryByText('Orange')).not.toBeInTheDocument();
    });

    it('搜索词不区分大小写', () => {
      render(<Select options={mockOptions} searchable />);
      fireEvent.click(screen.getByRole('button'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'APPLE' } });
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });

    it('已有选中值时打开应该预填 label', () => {
      render(<Select options={mockOptions} value="banana" searchable />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('textbox')).toHaveValue('Banana');
    });

    it('无选中值时打开输入框应为空', () => {
      render(<Select options={mockOptions} searchable />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('选中选项后关闭下拉框并触发 onChange', () => {
      const onChange = jest.fn();
      render(<Select options={mockOptions} onChange={onChange} searchable />);
      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(screen.getByText('Banana'));
      expect(onChange).toHaveBeenCalledWith('banana');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  // ─── onSearch 异步搜索 ─────────────────────────────────────────────
  describe('onSearch（异步搜索）', () => {
    it('打开时应该立即调用 onSearch("")', async () => {
      const onSearch = jest.fn().mockResolvedValue(mockOptions);
      render(<Select options={[]} searchable onSearch={onSearch} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => expect(onSearch).toHaveBeenCalledWith(''));
    });

    it('搜索期间下拉菜单应该显示 Loading...', async () => {
      let resolve: (v: SelectOption[]) => void;
      const onSearch = jest.fn().mockReturnValue(
        new Promise<SelectOption[]>(r => { resolve = r; })
      );
      render(<Select options={[]} searchable onSearch={onSearch} />);
      fireEvent.click(screen.getByRole('button'));
      expect(await screen.findByText('Loading...')).toBeInTheDocument();
      act(() => resolve!(mockOptions));
      await waitFor(() =>
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
      );
    });

    it('onSearch 返回结果后应该在下拉菜单中渲染选项', async () => {
      const onSearch = jest.fn().mockResolvedValue(mockOptions);
      render(<Select options={[]} searchable onSearch={onSearch} />);
      fireEvent.click(screen.getByRole('button'));
      expect(await screen.findByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('Banana')).toBeInTheDocument();
    });

    it('输入搜索词时应该用新词调用 onSearch', async () => {
      const onSearch = jest.fn().mockResolvedValue([
        { label: 'Apple', value: 'apple' },
      ]);
      render(<Select options={[]} searchable onSearch={onSearch} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => expect(onSearch).toHaveBeenCalledWith(''));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'app' } });
      await waitFor(() => expect(onSearch).toHaveBeenCalledWith('app'));
    });

    it('无 enum 场景：选中后关闭仍能显示 label', async () => {
      const onSearch = jest.fn().mockResolvedValue(mockOptions);
      // 需要受控 wrapper，否则 mock onChange 不会更新 value
      const Wrapper = () => {
        const [val, setVal] = React.useState<string | number | undefined>(undefined);
        return (
          <Select
            options={[]}
            searchable
            onSearch={onSearch}
            value={val}
            onChange={v => setVal(v as string | number)}
          />
        );
      };
      const { container } = render(<Wrapper />);
      fireEvent.click(container.querySelector('.select-trigger')!);
      expect(await screen.findByText('Apple')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Apple'));
      // 关闭后 trigger 仍能显示 label（来自 knownOptions）
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });

    it('有选中值时打开应该用 label 调用 onSearch', async () => {
      const onSearch = jest.fn().mockResolvedValue(mockOptions);
      render(
        <Select options={mockOptions} value="banana" searchable onSearch={onSearch} />
      );
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => expect(onSearch).toHaveBeenCalledWith('Banana'));
    });
  });

  // ─── multiple + searchable ─────────────────────────────────────────
  describe('multiple + searchable', () => {
    it('已选项应该以 tag 形式显示', () => {
      const { container } = render(
        <Select options={mockOptions} value={['apple', 'banana']} multiple searchable />
      );
      expect(container.querySelectorAll('.select-trigger__tag')).toHaveLength(2);
      expect(screen.getByText('Apple')).toBeInTheDocument();
      expect(screen.getByText('Banana')).toBeInTheDocument();
    });

    it('点击 tag × 应该移除该选项', () => {
      const onChange = jest.fn();
      const { container } = render(
        <Select
          options={mockOptions}
          value={['apple', 'banana']}
          multiple
          searchable
          onChange={onChange}
        />
      );
      const removeButtons = container.querySelectorAll('.select-trigger__tag-remove');
      fireEvent.click(removeButtons[0]); // 移除 Apple
      expect(onChange).toHaveBeenCalledWith(['banana']);
    });

    it('点击 tag × 不应该触发下拉框打开', () => {
      const { container } = render(
        <Select options={mockOptions} value={['apple']} multiple searchable />
      );
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      const removeButton = container.querySelector('.select-trigger__tag-remove')!;
      fireEvent.click(removeButton);
      // 下拉框仍然关闭，没有 textbox
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('打开后应该在 tags 末尾显示 inline 搜索框', () => {
      render(
        <Select options={mockOptions} value={['apple']} multiple searchable />
      );
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('在搜索框输入应该过滤选项列表', () => {
      render(<Select options={mockOptions} multiple searchable />);
      fireEvent.click(screen.getByRole('button'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ban' } });
      expect(screen.getByText('Banana')).toBeInTheDocument();
      expect(screen.queryByText('Apple')).not.toBeInTheDocument();
    });

    it('多选选中后不关闭下拉框', () => {
      const onChange = jest.fn();
      render(<Select options={mockOptions} multiple searchable onChange={onChange} />);
      fireEvent.click(screen.getByRole('button'));
      fireEvent.click(screen.getByText('Apple'));
      expect(onChange).toHaveBeenCalledWith(['apple']);
      // 下拉框仍然打开，Banana 仍然可见
      expect(screen.getByText('Banana')).toBeInTheDocument();
    });

    it('多选 + onSearch：打开时调用 onSearch("") 并渲染结果', async () => {
      const onSearch = jest.fn().mockResolvedValue(mockOptions);
      render(<Select options={[]} multiple searchable onSearch={onSearch} />);
      fireEvent.click(screen.getByRole('button'));
      await waitFor(() => expect(onSearch).toHaveBeenCalledWith(''));
      expect(await screen.findByText('Apple')).toBeInTheDocument();
    });

    it('无已选项时应该显示 placeholder', () => {
      render(
        <Select options={mockOptions} multiple searchable placeholder="请选择标签" />
      );
      expect(screen.getByText('请选择标签')).toBeInTheDocument();
    });
  });
});
