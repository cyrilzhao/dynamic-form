import React, {
  forwardRef,
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import {
  Button,
  Card,
  Tooltip,
  Checkbox,
  Popover,
  PopoverInteractionKind,
} from "@blueprintjs/core";
import { Virtuoso } from "react-virtuoso";
import type { FieldWidgetProps } from "../types";
import type { ExtendedJSONSchema } from "../types/schema";
import { FieldRegistry } from "../core/FieldRegistry";
import { SchemaParser } from "../core/SchemaParser";

export interface ArrayFieldWidgetProps extends FieldWidgetProps {
  schema: ExtendedJSONSchema & {
    type: "array";
    items: ExtendedJSONSchema;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
  };
  value?: any[];
  onChange?: (value: any[]) => void;
  disabled?: boolean;
  readonly?: boolean;
  layout?: "vertical" | "horizontal" | "inline";
  labelWidth?: number | string;
  /**
   * 是否启用虚拟滚动
   * 当数组项数量较多时（建议 > 20），启用虚拟滚动可以显著提升性能
   */
  enableVirtualScroll?: boolean;
  /**
   * 虚拟滚动容器高度（像素）
   * 默认值：600
   */
  virtualScrollHeight?: number;
  /** 是否允许新增数组元素，默认 true */
  canAdd?: boolean;
  /** 是否允许删除数组元素，默认 true */
  canRemove?: boolean;
  /** 是否允许调整数组元素顺序，默认 true */
  canReorder?: boolean;
}

/**
 * 根据 items schema 决定使用什么 widget 渲染数组元素
 */
function determineItemWidget(itemsSchema: ExtendedJSONSchema): string {
  // 优先级 1: 显式指定了 widget
  if (itemsSchema.ui?.widget) {
    return itemsSchema.ui.widget;
  }

  // 优先级 2: 对象类型 → 嵌套表单
  if (itemsSchema.type === "object") {
    return "nested-form";
  }

  // 优先级 3: 基本类型 → 对应的基础 widget
  switch (itemsSchema.type) {
    case "string":
      // 根据 format 进一步判断
      if (itemsSchema.format === "email") {
        return "email";
      }
      if (itemsSchema.format === "uri") {
        return "url";
      }
      if (itemsSchema.format === "date") {
        return "date";
      }
      if (itemsSchema.format === "date-time") {
        return "datetime";
      }
      if (itemsSchema.format === "time") {
        return "time";
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
 * 判断应该使用哪种渲染模式
 */
function determineArrayMode(schema: ExtendedJSONSchema): "static" | "dynamic" {
  // 1. 显式指定了 arrayMode
  if (schema.ui?.arrayMode) {
    return schema.ui.arrayMode;
  }

  // 2. 如果 items 有 enum，默认使用 static 模式（多选框组，不可增删）
  if (schema.items && typeof schema.items === "object") {
    const items = schema.items as ExtendedJSONSchema;
    if (items.enum && items.enum.length > 0) {
      return "static";
    }
  }

  // 3. 默认使用 dynamic 模式（可增删的列表）
  return "dynamic";
}

/**
 * 判断是否为基本类型（需要包装的类型）
 */
function isPrimitiveType(schema: ExtendedJSONSchema): boolean {
  const type = schema.type;
  return (
    type === "string" ||
    type === "number" ||
    type === "integer" ||
    type === "boolean"
  );
}

/**
 * 获取基本类型的默认值
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getDefaultPrimitiveValue(schema: ExtendedJSONSchema): any {
  if (schema.ui?.autogenerate === "uuid") {
    return generateUUID();
  }
  switch (schema.type) {
    case "string":
      return "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}

/**
 * 获取数组元素的默认值
 * 对于基本类型，包装成 { value: xxx } 以避免被 useFieldArray 过滤
 */
function getDefaultValue(itemsSchema: ExtendedJSONSchema): any {
  // 如果是基本类型，包装成对象
  if (isPrimitiveType(itemsSchema)) {
    const defaultVal =
      itemsSchema.default !== undefined
        ? itemsSchema.default
        : getDefaultPrimitiveValue(itemsSchema);
    return { value: defaultVal };
  }

  // 对象类型，正常处理
  if (itemsSchema.default !== undefined) {
    return itemsSchema.default;
  }

  if (itemsSchema.type === "object") {
    // 为对象类型生成默认值
    if (itemsSchema.properties) {
      const defaultObj: any = {};
      Object.entries(itemsSchema.properties).forEach(([key, propSchema]) => {
        const prop = propSchema as ExtendedJSONSchema;
        if (prop.ui?.autogenerate === "uuid") {
          defaultObj[key] = generateUUID();
        } else if (prop.default !== undefined) {
          defaultObj[key] = prop.default;
        } else if (prop.type === "string") {
          defaultObj[key] = "";
        } else if (prop.type === "number" || prop.type === "integer") {
          defaultObj[key] = 0;
        } else if (prop.type === "boolean") {
          defaultObj[key] = false;
        } else if (prop.type === "array") {
          defaultObj[key] = [];
        } else if (prop.type === "object") {
          defaultObj[key] = {};
        }
      });
      return defaultObj;
    }
    return {};
  }

  if (itemsSchema.type === "array") {
    return [];
  }

  return null;
}

export const ArrayFieldWidget = forwardRef<
  HTMLDivElement,
  ArrayFieldWidgetProps
>(
  (
    {
      name,
      schema,
      disabled,
      readonly,
      layout,
      labelWidth,
      enableVirtualScroll = false,
      virtualScrollHeight = 600,
      canAdd = true,
      canRemove = true,
      canReorder = true,
    },
    ref,
  ) => {
    const { control, formState, unregister } = useFormContext();

    // 获取数组项的 schema，用 boolean flag 记录有效性，避免在 hooks 之前 return
    const itemSchema = schema.items as ExtendedJSONSchema;
    const isValidItemSchema = !!itemSchema && typeof itemSchema === "object";

    // 判断渲染模式
    const arrayMode = useMemo(() => determineArrayMode(schema), [schema]);

    // 所有 hooks 必须在任何条件 return 之前调用
    const { fields, append, remove, move } = useFieldArray({
      control,
      name,
    });

    // 当切换到 static 模式时，取消 useFieldArray 的注册
    useEffect(() => {
      if (!isValidItemSchema) {
        return;
      }
      if (arrayMode === "static" && itemSchema.enum) {
        // 取消 useFieldArray 注册的字段
        unregister(name);
      }
    }, [isValidItemSchema, arrayMode, itemSchema, name, unregister]);

    // Virtuoso ref，用于控制滚动
    const virtuosoRef = useRef<any>(null);

    // 显式订阅 formState 的属性，确保能追踪到变化
    const { errors, isValidating, isValid } = formState;

    // 监听表单错误，自动滚动到第一个错误的数组项
    // 使用 isValidating 和 isValid 作为触发器，确保在验证完成后触发滚动
    useEffect(() => {
      // 只在验证完成后（isValidating 为 false）且验证失败（isValid 为 false）时触发
      if (isValidating || isValid) {
        return;
      }

      if (!errors) {
        return;
      }

      // 查找第一个有错误的数组项索引
      const arrayErrors = errors[name] as any;

      if (arrayErrors && Array.isArray(arrayErrors)) {
        const firstErrorIndex = arrayErrors.findIndex(
          (error: any) => error !== undefined,
        );

        if (firstErrorIndex !== -1) {
          // 使用 setTimeout 确保 DOM 已更新
          setTimeout(() => {
            if (enableVirtualScroll && virtuosoRef.current) {
              // 虚拟滚动模式：使用 Virtuoso 的 scrollToIndex
              virtuosoRef.current.scrollToIndex({
                index: firstErrorIndex,
                align: "center",
                behavior: "smooth",
              });
            } else {
              // 普通渲染模式：使用 DOM 元素的 scrollIntoView
              const errorElement = document.querySelector(
                `[data-array-item-name="${name}.${firstErrorIndex}"]`,
              );
              if (errorElement) {
                errorElement.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }
            }
          }, 100);
        }
      }
    }, [isValidating, isValid, errors, name, enableVirtualScroll]);

    // 从 schema.ui 中获取配置
    const addButtonText = schema.ui?.addButtonText || "Add";
    const emptyText = schema.ui?.emptyText;
    const minItems = schema.minItems || 0;
    const maxItems = schema.maxItems;

    // 动态数组的操作权限：disabled、readonly 和 static 模式始终优先禁止操作。
    const canModifyItems = !disabled && !readonly && arrayMode === "dynamic";
    const canAppendItems = canModifyItems && canAdd;
    const canDeleteItems = canModifyItems && canRemove;
    const canMoveItems = canModifyItems && canReorder;

    // ✅ 使用 useCallback 缓存回调函数，避免每次渲染都创建新函数
    // 添加新项
    const handleAdd = useCallback(() => {
      const defaultValue = getDefaultValue(itemSchema);
      append(defaultValue);
    }, [itemSchema, append]);

    // 删除项
    const handleRemove = useCallback(
      (index: number) => {
        // 删除项时不触发验证
        remove(index);
      },
      [remove],
    );

    // 上移
    const handleMoveUp = useCallback(
      (index: number) => {
        if (index > 0) {
          // 移动项时不触发验证
          move(index, index - 1);
        }
      },
      [move],
    );

    // 下移
    const handleMoveDown = useCallback(
      (index: number) => {
        if (index < fields.length - 1) {
          // 移动项时不触发验证
          move(index, index + 1);
        }
      },
      [move, fields.length],
    );

    // ✅ 使用 useMemo 缓存所有 statusMap，避免每次渲染都创建新对象
    const statusMaps = useMemo(() => {
      return fields.map((_, index) => ({
        isAtMinLimit: fields.length <= minItems,
        isFirstItem: index === 0,
        isLastItem: index === fields.length - 1,
      }));
    }, [fields, minItems]);

    // ✅ 使用 useCallback 缓存虚拟滚动的 itemContent 回调
    const renderItem = useCallback(
      (index: number, field: any) => (
        <ArrayItem
          key={field.id}
          name={`${name}.${index}`}
          index={index}
          schema={itemSchema}
          onRemove={canDeleteItems ? handleRemove : undefined}
          onMoveUp={canMoveItems ? handleMoveUp : undefined}
          onMoveDown={canMoveItems ? handleMoveDown : undefined}
          statusMap={statusMaps[index]}
          disabled={disabled}
          readonly={readonly}
          layout={layout}
          labelWidth={labelWidth}
        />
      ),
      [
        name,
        itemSchema,
        canDeleteItems,
        canMoveItems,
        handleRemove,
        handleMoveUp,
        handleMoveDown,
        statusMaps,
        disabled,
        readonly,
        layout,
        labelWidth,
      ],
    );

    // 所有 hooks 调用完毕，现在可以安全地进行条件 return
    if (!isValidItemSchema) {
      console.warn(
        `ArrayFieldWidget: schema.items is required for array field "${name}"`,
      );
      return null;
    }

    // 如果是 static 模式（枚举数组），渲染为多选框组
    if (arrayMode === "static") {
      // 如果没有配置 enum，显示提示信息
      if (!itemSchema.enum || itemSchema.enum.length === 0) {
        return (
          <div
            ref={ref}
            className="array-field-widget array-field-widget--static"
          >
            <div
              style={{ padding: "10px", color: "#999", fontStyle: "italic" }}
            >
              No options configured. Please add options in the schema editor.
            </div>
          </div>
        );
      }

      return (
        <div
          ref={ref}
          className="array-field-widget array-field-widget--static"
        >
          <Controller
            name={name}
            control={control}
            defaultValue={[]}
            render={({ field }) => {
              const currentValue = Array.isArray(field.value)
                ? field.value
                : [];
              const enumValues = itemSchema.enum || [];
              const enumNames = itemSchema.enumNames || enumValues;

              return (
                <div className="checkbox-group">
                  {enumValues.map((enumValue, index) => {
                    // 处理对象包装格式 { value: xxx }
                    const isChecked = currentValue.some((item: any) => {
                      if (item && typeof item === "object" && "value" in item) {
                        return item.value === enumValue;
                      }
                      return item === enumValue;
                    });
                    const label = String(enumNames[index] || enumValue);

                    return (
                      <Checkbox
                        key={`${name}-${String(enumValue)}-${index}`}
                        label={label}
                        checked={isChecked}
                        disabled={disabled || readonly}
                        onChange={(e) => {
                          const checked = e.currentTarget.checked;
                          let newValue: any[];

                          if (checked) {
                            // 添加选项
                            newValue = [...currentValue, enumValue];
                          } else {
                            // 移除选项
                            newValue = currentValue.filter(
                              (v: any) => v !== enumValue,
                            );
                          }

                          // 直接设置数组值
                          field.onChange(newValue);
                        }}
                        style={{ marginBottom: "8px" }}
                      />
                    );
                  })}
                </div>
              );
            }}
          />
        </div>
      );
    }

    // dynamic 模式：可增删的列表
    return (
      <div ref={ref} className="array-field-widget">
        {/* 数组项列表 */}
        {enableVirtualScroll && fields.length > 0 ? (
          // ✅ 虚拟滚动模式：使用缓存的 renderItem 回调
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: `${virtualScrollHeight}px` }}
            data={fields}
            itemContent={renderItem}
          />
        ) : (
          // 普通渲染模式
          fields.map((field, index) => (
            <ArrayItem
              key={field.id}
              name={`${name}.${index}`}
              index={index}
              schema={itemSchema}
              onRemove={canDeleteItems ? handleRemove : undefined}
              onMoveUp={canMoveItems ? handleMoveUp : undefined}
              onMoveDown={canMoveItems ? handleMoveDown : undefined}
              statusMap={statusMaps[index]}
              disabled={disabled}
              readonly={readonly}
              layout={layout}
              labelWidth={labelWidth}
            />
          ))
        )}

        {/* 空状态提示 */}
        {fields.length === 0 && emptyText && (
          <div
            className="array-empty-text"
            style={{ color: "#999", padding: "10px", textAlign: "center" }}
          >
            {emptyText}
          </div>
        )}

        {/* 添加按钮 */}
        {canAppendItems && (
          <Tooltip
            content={
              maxItems && fields.length >= maxItems
                ? `Maximum of ${maxItems} items allowed`
                : ""
            }
            disabled={!maxItems || fields.length < maxItems}
          >
            <Button
              icon="add"
              intent="primary"
              onClick={handleAdd}
              disabled={maxItems !== undefined && fields.length >= maxItems}
              style={{ marginTop: fields.length > 0 ? "10px" : "0" }}
            >
              {addButtonText}
            </Button>
          </Tooltip>
        )}
      </div>
    );
  },
);

ArrayFieldWidget.displayName = "ArrayFieldWidget";

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
        Delete item {itemIndex + 1}?
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
 * ArrayItem 状态映射
 */
interface ArrayItemStatusMap {
  isAtMinLimit?: boolean; // 是否达到最小数量限制
  isFirstItem?: boolean; // 是否是第一项
  isLastItem?: boolean; // 是否是最后一项
}

/**
 * ArrayItem 子组件
 */
interface ArrayItemProps {
  name: string;
  index: number;
  schema: ExtendedJSONSchema;
  onRemove?: (index: number) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  statusMap?: ArrayItemStatusMap;
  disabled?: boolean;
  readonly?: boolean;
  layout?: "vertical" | "horizontal" | "inline";
  labelWidth?: number | string;
}

/**
 * ArrayItem 子组件
 * ✅ 使用 React.memo 优化，避免不必要的重渲染
 */
const ArrayItem = React.memo<ArrayItemProps>(
  ({
    name,
    index,
    schema,
    onRemove,
    onMoveUp,
    onMoveDown,
    statusMap,
    disabled,
    readonly,
    layout,
    labelWidth,
  }) => {
    const { control } = useFormContext();

    // 删除确认 Popover 的状态
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

    // 根据 schema 获取对应的 Widget
    const itemWidget = useMemo(() => determineItemWidget(schema), [schema]);
    const WidgetComponent = FieldRegistry.getWidget(itemWidget);

    if (!WidgetComponent) {
      console.error(`Widget "${itemWidget}" not found in registry`);
      return null;
    }

    // 如果是对象类型，使用特殊渲染
    if (schema.type === "object") {
      return (
        <Card
          className="array-item array-item-object"
          elevation={1}
          style={{ marginBottom: "15px", padding: "15px" }}
          data-array-item-name={name}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <span style={{ fontWeight: "bold" }}>
              {schema.title || "Item"} {index + 1}
            </span>
            {(onMoveUp || onMoveDown || onRemove) && (
              <div
                className="array-item-actions"
                style={{ display: "flex", gap: "5px" }}
              >
                {onMoveUp && (
                  <Tooltip
                    content={
                      statusMap?.isFirstItem ? "Already at the first item" : ""
                    }
                    disabled={!statusMap?.isFirstItem}
                  >
                    <Button
                      icon="arrow-up"
                      minimal
                      small
                      onClick={() => onMoveUp(index)}
                      disabled={disabled || statusMap?.isFirstItem}
                      title="Move up"
                    />
                  </Tooltip>
                )}
                {onMoveDown && (
                  <Tooltip
                    content={
                      statusMap?.isLastItem ? "Already at the last item" : ""
                    }
                    disabled={!statusMap?.isLastItem}
                  >
                    <Button
                      icon="arrow-down"
                      minimal
                      small
                      onClick={() => onMoveDown(index)}
                      disabled={disabled || statusMap?.isLastItem}
                      title="Move down"
                    />
                  </Tooltip>
                )}
                {onRemove && (
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
                      // 如果按钮被禁用，不允许打开 Popover
                      if (disabled || statusMap?.isAtMinLimit) {
                        return;
                      }
                      setIsDeletePopoverOpen(nextOpenState);
                    }}
                    interactionKind={PopoverInteractionKind.CLICK}
                    placement="top"
                  >
                    <Tooltip
                      content={
                        statusMap?.isAtMinLimit
                          ? "At least one item is required"
                          : ""
                      }
                      disabled={!statusMap?.isAtMinLimit}
                    >
                      <Button
                        icon="trash"
                        minimal
                        small
                        intent="danger"
                        disabled={disabled || statusMap?.isAtMinLimit}
                        title="Delete"
                      />
                    </Tooltip>
                  </Popover>
                )}
              </div>
            )}
          </div>

          {/* 直接渲染 NestedFormWidget，不再使用 Controller 包裹 */}
          {/* NestedFormWidget 内部使用 asNestedForm 模式，子字段会直接注册到父表单 */}
          {/* 传递 noCard={true} 避免双层 Card 嵌套 */}
          <WidgetComponent
            name={name}
            schema={schema}
            disabled={disabled}
            readonly={readonly}
            layout={layout}
            labelWidth={labelWidth}
            noCard={true}
            {...(schema.ui?.widgetProps || {})}
          />
        </Card>
      );
    }

    // 基本类型：渲染为简单的输入框 + 操作按钮

    // 为基础类型生成校验规则
    const validationRules = useMemo(() => {
      const rules = SchemaParser.getValidationRules(schema, false);

      return rules;
    }, [schema]);

    return (
      <div
        className="array-item array-item-simple"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          marginBottom: "10px",
        }}
        data-array-item-name={name}
      >
        {/* 索引标签 */}
        <div
          className="array-item-index"
          style={{ minWidth: "30px", color: "#999" }}
        >
          #{index + 1}
        </div>

        {/* 字段内容 */}
        <div className="array-item-field" style={{ flex: 1 }}>
          <Controller
            name={`${name}.value`}
            control={control}
            rules={{
              ...validationRules,
              // ✅ 添加 onChange 验证，确保用户输入时实时验证
              onChange: validationRules.validate
                ? (value: any) => {
                    // 执行所有自定义验证规则
                    if (validationRules.validate) {
                      // validate 是对象形式的验证规则，执行所有验证
                      for (const key in validationRules.validate) {
                        const validateFn = validationRules.validate[key];
                        const result = validateFn(value);
                        if (result !== true) {
                          return result;
                        }
                      }
                    }
                    return true;
                  }
                : undefined,
            }}
            render={({ field: controllerField, fieldState }) => {
              return (
                <>
                  <WidgetComponent
                    name={`${name}.value`}
                    schema={schema}
                    value={controllerField.value}
                    onChange={(newValue: any) => {
                      controllerField.onChange(newValue);
                    }}
                    disabled={disabled}
                    readonly={readonly}
                    {...(schema.ui?.widgetProps || {})}
                  />
                  {fieldState.error && (
                    <div
                      style={{
                        color: "#DB3737",
                        fontSize: "12px",
                        marginTop: "5px",
                      }}
                    >
                      {fieldState.error.message}
                    </div>
                  )}
                </>
              );
            }}
          />
        </div>

        {/* 操作按钮 */}
        {(onMoveUp || onMoveDown || onRemove) && (
          <div
            className="array-item-actions"
            style={{
              display: "flex",
              height: "30px",
              gap: "5px",
              alignItems: "center",
            }}
          >
            {onMoveUp && (
              <Tooltip
                content={
                  statusMap?.isFirstItem ? "Already at the first item" : ""
                }
                disabled={!statusMap?.isFirstItem}
              >
                <Button
                  icon="arrow-up"
                  minimal
                  small
                  onClick={() => onMoveUp(index)}
                  disabled={disabled || statusMap?.isFirstItem}
                  title="Move up"
                />
              </Tooltip>
            )}
            {onMoveDown && (
              <Tooltip
                content={
                  statusMap?.isLastItem ? "Already at the last item" : ""
                }
                disabled={!statusMap?.isLastItem}
              >
                <Button
                  icon="arrow-down"
                  minimal
                  small
                  onClick={() => onMoveDown(index)}
                  disabled={disabled || statusMap?.isLastItem}
                  title="Move down"
                />
              </Tooltip>
            )}
            {onRemove && (
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
                  // 如果按钮被禁用，不允许打开 Popover
                  if (disabled || statusMap?.isAtMinLimit) {
                    return;
                  }
                  setIsDeletePopoverOpen(nextOpenState);
                }}
                interactionKind={PopoverInteractionKind.CLICK}
                placement="top"
              >
                <Tooltip
                  content={
                    statusMap?.isAtMinLimit
                      ? "At least one item is required"
                      : ""
                  }
                  disabled={!statusMap?.isAtMinLimit}
                >
                  <Button
                    icon="trash"
                    minimal
                    small
                    intent="danger"
                    disabled={disabled || statusMap?.isAtMinLimit}
                    title="Delete"
                  />
                </Tooltip>
              </Popover>
            )}
          </div>
        )}
      </div>
    );
  },
  // ✅ 自定义比较函数：只在关键 props 变化时重渲染
  (prevProps, nextProps) => {
    // 深度比较 statusMap（比较值而不是引用）
    const statusMapEqual =
      prevProps.statusMap === nextProps.statusMap ||
      (prevProps.statusMap?.isAtMinLimit ===
        nextProps.statusMap?.isAtMinLimit &&
        prevProps.statusMap?.isFirstItem === nextProps.statusMap?.isFirstItem &&
        prevProps.statusMap?.isLastItem === nextProps.statusMap?.isLastItem);

    return (
      prevProps.name === nextProps.name &&
      prevProps.index === nextProps.index &&
      prevProps.schema === nextProps.schema &&
      prevProps.onRemove === nextProps.onRemove &&
      prevProps.onMoveUp === nextProps.onMoveUp &&
      prevProps.onMoveDown === nextProps.onMoveDown &&
      statusMapEqual &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.readonly === nextProps.readonly &&
      prevProps.layout === nextProps.layout &&
      prevProps.labelWidth === nextProps.labelWidth
    );
  },
);
