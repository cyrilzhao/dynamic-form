import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { markdown } from '@codemirror/lang-markdown';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import {
  bracketMatching,
  foldGutter,
  indentOnInput,
  syntaxHighlighting,
  defaultHighlightStyle,
} from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import type { CodeMirrorViewProps, SupportedLanguage } from './types';

/**
 * 语言扩展映射
 */
const languageExtensions: Record<SupportedLanguage, ReturnType<typeof javascript>> = {
  javascript: javascript(),
  json: json(),
  python: python(),
  sql: sql(),
  yaml: yaml(),
  markdown: markdown(),
  html: html(),
  css: css(),
};

/**
 * CodeMirror 编辑器视图组件
 * 封装 CodeMirror 6 的核心功能
 */
export const CodeMirrorView: React.FC<CodeMirrorViewProps> = ({
  value,
  language,
  readonly = false,
  maxHeight,
  lineWrapping = false,
  onChange,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  }, [value, onChange]);

  useEffect(() => {
    if (!editorRef.current) return;

    // 构建扩展列表
    const extensions = [
      lineNumbers(),
      history(),
      foldGutter(),
      indentOnInput(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      highlightSelectionMatches(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...completionKeymap,
      ]),
      languageExtensions[language] || [],
      EditorView.editable.of(!readonly),
    ];

    // 添加自动补全（仅在非只读模式下）
    if (!readonly) {
      extensions.push(autocompletion());
    }

    // 添加自动换行
    if (lineWrapping) {
      extensions.push(EditorView.lineWrapping);
    }

    // 添加最大高度限制
    if (maxHeight) {
      extensions.push(
        EditorView.theme({
          '&': { maxHeight: `${maxHeight}px` },
          '.cm-scroller': { overflow: 'auto' },
        })
      );
    }

    // 添加值变化监听
    if (onChangeRef.current) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        })
      );
    }

    // 创建编辑器实例
    const view = new EditorView({
      state: EditorState.create({ doc: valueRef.current, extensions }),
      parent: editorRef.current,
    });

    viewRef.current = view;

    // 清理函数
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, readonly, maxHeight, lineWrapping]);

  // 同步外部值变化到编辑器
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== value) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value,
          },
        });
      }
    }
  }, [value]);

  return <div ref={editorRef} className="code-mirror-view" />;
};
