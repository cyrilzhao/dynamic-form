import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Intent, Tag, Callout, Spinner } from '@blueprintjs/core';
import { CodeMirrorView } from '@/components/CodeEditor/CodeMirrorView';
import { WidgetPreview } from '../components/WidgetPreview/WidgetPreview';
import { PropsConfigDialog } from '../components/PropsConfigDialog/PropsConfigDialog';
import { WidgetCompiler } from '../services/widgetCompiler';
import { WidgetSandbox } from '@/utils/widgetSandbox';
import { fetchWidgetById, createWidget, updateWidget } from '../services/widgetApi';
import type { CustomWidget } from '../types/widget';

const DEFAULT_CODE = `import React, { useState } from 'react';
import { FormGroup, InputGroup, Intent, Button } from '@blueprintjs/core';
import { ofetch } from 'ofetch';
import _ from 'lodash';
import { z } from 'zod';

/**
 * 自定义 Widget 示例
 *
 * 可用的内置依赖：
 * - React Hooks: useState, useEffect, useMemo, useCallback, useRef 等
 * - @blueprintjs/core: 所有 Blueprint 组件
 * - @blueprintjs/icons: 所有图标
 * - ofetch: HTTP 请求工具
 * - lodash (_): 完整的 Lodash 工具库
 * - zod (z): 运行时数据校验
 */

export default function MyCustomWidget({
  name,
  label,
  value = '',
  onChange,
  onBlur,
  disabled = false,
  readonly = false,
  required = false,
  error,
  placeholder,
  ...otherProps
}) {
  // 使用防抖优化输入性能
  const debouncedChange = _.debounce((val) => {
    onChange?.(val);
  }, 300);

  const handleChange = (e) => {
    const newValue = e.target.value;
    debouncedChange(newValue);
  };

  // 使用 zod 进行数据校验
  const validateInput = (val) => {
    const schema = z.string().min(3, 'At least 3 characters required');
    try {
      schema.parse(val);
      return null;
    } catch (err) {
      return err.errors[0]?.message;
    }
  };

  return (
    <FormGroup
      label={label}
      labelFor={name}
      labelInfo={required ? '(required)' : undefined}
      helperText={error || validateInput(value)}
      intent={error ? Intent.DANGER : Intent.NONE}
    >
      <InputGroup
        id={name}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        disabled={disabled}
        readOnly={readonly}
        placeholder={placeholder || 'Enter at least 3 characters...'}
        intent={error ? Intent.DANGER : Intent.NONE}
      />
    </FormGroup>
  );
}`;

const STATUS_COLORS: Record<string, Intent> = {
  draft: Intent.NONE,
  published: Intent.SUCCESS,
  archived: Intent.DANGER,
};

const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已下架',
};

export const WidgetEditorPage: React.FC = () => {
  console.log('[WidgetEditorPage] Component rendering');

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  console.log('[WidgetEditorPage] id:', id, 'isEditMode:', isEditMode);

  const [widget, setWidget] = useState<CustomWidget | null>(null);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  const [previewProps, setPreviewProps] = useState<Record<string, any>>({});
  const [propsDialogOpen, setPropsDialogOpen] = useState(false);

  const compiler = useMemo(() => new WidgetCompiler(), []);
  const sandbox = useMemo(() => new WidgetSandbox(), []);

  const [compiledComponent, setCompiledComponent] = useState<React.ComponentType<any> | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      loadWidget(id);
    }

    const savedProps = localStorage.getItem('widget-preview-props');
    if (savedProps) {
      try {
        // 使用 Function Constructor 解析保存的 props 配置
        // 这是受控环境，仅用于开发者预览自定义 widget
        const parseFn = new Function(`return (${savedProps})`);
        setPreviewProps(parseFn());
      } catch {
        // 忽略解析错误
      }
    }
  }, [id, isEditMode]);

  // 移除自动编译，改为手动触发
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     compileCode(code);
  //   }, 1500);
  //   return () => clearTimeout(timer);
  // }, [code]);

  const loadWidget = async (widgetId: string) => {
    console.log('[WidgetEditorPage] Loading widget:', widgetId);
    setLoading(true);
    try {
      const data = await fetchWidgetById(widgetId);
      console.log('[WidgetEditorPage] Widget loaded:', data);
      if (data) {
        setWidget(data);
        setCode(data.code);
      } else {
        console.error('[WidgetEditorPage] Widget not found');
      }
    } catch (error) {
      console.error('[WidgetEditorPage] Failed to load widget:', error);
    } finally {
      setLoading(false);
      console.log('[WidgetEditorPage] Loading complete, loading state:', false);
    }
  };

  const compileCode = (sourceCode: string) => {
    setCompiling(true);

    try {
      const compileResult = compiler.compile(sourceCode);

      if (!compileResult.success || !compileResult.code) {
        setCompileError(compileResult.error || 'Compilation failed');
        return;
      }

      const executeResult = sandbox.execute(compileResult.code);

      if (!executeResult.success || !executeResult.component) {
        setCompileError(executeResult.error || 'Execution failed');
        return;
      }

      // 编译和执行都成功，更新组件并清除错误
      setCompileError(null);
      setCompiledComponent(() => executeResult.component);
    } finally {
      setCompiling(false);
    }
  };

  const handleCompile = () => {
    compileCode(code);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEditMode && id) {
        await updateWidget(id, { code });
      } else {
        const widgetName = prompt('请输入 Widget 名称（kebab-case）：');
        if (!widgetName) return;
        await createWidget({ name: widgetName, code });
      }
      navigate('/widget-manager');
    } catch (error) {
      console.error('Failed to save widget:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <Spinner />
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>
              {widget ? widget.name : '新建 Widget'}
            </h2>
            {widget && (
              <Tag intent={STATUS_COLORS[widget.status]}>
                {STATUS_LABELS[widget.status]}
              </Tag>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button onClick={() => navigate('/widget-manager')}>返回</Button>
            <Button
              intent={Intent.PRIMARY}
              icon="floppy-disk"
              loading={saving}
              onClick={handleSave}
            >
              保存
            </Button>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '50% 50%', gap: 20 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>代码编辑器</h3>
            <Button
              icon="play"
              text="编译预览"
              intent={Intent.PRIMARY}
              loading={compiling}
              onClick={handleCompile}
            />
          </div>
          <div style={{ border: '1px solid #CCC', borderRadius: 4 }}>
            <CodeMirrorView
              value={code}
              language="javascript"
              onChange={setCode}
              maxHeight={600}
              lineWrapping={true}
            />
          </div>
        </Card>

        <div>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>实时预览</h3>
              <Button
                icon="cog"
                text="配置 Props"
                onClick={() => setPropsDialogOpen(true)}
              />
            </div>
          </Card>

          {compileError && (
            <Callout intent={Intent.DANGER} style={{ marginBottom: 20 }}>
              {compileError}
            </Callout>
          )}

          <WidgetPreview
            component={compiledComponent}
            props={previewProps}
            error={compileError || undefined}
          />
        </div>
      </div>

      <PropsConfigDialog
        isOpen={propsDialogOpen}
        onClose={() => setPropsDialogOpen(false)}
        onApply={setPreviewProps}
        initialProps={previewProps}
      />
    </div>
  );
};
