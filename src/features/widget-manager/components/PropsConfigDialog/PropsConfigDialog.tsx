import React, { useState } from 'react';
import { Dialog, Button, Intent, Classes, Callout } from '@blueprintjs/core';
import { CodeMirrorView } from '@/components/CodeEditor/CodeMirrorView';

interface PropsConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (props: Record<string, any>) => void;
  initialProps?: Record<string, any>;
}

/**
 * Props 配置弹窗
 * 使用 CodeEditor 编辑 JavaScript 对象字面量形式的 Props
 */
export const PropsConfigDialog: React.FC<PropsConfigDialogProps> = ({
  isOpen,
  onClose,
  onApply,
  initialProps = {},
}) => {
  const [propsCode, setPropsCode] = useState(() => {
    return JSON.stringify(initialProps, null, 2);
  });
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    try {
      // 使用 Function Constructor 解析 JavaScript 对象字面量
      // 支持函数、复杂对象等 JSON 不支持的语法
      // 这是受控环境，仅用于开发者预览 widget
      const parseFn = new Function(`return (${propsCode})`);
      const props = parseFn();

      if (typeof props !== 'object' || props === null) {
        throw new Error('Props must be an object');
      }

      localStorage.setItem('widget-preview-props', propsCode);

      onApply(props);
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid props format');
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="配置 Widget Props"
      style={{ width: 800 }}
    >
      <div className={Classes.DIALOG_BODY}>
        <p style={{ marginBottom: 10, color: '#5C7080' }}>
          在下方编辑器中以 JavaScript 对象字面量形式配置 Widget 的 props（支持函数）
        </p>

        {error && (
          <Callout intent={Intent.DANGER} style={{ marginBottom: 10 }}>
            {error}
          </Callout>
        )}

        <div style={{ border: '1px solid #CCC', borderRadius: 4 }}>
          <CodeMirrorView
            value={propsCode}
            language="javascript"
            onChange={setPropsCode}
            maxHeight={400}
          />
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>取消</Button>
          <Button intent={Intent.PRIMARY} onClick={handleApply}>
            应用
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
