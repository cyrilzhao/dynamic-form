/**
 * 支持的编程语言类型
 */
export type SupportedLanguage =
  | 'javascript'
  | 'json'
  | 'python'
  | 'sql'
  | 'yaml'
  | 'markdown'
  | 'html'
  | 'css';

/**
 * 编辑器主题
 */
export type EditorTheme = 'light' | 'dark';

/**
 * 编辑器配置
 */
export interface CodeEditorConfig {
  /** 初始模式 */
  initialMode?: 'preview' | 'edit';

  /** 预览行数，默认 3 */
  previewLines?: number;

  /** 预览最大高度（px），默认 120 */
  previewMaxHeight?: number;

  /** 模态边距（编辑器距离屏幕边缘的距离，px），默认 40 */
  modalPadding?: number;

  /** 遮罩层透明度（0-1），默认 0.5 */
  backdropOpacity?: number;

  /** 按 ESC 键关闭模态，默认 true */
  closeOnEscape?: boolean;

  /** 点击遮罩层关闭模态，默认 true */
  closeOnBackdropClick?: boolean;

  /** 失去焦点时关闭模态，默认 false */
  closeOnBlur?: boolean;
}

/**
 * CodeMirrorView Props
 */
export interface CodeMirrorViewProps {
  /** 代码内容 */
  value: string;

  /** 语言类型 */
  language: SupportedLanguage;

  /** 主题 */
  theme?: EditorTheme;

  /** 是否只读 */
  readonly?: boolean;

  /** 最大高度（px） */
  maxHeight?: number;

  /** 值变化回调 */
  onChange?: (value: string) => void;

  /** 验证器 */
  validator?: (code: string) => string | null;
}

/**
 * CodeEditorPreview Props
 */
export interface CodeEditorPreviewProps {
  /** 代码内容 */
  value: string;

  /** 语言类型 */
  language: SupportedLanguage;

  /** 主题 */
  theme?: EditorTheme;

  /** 编辑器配置 */
  config: CodeEditorConfig;

  /** 是否禁用 */
  disabled?: boolean;

  /** 是否只读 */
  readonly?: boolean;

  /** 错误信息 */
  error?: string;

  /** 点击编辑回调 */
  onEdit: () => void;
}

/**
 * CodeEditorModal Props
 */
export interface CodeEditorModalProps {
  /** 字段名称 */
  name?: string;

  /** 代码内容 */
  value: string;

  /** 语言类型 */
  language: SupportedLanguage;

  /** 主题 */
  theme?: EditorTheme;

  /** 编辑器配置 */
  config: CodeEditorConfig;

  /** 是否禁用 */
  disabled?: boolean;

  /** 是否只读 */
  readonly?: boolean;

  /** 是否在保存前自动校验（根据 language 自动选择校验器） */
  enableValidate?: boolean;

  /** 保存回调 */
  onSave: (value: string) => void;

  /** 取消回调 */
  onCancel: () => void;

  /** 关闭回调 */
  onClose?: () => void;

  /** 验证器 */
  validator?: (code: string) => string | null;

  /** 格式化器 */
  formatter?: (code: string) => string;
}

/**
 * CodeEditor 通用组件 Props
 */
export interface CodeEditorProps {
  /** 代码内容 */
  value?: string;

  /** 语言类型 */
  language?: SupportedLanguage;

  /** 编辑器配置 */
  config?: CodeEditorConfig;

  /** 主题 */
  theme?: EditorTheme;

  /** 是否禁用 */
  disabled?: boolean;

  /** 是否只读 */
  readonly?: boolean;

  /** 错误信息 */
  error?: string;

  /** 是否在保存前自动校验（根据 language 自动选择校验器） */
  enableValidate?: boolean;

  /** 值变化回调 */
  onChange?: (value: string) => void;

  /** 失焦回调 */
  onBlur?: () => void;

  /** 验证器（可选） */
  validator?: (code: string) => string | null;

  /** 格式化器（可选） */
  formatter?: (code: string) => string;
}
