import type { FieldWidgetProps } from '../../types/index';
import type { CodeEditorProps } from '../../../CodeEditor';

// 从通用组件重新导出类型
export type {
  SupportedLanguage,
  EditorTheme,
  CodeEditorConfig,
  CodeEditorProps,
} from '../../../CodeEditor';

/**
 * CodeEditorWidget Props
 * 继承 FieldWidgetProps 以适配 DynamicForm，同时复用 CodeEditorProps
 */
export interface CodeEditorWidgetProps
  extends FieldWidgetProps,
    Omit<CodeEditorProps, keyof FieldWidgetProps> {}
