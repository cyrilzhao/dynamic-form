import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectEditor } from '../ObjectEditor';

// Mock CodeEditor 组件
jest.mock('../../CodeEditor', () => ({
  CodeEditor: React.forwardRef<
    HTMLDivElement,
    {
      value: string;
      language: string;
      onChange?: (value: string) => void;
      onBlur?: () => void;
      disabled?: boolean;
      readonly?: boolean;
      error?: string;
      config?: Record<string, unknown>;
      theme?: string;
    }
  >(function MockCodeEditor(props, ref) {
    return (
      <div ref={ref} data-testid="code-editor">
        <span data-testid="editor-value">{props.value}</span>
        <span data-testid="editor-language">{props.language}</span>
        <span data-testid="editor-theme">{props.theme}</span>
        <span data-testid="editor-disabled">{String(props.disabled)}</span>
        <span data-testid="editor-readonly">{String(props.readonly)}</span>
        {props.error && <span data-testid="editor-error">{props.error}</span>}
        {props.config?.previewMaxHeight && (
          <span data-testid="editor-height">{String(props.config.previewMaxHeight)}</span>
        )}
        <input
          data-testid="editor-input"
          value={props.value}
          onChange={e => props.onChange?.(e.target.value)}
          onBlur={props.onBlur}
        />
      </div>
    );
  }),
}));

describe('ObjectEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本渲染', () => {
    it('应该正确渲染 CodeEditor 组件', () => {
      render(<ObjectEditor />);
      expect(screen.getByTestId('code-editor')).toBeInTheDocument();
    });

    it('应该使用 json 作为语言', () => {
      render(<ObjectEditor />);
      expect(screen.getByTestId('editor-language')).toHaveTextContent('json');
    });

    it('应该使用默认主题 light', () => {
      render(<ObjectEditor />);
      expect(screen.getByTestId('editor-theme')).toHaveTextContent('light');
    });

    it('应该支持自定义主题', () => {
      render(<ObjectEditor theme="dark" />);
      expect(screen.getByTestId('editor-theme')).toHaveTextContent('dark');
    });
  });

  describe('值转换 - 对象到 JSON 字符串', () => {
    it('应该将对象转换为 JSON 字符串', () => {
      const value = { name: 'test', count: 42 };
      render(<ObjectEditor value={value} />);
      expect(screen.getByTestId('editor-value').textContent).toBe(
        JSON.stringify(value, null, 2)
      );
    });

    it('应该将数组转换为 JSON 字符串', () => {
      const value = [1, 2, 3];
      render(<ObjectEditor value={value} />);
      expect(screen.getByTestId('editor-value').textContent).toBe(
        JSON.stringify(value, null, 2)
      );
    });

    it('应该将嵌套对象转换为 JSON 字符串', () => {
      const value = { user: { name: 'test', roles: ['admin', 'user'] } };
      render(<ObjectEditor value={value} />);
      expect(screen.getByTestId('editor-value').textContent).toBe(
        JSON.stringify(value, null, 2)
      );
    });

    it('undefined 值应该显示为空字符串', () => {
      render(<ObjectEditor value={undefined} />);
      expect(screen.getByTestId('editor-value').textContent).toBe('');
    });

    it('null 值应该显示为空字符串', () => {
      render(<ObjectEditor value={null} />);
      expect(screen.getByTestId('editor-value').textContent).toBe('');
    });

    it('应该支持自定义缩进', () => {
      const value = { a: 1 };
      render(<ObjectEditor value={value} indent={4} />);
      expect(screen.getByTestId('editor-value').textContent).toBe(
        JSON.stringify(value, null, 4)
      );
    });

    it('无法序列化的值应该显示为空字符串', () => {
      // 创建循环引用对象
      const circularObj: Record<string, unknown> = { name: 'test' };
      circularObj.self = circularObj;

      render(<ObjectEditor value={circularObj} />);
      expect(screen.getByTestId('editor-value').textContent).toBe('');
    });
  });

  describe('值变化回调', () => {
    it('有效 JSON 应该触发 onChange 并传递解析后的对象', () => {
      const onChange = jest.fn();
      render(<ObjectEditor onChange={onChange} />);

      const input = screen.getByTestId('editor-input');
      fireEvent.change(input, { target: { value: '{"name":"updated"}' } });

      expect(onChange).toHaveBeenCalledWith({ name: 'updated' });
    });

    it('空字符串应该触发 onChange 并传递 undefined', () => {
      const onChange = jest.fn();
      render(<ObjectEditor value={{ test: 1 }} onChange={onChange} />);

      const input = screen.getByTestId('editor-input');
      fireEvent.change(input, { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('只有空格的字符串应该触发 onChange 并传递 undefined', () => {
      const onChange = jest.fn();
      render(<ObjectEditor value={{ test: 1 }} onChange={onChange} />);

      const input = screen.getByTestId('editor-input');
      fireEvent.change(input, { target: { value: '   ' } });

      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('无效 JSON 不应该触发 onChange', () => {
      const onChange = jest.fn();
      render(<ObjectEditor onChange={onChange} />);

      const input = screen.getByTestId('editor-input');
      fireEvent.change(input, { target: { value: '{invalid json}' } });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('没有 onChange 回调时不应该报错', () => {
      render(<ObjectEditor />);

      const input = screen.getByTestId('editor-input');
      expect(() => {
        fireEvent.change(input, { target: { value: '{"test":1}' } });
      }).not.toThrow();
    });
  });

  describe('禁用和只读状态', () => {
    it('应该传递 disabled 属性', () => {
      render(<ObjectEditor disabled={true} />);
      expect(screen.getByTestId('editor-disabled')).toHaveTextContent('true');
    });

    it('应该传递 readonly 属性', () => {
      render(<ObjectEditor readonly={true} />);
      expect(screen.getByTestId('editor-readonly')).toHaveTextContent('true');
    });

    it('默认 disabled 应该为 false', () => {
      render(<ObjectEditor />);
      expect(screen.getByTestId('editor-disabled')).toHaveTextContent('false');
    });

    it('默认 readonly 应该为 false', () => {
      render(<ObjectEditor />);
      expect(screen.getByTestId('editor-readonly')).toHaveTextContent('false');
    });
  });

  describe('错误状态', () => {
    it('应该传递错误信息', () => {
      render(<ObjectEditor error="Invalid JSON" />);
      expect(screen.getByTestId('editor-error')).toHaveTextContent('Invalid JSON');
    });

    it('没有错误时不应该显示错误元素', () => {
      render(<ObjectEditor />);
      expect(screen.queryByTestId('editor-error')).not.toBeInTheDocument();
    });
  });

  describe('config 透传', () => {
    it('应该将 config.previewMaxHeight 传递给 CodeEditor', () => {
      render(<ObjectEditor config={{ previewMaxHeight: 250 }} />);
      expect(screen.getByTestId('editor-height')).toHaveTextContent('250');
    });
  });

  describe('ref 转发', () => {
    it('应该正确转发 ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<ObjectEditor ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('onBlur 回调', () => {
    it('应该传递 onBlur 回调', () => {
      const onBlur = jest.fn();
      render(<ObjectEditor onBlur={onBlur} />);

      const input = screen.getByTestId('editor-input');
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('displayName', () => {
    it('应该设置正确的 displayName', () => {
      expect(ObjectEditor.displayName).toBe('ObjectEditor');
    });
  });
});
