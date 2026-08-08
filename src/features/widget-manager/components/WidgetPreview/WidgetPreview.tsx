import React from 'react';
import { Card, Callout, Intent } from '@blueprintjs/core';

interface WidgetPreviewProps {
  component: React.ComponentType<any> | null;
  props: Record<string, any>;
  error?: string;
}

/**
 * Widget 预览组件
 * 在编辑器中实时渲染 Widget 效果
 */
export const WidgetPreview: React.FC<WidgetPreviewProps> = ({ component, props, error }) => {
  if (error) {
    return (
      <Card style={{ padding: 20 }}>
        <Callout intent={Intent.DANGER} title="编译错误">
          {error}
        </Callout>
      </Card>
    );
  }

  if (!component) {
    return (
      <Card style={{ padding: 20 }}>
        <Callout intent={Intent.PRIMARY} title="预览区域">
          在左侧编辑代码，实时预览效果将显示在这里
        </Callout>
      </Card>
    );
  }

  const WidgetComponent = component;

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ marginBottom: 10, color: '#5C7080', fontSize: 12 }}>
        预览效果：
      </div>
      <div style={{ border: '1px dashed #CCC', padding: 20, borderRadius: 4 }}>
        <WidgetComponent {...props} />
      </div>
    </Card>
  );
};
