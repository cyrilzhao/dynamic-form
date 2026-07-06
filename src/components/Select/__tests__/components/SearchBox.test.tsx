import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SearchBox } from '../../components/SearchBox';

describe('SearchBox', () => {
  describe('渲染', () => {
    it('应该正确渲染搜索框', () => {
      const onChange = jest.fn();
      render(<SearchBox value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveClass('select-search__input');
    });

    it('应该显示传入的 value', () => {
      const onChange = jest.fn();
      render(<SearchBox value="test query" onChange={onChange} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('test query');
    });

    it('应该显示默认的 placeholder', () => {
      const onChange = jest.fn();
      render(<SearchBox value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', 'Search...');
    });

    it('应该显示自定义的 placeholder', () => {
      const onChange = jest.fn();
      render(<SearchBox value="" onChange={onChange} placeholder="请输入关键词" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', '请输入关键词');
    });
  });

  describe('交互', () => {
    it('当输入内容时应该调用 onChange', () => {
      const onChange = jest.fn();
      render(<SearchBox value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'new text' } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('new text');
    });

    it('应该支持多次输入', () => {
      const onChange = jest.fn();
      const { rerender } = render(<SearchBox value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');

      fireEvent.change(input, { target: { value: 'a' } });
      expect(onChange).toHaveBeenCalledWith('a');

      rerender(<SearchBox value="a" onChange={onChange} />);
      fireEvent.change(input, { target: { value: 'ab' } });
      expect(onChange).toHaveBeenCalledWith('ab');

      rerender(<SearchBox value="ab" onChange={onChange} />);
      fireEvent.change(input, { target: { value: 'abc' } });
      expect(onChange).toHaveBeenCalledWith('abc');

      expect(onChange).toHaveBeenCalledTimes(3);
    });

    it('当清空内容时应该调用 onChange', () => {
      const onChange = jest.fn();
      render(<SearchBox value="some text" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('受控组件行为', () => {
    it('应该作为受控组件工作', () => {
      const onChange = jest.fn();
      const { rerender } = render(<SearchBox value="initial" onChange={onChange} />);

      let input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('initial');

      rerender(<SearchBox value="updated" onChange={onChange} />);
      input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('updated');
    });

    it('value 变化时应该更新输入框显示', () => {
      const onChange = jest.fn();
      const { rerender } = render(<SearchBox value="" onChange={onChange} />);

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('');

      rerender(<SearchBox value="test" onChange={onChange} />);
      expect(input.value).toBe('test');

      rerender(<SearchBox value="" onChange={onChange} />);
      expect(input.value).toBe('');
    });
  });

  describe('样式类名', () => {
    it('容器应该有正确的类名', () => {
      const onChange = jest.fn();
      const { container } = render(<SearchBox value="" onChange={onChange} />);

      const wrapper = container.querySelector('.select-search');
      expect(wrapper).toBeInTheDocument();
    });

    it('输入框应该有正确的类名', () => {
      const onChange = jest.fn();
      render(<SearchBox value="" onChange={onChange} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('select-search__input');
    });
  });
});
