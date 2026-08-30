import type { ExtendedJSONSchema } from '../DynamicForm/types/schema';

export type PreviewMode = 'both' | 'form' | 'json' | 'none';

export interface SchemaBuilderRef {
  /**
   * Update schema without remounting the component.
   * Preserves user state like expanded nodes and selected path.
   */
  setSchema: (schema: ExtendedJSONSchema) => void;

  /**
   * Get current schema value.
   */
  getSchema: () => ExtendedJSONSchema;

  /**
   * Reset to initial schema and clear all user state.
   */
  reset: () => void;
}

export interface SchemaBuilderProps {
  /**
   * The initial schema to edit (uncontrolled mode).
   * Only used during component initialization.
   * To reset the schema after mount, use the `key` prop to remount the component.
   */
  defaultValue?: ExtendedJSONSchema;

  /**
   * Callback fired when the schema changes.
   */
  onChange?: (schema: ExtendedJSONSchema) => void;

  /**
   * Initial selected field path.
   * Supports both array format: ['properties', 'user', 'properties', 'name']
   * and JSON Pointer format: '#/properties/user/properties/name'
   *
   * Note: Cannot select 'items' nodes directly as they are not editable.
   */
  initialSelectedPath?: string[] | string;

  /**
   * Hide the left schema tree panel
   */
  hideTree?: boolean;

  /** 可选的 UI 能力控制，未配置项默认显示且可编辑。 */
  options?: SchemaBuilderOptions;

  /**
   * Control preview panel visibility
   * - 'both': Show both form and json tabs (default)
   * - 'form': Show only form preview
   * - 'json': Show only json schema
   * - 'none': Hide entire preview panel
   */
  previewMode?: PreviewMode;

  /**
   * Optional custom class name.
   */
  className?: string;

  /**
   * Optional custom styles.
   */
  style?: React.CSSProperties;
}

export interface SchemaBuilderOptions {
  rootType?: SchemaNodeType | 'null';
  hidden?: {
    tree?: boolean;
    preview?: boolean;
    importExport?: boolean;
    propertyEditor?: boolean;
    rootValidation?: boolean;
    variantsTab?: boolean;
  };
  readonly?: {
    all?: boolean;
    tree?: boolean;
    propertyEditor?: boolean;
    schema?: boolean;
    addFieldActions?: boolean;
    deleteFieldActions?: boolean;
    reorderFieldActions?: boolean;
    editFieldKey?: boolean;
    editFieldType?: boolean;
  };
}

export type SchemaNodeType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

export interface SchemaNode extends ExtendedJSONSchema {
  key?: string; // For object properties
}

export interface SchemaBuilderContextType {
  schema: ExtendedJSONSchema;
  options?: SchemaBuilderOptions;
  selectedPath: string[]; // Path to the currently selected node
  expandedPaths: Record<string, boolean>;
  onSelect: (path: string[]) => void;
  onUpdate: (path: string[], updates: Partial<SchemaNode>, newKey?: string) => void;
  onAddChild: (path: string[], type: SchemaNodeType) => void;
  onAddSibling: (path: string[], type: SchemaNodeType) => void;
  onDelete: (path: string[]) => void;
  onToggleExpand: (path: string[], expanded: boolean) => void;
  onMoveUp: (path: string[]) => void;
  onMoveDown: (path: string[]) => void;
}
