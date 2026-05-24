import { forwardRef } from 'react';
import { ObjectEditor } from '../../../ObjectEditor';
import type { ObjectEditorWidgetProps } from './types';

/**
 * 对象编辑器 Widget
 * 基于通用 ObjectEditor，支持 JSON 格式编辑对象
 */
export const ObjectEditorWidget = forwardRef<HTMLDivElement, ObjectEditorWidgetProps>(
  (props, ref) => {
    return <ObjectEditor ref={ref} {...props} />;
  }
);

ObjectEditorWidget.displayName = 'ObjectEditorWidget';
