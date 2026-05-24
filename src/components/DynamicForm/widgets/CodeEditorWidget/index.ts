export { CodeEditorWidget } from './CodeEditorWidget';
export * from './types';

// 从通用组件重新导出，保持向后兼容
export {
  CodeMirrorView,
  CodeEditorPreview,
  CodeEditorModal,
  jsonValidator,
  jsonFormatter,
  getLanguageDisplayName,
  countLines,
  truncateLines,
} from '../../../CodeEditor';
