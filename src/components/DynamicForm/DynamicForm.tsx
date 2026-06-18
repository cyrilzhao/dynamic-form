import React, { useCallback, useMemo, useImperativeHandle, forwardRef, useRef } from 'react';
import { useForm, FormProvider, useFormContext, type UseFormReturn } from 'react-hook-form';
import { Button } from '@blueprintjs/core';
import { SchemaParser } from './core/SchemaParser';
import { FormField } from './layout/FormField';
import { ErrorList } from './components/ErrorList';
import type { DynamicFormProps, DynamicFormRef } from './types';
import { parseSchemaLinkages, transformToAbsolutePaths } from './utils/schemaLinkageParser';
import { useArrayLinkageManager } from './hooks/useArrayLinkageManager';
import type { LinkageConfig } from './types/linkage';
import type { ExtendedJSONSchema } from './types/schema';
import { filterValueWithNestedSchemas } from './utils/filterValueWithNestedSchemas';
import {
  NestedSchemaProvider,
  useNestedSchemaRegistryOptional,
} from './context/NestedSchemaContext';
import { PathPrefixProvider } from './context/PathPrefixContext';
import { LinkageStateProvider, useLinkageStateContext } from './context/LinkageStateContext';
import { WidgetsProvider } from './context/WidgetsContext';
import { wrapPrimitiveArrays, unwrapPrimitiveArrays } from './utils/arrayTransformer';
import { extractSchemaDefaults, mergeDefaults } from './utils/extractSchemaDefaults';
import { createSchemaResolver } from './utils/createSchemaResolver';
import '@blueprintjs/core/lib/css/blueprint.css';

// 空对象常量，避免每次渲染创建新对象
const EMPTY_LINKAGE_FUNCTIONS = {};
const EMPTY_WIDGETS = {};
const EMPTY_CUSTOM_FORMATS = {};

/**
 * 递归展开嵌套对象，对每层路径都调用 setValue
 *
 * 问题背景：NestedFormWidget 的子字段（如 address.street）通过独立 Controller 注册，
 * 而 FormField 同时也为 address 注册了一个父 Controller。
 * 当调用 setValue('address', { street: '123' }) 时，RHF 只更新父 Controller，
 * 子 Controller 不会自动收到新值。
 *
 * 解决方案：递归展开嵌套对象，对每层路径都调用 setValue，确保所有 Controller 都被更新。
 */
function setValuesRecursive(
  methods: UseFormReturn,
  obj: Record<string, any>,
  options?: {
    shouldValidate?: boolean;
    shouldDirty?: boolean;
    shouldTouch?: boolean;
  },
  prefix = ''
) {
  Object.entries(obj).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    // 设置当前路径的值
    methods.setValue(path, value, options);
    // 普通对象递归展开（数组和 null 除外）
    // 数组由 useFieldArray 管理，直接设置整体即可
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      setValuesRecursive(methods, value, options, path);
    }
  });
}

/**
 * 根据 schema 结构构建类型恰当的空值对象
 *
 * 用于 reset({}) 场景：需要为每个字段生成正确类型的空值，
 * 避免使用 undefined（会导致 React 受控组件变为非受控组件，保留旧值）。
 *
 * 类型映射：
 * - string → ''
 * - number/integer → undefined（数字字段 undefined 是合法的空状态）
 * - boolean → false
 * - array → []
 * - object → 递归构建空对象
 */
function buildEmptyValues(schema: ExtendedJSONSchema): Record<string, any> {
  if (schema.type !== 'object' || !schema.properties) return {};

  const result: Record<string, any> = {};

  Object.entries(schema.properties).forEach(([key, fieldSchema]) => {
    const typedSchema = fieldSchema as ExtendedJSONSchema;

    if (typedSchema.type === 'array') {
      result[key] = [];
    } else if (typedSchema.type === 'object' && typedSchema.properties) {
      result[key] = buildEmptyValues(typedSchema);
    } else if (typedSchema.type === 'string') {
      result[key] = '';
    } else {
      // number/integer/boolean 等：undefined 是合法的空状态
      result[key] = undefined;
    }
  });

  return result;
}

/**
 * 批量设置表单值，处理基本类型数组包装和嵌套对象展开
 */
function setFormValues({
  methods,
  values,
  schema,
  options,
}: {
  methods: UseFormReturn;
  values: Record<string, any>;
  schema: ExtendedJSONSchema;
  options?: {
    shouldValidate?: boolean;
    shouldDirty?: boolean;
    shouldTouch?: boolean;
  };
}) {
  // 步骤1：基本类型数组包装
  const wrapped = wrapPrimitiveArrays(values, schema);
  // 步骤2：递归设置值
  setValuesRecursive(methods, wrapped, options);
}

/**
 * 转换表单数据：数组解包 + 数据过滤
 *
 * 新方案（v3.0）：
 * - 移除路径转换逻辑，数据保持标准的嵌套格式
 * - 只需要解包基本类型数组和过滤数据
 *
 * @param data - 原始表单数据
 * @param schema - Schema 定义
 * @param nestedSchemaRegistry - 嵌套 Schema 注册表（可选）
 * @param shouldFilter - 是否需要过滤数据（默认 false）
 * @returns 转换后的数据
 */
function transformFormData(
  data: Record<string, any>,
  schema: ExtendedJSONSchema,
  nestedSchemaRegistry?: { getAllSchemas: () => Map<string, ExtendedJSONSchema> },
  shouldFilter: boolean = false
): Record<string, any> {
  // 第一步：解包基本类型数组
  let processedData = unwrapPrimitiveArrays(data, schema);

  // 第二步：根据 schema 过滤数据（仅在需要时执行）
  if (shouldFilter) {
    processedData = nestedSchemaRegistry
      ? filterValueWithNestedSchemas(processedData, schema, nestedSchemaRegistry.getAllSchemas())
      : filterValueWithNestedSchemas(processedData, schema, new Map());
  }

  return processedData;
}

/**
 * 检查字段是否应该被隐藏（包括检查父级路径的联动状态）
 *
 * 新方案（v3.0）：
 * - 使用标准的 . 分隔符
 * - 检查字段自身和所有父级路径的联动状态
 *
 * @param fieldPath - 字段路径，如 'auth.content.key'
 * @param linkageStates - 联动状态映射
 * @returns 如果字段或其任何父级被隐藏，返回 true
 */
function isFieldHiddenByLinkage(
  fieldPath: string,
  linkageStates: Record<string, { visible?: boolean }>
): boolean {
  // 检查字段自身的联动状态
  if (linkageStates[fieldPath]?.visible === false) {
    return true;
  }

  // 使用标准的 . 分隔符拆分路径
  const parts = fieldPath.split('.');

  // 检查每个父级路径的联动状态
  for (let i = 1; i < parts.length; i++) {
    const parentPath = parts.slice(0, i).join('.');
    if (linkageStates[parentPath]?.visible === false) {
      return true;
    }
  }

  return false;
}

// 内层组件：实际的表单逻辑
// ✅ 使用 React.memo 优化，避免不必要的重渲染
const DynamicFormInner = React.memo(
  forwardRef<DynamicFormRef, DynamicFormProps>(
    (
      {
        schema,
        defaultValues = {},
        onSubmit,
        onChange,
        widgets,
        linkageFunctions,
        customFormats,
        layout = 'vertical',
        labelWidth,
        showErrorList = false,
        showSubmitButton = true,
        renderAsForm = true,
        validateMode = 'onSubmit',
        reValidateMode = 'onChange',
        loading = false,
        disabled = false,
        readonly = false,
        className,
        style,
        pathPrefix = '',
        asNestedForm = false,
        enableVirtualScroll = false,
        virtualScrollHeight = 600,
      },
      ref
    ) => {
      // ========== Context 获取（集中管理） ==========
      const parentFormContext = useFormContext();
      const linkageStateContext = useLinkageStateContext();
      const nestedSchemaRegistry = useNestedSchemaRegistryOptional();

      // ========== 空对象常量处理（统一管理） ==========
      const stableLinkageFunctions = linkageFunctions || EMPTY_LINKAGE_FUNCTIONS;
      const stableWidgets = widgets || EMPTY_WIDGETS;
      const stableCustomFormats = customFormats || EMPTY_CUSTOM_FORMATS;

      // 设置自定义格式验证器并解析字段
      // 当 asNestedForm 为 true 时，需要为字段名添加 pathPrefix 前缀
      const fields = useMemo(() => {
        if (stableCustomFormats && Object.keys(stableCustomFormats).length > 0) {
          SchemaParser.setCustomFormats(stableCustomFormats);
        }

        // 从 schema.ui 中读取 prefixLabel（用于 flattenPrefix 场景）
        const prefixLabel = schema.ui?.prefixLabel || '';

        const parsedFields = SchemaParser.parse(schema, {
          prefixLabel,
        });

        // 如果是嵌套表单模式且有路径前缀，为字段名添加前缀
        if (asNestedForm && pathPrefix) {
          return parsedFields.map(field => ({
            ...field,
            name: `${pathPrefix}.${field.name}`,
          }));
        }
        return parsedFields;
      }, [schema, stableCustomFormats, asNestedForm, pathPrefix]);

      // 处理 defaultValues：提取 schema 中的 default 值并与用户提供的 defaultValues 合并
      // 优先级：用户提供的 defaultValues > schema 中的 default 值
      // 新方案（v3.0）：数据保持标准嵌套格式，无需路径转换
      const processedDefaultValues = useMemo(() => {
        // 步骤1：从 schema 中提取所有 default 值
        const schemaDefaults = extractSchemaDefaults(schema);

        // 步骤2：合并 schema 默认值和用户提供的默认值
        const merged = defaultValues
          ? mergeDefaults(schemaDefaults, defaultValues)
          : schemaDefaults;

        // 步骤3：如果没有任何默认值，返回 undefined
        if (Object.keys(merged).length === 0) {
          return undefined;
        }

        // 步骤4：包装基本类型数组
        return wrapPrimitiveArrays(merged, schema);
      }, [defaultValues, schema]);

      // 用于向 resolver 传递最新联动状态（ref 避免重新创建 resolver）
      const linkageStatesRef = useRef<Record<string, { visible?: boolean; disabled?: boolean }>>({});

      // 只有非嵌套表单模式才创建新的 useForm 实例
      const ownMethods = useForm({
        defaultValues: processedDefaultValues,
        mode: validateMode,
        reValidateMode: reValidateMode,
        resolver: createSchemaResolver(schema, linkageStatesRef),
      });

      // 根据模式选择使用哪个 form methods
      // 嵌套表单模式下复用父表单的 FormContext，否则使用自己的
      const methods = asNestedForm && parentFormContext ? parentFormContext : ownMethods;

      // ✅ 使用 useRef 保持 methods 引用稳定，避免触发不必要的重新计算
      const methodsRef = React.useRef(methods);
      React.useEffect(() => {
        methodsRef.current = methods;
      }, [methods]);

      // ✅ 使用 useRef 保持 refreshLinkage 引用，避免循环依赖
      // const refreshLinkageRef = React.useRef<() => void>(() => {});

      // 解析 schema 中的联动配置
      // 分层计算策略：遇到数组字段时停止递归，数组元素内部由 NestedFormWidget 独立处理
      const { linkages: rawLinkages } = useMemo(() => {
        const parsed = parseSchemaLinkages(schema);
        // if (process.env.NODE_ENV !== 'production') {
        //   console.log(
        //     '[DynamicForm] 解析 schema 联动配置:',
        //     JSON.stringify({
        //       schema: schema.title || 'root',
        //       pathPrefix,
        //       asNestedForm,
        //       linkagesCount: Object.keys(parsed.linkages).length,
        //     })
        //   );
        // }
        return parsed;
      }, [schema, pathPrefix, asNestedForm]);

      // 统一处理联动配置：路径转换 -> 过滤父级联动
      const { processedLinkages, formToUse, effectiveLinkageFunctions } = useMemo(() => {
        // 步骤1: 路径转换和过滤
        let linkages = rawLinkages;
        if (asNestedForm && pathPrefix) {
          const transformed = transformToAbsolutePaths(rawLinkages, pathPrefix);

          // 如果有父级联动状态，过滤掉已经在父级计算过的联动
          if (linkageStateContext?.parentLinkageStates) {
            const filtered: Record<string, LinkageConfig[]> = {};
            Object.entries(transformed).forEach(([key, value]) => {
              if (!(key in linkageStateContext.parentLinkageStates)) {
                filtered[key] = value;
              }
            });
            // if (process.env.NODE_ENV !== 'production') {
            //   console.log(
            //     '[DynamicForm] 嵌套表单路径转换（已过滤父级联动）:',
            //     JSON.stringify({
            //       pathPrefix,
            //       rawLinkages,
            //       transformed,
            //       filtered,
            //     })
            //   );
            // }
            linkages = filtered;
          } else {
            // if (process.env.NODE_ENV !== 'production') {
            //   console.log('[DynamicForm] 嵌套表单路径转换:', {
            //     pathPrefix,
            //     rawLinkages,
            //     transformed,
            //   });
            // }
            linkages = transformed;
          }
        }

        // 步骤2: 确定使用的表单实例和联动函数
        // 优先使用自己的 linkageFunctions（如果有内容），否则使用 Context 中的
        const hasOwnFunctions = Object.keys(stableLinkageFunctions).length > 0;
        const finalLinkageFunctions = hasOwnFunctions
          ? stableLinkageFunctions
          : linkageStateContext?.linkageFunctions || EMPTY_LINKAGE_FUNCTIONS;

        // if (process.env.NODE_ENV !== 'production') {
        //   console.log(
        //     '[DynamicForm] 联动函数解析:',
        //     JSON.stringify({
        //       pathPrefix,
        //       asNestedForm,
        //       hasOwnFunctions,
        //       stableLinkageFunctions: Object.keys(stableLinkageFunctions),
        //       contextLinkageFunctions: linkageStateContext?.linkageFunctions
        //         ? Object.keys(linkageStateContext.linkageFunctions)
        //         : null,
        //       finalLinkageFunctions: Object.keys(finalLinkageFunctions),
        //     })
        //   );
        // }

        return {
          processedLinkages: linkages,
          formToUse: linkageStateContext?.form || methodsRef.current,
          effectiveLinkageFunctions: finalLinkageFunctions,
        };
      }, [
        rawLinkages,
        asNestedForm,
        pathPrefix,
        linkageStateContext?.parentLinkageStates,
        linkageStateContext?.form,
        linkageStateContext?.linkageFunctions,
        stableLinkageFunctions,
        // 移除 methods 依赖，因为它会在每次表单状态变化时触发重新计算
        // methods 只是用来获取表单实例，不应该触发联动配置的重新计算
      ]);

      // 步骤3: 计算自己的联动状态
      const { linkageStates: ownLinkageStates, refresh: refreshLinkage, setValueWithoutLinkage } = useArrayLinkageManager({
        form: formToUse,
        baseLinkages: processedLinkages,
        linkageFunctions: effectiveLinkageFunctions,
        schema,
      });

      // // 更新 refreshLinkageRef
      // React.useEffect(() => {
      //   refreshLinkageRef.current = refreshLinkage;
      // }, [refreshLinkage]);

      // 步骤4: 合并父级和自己的联动状态
      const linkageStates = useMemo(() => {
        if (linkageStateContext?.parentLinkageStates) {
          const merged = { ...linkageStateContext.parentLinkageStates, ...ownLinkageStates };
          // if (process.env.NODE_ENV !== 'production') {
          //   console.log(
          //     '[DynamicForm] 合并联动状态:',
          //     JSON.stringify({
          //       pathPrefix,
          //       parentStates: linkageStateContext.parentLinkageStates,
          //       ownStates: ownLinkageStates,
          //       merged,
          //     })
          //   );
          // }
          return merged;
        }
        return { ...ownLinkageStates };
      }, [linkageStateContext, ownLinkageStates, pathPrefix]);

      // 同步更新 ref，确保 resolver 始终使用最新联动状态
      linkageStatesRef.current = linkageStates;

      const {
        handleSubmit,
        watch,
        formState: { errors },
      } = methods;

      // ========== 暴露外部可访问的 API ==========
      useImperativeHandle(
        ref,
        () => ({
          setValue: (name, value, options) => {
            methods.setValue(name, value, options);
          },
          getValue: (name: string) => {
            return methods.getValues(name as any);
          },
          getValues: () => {
            return methods.getValues();
          },
          setValues: (values, options) => {
            if (options?.silence) {
              setValueWithoutLinkage(() => {
                setFormValues({ methods, values, schema, options });
              });
            } else {
              setFormValues({ methods, values, schema, options });
            }
          },
          reset: values => {
            if (values && Object.keys(values).length > 0) {
              // 有值：包装数组后重置，再递归设置嵌套路径
              const processed = wrapPrimitiveArrays(values, schema);
              methods.reset(processed);
              setValuesRecursive(methods, processed);
            } else {
              // 清空：构建类型恰当的空值，确保受控组件正确清除
              const emptyValues = buildEmptyValues(schema);
              methods.reset(emptyValues);
              setValuesRecursive(methods, emptyValues);
            }
          },
          validate: async name => {
            return methods.trigger(name);
          },
          getErrors: () => {
            return methods.formState.errors;
          },
          clearErrors: name => {
            methods.clearErrors(name);
          },
          setError: (name, error) => {
            methods.setError(name, error);
          },
          getFormState: () => {
            const { isDirty, isValid, isSubmitting, isSubmitted, submitCount } = methods.formState;
            return { isDirty, isValid, isSubmitting, isSubmitted, submitCount };
          },
          refreshLinkage: async () => {
            await refreshLinkage();
          },
        }),
        [methods, schema]
      );

      React.useEffect(() => {
        if (onChange) {
          const subscription = watch(data => {
            const processedData = transformFormData(data, schema);
            onChange(processedData);
          });
          return () => subscription.unsubscribe();
        }
      }, [watch, onChange, schema]);

      // ✅ 使用 useCallback 缓存 onSubmitHandler，避免每次渲染创建新函
      const onSubmitHandler = useCallback(
        async (data: Record<string, any>) => {
          if (onSubmit) {
            // if (process.env.NODE_ENV !== 'production') {
            //   console.info('[DynamicForm] onSubmitHandler - 原始数据:', JSON.stringify(data));
            // }

            // 使用公共函数进行数据转换，包含过滤步骤
            const filteredData = transformFormData(
              data,
              schema,
              nestedSchemaRegistry || undefined,
              true // 需要过滤数据
            );

            // if (process.env.NODE_ENV !== 'production') {
            //   console.info('[DynamicForm] onSubmitHandler - 过滤后:', JSON.stringify(filteredData));
            // }

            await onSubmit(filteredData);
          }
        },
        [onSubmit, schema, nestedSchemaRegistry]
      );

      // 使用 useMemo 缓存 LinkageStateContext 的 value 对象
      // 避免每次 linkageStates 变化时都创建新对象，导致所有消费该 Context 的组件重新渲染
      const linkageContextValue = useMemo(
        () => ({
          parentLinkageStates: linkageStates,
          form: methodsRef.current, // ✅ 使用 ref 避免 methods 变化触发重新计算
          rootSchema: schema,
          pathPrefix: pathPrefix,
          linkageFunctions: effectiveLinkageFunctions,
        }),
        [linkageStates, schema, pathPrefix, effectiveLinkageFunctions] // ✅ 移除 methods 依赖
      );

      // 使用 useMemo 缓存字段内容，避免每次渲染都创建新的 children
      const fieldsContent = useMemo(
        () => (
          <div className="dynamic-form__fields">
            {fields.map(field => {
              const linkageState = linkageStates[field.name];

              // 如果联动状态指定不可见，则不渲染该字段
              if (isFieldHiddenByLinkage(field.name, linkageStates)) {
                return null;
              }

              return (
                <FormField
                  key={field.name}
                  field={field}
                  disabled={disabled || field.disabled || loading || linkageState?.disabled}
                  readonly={readonly || field.readonly || linkageState?.readonly}
                  linkageState={linkageState}
                  layout={layout}
                  labelWidth={labelWidth}
                  enableVirtualScroll={enableVirtualScroll}
                  virtualScrollHeight={virtualScrollHeight}
                />
              );
            })}
          </div>
        ),
        [
          fields,
          linkageStates,
          disabled,
          loading,
          readonly,
          layout,
          labelWidth,
          enableVirtualScroll,
          virtualScrollHeight,
        ]
      );

      // 使用 useMemo 缓存带 Provider 的字段内容
      const renderedFields = useMemo(() => {
        // 如果不是嵌套表单，提供 LinkageStateContext
        if (!asNestedForm) {
          return (
            <LinkageStateProvider value={linkageContextValue}>{fieldsContent}</LinkageStateProvider>
          );
        }
        return fieldsContent;
      }, [asNestedForm, linkageContextValue, fieldsContent]);

      // 使用 useMemo 缓存提交按钮
      const submitButton = useMemo(() => {
        if (!showSubmitButton) return null;

        return (
          <div className="dynamic-form__actions" style={{ marginTop: '20px' }}>
            <Button type="submit" intent="primary" loading={loading} disabled={loading || disabled}>
              {loading ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        );
      }, [showSubmitButton, loading, disabled]);

      const formClassName = `dynamic-form dynamic-form--${layout} ${className || ''}`;

      // 使用 useMemo 缓存表单内容，避免每次渲染都创建新的 children
      const formContent = useMemo(() => {
        const content = (
          <PathPrefixProvider prefix={asNestedForm ? '' : pathPrefix}>
            {renderAsForm ? (
              <form
                onSubmit={handleSubmit(onSubmitHandler)}
                className={formClassName}
                style={style}
              >
                {showErrorList && Object.keys(errors).length > 0 && <ErrorList errors={errors} />}
                {renderedFields}
                {submitButton}
              </form>
            ) : (
              <div className={formClassName} style={style}>
                {showErrorList && Object.keys(errors).length > 0 && <ErrorList errors={errors} />}
                {renderedFields}
                {submitButton}
              </div>
            )}
          </PathPrefixProvider>
        );

        // 只在顶层（非嵌套表单）创建 WidgetsProvider
        if (asNestedForm) {
          return content;
        }

        return <WidgetsProvider widgets={stableWidgets}>{content}</WidgetsProvider>;
      }, [
        asNestedForm,
        pathPrefix,
        renderAsForm,
        handleSubmit,
        onSubmitHandler,
        formClassName,
        style,
        showErrorList,
        errors,
        renderedFields,
        submitButton,
        stableWidgets,
      ]);

      // 嵌套表单模式下不需要再包裹 FormProvider，因为已经复用了父表单的 context
      if (asNestedForm && parentFormContext) {
        return formContent;
      }

      // 非嵌套表单模式，需要提供 FormProvider
      return <FormProvider {...methods}>{formContent}</FormProvider>;
    }
  )
);

// 外层组件：提供 NestedSchemaProvider
export const DynamicForm = forwardRef<DynamicFormRef, DynamicFormProps>((props, ref) => {
  // 如果已经在 NestedSchemaProvider 内部（嵌套表单场景），直接渲染内层组件
  const existingRegistry = useNestedSchemaRegistryOptional();

  if (existingRegistry) {
    return <DynamicFormInner {...props} ref={ref} />;
  }

  // 否则提供新的 NestedSchemaProvider（顶层表单场景）
  return (
    <NestedSchemaProvider>
      <DynamicFormInner {...props} ref={ref} />
    </NestedSchemaProvider>
  );
});
