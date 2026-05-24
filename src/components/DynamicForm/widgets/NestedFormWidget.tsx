import { forwardRef, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Card } from '@blueprintjs/core';
import { DynamicForm } from '../DynamicForm';
import type { FieldWidgetProps } from '../types';
import type { ExtendedJSONSchema } from '../types/schema';
import { useNestedSchemaRegistry } from '../context/NestedSchemaContext';
import { usePathPrefix, joinPath } from '../context/PathPrefixContext';
import { useLinkageStateContext } from '../context/LinkageStateContext';
import { extractSchemaDefaults, mergeDefaults } from '../utils/extractSchemaDefaults';

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
  layout?: 'vertical' | 'horizontal' | 'inline'; // 布局方式
  labelWidth?: number | string; // 标签宽度

  // 是否不渲染 Card 容器（用于 ArrayFieldWidget 调用时避免双层 Card）
  noCard?: boolean;
}

export const NestedFormWidget = forwardRef<HTMLDivElement, NestedFormWidgetProps>(
  ({ name, schema, disabled, readonly, layout, labelWidth, noCard = false }, ref) => {
    const [currentSchema, setCurrentSchema] = useState<ExtendedJSONSchema>(schema);
    // 获取外层表单的 context，用于在动态 schema 变化时设置默认值
    const parentFormContext = useFormContext();

    // 获取父级路径前缀
    const parentPathPrefix = usePathPrefix();
    // ✅ 使用 useMemo 缓存完整路径，避免每次渲染都创建新字符串
    const fullPath = useMemo(() => joinPath(parentPathPrefix, name), [parentPathPrefix, name]);

    // 获取嵌套 schema 注册表
    const nestedSchemaRegistry = useNestedSchemaRegistry();

    // 获取联动状态 Context
    const linkageStateContext = useLinkageStateContext();

    // 保存当前的 schema key 值，用于检测切换
    // const previousKeyRef = useRef<string | undefined>();

    // 保存上次的 value 序列化值，用于检测 value 是否真正变化
    // const previousValueRef = useRef<string>('');

    // 注册当前 schema 到 Context（当 currentSchema 变化时更新）
    useEffect(() => {
      nestedSchemaRegistry.register(fullPath, currentSchema);

      return () => {
        nestedSchemaRegistry.unregister(fullPath);
      };
    }, [fullPath, currentSchema, nestedSchemaRegistry]);

    // 获取当前字段的联动 schema（用于依赖追踪）
    const linkageSchema = linkageStateContext?.parentLinkageStates[fullPath]?.schema;

    // 保存上一次的 schema prop 引用，用于检测变化
    const prevSchemaRef = useRef<ExtendedJSONSchema>(schema);

    // 同步 schema prop 到 currentSchema 状态
    // 当父组件传入新的 schema prop 时（例如父级 schema 联动导致子级 schema 变化），
    // 需要更新 currentSchema 状态以触发重新渲染
    useEffect(() => {
      // 如果有联动 schema，优先使用联动 schema（由下面的 useEffect 处理）
      if (linkageSchema) {
        prevSchemaRef.current = schema;
        return;
      }

      // 比较 schema 引用是否变化
      if (schema !== prevSchemaRef.current) {
        prevSchemaRef.current = schema;
        setCurrentSchema(schema);
      }
    }, [schema, linkageSchema, fullPath]);

    // 处理 schema 联动（新的联动系统）
    useEffect(() => {
      // 如果没有联动 schema，不需要更新
      if (!linkageSchema) return;

      // 选择性合并 schema，只更新 properties 和校验相关字段
      // 保留原有的 ui 配置（包括 ui.linkage）
      setCurrentSchema(prevSchema => ({
        ...prevSchema,
        // 更新 properties
        properties: linkageSchema.properties || prevSchema.properties,
        // 更新校验相关字段
        required: linkageSchema.required,
        minProperties: linkageSchema.minProperties,
        maxProperties: linkageSchema.maxProperties,
        dependencies: linkageSchema.dependencies,
        if: linkageSchema.if,
        then: linkageSchema.then,
        else: linkageSchema.else,
        allOf: linkageSchema.allOf,
        anyOf: linkageSchema.anyOf,
        oneOf: linkageSchema.oneOf,
        not: linkageSchema.not,
        // 保留原有的 ui 配置
        ui: prevSchema.ui,
      }));
    }, [linkageSchema]);

    // 保存上一次的联动 schema 引用，用于检测变化
    const prevLinkageSchemaRef = useRef<ExtendedJSONSchema | undefined>(undefined);

    // 当动态 schema 变化时，提取并应用新 schema 的默认值
    // 这解决了异步加载 schema 后，新 schema 中的 default 值未被应用的问题
    useEffect(() => {
      // 只在 linkageSchema 真正变化时处理（不是初始化）
      if (!linkageSchema || linkageSchema === prevLinkageSchemaRef.current) {
        prevLinkageSchemaRef.current = linkageSchema;
        return;
      }

      prevLinkageSchemaRef.current = linkageSchema;

      // 提取新 schema 的默认值
      const newDefaults = extractSchemaDefaults(linkageSchema);

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
      const hasChanges = Object.keys(newDefaults).some(key => {
        return currentValue[key] === undefined && newDefaults[key] !== undefined;
      });

      if (hasChanges) {
        // 批量设置默认值到表单
        parentFormContext.setValue(fullPath, mergedValue, {
          shouldValidate: false,
          shouldDirty: false,
        });
      }
    }, [linkageSchema, fullPath, parentFormContext]);

    // ✅ 使用 useCallback 缓存 onSubmit 函数，避免每次渲染都创建新函数
    const handleSubmit = useCallback(() => {}, []);

    if (!currentSchema || !currentSchema.properties) {
      return null;
    }

    // 内部表单内容
    const formContent = (
      <DynamicForm
        schema={currentSchema}
        disabled={disabled}
        readonly={readonly}
        layout={layout}
        labelWidth={labelWidth}
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
        <div
          ref={ref}
          className="nested-form-widget--flatten"
          data-name={name}
        >
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
        style={{ padding: '15px' }}
      >
        {formContent}
      </Card>
    );
  }
);

NestedFormWidget.displayName = 'NestedFormWidget';
