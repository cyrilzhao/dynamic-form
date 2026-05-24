import type { FieldWidgetProps } from '../../types/index';
import type { ObjectEditorProps } from '../../../ObjectEditor';

/**
 * ObjectEditorWidget Props
 * 基于通用 ObjectEditor 的表单字段组件
 */
export interface ObjectEditorWidgetProps
  extends FieldWidgetProps,
    Omit<ObjectEditorProps, 'value' | 'onChange'> {
  /** 对象值 */
  value?: Record<string, unknown>;

  /** 值变化回调，返回解析后的对象 */
  onChange?: (value: Record<string, unknown> | undefined) => void;
}
