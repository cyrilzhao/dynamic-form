import type { CodeEditorConfig, EditorTheme } from '../CodeEditor';

/**
 * ObjectEditor Props
 * 通用的对象/数组编辑器，基于 CodeEditor 支持 JSON 格式编辑
 */
export interface ObjectEditorProps {
  /** 值（对象或数组） */
  value?: unknown;

  /** 值变化回调，返回解析后的值 */
  onChange?: (value: unknown) => void;

  /** 失焦回调 */
  onBlur?: () => void;

  /** 是否禁用 */
  disabled?: boolean;

  /** 是否只读 */
  readonly?: boolean;

  /** 错误信息 */
  error?: string;

  /** 编辑器配置 */
  config?: CodeEditorConfig;

  /** 主题 */
  theme?: EditorTheme;

  /** JSON 缩进空格数，默认 2 */
  indent?: number;
}
