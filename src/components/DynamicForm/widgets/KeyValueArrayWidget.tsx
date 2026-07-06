import React, { forwardRef, useCallback, useMemo } from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";
import { Button, InputGroup } from "@blueprintjs/core";
import { Trash2, Plus } from "lucide-react";
import type { FieldWidgetProps } from "../types";
import type { ExtendedJSONSchema } from "../types/schema";
import { FieldRegistry } from "../core/FieldRegistry";
import { SchemaParser } from "../core/SchemaParser";
import "./KeyValueArrayWidget.scss";

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
      if (schema.enum) {
        return "select";
      }
      return "text";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "switch";
    default:
      return "text";
  }
}

/**
 * 根据 schema 类型生成默认值
 */
function getDefaultValue(schema: ExtendedJSONSchema): any {
  if (schema.default !== undefined) {
    return schema.default;
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
      return "";
  }
}

export interface KeyValueArrayWidgetProps extends FieldWidgetProps {
  schema: ExtendedJSONSchema & {
    type: "array";
    items: ExtendedJSONSchema;
  };
  value?: any[];
  onChange?: (value: any[]) => void;
  disabled?: boolean;
  readonly?: boolean;
  /**
   * 键字段名称（默认：'key'）
   */
  keyField?: string;
  /**
   * 值字段名称（默认：'value'）
   */
  valueField?: string;
  /**
   * 键列标题（默认：'Key'）
   */
  keyLabel?: string;
  /**
   * 值列标题（默认：'Value'）
   */
  valueLabel?: string;
  /**
   * 键输入框占位符
   */
  keyPlaceholder?: string;
  /**
   * 值输入框占位符
   */
  valuePlaceholder?: string;
  /**
   * 添加按钮文本（默认：'Add'）
   */
  addButtonText?: string;
  /**
   * 空状态提示文本
   */
  emptyText?: string;
  /**
   * 键字段是否必填（默认从 schema.items.required 推断）
   */
  keyRequired?: boolean;
  /**
   * 值字段是否必填（默认从 schema.items.required 推断）
   */
  valueRequired?: boolean;
}

/**
 * KeyValueArrayWidget - 键值对数组组件
 *
 * 用于渲染和编辑键值对数组，适用于配置映射、参数设置等场景。
 * 支持根据 schema 中的 type 和 ui.widget 自动选择对应的 widget 组件。
 *
 * @example
 * ```json
 * {
 *   "type": "array",
 *   "title": "Environment Variables",
 *   "items": {
 *     "type": "object",
 *     "properties": {
 *       "name": { "type": "string", "title": "Name" },
 *       "value": { "type": "string", "title": "Value" }
 *     },
 *     "required": ["name"]
 *   },
 *   "ui": {
 *     "widget": "key-value-array",
 *     "widgetProps": {
 *       "keyField": "name",
 *       "valueField": "value"
 *     }
 *   }
 * }
 * ```
 *
 * @example 使用自定义 widget
 * ```json
 * {
 *   "type": "array",
 *   "title": "Settings",
 *   "items": {
 *     "type": "object",
 *     "properties": {
 *       "key": {
 *         "type": "string",
 *         "title": "Setting",
 *         "enum": ["theme", "language", "timezone"],
 *         "enumNames": ["Theme", "Language", "Timezone"]
 *       },
 *       "value": {
 *         "type": "string",
 *         "title": "Value",
 *         "ui": { "widget": "textarea" }
 *       }
 *     }
 *   },
 *   "ui": { "widget": "key-value-array" }
 * }
 * ```
 *
 * @example 使用不同类型
 * ```json
 * {
 *   "type": "array",
 *   "title": "Feature Flags",
 *   "items": {
 *     "type": "object",
 *     "properties": {
 *       "feature": { "type": "string", "title": "Feature" },
 *       "enabled": { "type": "boolean", "title": "Enabled" }
 *     }
 *   },
 *   "ui": {
 *     "widget": "key-value-array",
 *     "widgetProps": {
 *       "keyField": "feature",
 *       "valueField": "enabled"
 *     }
 *   }
 * }
 * ```
 */
export const KeyValueArrayWidget = forwardRef<
  HTMLDivElement,
  KeyValueArrayWidgetProps
>(
  (
    {
      name,
      schema,
      disabled,
      readonly,
      keyField = "key",
      valueField = "value",
      keyLabel = "Key",
      valueLabel = "Value",
      keyPlaceholder,
      valuePlaceholder,
      addButtonText = "Add",
      emptyText,
      keyRequired,
      valueRequired,
    },
    ref,
  ) => {
    const { control } = useFormContext();
    const { fields, append, remove } = useFieldArray({
      control,
      name,
    });

    // 从 schema.ui.widgetProps 中获取配置（优先级更高）
    const widgetProps = schema.ui?.widgetProps || {};
    const finalKeyField = widgetProps.keyField || keyField;
    const finalValueField = widgetProps.valueField || valueField;
    const finalKeyLabel = widgetProps.keyLabel || keyLabel;
    const finalValueLabel = widgetProps.valueLabel || valueLabel;
    const finalKeyPlaceholder =
      widgetProps.keyPlaceholder || keyPlaceholder || finalKeyLabel;
    const finalValuePlaceholder =
      widgetProps.valuePlaceholder || valuePlaceholder || finalValueLabel;
    const finalAddButtonText = widgetProps.addButtonText || addButtonText;
    const finalEmptyText = widgetProps.emptyText || emptyText;

    // 从 schema.items.required 推断字段是否必填
    const itemsRequired = schema.items?.required || [];
    const finalKeyRequired =
      widgetProps.keyRequired ??
      keyRequired ??
      itemsRequired.includes(finalKeyField);
    const finalValueRequired =
      widgetProps.valueRequired ??
      valueRequired ??
      itemsRequired.includes(finalValueField);

    // 获取 key 和 value 字段的 schema
    const itemProperties =
      (schema.items as ExtendedJSONSchema)?.properties || {};
    const keySchema = itemProperties[finalKeyField] as
      | ExtendedJSONSchema
      | undefined;
    const valueSchema = itemProperties[finalValueField] as
      | ExtendedJSONSchema
      | undefined;

    // 根据 schema 确定使用的 widget
    const keyWidgetName = useMemo(
      () => (keySchema ? determineWidget(keySchema) : "text"),
      [keySchema],
    );
    const valueWidgetName = useMemo(
      () => (valueSchema ? determineWidget(valueSchema) : "text"),
      [valueSchema],
    );

    // 获取 widget 组件
    const KeyWidgetComponent = FieldRegistry.getWidget(keyWidgetName);
    const ValueWidgetComponent = FieldRegistry.getWidget(valueWidgetName);

    // 生成验证规则
    const keyValidationRules = useMemo(
      () =>
        keySchema
          ? SchemaParser.getValidationRules(keySchema, finalKeyRequired)
          : {},
      [keySchema, finalKeyRequired],
    );
    const valueValidationRules = useMemo(
      () =>
        valueSchema
          ? SchemaParser.getValidationRules(valueSchema, finalValueRequired)
          : {},
      [valueSchema, finalValueRequired],
    );

    // 判断是否可以增删
    const canAddRemove = !disabled && !readonly;

    // 获取最小/最大项数限制
    const minItems = schema.minItems || 0;
    const maxItems = schema.maxItems;

    // 添加新项
    const handleAdd = useCallback(() => {
      const newItem = {
        [finalKeyField]: keySchema ? getDefaultValue(keySchema) : "",
        [finalValueField]: valueSchema ? getDefaultValue(valueSchema) : "",
      };
      append(newItem);
    }, [finalKeyField, finalValueField, keySchema, valueSchema, append]);

    // 删除项
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

    return (
      <div ref={ref} className="key-value-array-widget">
        {/* 表头 */}
        {fields.length > 0 && (
          <div className="key-value-array-header">
            <div className="col-key">{finalKeyLabel}</div>
            <div className="col-arrow"></div>
            <div className="col-value">{finalValueLabel}</div>
            <div className="col-action"></div>
          </div>
        )}

        {/* 列表 */}
        <div className="key-value-array-list">
          {fields.length === 0 && finalEmptyText ? (
            <div className="key-value-array-empty">{finalEmptyText}</div>
          ) : (
            fields.map((field, index) => (
              <div key={field.id} className="key-value-array-item">
                {/* 键字段 */}
                <div className="field-group">
                  <Controller
                    name={`${name}.${index}.${finalKeyField}`}
                    control={control}
                    rules={keyValidationRules}
                    render={({ field: controllerField, fieldState }) =>
                      KeyWidgetComponent ? (
                        <KeyWidgetComponent
                          {...controllerField}
                          name={`${name}.${index}.${finalKeyField}`}
                          schema={keySchema}
                          placeholder={finalKeyPlaceholder}
                          disabled={disabled}
                          readonly={readonly}
                          error={fieldState.error?.message}
                          options={keySchema?.enum?.map(
                            (value: any, i: number) => ({
                              label: keySchema?.enumNames?.[i] || String(value),
                              value,
                            }),
                          )}
                          {...(keySchema?.ui?.widgetProps || {})}
                        />
                      ) : (
                        <InputGroup
                          {...controllerField}
                          placeholder={finalKeyPlaceholder}
                          disabled={disabled}
                          readOnly={readonly}
                          intent={fieldState.error ? "danger" : "none"}
                        />
                      )
                    }
                  />
                </div>

                {/* 分隔符 */}
                <div className="arrow">=</div>

                {/* 值字段 */}
                <div className="field-group">
                  <Controller
                    name={`${name}.${index}.${finalValueField}`}
                    control={control}
                    rules={valueValidationRules}
                    render={({ field: controllerField, fieldState }) =>
                      ValueWidgetComponent ? (
                        <ValueWidgetComponent
                          {...controllerField}
                          name={`${name}.${index}.${finalValueField}`}
                          schema={valueSchema}
                          placeholder={finalValuePlaceholder}
                          disabled={disabled}
                          readonly={readonly}
                          error={fieldState.error?.message}
                          options={valueSchema?.enum?.map(
                            (value: any, i: number) => ({
                              label:
                                valueSchema?.enumNames?.[i] || String(value),
                              value,
                            }),
                          )}
                          {...(valueSchema?.ui?.widgetProps || {})}
                        />
                      ) : (
                        <InputGroup
                          {...controllerField}
                          placeholder={finalValuePlaceholder}
                          disabled={disabled}
                          readOnly={readonly}
                          intent={fieldState.error ? "danger" : "none"}
                        />
                      )
                    }
                  />
                </div>

                {/* 删除按钮 */}
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => handleRemove(index)}
                  disabled={!canRemove(index)}
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* 添加按钮 */}
        {canAdd && (
          <Button
            icon={<Plus size={14} />}
            onClick={handleAdd}
            disabled={!canAdd}
            style={{ marginTop: fields.length > 0 ? "10px" : "0" }}
          >
            {finalAddButtonText}
          </Button>
        )}
      </div>
    );
  },
);

KeyValueArrayWidget.displayName = "KeyValueArrayWidget";
