import { forwardRef, useEffect, useRef, useCallback, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Card } from "@blueprintjs/core";
import { DynamicForm } from "../DynamicForm";
import type { FieldWidgetProps } from "../types";
import type { ExtendedJSONSchema } from "../types/schema";
import { useNestedSchemaRegistry } from "../context/NestedSchemaContext";
import { usePathPrefix, joinPath } from "../context/PathPrefixContext";
import {
  extractSchemaDefaults,
  mergeDefaults,
} from "../utils/extractSchemaDefaults";

export interface NestedFormWidgetProps extends FieldWidgetProps {
  // 当前字段的 schema（包含 properties）
  schema: ExtendedJSONSchema;

  // 当前字段值（对象）
  value?: Record<string, any>;

  // 值变化回调
  onChange?: (value: Record<string, any>) => void;

  // 其他配置
  disabled?: boolean;
  readonly?: boolean;
  layout?: "vertical" | "horizontal" | "inline"; // 布局方式
  labelWidth?: number | string; // 标签宽度

  // 是否不渲染 Card 容器（用于 ArrayFieldWidget 调用时避免双层 Card）
  noCard?: boolean;
}

export const NestedFormWidget = forwardRef<
  HTMLDivElement,
  NestedFormWidgetProps
>(
  (
    { name, schema, disabled, readonly, layout, labelWidth, noCard = false },
    ref,
  ) => {
    // 获取外层表单的 context，用于在动态 schema 变化时设置默认值
    const parentFormContext = useFormContext();

    // 获取父级路径前缀
    const parentPathPrefix = usePathPrefix();
    // ✅ 使用 useMemo 缓存完整路径，避免每次渲染都创建新字符串
    const fullPath = useMemo(
      () => joinPath(parentPathPrefix, name),
      [parentPathPrefix, name],
    );

    // 获取嵌套 schema 注册表
    const nestedSchemaRegistry = useNestedSchemaRegistry();

    // 注册当前 schema 到 Context（当 schema 变化时更新）
    useEffect(() => {
      nestedSchemaRegistry.register(fullPath, schema);

      return () => {
        nestedSchemaRegistry.unregister(fullPath);
      };
    }, [fullPath, schema, nestedSchemaRegistry]);

    // 保存上一次的 schema 引用，用于检测变化
    const prevSchemaRef = useRef<ExtendedJSONSchema>(schema);

    // 当 schema 变化时，提取并应用新 schema 的默认值
    // 这解决了动态加载 schema（如 schema 联动）后，新 schema 中的 default 值未被应用的问题
    useEffect(() => {
      // 只在 schema 真正变化时处理（不是初始化）
      if (schema === prevSchemaRef.current) {
        return;
      }

      prevSchemaRef.current = schema;

      // 提取新 schema 的默认值
      const newDefaults = extractSchemaDefaults(schema);

      // 如果没有默认值，不需要更新
      if (Object.keys(newDefaults).length === 0) {
        return;
      }

      // 获取当前字段的值
      const currentValue = parentFormContext.getValues(fullPath) || {};

      // 合并默认值：只设置当前值中不存在的字段
      // 这避免了覆盖用户已经输入的值
      const mergedValue = mergeDefaults(newDefaults, currentValue);

      // 如果合并后的值与当前值不同，才更新表单
      const hasChanges = Object.keys(newDefaults).some((key) => {
        return (
          currentValue[key] === undefined && newDefaults[key] !== undefined
        );
      });

      if (hasChanges) {
        // 批量设置默认值到表单
        parentFormContext.setValue(fullPath, mergedValue, {
          shouldValidate: false,
          shouldDirty: false,
        });
      }
    }, [schema, fullPath, parentFormContext]);

    // ✅ 使用 useCallback 缓存 onSubmit 函数，避免每次渲染都创建新函数
    const handleSubmit = useCallback(() => {}, []);

    if (!schema || !schema.properties) {
      return null;
    }

    // 内部表单内容
    const formContent = (
      <DynamicForm
        schema={schema}
        disabled={disabled}
        readonly={readonly}
        layout={layout}
        labelWidth={labelWidth}
        columnsCount={schema.ui?.columnsCount}
        showSubmitButton={false}
        renderAsForm={false}
        onSubmit={handleSubmit}
        pathPrefix={fullPath}
        asNestedForm={true}
      />
    );

    // 检查是否使用 flattenPath（路径透明化）
    const useFlattenPath = schema.ui?.flattenPath;

    // 根据 flattenPath 或 noCard 决定渲染方式
    if (useFlattenPath || noCard) {
      // 透明容器：无 Card、无 padding、无标题
      return (
        <div ref={ref} className="nested-form-widget--flatten" data-name={name}>
          {formContent}
        </div>
      );
    }

    // 标准容器：有 Card、有 padding、有标题
    return (
      <Card
        ref={ref}
        className="nested-form-widget"
        data-name={name}
        elevation={1}
        style={{ padding: "15px" }}
      >
        {formContent}
      </Card>
    );
  },
);

NestedFormWidget.displayName = "NestedFormWidget";
