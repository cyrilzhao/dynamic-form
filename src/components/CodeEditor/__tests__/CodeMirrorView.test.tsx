/**
 * CodeMirrorView 组件测试
 * 使用 moduleNameMapper 方式 mock CodeMirror 模块
 */
import React from 'react';
import '@testing-library/jest-dom';
import { render, cleanup } from '@testing-library/react';
import { CodeMirrorView } from '../CodeMirrorView';
import type { CodeMirrorViewProps } from '../types';

// 直接导入 mock 模块的工具函数
import {
  __mockCalls,
  __lastInstance,
  EditorView,
} from '../__mocks__/codemirror-view';
import {
  EditorState,
  __resetMockDocValue,
} from '../__mocks__/codemirror-state';
import { autocompletion } from '../__mocks__/codemirror-others';

describe('CodeMirrorView', () => {
  const defaultProps: CodeMirrorViewProps = {
    value: 'const x = 1;',
    language: 'javascript',
  };

  beforeEach(() => {
    // 清除所有 mock 调用记录
    jest.clearAllMocks();
    __mockCalls.reset();
    __resetMockDocValue();
  });

  afterEach(() => {
    cleanup();
  });

  describe('基本渲染', () => {
    it('应该渲染容器元素', () => {
      const { container } = render(<CodeMirrorView {...defaultProps} />);
      expect(container.querySelector('.code-mirror-view')).toBeInTheDocument();
    });

    it('应该创建 EditorView 实例', () => {
      render(<CodeMirrorView {...defaultProps} />);
      expect(__lastInstance).not.toBeNull();
    });

    it('应该使用传入的 value 初始化编辑器', () => {
      render(<CodeMirrorView {...defaultProps} value="test code" />);
      expect(EditorState.create).toHaveBeenCalledWith(
        expect.objectContaining({ doc: 'test code' })
      );
    });
  });

  describe('只读模式', () => {
    it('应该在只读模式下设置 editable 为 false', () => {
      render(<CodeMirrorView {...defaultProps} readonly={true} />);
      expect((EditorView as any).editable.of).toHaveBeenCalledWith(false);
    });

    it('应该在非只读模式下设置 editable 为 true', () => {
      render(<CodeMirrorView {...defaultProps} readonly={false} />);
      expect((EditorView as any).editable.of).toHaveBeenCalledWith(true);
    });

    it('只读模式下不应该启用自动补全', () => {
      render(<CodeMirrorView {...defaultProps} readonly={true} />);
      expect(autocompletion).not.toHaveBeenCalled();
    });

    it('非只读模式下应该启用自动补全', () => {
      render(<CodeMirrorView {...defaultProps} readonly={false} />);
      expect(autocompletion).toHaveBeenCalled();
    });
  });

  describe('最大高度', () => {
    it('应该在设置 maxHeight 时应用主题', () => {
      render(<CodeMirrorView {...defaultProps} maxHeight={200} />);
      expect((EditorView as any).theme).toHaveBeenCalled();
    });

    it('不设置 maxHeight 时不应该应用主题', () => {
      render(<CodeMirrorView {...defaultProps} />);
      expect((EditorView as any).theme).not.toHaveBeenCalled();
    });
  });

  describe('onChange 回调', () => {
    it('应该在有 onChange 时注册更新监听器', () => {
      const onChange = jest.fn();
      render(<CodeMirrorView {...defaultProps} onChange={onChange} />);
      expect((EditorView as any).updateListener.of).toHaveBeenCalled();
    });

    it('没有 onChange 时不应该注册更新监听器', () => {
      render(<CodeMirrorView {...defaultProps} />);
      expect((EditorView as any).updateListener.of).not.toHaveBeenCalled();
    });
  });

  describe('清理', () => {
    it('组件卸载时应该销毁编辑器实例', () => {
      const { unmount } = render(<CodeMirrorView {...defaultProps} />);
      expect(__mockCalls.destroy).toHaveLength(0);
      unmount();
      expect(__mockCalls.destroy).toHaveLength(1);
    });
  });
});
