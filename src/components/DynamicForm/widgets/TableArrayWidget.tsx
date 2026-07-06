import React, {
  forwardRef,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import {
  Button,
  Popover,
  PopoverInteractionKind,
  Tooltip,
} from "@blueprintjs/core";
import { Virtuoso } from "react-virtuoso";
import type { FieldWidgetProps } from "../types";
import type { ExtendedJSONSchema } from "../types/schema";
import { FieldRegistry } from "../core/FieldRegistry";
import { SchemaParser } from "../core/SchemaParser";
import "./TableArrayWidget.scss";

export interface TableArrayWidgetProps extends FieldWidgetProps {
  schema: ExtendedJSONSchema & {
    type: "array";
    items: ExtendedJSONSchema & {
      type: "object";
      properties: Record<string, ExtendedJSONSchema>;
    };
    minItems?: number;
    maxItems?: number;
  };
  value?: any[];
  onChange?: (value: any[]) => void;
  disabled?: boolean;
  readonly?: boolean;
  /**
   * 是否启用虚拟滚动
   */
  enableVirtualScroll?: boolean;
  /**
   * 虚拟滚动容器高度（像素）
   */
  virtualScrollHeight?: number;
  /**
   * 列顺序（可选，默认按 properties 顺序）
   */
  columns?: string[];
  /**
   * 添加按钮文本
   */
  addButtonText?: string;
  /**
   * 空状态提示文本
   */
  emptyText?: string;
}

/**
 * 列定义
 */
interface ColumnDef {
  key: string;
  title: string;
  schema: ExtendedJSONSchema;
  widget: string;
  validationRules: Record<string, any>;
}

/**
 * 根据 schema 生成列定义
 */
function generateColumns({
  itemSchema,
  columnOrder,
}: {
  itemSchema: ExtendedJSONSchema & {
    type: "object";
    properties: Record<string, ExtendedJSONSchema>;
  };
  columnOrder?: string[];
}): ColumnDef[] {
  const properties = itemSchema.properties;
  const keys = columnOrder || Object.keys(properties);
  const requiredFields = itemSchema.required || [];

  return keys.map((key) => {
    const propSchema = properties[key];
    const isRequired = requiredFields.includes(key);
    return {
      key,
      title: propSchema.title || key,
      schema: propSchema,
      widget: determineWidget(propSchema),
      validationRules: SchemaParser.getValidationRules(propSchema, isRequired),
    };
  });
}

/**
 * 根据 schema 确定使用的 widget
 */
function determineWidget(schema: ExtendedJSONSchema): string {
  if (schema.ui?.widget) {
    return schema.ui.widget;
  }

  switch (schema.type) {
    case "string":
      if (schema.format === "email") {
        return "email";
      }
      if (schema.format === "uri") {
        return "url";
      }
      return "text";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "checkbox";
    default:
      return "text";
  }
}

/**
 * 生成默认行数据
 */
function generateDefaultRow(
  itemSchema: ExtendedJSONSchema & {
    type: "object";
    properties: Record<string, ExtendedJSONSchema>;
  },
): any {
  const defaultRow: any = {};
  Object.entries(itemSchema.properties).forEach(([key, propSchema]) => {
    if (propSchema.default !== undefined) {
      defaultRow[key] = propSchema.default;
    } else if (propSchema.type === "string") {
      defaultRow[key] = "";
    } else if (propSchema.type === "number" || propSchema.type === "integer") {
      defaultRow[key] = 0;
    } else if (propSchema.type === "boolean") {
      defaultRow[key] = false;
    }
  });
  return defaultRow;
}

/**
 * 删除确认 Popover 内容组件
 */
interface DeleteConfirmPopoverProps {
  onConfirm: () => void;
  onCancel: () => void;
  itemIndex: number;
}

const DeleteConfirmPopover: React.FC<DeleteConfirmPopoverProps> = ({
  onConfirm,
  onCancel,
  itemIndex,
}) => {
  return (
    <div style={{ padding: "10px", maxWidth: "250px" }}>
      <div style={{ marginBottom: "10px", fontSize: "14px" }}>
        Delete row {itemIndex + 1}?
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
        <Button small onClick={onCancel}>
          Cancel
        </Button>
        <Button small intent="danger" onClick={onConfirm}>
          Delete
        </Button>
      </div>
    </div>
  );
};

/**
 * TableArrayWidget - 表格形式的数组组件
 *
 * 用于以表格形式渲染和编辑对象数组，支持虚拟滚动优化。
 */
export const TableArrayWidget = forwardRef<
  HTMLDivElement,
  TableArrayWidgetProps
>(
  (
    {
      name,
      schema,
      disabled,
      readonly,
      enableVirtualScroll = false,
      virtualScrollHeight = 400,
      columns,
      addButtonText = "Add Row",
      emptyText = "No data",
    },
    ref,
  ) => {
    const { control } = useFormContext();
    const { fields, append, remove } = useFieldArray({
      control,
      name,
    });

    // 从 schema.ui.widgetProps 中获取配置
    const widgetProps = schema.ui?.widgetProps || {};
    const finalEnableVirtualScroll =
      widgetProps.enableVirtualScroll ?? enableVirtualScroll;
    const finalVirtualScrollHeight =
      widgetProps.virtualScrollHeight ?? virtualScrollHeight;
    const finalColumns = widgetProps.columns ?? columns;
    const finalAddButtonText = widgetProps.addButtonText ?? addButtonText;
    const finalEmptyText = widgetProps.emptyText ?? emptyText;

    // 获取数组项的 schema
    const itemSchema = schema.items as ExtendedJSONSchema & {
      type: "object";
      properties: Record<string, ExtendedJSONSchema>;
    };

    if (!itemSchema || itemSchema.type !== "object" || !itemSchema.properties) {
      console.error(
        `TableArrayWidget: schema.items must be an object type with properties`,
      );
      return null;
    }

    // 生成列定义
    const columnDefs = useMemo(
      () => generateColumns({ itemSchema, columnOrder: finalColumns }),
      [itemSchema, finalColumns],
    );

    // 获取最小/最大项数限制
    const minItems = schema.minItems || 0;
    const maxItems = schema.maxItems;

    // 判断是否可以增删
    const canAddRemove = !disabled && !readonly;

    // Virtuoso ref
    const virtuosoRef = useRef<any>(null);

    // 添加新行
    const handleAdd = useCallback(() => {
      const defaultRow = generateDefaultRow(itemSchema);
      append(defaultRow);
    }, [itemSchema, append]);

    // 删除行
    const handleRemove = useCallback(
      (index: number) => {
        remove(index);
      },
      [remove],
    );

    // 判断是否可以删除
    const canRemove = useCallback(
      (index: number) => {
        return canAddRemove && fields.length > minItems;
      },
      [canAddRemove, fields.length, minItems],
    );

    // 判断是否可以添加
    const canAdd = useMemo(() => {
      return (
        canAddRemove && (maxItems === undefined || fields.length < maxItems)
      );
    }, [canAddRemove, maxItems, fields.length]);

    // 渲染表格行
    const renderRow = useCallback(
      (index: number, field: any) => (
        <TableRow
          key={field.id}
          name={name}
          index={index}
          columnDefs={columnDefs}
          onRemove={canRemove(index) ? handleRemove : undefined}
          disabled={disabled}
          readonly={readonly}
        />
      ),
      [name, columnDefs, canRemove, handleRemove, disabled, readonly],
    );

    return (
      <div ref={ref} className="table-array-widget">
        {/* 表格容器 */}
        <div className="table-container">
          {fields.length === 0 ? (
            <div className="table-empty">{finalEmptyText}</div>
          ) : (
            <>
              {/* 表头 */}
              <div className="table-header">
                <div className="table-row">
                  <div className="table-cell index-cell">#</div>
                  {columnDefs.map((col) => (
                    <div key={col.key} className="table-cell">
                      {col.title}
                    </div>
                  ))}
                  {canAddRemove && (
                    <div className="table-cell action-cell">Actions</div>
                  )}
                </div>
              </div>

              {/* 表体 */}
              <div className="table-body">
                {finalEnableVirtualScroll ? (
                  <Virtuoso
                    ref={virtuosoRef}
                    style={{ height: `${finalVirtualScrollHeight}px` }}
                    data={fields}
                    itemContent={renderRow}
                  />
                ) : (
                  fields.map((field, index) => renderRow(index, field))
                )}
              </div>
            </>
          )}
        </div>

        {/* 添加按钮 */}
        {canAdd && (
          <Button
            icon="add"
            intent="primary"
            onClick={handleAdd}
            disabled={!canAdd}
            style={{ marginTop: "10px" }}
          >
            {finalAddButtonText}
          </Button>
        )}
      </div>
    );
  },
);

TableArrayWidget.displayName = "TableArrayWidget";

/**
 * TableRow 组件属性
 */
interface TableRowProps {
  name: string;
  index: number;
  columnDefs: ColumnDef[];
  onRemove?: (index: number) => void;
  disabled?: boolean;
  readonly?: boolean;
}

/**
 * TableRow 组件
 */
const TableRow = React.memo<TableRowProps>(
  ({ name, index, columnDefs, onRemove, disabled, readonly }) => {
    const { control } = useFormContext();
    const [isDeletePopoverOpen, setIsDeletePopoverOpen] = useState(false);

    // 处理删除确认
    const handleConfirmDelete = () => {
      setIsDeletePopoverOpen(false);
      onRemove?.(index);
    };

    // 处理取消删除
    const handleCancelDelete = () => {
      setIsDeletePopoverOpen(false);
    };

    return (
      <div className="table-row">
        {/* 索引列 */}
        <div className="table-cell index-cell">{index + 1}</div>

        {/* 数据列 */}
        {columnDefs.map((col) => {
          const WidgetComponent = FieldRegistry.getWidget(col.widget);
          if (!WidgetComponent) {
            console.error(`Widget "${col.widget}" not found in registry`);
            return (
              <div key={col.key} className="table-cell">
                -
              </div>
            );
          }

          return (
            <div key={col.key} className="table-cell">
              <Controller
                name={`${name}.${index}.${col.key}`}
                control={control}
                rules={col.validationRules}
                render={({ field: controllerField, fieldState }) => (
                  <>
                    <WidgetComponent
                      name={`${name}.${index}.${col.key}`}
                      schema={col.schema}
                      value={controllerField.value}
                      onChange={controllerField.onChange}
                      disabled={disabled}
                      readonly={readonly}
                      error={fieldState.error?.message}
                      {...(col.schema.ui?.widgetProps || {})}
                    />
                    {fieldState.error && (
                      <div
                        style={{
                          color: "#DB3737",
                          fontSize: "11px",
                          marginTop: "2px",
                        }}
                      >
                        {fieldState.error.message}
                      </div>
                    )}
                  </>
                )}
              />
            </div>
          );
        })}

        {/* 操作列 */}
        {onRemove && (
          <div className="table-cell action-cell">
            <Popover
              content={
                <DeleteConfirmPopover
                  onConfirm={handleConfirmDelete}
                  onCancel={handleCancelDelete}
                  itemIndex={index}
                />
              }
              isOpen={isDeletePopoverOpen}
              onInteraction={(nextOpenState) => {
                if (disabled) {
                  return;
                }
                setIsDeletePopoverOpen(nextOpenState);
              }}
              interactionKind={PopoverInteractionKind.CLICK}
              placement="top"
            >
              <Button
                icon="trash"
                minimal
                small
                intent="danger"
                disabled={disabled}
              />
            </Popover>
          </div>
        )}
      </div>
    );
  },
);

TableRow.displayName = "TableRow";
