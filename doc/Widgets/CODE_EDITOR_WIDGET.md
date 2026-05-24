# CodeMirror Widget 设计方案

## 1. 概述

### 1.1 背景

在动态表单系统中，经常需要用户输入代码片段（如 JSON、JavaScript、SQL、YAML 等）。传统的 `<textarea>` 组件缺乏代码编辑器的基本功能（语法高亮、代码折叠、自动补全等），用户体验较差。因此需要集成一个专业的代码编辑器组件。

### 1.2 目标

- 提供专业的代码编辑体验（语法高亮、行号、代码折叠等）
- 支持多种编程语言（JSON、JavaScript、Python、SQL、YAML 等）
- 针对代码内容较长的特点，优化预览态和编辑态的交互体验
- 无缝集成到 DynamicForm 的 widget 体系中
- 保持与其他 widget 一致的 API 和行为

### 1.3 技术选型

**选择 CodeMirror 6 的理由：**

1. **现代化架构**：基于 ES6 模块，TypeScript 友好
2. **高性能**：虚拟滚动，支持大文件编辑
3. **可扩展性强**：插件化架构，易于定制
4. **活跃维护**：持续更新，社区活跃
5. **体积可控**：按需加载语言支持和扩展

**依赖包：**

```json
{
  "@codemirror/state": "^6.4.0",
  "@codemirror/view": "^6.23.0",
  "@codemirror/lang-javascript": "^6.2.1",
  "@codemirror/lang-json": "^6.0.1",
  "@codemirror/lang-python": "^6.1.3",
  "@codemirror/lang-sql": "^6.5.4",
  "@codemirror/lang-yaml": "^6.0.0",
  "@codemirror/language": "^6.10.0",
  "@codemirror/commands": "^6.3.3",
  "@codemirror/search": "^6.5.5",
  "@codemirror/autocomplete": "^6.12.0",
  "@codemirror/lint": "^6.5.0",
  "@codemirror/theme-one-dark": "^6.1.2"
}
```

---

## 2. 核心设计

### 2.1 预览态与编辑态设计

**核心问题：** 代码内容通常较长，如果在表单中直接展示完整的编辑器，会占用大量垂直空间，影响表单的整体浏览体验。

**解决方案：** 采用「预览态 + 编辑态」的双模式设计。

#### 2.1.1 预览态（Preview Mode）

**特点：**

- 紧凑显示，节省空间
- 显示代码的前几行（默认 3-5 行）
- 语法高亮（只读）
- 显示语言标签和行数统计
- 提供「展开编辑」按钮

**布局示例：**

```
┌─────────────────────────────────────────────┐
│ Code (JSON) · 45 lines          [Edit ✏️]  │
├─────────────────────────────────────────────┤
│ 1  {                                        │
│ 2    "name": "example",                     │
│ 3    "version": "1.0.0",                    │
│ 4    ...                                    │
│ 5  }                                        │
└─────────────────────────────────────────────┘
```

**实现要点：**

- 使用 `max-height` 限制高度（如 120px）
- 添加渐变遮罩效果，提示内容被截断
- 点击任意位置或「Edit」按钮进入编辑态

#### 2.1.2 编辑态（Edit Mode）

**特点：**

- 使用 React Portal 挂载到 `document.body`
- 全屏模态展示，充分利用屏幕空间
- 半透明遮罩层，突出编辑器
- 编辑器容器比屏幕略小（留出边距），呈现悬浮效果
- 完整的编辑功能（搜索、替换、代码折叠等）
- 支持 ESC 键和点击遮罩关闭

**布局示例：**

```
┌─────────────────────────────────────────────────────────────┐
│                    [半透明遮罩层 - 点击关闭]                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Code Editor (JSON) · 45 lines    [Format] [Done ✓] │   │
│   ├─────────────────────────────────────────────────────┤   │
│   │ 1  {                                                │   │
│   │ 2    "name": "example",                             │   │
│   │ 3    "version": "1.0.0",                            │   │
│   │ 4    "description": "A sample package",             │   │
│   │ 5    "main": "index.js",                            │   │
│   │ 6    "scripts": {                                   │   │
│   │ 7      "test": "jest",                              │   │
│   │ 8      "build": "webpack"                           │   │
│   │ 9    },                                             │   │
│   │ 10   "dependencies": {                              │   │
│   │ 11     "react": "^18.0.0"                           │   │
│   │ 12   },                                             │   │
│   │ ...                                                 │   │
│   │ 45 }                                                │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**实现要点：**

- 使用 `ReactDOM.createPortal` 挂载到 `document.body`
- 编辑器容器宽度：`calc(100vw - 80px)`，高度：`calc(100vh - 80px)`
- 遮罩层背景：`rgba(0, 0, 0, 0.5)`
- 编辑器容器居中显示，带圆角和阴影
- 点击遮罩层或按 ESC 键关闭编辑器
- 打开时禁止 body 滚动（`overflow: hidden`）

### 2.2 模式切换策略

**切换方式：**

- **预览态 → 编辑态**：点击预览区域或「Edit」按钮，打开全屏模态编辑器
- **编辑态 → 预览态**：
  - 点击「Done」按钮
  - 点击遮罩层
  - 按 ESC 键
  - 失去焦点（可配置）

**配置项：**

```typescript
interface CodeEditorConfig {
  // 初始模式
  initialMode?: 'preview' | 'edit';

  // 预览态配置
  previewLines?: number; // 预览行数，默认 3
  previewMaxHeight?: number; // 预览最大高度，默认 120px

  // 编辑态配置（全屏模态）
  modalPadding?: number; // 模态边距，默认 40px（编辑器容器距离屏幕边缘的距离）
  backdropOpacity?: number; // 遮罩层透明度，默认 0.5

  // 切换行为
  closeOnEscape?: boolean; // 按 ESC 键关闭，默认 true
  closeOnBackdropClick?: boolean; // 点击遮罩关闭，默认 true
  closeOnBlur?: boolean; // 失去焦点时关闭，默认 false
}
```

---

## 3. 组件架构

### 3.1 组件层次结构

```
CodeEditorWidget (主组件)
├── CodeEditorPreview (预览态组件)
│   ├── PreviewHeader (头部：语言标签、行数、编辑按钮)
│   ├── CodeMirrorView (只读编辑器)
│   └── PreviewOverlay (渐变遮罩)
└── CodeEditorModal (编辑态模态组件 - 使用 Portal)
    ├── Backdrop (遮罩层)
    └── ModalContainer (编辑器容器)
        ├── ModalHeader (头部：语言标签、行数、操作按钮)
        ├── CodeMirrorView (可编辑编辑器)
        └── ModalFooter (底部：可选的状态栏或提示信息)
```

### 3.2 核心组件设计

#### 3.2.1 CodeEditorWidget

**职责：**

- 实现 `FieldWidgetProps` 接口
- 管理预览态和编辑态的切换
- 处理表单值的读写
- 提供统一的错误处理
- 管理 body 滚动锁定

**Props：**

```typescript
interface CodeEditorWidgetProps extends FieldWidgetProps {
  // 语言类型
  language?: 'javascript' | 'json' | 'python' | 'sql' | 'yaml' | 'markdown' | 'html' | 'css';

  // 编辑器配置
  config?: CodeEditorConfig;

  // 主题
  theme?: 'light' | 'dark';

  // 验证器（可选）
  validator?: (code: string) => string | null;

  // 格式化器（可选）
  formatter?: (code: string) => string;

  // 其他 FieldWidgetProps
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  readonly?: boolean;
  error?: string;
}
```

**状态管理：**

```typescript
interface CodeEditorState {
  isModalOpen: boolean; // 模态是否打开
  internalValue: string; // 内部值（用于取消编辑时恢复）
  lineCount: number;
}
```

**实现示例：**

```typescript
import React, { forwardRef, useState, useCallback, useEffect } from 'react';
import type { FieldWidgetProps } from '../types';
import { CodeEditorPreview } from './CodeEditorPreview';
import { CodeEditorModal } from './CodeEditorModal';

export const CodeEditorWidget = forwardRef<HTMLDivElement, CodeEditorWidgetProps>(
  ({
    name,
    value = '',
    onChange,
    onBlur,
    disabled = false,
    readonly = false,
    error,
    language = 'javascript',
    config = {},
    theme = 'light',
    validator,
    formatter,
    ...rest
  }, ref) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(value);

    // 打开模态时锁定 body 滚动
    useEffect(() => {
      if (isModalOpen) {
        document.body.style.overflow = 'hidden';
        return () => {
          document.body.style.overflow = '';
        };
      }
    }, [isModalOpen]);

    const handleEdit = useCallback(() => {
      setInternalValue(value);
      setIsModalOpen(true);
    }, [value]);

    const handleClose = useCallback(() => {
      setIsModalOpen(false);
      onBlur?.();
    }, [onBlur]);

    const handleSave = useCallback((newValue: string) => {
      onChange?.(newValue);
      setIsModalOpen(false);
      onBlur?.();
    }, [onChange, onBlur]);

    const handleCancel = useCallback(() => {
      setIsModalOpen(false);
      onBlur?.();
    }, [onBlur]);

    return (
      <>
        <CodeEditorPreview
          ref={ref}
          value={value}
          language={language}
          theme={theme}
          config={config}
          disabled={disabled}
          readonly={readonly}
          error={error}
          onEdit={handleEdit}
        />

        {isModalOpen && (
          <CodeEditorModal
            name={name}
            value={internalValue}
            language={language}
            theme={theme}
            config={config}
            disabled={disabled}
            readonly={readonly}
            onSave={handleSave}
            onCancel={handleCancel}
            onClose={handleClose}
            validator={validator}
            formatter={formatter}
          />
        )}
      </>
    );
  }
);

CodeEditorWidget.displayName = 'CodeEditorWidget';
```

#### 3.2.2 CodeEditorPreview

**职责：**

- 渲染预览态界面
- 显示代码的前几行
- 提供进入编辑态的交互

**实现要点：**

```typescript
export const CodeEditorPreview: React.FC<CodeEditorPreviewProps> = ({
  value,
  language,
  theme,
  config,
  disabled,
  readonly,
  error,
  onEdit,
}) => {
  const lineCount = value.split('\n').length;
  const previewLines = config.previewLines || 3;

  return (
    <div
      className={`code-editor-preview ${error ? 'has-error' : ''}`}
      onClick={!disabled && !readonly ? onEdit : undefined}
    >
      <div className="preview-header">
        <span className="language-badge">{language.toUpperCase()}</span>
        <span className="line-count">{lineCount} lines</span>
        {!disabled && !readonly && (
          <button className="edit-button" onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
      <div className="preview-content">
        <CodeMirrorView
          value={value}
          language={language}
          theme={theme}
          readonly={true}
          maxHeight={config.previewMaxHeight || 120}
        />
        {lineCount > previewLines && (
          <div className="preview-overlay" />
        )}
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};
```

#### 3.2.3 CodeEditorModal

**职责：**

- 使用 Portal 渲染全屏模态编辑器
- 处理代码编辑和保存/取消逻辑
- 管理键盘事件（ESC 关闭）
- 处理遮罩层点击事件

**实现要点：**

```typescript
import ReactDOM from 'react-dom';

export const CodeEditorModal: React.FC<CodeEditorModalProps> = ({
  name,
  value,
  language,
  theme,
  config,
  disabled,
  readonly,
  onSave,
  onCancel,
  onClose,
  validator,
  formatter,
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const lineCount = internalValue.split('\n').length;
  const modalPadding = config.modalPadding || 40;
  const backdropOpacity = config.backdropOpacity || 0.5;

  // 处理 ESC 键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && config.closeOnEscape !== false) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [config.closeOnEscape, onCancel]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && config.closeOnBackdropClick !== false) {
      onCancel();
    }
  }, [config.closeOnBackdropClick, onCancel]);

  const handleFormat = useCallback(() => {
    if (formatter) {
      const formatted = formatter(internalValue);
      setInternalValue(formatted);
    }
  }, [formatter, internalValue]);

  const handleSave = useCallback(() => {
    onSave(internalValue);
  }, [internalValue, onSave]);

  const modalContent = (
    <div className="code-editor-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="code-editor-modal-container"
        style={{
          width: `calc(100vw - ${modalPadding * 2}px)`,
          height: `calc(100vh - ${modalPadding * 2}px)`,
        }}
      >
        <div className="modal-header">
          <span className="language-badge">{language.toUpperCase()}</span>
          <span className="line-count">{lineCount} lines</span>
          <div className="modal-actions">
            {formatter && (
              <button className="format-button" onClick={handleFormat}>
                Format
              </button>
            )}
            <button className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
            <button className="save-button" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
        <div className="modal-content">
          <CodeMirrorView
            value={internalValue}
            language={language}
            theme={theme}
            readonly={readonly || disabled}
            onChange={setInternalValue}
            validator={validator}
          />
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
```

#### 3.2.4 CodeMirrorView

**职责：**

- 封装 CodeMirror 6 的核心功能
- 处理语言支持和扩展加载
- 管理编辑器实例的生命周期

**实现要点：**

```typescript
import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';

const languageExtensions = {
  javascript: javascript(),
  json: json(),
  // ... 其他语言
};

export const CodeMirrorView: React.FC<CodeMirrorViewProps> = ({
  value,
  language,
  readonly,
  onChange,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      keymap.of(defaultKeymap),
      languageExtensions[language] || [],
      EditorView.editable.of(!readonly),
    ];

    if (onChange) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        })
      );
    }

    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: editorRef.current,
    });

    viewRef.current = view;
    return () => view.destroy();
  }, [language, readonly]);

  return <div ref={editorRef} />;
};
```

---

## 4. Schema 集成

### 4.1 Schema 定义

在 JSON Schema 中使用 CodeEditor Widget：

```typescript
const schema: ExtendedJSONSchema = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      title: 'Code',
      description: 'Enter your code here',
      ui: {
        widget: 'code-editor',
        language: 'javascript',
        config: {
          initialMode: 'preview',
          previewLines: 5,
          editorHeight: 400,
          resizable: true,
        },
      },
    },
  },
};
```

### 4.2 Widget 注册

```typescript
import { CodeEditorWidget } from '@/components/DynamicForm/widgets/CodeEditorWidget';

const customWidgets = {
  'code-editor': CodeEditorWidget,
};

<DynamicForm
  schema={schema}
  widgets={customWidgets}
  onSubmit={handleSubmit}
/>
```

### 4.3 支持的语言类型

- `javascript` / `js`
- `json`
- `python` / `py`
- `sql`
- `yaml` / `yml`
- `markdown` / `md`
- `html`
- `css`

---

## 5. 高级特性

### 5.1 代码验证

提供自定义验证器，实时检查代码错误：

```typescript
const jsonValidator = (code: string): string | null => {
  try {
    JSON.parse(code);
    return null;
  } catch (error) {
    return `Invalid JSON: ${error.message}`;
  }
};

<DynamicForm
  schema={schema}
  widgets={{
    'code-editor': (props) => (
      <CodeEditorWidget {...props} validator={jsonValidator} />
    ),
  }}
/>
```

### 5.2 代码格式化

提供格式化功能，美化代码：

```typescript
const jsonFormatter = (code: string): string => {
  try {
    return JSON.stringify(JSON.parse(code), null, 2);
  } catch {
    return code;
  }
};

<DynamicForm
  schema={schema}
  widgets={{
    'code-editor': (props) => (
      <CodeEditorWidget {...props} formatter={jsonFormatter} />
    ),
  }}
/>
```

### 5.3 主题定制

支持亮色和暗色主题：

```typescript
{
  type: 'string',
  title: 'Code',
  ui: {
    widget: 'code-editor',
    theme: 'dark', // 'light' | 'dark'
  }
}
```

### 5.4 自动补全

集成 CodeMirror 的自动补全功能：

```typescript
import { autocompletion } from '@codemirror/autocomplete';

// 在 CodeMirrorView 中添加扩展
const extensions = [
  // ... 其他扩展
  autocompletion({
    override: [customCompletions],
  }),
];
```

---

## 6. 样式设计

### 6.1 预览态样式

```css
.code-editor-preview {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s;
}

.code-editor-preview:hover {
  border-color: #9ca3af;
}

.code-editor-preview.has-error {
  border-color: #ef4444;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.language-badge {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

.line-count {
  font-size: 12px;
  color: #9ca3af;
}

.preview-content {
  position: relative;
  overflow: hidden;
}

.preview-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(transparent, white);
  pointer-events: none;
}
```

### 6.2 编辑态模态样式

```css
/* 遮罩层 */
.code-editor-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 编辑器容器 */
.code-editor-modal-container {
  background: white;
  border-radius: 8px;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* 模态头部 */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.modal-actions {
  display: flex;
  gap: 8px;
}

/* 模态内容区 */
.modal-content {
  flex: 1;
  overflow: auto;
  min-height: 0;
}
```

---

## 7. 使用示例

### 7.1 基础用法

```typescript
const schema = {
  type: 'object',
  properties: {
    script: {
      type: 'string',
      title: 'JavaScript Code',
      ui: {
        widget: 'code-editor',
        language: 'javascript',
      },
    },
  },
};

<DynamicForm
  schema={schema}
  widgets={{ 'code-editor': CodeEditorWidget }}
  onSubmit={(data) => console.log(data)}
/>
```

### 7.2 JSON 配置编辑器

```typescript
const schema = {
  type: 'object',
  properties: {
    config: {
      type: 'string',
      title: 'Configuration',
      ui: {
        widget: 'code-editor',
        language: 'json',
        config: {
          previewLines: 5,
          editorHeight: 400,
        },
      },
    },
  },
};

const jsonValidator = (code: string) => {
  try {
    JSON.parse(code);
    return null;
  } catch (error) {
    return `Invalid JSON: ${error.message}`;
  }
};

const jsonFormatter = (code: string) => {
  try {
    return JSON.stringify(JSON.parse(code), null, 2);
  } catch {
    return code;
  }
};

<DynamicForm
  schema={schema}
  widgets={{
    'code-editor': (props) => (
      <CodeEditorWidget
        {...props}
        validator={jsonValidator}
        formatter={jsonFormatter}
      />
    ),
  }}
/>
```

### 7.3 SQL 查询编辑器

```typescript
const schema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      title: 'SQL Query',
      ui: {
        widget: 'code-editor',
        language: 'sql',
        config: {
          initialMode: 'edit',
          editorHeight: 300,
        },
      },
    },
  },
};
```

---

## 8. 实现计划

### 8.1 第一阶段：基础功能

**目标：** 实现基本的代码编辑器 Widget

**任务：**

1. 安装 CodeMirror 6 依赖包
2. 创建 `CodeMirrorView` 组件，封装 CodeMirror 核心功能
3. 实现 `CodeEditorWidget` 主组件
4. 支持基本的语言类型（JavaScript、JSON）
5. 实现预览态和编辑态的基本切换
6. 集成到 DynamicForm 的 widget 体系

**验收标准：**

- 能够在表单中正常显示和编辑代码
- 支持语法高亮
- 预览态和编辑态切换流畅
- 表单值正确读写

### 8.2 第二阶段：交互优化

**目标：** 优化用户体验

**任务：**

1. 实现预览态的渐变遮罩效果
2. 实现编辑器高度调整功能（ResizeHandle）
3. 添加语言标签和行数统计
4. 优化模式切换动画
5. 添加错误状态显示
6. 实现 disabled 和 readonly 状态

**验收标准：**

- 预览态显示美观，有明确的「展开」提示
- 编辑器高度可拖拽调整
- 状态切换有平滑动画
- 错误提示清晰

### 8.3 第三阶段：高级特性

**目标：** 增强编辑器功能

**任务：**

1. 支持更多语言（Python、SQL、YAML 等）
2. 实现代码验证功能
3. 实现代码格式化功能
4. 添加主题支持（亮色/暗色）
5. 集成自动补全功能
6. 添加搜索和替换功能

**验收标准：**

- 支持至少 6 种编程语言
- 验证器能实时检查代码错误
- 格式化功能正常工作
- 主题切换流畅

### 8.4 第四阶段：性能优化和测试

**目标：** 确保稳定性和性能

**任务：**

1. 优化大文件编辑性能
2. 添加单元测试
3. 添加集成测试
4. 编写使用文档
5. 性能测试和优化

**验收标准：**

- 能流畅编辑 1000+ 行代码
- 测试覆盖率 > 80%
- 文档完整清晰

---

## 9. 技术难点与解决方案

### 9.1 CodeMirror 实例管理

**问题：** CodeMirror 实例需要手动创建和销毁，与 React 的生命周期不匹配。

**解决方案：**

- 使用 `useRef` 保存编辑器实例
- 在 `useEffect` 中创建实例，返回清理函数销毁实例
- 使用 `useEffect` 依赖项控制重新创建时机

### 9.2 值同步问题

**问题：** 表单值更新时，需要同步到 CodeMirror 编辑器。

**解决方案：**

- 监听 `value` prop 的变化
- 使用 `dispatch` 方法更新编辑器内容
- 避免循环更新（检查值是否真的改变）

### 9.3 性能优化

**问题：** 大文件编辑可能导致性能问题。

**解决方案：**

- 利用 CodeMirror 6 的虚拟滚动特性
- 按需加载语言支持包
- 使用 `useMemo` 缓存扩展配置
- 防抖处理 onChange 事件

### 9.4 预览态截断显示

**问题：** 如何优雅地显示代码的前几行。

**解决方案：**

- 使用 `max-height` + `overflow: hidden` 限制高度
- 添加渐变遮罩提示内容被截断
- 保持语法高亮（使用只读的 CodeMirror 实例）

---

## 10. 最佳实践

### 10.1 语言选择

根据数据类型自动推断语言：

```typescript
const getLanguageFromSchema = (schema: ExtendedJSONSchema): string => {
  if (schema.format === 'json') return 'json';
  if (schema.contentMediaType === 'application/json') return 'json';
  if (schema.contentMediaType === 'text/javascript') return 'javascript';
  return 'text';
};
```

### 10.2 默认值处理

为代码字段提供合理的默认值：

```typescript
{
  type: 'string',
  title: 'Configuration',
  default: '{\n  "key": "value"\n}',
  ui: {
    widget: 'code-editor',
    language: 'json',
  }
}
```

### 10.3 验证集成

将代码验证与 Schema 验证结合：

```typescript
{
  type: 'string',
  title: 'JSON Config',
  ui: {
    widget: 'code-editor',
    language: 'json',
    errorMessages: {
      pattern: 'Invalid JSON format',
    },
  },
  // 使用 pattern 进行基础验证
  pattern: '^\\{.*\\}$',
}
```

---

## 11. 文件结构

```
src/components/DynamicForm/
├── widgets/
│   ├── CodeEditorWidget/
│   │   ├── index.ts                    # 导出主组件
│   │   ├── CodeEditorWidget.tsx        # 主组件
│   │   ├── CodeEditorPreview.tsx       # 预览态组件
│   │   ├── CodeEditorModal.tsx         # 编辑态模态组件（使用 Portal）
│   │   ├── CodeMirrorView.tsx          # CodeMirror 封装
│   │   ├── types.ts                    # 类型定义
│   │   ├── utils.ts                    # 工具函数
│   │   ├── styles.css                  # 样式文件
│   │   └── __tests__/                  # 测试文件
│   │       ├── CodeEditorWidget.test.tsx
│   │       ├── CodeEditorModal.test.tsx
│   │       └── CodeMirrorView.test.tsx
│   └── index.ts                        # 导出所有 widgets
```

---

## 12. API 参考

### 12.1 CodeEditorWidget Props

| 属性        | 类型                               | 默认值         | 说明             |
| ----------- | ---------------------------------- | -------------- | ---------------- |
| `name`      | `string`                           | -              | 字段名称（必需） |
| `value`     | `string`                           | `''`           | 代码内容         |
| `onChange`  | `(value: string) => void`          | -              | 值变化回调       |
| `onBlur`    | `() => void`                       | -              | 失去焦点回调     |
| `language`  | `string`                           | `'javascript'` | 编程语言         |
| `config`    | `CodeEditorConfig`                 | `{}`           | 编辑器配置       |
| `theme`     | `'light' \| 'dark'`                | `'light'`      | 主题             |
| `disabled`  | `boolean`                          | `false`        | 是否禁用         |
| `readonly`  | `boolean`                          | `false`        | 是否只读         |
| `error`     | `string`                           | -              | 错误信息         |
| `validator` | `(code: string) => string \| null` | -              | 验证器           |
| `formatter` | `(code: string) => string`         | -              | 格式化器         |

### 12.2 CodeEditorConfig

| 属性                   | 类型                  | 默认值      | 说明                                     |
| ---------------------- | --------------------- | ----------- | ---------------------------------------- |
| `initialMode`          | `'preview' \| 'edit'` | `'preview'` | 初始模式                                 |
| `previewLines`         | `number`              | `3`         | 预览行数                                 |
| `previewMaxHeight`     | `number`              | `120`       | 预览最大高度（px）                       |
| `modalPadding`         | `number`              | `40`        | 模态边距（编辑器距离屏幕边缘的距离，px） |
| `backdropOpacity`      | `number`              | `0.5`       | 遮罩层透明度（0-1）                      |
| `closeOnEscape`        | `boolean`             | `true`      | 按 ESC 键关闭模态                        |
| `closeOnBackdropClick` | `boolean`             | `true`      | 点击遮罩层关闭模态                       |
| `closeOnBlur`          | `boolean`             | `false`     | 失去焦点时关闭模态                       |

---

## 13. 总结

### 13.1 核心特性

本设计方案为 DynamicForm 提供了一个功能完善的代码编辑器 Widget，具有以下核心特性：

1. **双模式设计**：预览态和编辑态分离，优化表单空间利用
2. **专业编辑体验**：基于 CodeMirror 6，提供语法高亮、代码折叠等功能
3. **多语言支持**：支持 JavaScript、JSON、Python、SQL、YAML 等常见语言
4. **灵活配置**：通过 Schema 配置语言、主题、编辑器行为等
5. **无缝集成**：完全兼容 DynamicForm 的 widget 体系和表单验证机制

### 13.2 设计亮点

1. **Portal 全屏模态**：编辑态使用 React Portal 挂载到 body，充分利用屏幕空间，不受表单容器尺寸限制
2. **预览态优化**：通过紧凑的预览模式，解决了代码内容过长占用空间的问题
3. **沉浸式编辑体验**：全屏模态配合半透明遮罩，提供专注的代码编辑环境
4. **灵活的关闭方式**：支持 ESC 键、点击遮罩、点击按钮等多种关闭方式
5. **渐进增强**：基础功能简单易用，高级功能（验证、格式化）可选配置
6. **性能优先**：利用 CodeMirror 6 的虚拟滚动和按需加载特性
7. **平滑动画**：模态打开/关闭带有淡入淡出和缩放动画，提升用户体验

### 13.3 后续优化方向

1. **更多语言支持**：根据实际需求添加更多编程语言
2. **协作编辑**：支持多人实时协作编辑（如果需要）
3. **代码片段**：提供常用代码片段的快速插入
4. **差异对比**：支持代码版本对比功能
5. **AI 辅助**：集成 AI 代码补全和建议

---

**文档版本**：v1.0  
**创建日期**：2026-01-09  
**作者**：项目团队
