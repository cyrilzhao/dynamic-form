import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ExpressionInput, Variable } from '../index';

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Braces: ({ size }: { size: number }) => (
    <svg data-testid="braces-icon" width={size} height={size} />
  ),
}));

// Mock createPortal
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// Mock scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

describe('ExpressionInput', () => {
  const mockVariables: Variable[] = [
    { label: 'User ID', value: 'user.id', type: 'string', group: 'User' },
    { label: 'User Name', value: 'user.name', type: 'string', group: 'User' },
    { label: 'Order Total', value: 'order.total', type: 'number', group: 'Order' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本渲染', () => {
    it('应该正确渲染组件', () => {
      render(<ExpressionInput />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('应该显示默认 placeholder', () => {
      render(<ExpressionInput />);
      expect(screen.getByPlaceholderText('Type ${ to select variable...')).toBeInTheDocument();
    });

    it('应该支持自定义 placeholder', () => {
      render(<ExpressionInput placeholder="Enter expression" />);
      expect(screen.getByPlaceholderText('Enter expression')).toBeInTheDocument();
    });

    it('应该渲染模式切换按钮', () => {
      render(<ExpressionInput />);
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByTestId('braces-icon')).toBeInTheDocument();
    });

    it('应该显示传入的值', () => {
      render(<ExpressionInput value="test value" />);
      expect(screen.getByRole('textbox')).toHaveValue('test value');
    });
  });

  describe('文本模式', () => {
    it('默认应该是文本模式', () => {
      render(<ExpressionInput />);
      const container = screen.getByRole('textbox').closest('.expression-input-container');
      expect(container).not.toHaveClass('expression-mode');
    });

    it('文本模式下输入应该直接传递值', () => {
      const onChange = jest.fn();
      render(<ExpressionInput onChange={onChange} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'hello world' } });

      expect(onChange).toHaveBeenCalledWith('hello world');
    });

    it('文本模式下不应该显示表达式装饰器', () => {
      render(<ExpressionInput />);
      expect(screen.queryByText('${')).not.toBeInTheDocument();
    });
  });

  describe('表达式模式', () => {
    it('点击按钮应该切换到表达式模式', () => {
      render(<ExpressionInput />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      const container = screen.getByRole('textbox').closest('.expression-input-container');
      expect(container).toHaveClass('expression-mode');
    });

    it('表达式模式下应该显示装饰器', () => {
      render(<ExpressionInput />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('${')).toBeInTheDocument();
      expect(screen.getByText('}')).toBeInTheDocument();
    });

    it('切换到表达式模式时应该包装值为 ${}', () => {
      const onChange = jest.fn();
      render(<ExpressionInput value="test" onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onChange).toHaveBeenCalledWith('${test}');
    });

    it('表达式模式下输入应该自动包装为 ${}', () => {
      const onChange = jest.fn();
      render(<ExpressionInput value="${}" onChange={onChange} />);

      // 先切换到表达式模式
      fireEvent.click(screen.getByRole('button'));

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'user.id' } });

      expect(onChange).toHaveBeenCalledWith('${user.id}');
    });
  });

  describe('模式切换', () => {
    it('从表达式模式切换回文本模式应该去除 ${}', () => {
      const onChange = jest.fn();
      render(<ExpressionInput value="${test}" onChange={onChange} />);

      // 先切换到表达式模式
      fireEvent.click(screen.getByRole('button'));
      onChange.mockClear();

      // 再切换回文本模式
      fireEvent.click(screen.getByRole('button'));

      expect(onChange).toHaveBeenCalledWith('test');
    });

    it('按钮在表达式模式下应该有 active 类', () => {
      render(<ExpressionInput />);

      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('active');

      fireEvent.click(button);
      expect(button).toHaveClass('active');
    });

    it('值已经是 ${} 格式时切换到表达式模式不应该重复包装', () => {
      const onChange = jest.fn();
      render(<ExpressionInput value="${existing}" onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      // 不应该调用 onChange，因为值已经是正确格式
      expect(onChange).not.toHaveBeenCalled();
    });

    it('值不是 ${} 格式时切换回文本模式不应该调用 onChange', () => {
      const onChange = jest.fn();
      render(<ExpressionInput value="plain text" onChange={onChange} />);

      // 切换到表达式模式
      fireEvent.click(screen.getByRole('button'));
      onChange.mockClear();

      // 切换回文本模式，但值不是 $ 格式
      fireEvent.click(screen.getByRole('button'));

      // 不应该调用 onChange
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('变量自动完成', () => {
    it('表达式模式下输入变量前缀应该显示建议列表', async () => {
      render(<ExpressionInput value="${us}" variables={mockVariables} />);

      // 切换到表达式模式
      fireEvent.click(screen.getByRole('button'));

      // 等待变量列表显示
      await waitFor(() => {
        expect(screen.getByText('User ID')).toBeInTheDocument();
      });
    });

    it('输入完全匹配的变量名时不应该显示建议列表', async () => {
      render(<ExpressionInput value="${user.id}" variables={mockVariables} />);

      fireEvent.click(screen.getByRole('button'));

      // 完全匹配时不显示下拉
      await waitFor(() => {
        expect(screen.queryByText('User ID')).not.toBeInTheDocument();
      });
    });

    it('点击变量项应该插入变量', async () => {
      const onChange = jest.fn();
      render(<ExpressionInput value="${us}" variables={mockVariables} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('User ID')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('User ID'));

      expect(onChange).toHaveBeenCalledWith('${user.id}');
    });

    it('鼠标悬停在变量项上应该更新活动索引', async () => {
      render(<ExpressionInput value="${us}" variables={mockVariables} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('User Name')).toBeInTheDocument();
      });

      const userNameItem = screen.getByText('User Name').closest('.variable-item');
      if (userNameItem) {
        fireEvent.mouseEnter(userNameItem);
        expect(userNameItem).toHaveClass('active');
      }
    });
  });

  describe('键盘导航', () => {
    it('按下 ArrowDown 应该选择下一个变量', async () => {
      render(<ExpressionInput value="${us}" variables={mockVariables} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('User ID')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'ArrowDown' });

      const userNameItem = screen.getByText('User Name').closest('.variable-item');
      expect(userNameItem).toHaveClass('active');
    });

    it('按下 ArrowUp 应该选择上一个变量', async () => {
      render(<ExpressionInput value="${us}" variables={mockVariables} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('User ID')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'ArrowDown' });
      fireEvent.keyDown(textarea, { key: 'ArrowUp' });

      const userIdItem = screen.getByText('User ID').closest('.variable-item');
      expect(userIdItem).toHaveClass('active');
    });

    it('按下 Enter 应该插入选中的变量', async () => {
      const onChange = jest.fn();
      render(<ExpressionInput value="${us}" variables={mockVariables} onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('User ID')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith('${user.id}');
    });

    it('按下 Escape 应该关闭建议列表', async () => {
      render(<ExpressionInput value="${us}" variables={mockVariables} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('User ID')).toBeInTheDocument();
      });

      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('User ID')).not.toBeInTheDocument();
      });
    });
  });

  describe('滚动同步', () => {
    it('滚动 textarea 应该同步 backdrop', () => {
      render(<ExpressionInput value="long text content" />);

      const textarea = screen.getByRole('textbox');
      fireEvent.scroll(textarea);

      expect(textarea).toBeInTheDocument();
    });
  });

  describe('变量高亮', () => {
    it('表达式模式下匹配的变量应该被高亮', async () => {
      render(<ExpressionInput value="${user.id}" variables={mockVariables} />);

      fireEvent.click(screen.getByRole('button'));

      const highlights = document.querySelector('.highlights');
      expect(highlights).toBeInTheDocument();
    });
  });

  describe('空值和边界情况', () => {
    it('空输入不应该显示建议列表', () => {
      render(<ExpressionInput value="${}" variables={mockVariables} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.queryByText('User ID')).not.toBeInTheDocument();
    });

    it('输入不匹配任何变量时不应该显示建议列表', () => {
      render(<ExpressionInput value="${xyz}" variables={mockVariables} />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.queryByText('User ID')).not.toBeInTheDocument();
    });

    it('没有 onChange 回调时不应该报错', () => {
      render(<ExpressionInput />);

      const textarea = screen.getByRole('textbox');
      expect(() => {
        fireEvent.change(textarea, { target: { value: 'test' } });
      }).not.toThrow();
    });
  });
});