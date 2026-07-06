import React, {
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";
import {
  useForm,
  FormProvider,
  useFormContext,
  type UseFormReturn,
} from "react-hook-form";
import { Button } from "@blueprintjs/core";
import { SchemaParser } from "./core/SchemaParser";
import { FormField } from "./layout/FormField";
import { ErrorList } from "./components/ErrorList";
import type { DynamicFormProps, DynamicFormRef } from "./types";
import {
  parseSchemaLinkages,
  transformToAbsolutePaths,
} from "./utils/schemaLinkageParser";
import { useArrayLinkageManager } from "./hooks/useArrayLinkageManager";
import type { LinkageConfig } from "./types/linkage";
import type { ExtendedJSONSchema } from "./types/schema";
import { filterValueWithNestedSchemas } from "./utils/filterValueWithNestedSchemas";
import {
  NestedSchemaProvider,
  useNestedSchemaRegistryOptional,
} from "./context/NestedSchemaContext";
import { PathPrefixProvider } from "./context/PathPrefixContext";
import {
  LinkageStateProvider,
  useLinkageStateContext,
} from "./context/LinkageStateContext";
import { WidgetsProvider } from "./context/WidgetsContext";
import { CallbacksProvider } from "./context/CallbacksContext";
import {
  wrapPrimitiveArrays,
  unwrapPrimitiveArrays,
} from "./utils/arrayTransformer";
import {
  extractSchemaDefaults,
  mergeDefaults,
} from "./utils/extractSchemaDefaults";
import { createSchemaResolver } from "./utils/createSchemaResolver";
import { resolveTransformFn } from "./utils/resolveTransformFn";
import { mergeSchemaWithLinkage } from "./utils/mergeSchemaWithLinkage";
import "@blueprintjs/core/lib/css/blueprint.css";

// 空对象常量，避免每次渲染创建新对象
const EMPTY_LINKAGE_FUNCTIONS = {};
const EMPTY_WIDGETS = {};
const EMPTY_CUSTOM_FORMATS = {};
const EMPTY_CALLBACKS = {};

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
  prefix = "",
) {
  Object.entries(obj).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    // 设置当前路径的值
    methods.setValue(path, value, options);
    // 普通对象递归展开（数组和 null 除外）：
    // NestedFormWidget 内部的子字段通过独立的 Controller 注册（如 address.street）。
    // 仅调用 setValue('address', {...}) 只更新父 Controller，子 Controller 不会收到新值。
    // 必须对每一层路径都调用 setValue，才能确保所有嵌套表单的子字段同步更新。
    // 数组由 useFieldArray 管理，直接设置整体即可，无需递归展开。
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
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
  if (schema.type !== "object" || !schema.properties) {
    return {};
  }

  const result: Record<string, any> = {};

  Object.entries(schema.properties).forEach(([key, fieldSchema]) => {
    const typedSchema = fieldSchema as ExtendedJSONSchema;

    if (typedSchema.type === "array") {
      result[key] = [];
    } else if (typedSchema.type === "object" && typedSchema.properties) {
      result[key] = buildEmptyValues(typedSchema);
    } else if (typedSchema.type === "string") {
      result[key] = "";
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
  nestedSchemaRegistry?: {
    getAllSchemas: () => Map<string, ExtendedJSONSchema>;
  },
  shouldFilter: boolean = false,
): Record<string, any> {
  // 第一步：解包基本类型数组
  let processedData = unwrapPrimitiveArrays(data, schema);

  // 第二步：根据 schema 过滤数据（仅在需要时执行）
  if (shouldFilter) {
    processedData = nestedSchemaRegistry
      ? filterValueWithNestedSchemas(
          processedData,
          schema,
          nestedSchemaRegistry.getAllSchemas(),
        )
      : filterValueWithNestedSchemas(processedData, schema, new Map());
  }

  return processedData;
}

/**
 * 将表单数据中所有配置了 ui.transform.callback 的字段值从展示域转为存储域
 *
 * 调用时机：getValues、onChange 回调、onSubmit 回调。
 * 原因：表单内部存储展示域值（用户输入），对外暴露的所有数据出口统一返回存储域值，
 * 使外部调用方无需感知转换逻辑。
 */
function applyFieldTransforms(
  data: any,
  schema: ExtendedJSONSchema,
  callbacks: Record<string, (...args: any[]) => any>,
): any {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const result: Record<string, any> = { ...data };
  for (const [key, rawSchema] of Object.entries(schema.properties || {})) {
    if (!(key in result)) {
      continue;
    }
    const fieldSchema = rawSchema as ExtendedJSONSchema;
    const cb = fieldSchema.ui?.transform?.callback;
    const fn = resolveTransformFn(cb, callbacks);
    if (fn) {
      try {
        result[key] = fn(result[key]);
      } catch {
        /* keep */
      }
    }
    if (fieldSchema.type === "object" && fieldSchema.properties) {
      result[key] = applyFieldTransforms(result[key], fieldSchema, callbacks);
    }
    if (
      fieldSchema.type === "array" &&
      !Array.isArray(fieldSchema.items) &&
      fieldSchema.items &&
      Array.isArray(result[key])
    ) {
      result[key] = (result[key] as any[]).map((item) =>
        applyFieldTransforms(
          item,
          fieldSchema.items as ExtendedJSONSchema,
          callbacks,
        ),
      );
    }
  }
  return result;
}

/**
 * 根据路径字符串（如 "a.b.c" 或 "items.0.name"）从 schema 树中查找对应的子 schema
 *
 * 用于 setValue/getValue 时找到单个字段的 transform 配置，以便对值进行单字段级别转换。
 * 数字段（如 "0"）表示数组索引，此时跳入 items schema 继续查找。
 */
function getSchemaAtPath(
  schema: ExtendedJSONSchema,
  path: string,
): ExtendedJSONSchema | undefined {
  const parts = path.split(".");
  let current: ExtendedJSONSchema = schema;
  for (const part of parts) {
    const next =
      current.properties?.[part] ??
      (!isNaN(parseInt(part)) && !Array.isArray(current.items)
        ? current.items
        : undefined);
    if (!next) {
      return undefined;
    }
    current = next as ExtendedJSONSchema;
  }
  return current;
}

/**
 * 将外部传入的存储域值反向转换为展示域值，写入表单内部
 *
 * 调用时机：setValues、setValue、reset 等外部赋值 API。
 * 原因：表单内部存储展示域值，外部 API 统一接收存储域值，
 * 因此写入前需要先通过 reverseCallback 转换。
 */
function reverseFieldTransforms(
  data: any,
  schema: ExtendedJSONSchema,
  callbacks: Record<string, (...args: any[]) => any>,
): any {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const result: Record<string, any> = { ...data };
  for (const [key, rawSchema] of Object.entries(schema.properties || {})) {
    if (!(key in result)) {
      continue;
    }
    const fieldSchema = rawSchema as ExtendedJSONSchema;
    const cb = fieldSchema.ui?.transform?.reverseCallback;
    const fn = resolveTransformFn(cb, callbacks);
    if (fn) {
      try {
        result[key] = fn(result[key]);
      } catch {
        /* keep */
      }
    }
    if (fieldSchema.type === "object" && fieldSchema.properties) {
      result[key] = reverseFieldTransforms(result[key], fieldSchema, callbacks);
    }
    if (
      fieldSchema.type === "array" &&
      !Array.isArray(fieldSchema.items) &&
      fieldSchema.items &&
      Array.isArray(result[key])
    ) {
      result[key] = (result[key] as any[]).map((item) =>
        reverseFieldTransforms(
          item,
          fieldSchema.items as ExtendedJSONSchema,
          callbacks,
        ),
      );
    }
  }
  return result;
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
  linkageStates: Record<string, { visible?: boolean }>,
): boolean {
  // 检查字段自身的联动状态
  if (linkageStates[fieldPath]?.visible === false) {
    return true;
  }

  // 使用标准的 . 分隔符拆分路径
  const parts = fieldPath.split(".");

  // 检查每个父级路径的联动状态
  for (let i = 1; i < parts.length; i++) {
    const parentPath = parts.slice(0, i).join(".");
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
        callbacks,
        customFormats,
        layout = "vertical",
        labelWidth,
        columnsCount = 1,
        showErrorList = false,
        showSubmitButton = true,
        renderAsForm = true,
        validateMode = "onSubmit",
        reValidateMode = "onChange",
        loading = false,
        disabled = false,
        readonly = false,
        className,
        style,
        fieldsWrapperStyle,
        fieldRowStyle,
        fieldLabelStyle,
        fieldControlStyle,
        pathPrefix = "",
        asNestedForm = false,
        enableVirtualScroll = false,
        virtualScrollHeight = 600,
      },
      ref,
    ) => {
      // ========== Context 获取（集中管理） ==========
      const parentFormContext = useFormContext();
      const linkageStateContext = useLinkageStateContext();
      const nestedSchemaRegistry = useNestedSchemaRegistryOptional();

      // ========== 空对象常量处理（统一管理） ==========
      const stableLinkageFunctions =
        linkageFunctions || EMPTY_LINKAGE_FUNCTIONS;
      const stableWidgets = widgets || EMPTY_WIDGETS;
      const stableCustomFormats = customFormats || EMPTY_CUSTOM_FORMATS;
      const stableCallbacks = callbacks || EMPTY_CALLBACKS;

      // 设置自定义格式验证器并解析字段
      // 当 asNestedForm 为 true 时，需要为字段名添加 pathPrefix 前缀
      const fields = useMemo(() => {
        if (
          stableCustomFormats &&
          Object.keys(stableCustomFormats).length > 0
        ) {
          SchemaParser.setCustomFormats(stableCustomFormats);
        }

        // 从 schema.ui 中读取 prefixLabel（用于 flattenPrefix 场景）
        const prefixLabel = schema.ui?.prefixLabel || "";

        const parsedFields = SchemaParser.parse(schema, {
          prefixLabel,
        });

        // 如果是嵌套表单模式且有路径前缀，为字段名添加前缀
        if (asNestedForm && pathPrefix) {
          return parsedFields.map((field) => ({
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

        // 步骤4：包装基本类型数组（schema default 本身是展示域，无需反转）
        return wrapPrimitiveArrays(merged, schema);
      }, [defaultValues, schema]);

      // 用于向 resolver 传递最新联动状态（ref 避免重新创建 resolver）
      // resolver 需要读取最新的联动状态（用于跳过隐藏字段的校验），但不能将 linkageStates 作为
      // useForm 的依赖：每次联动状态变化都重新创建 resolver 会导致表单重新初始化、清空用户输入。
      // 用 ref 保存最新状态，resolver 通过 ref 读取而不触发 useForm 重建。
      const linkageStatesRef = useRef<
        Record<string, { visible?: boolean; disabled?: boolean }>
      >({});

      // 只有非嵌套表单模式才创建新的 useForm 实例
      const ownMethods = useForm({
        defaultValues: processedDefaultValues,
        mode: validateMode,
        reValidateMode: reValidateMode,
        resolver: createSchemaResolver(
          schema,
          stableCallbacks,
          linkageStatesRef,
        ),
      });

      // 根据模式选择使用哪个 form methods
      // 嵌套表单模式下复用父表单的 FormContext，否则使用自己的
      const methods =
        asNestedForm && parentFormContext ? parentFormContext : ownMethods;

      // ✅ 使用 useRef 保持 methods 引用稳定，避免触发不必要的重新计算
      const methodsRef = React.useRef(methods);
      React.useEffect(() => {
        methodsRef.current = methods;
      }, [methods]);

      const callbacksRef =
        useRef<{ [key in string]: (...args: any) => any }>(stableCallbacks);
      callbacksRef.current = stableCallbacks;

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
      const { processedLinkages, formToUse, effectiveLinkageFunctions } =
        useMemo(() => {
          // 步骤1: 路径转换和过滤
          let linkages = rawLinkages;
          if (asNestedForm && pathPrefix) {
            const transformed = transformToAbsolutePaths(
              rawLinkages,
              pathPrefix,
            );

            // 过滤掉已经由外层 DynamicForm 负责的联动配置。
            // 联动以数组字段为边界分层计算，每层只负责本层数组边界以内、下一层数组边界以外的联动。
            // 若内层重复计算外层已处理的联动，会导致同一字段被两个 useLinkageManager 实例同时管理，
            // 引发竞态条件和状态不一致。
            //
            // 使用外层的静态配置（parentLinkages）而不是运行时状态（parentLinkageStates）进行过滤：
            // parentLinkageStates 在外层 refreshLinkage 执行前为空，内层初始化时若依赖它做过滤，
            // 会因时序问题导致过滤失败，内层错误接管外层的联动，产生空对象覆盖有效状态的问题。
            // parentLinkages 是静态配置，在外层 useMemo 时即可确定，内层初始化时立即可读。
            if (linkageStateContext?.parentLinkages) {
              const filtered: Record<string, LinkageConfig[]> = {};
              Object.entries(transformed).forEach(([key, value]) => {
                if (!(key in linkageStateContext.parentLinkages)) {
                  filtered[key] = value;
                }
              });
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
          const hasOwnFunctions =
            Object.keys(stableLinkageFunctions).length > 0;
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
      const {
        linkageStates: ownLinkageStates,
        refresh: refreshLinkage,
        setValueWithoutLinkage,
      } = useArrayLinkageManager({
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
          const merged = {
            ...linkageStateContext.parentLinkageStates,
            ...ownLinkageStates,
          };
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
            const fieldSchema = getSchemaAtPath(schema, name);
            const reverseFn = resolveTransformFn(
              fieldSchema?.ui?.transform?.reverseCallback,
              callbacksRef.current,
            );
            methods.setValue(
              name,
              reverseFn ? reverseFn(value) : value,
              options,
            );
          },
          getValue: (name: string) => {
            const displayValue = methods.getValues(name as any);
            const fieldSchema = getSchemaAtPath(schema, name);
            const fn = resolveTransformFn(
              fieldSchema?.ui?.transform?.callback,
              callbacksRef.current,
            );
            return fn ? fn(displayValue) : displayValue;
          },
          getValues: () => {
            const displayValues = methods.getValues();
            return applyFieldTransforms(
              transformFormData(displayValues, schema),
              schema,
              callbacksRef.current,
            );
          },
          setValues: (values, options) => {
            const displayValues = reverseFieldTransforms(
              values,
              schema,
              callbacksRef.current,
            );
            if (options?.silence) {
              setValueWithoutLinkage(() => {
                setFormValues({
                  methods,
                  values: displayValues,
                  schema,
                  options,
                });
              });
            } else {
              setFormValues({
                methods,
                values: displayValues,
                schema,
                options,
              });
            }
          },
          reset: (values) => {
            if (values && Object.keys(values).length > 0) {
              const reversed = reverseFieldTransforms(
                values,
                schema,
                callbacksRef.current,
              );
              const processed = wrapPrimitiveArrays(reversed, schema);
              methods.reset(processed);
              setValuesRecursive(methods, processed);
            } else {
              // 清空：构建类型恰当的空值，确保受控组件正确清除
              const emptyValues = buildEmptyValues(schema);
              methods.reset(emptyValues);
              setValuesRecursive(methods, emptyValues);
            }
          },
          validate: async (name) => {
            return methods.trigger(name);
          },
          getErrors: () => {
            return methods.formState.errors;
          },
          clearErrors: (name) => {
            methods.clearErrors(name);
          },
          setError: (name, error) => {
            methods.setError(name, error);
          },
          getFormState: () => {
            const { isDirty, isValid, isSubmitting, isSubmitted, submitCount } =
              methods.formState;
            return { isDirty, isValid, isSubmitting, isSubmitted, submitCount };
          },
          refreshLinkage: async () => {
            await refreshLinkage();
          },
        }),
        [methods, schema, refreshLinkage],
      );

      React.useEffect(() => {
        if (onChange) {
          const subscription = watch((data) => {
            const processedData = transformFormData(data, schema);
            onChange(
              applyFieldTransforms(processedData, schema, callbacksRef.current),
            );
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
              true, // 需要过滤数据
            );

            // if (process.env.NODE_ENV !== 'production') {
            //   console.info('[DynamicForm] onSubmitHandler - 过滤后:', JSON.stringify(filteredData));
            // }

            await onSubmit(
              applyFieldTransforms(filteredData, schema, stableCallbacks),
            );
          }
        },
        [onSubmit, schema, nestedSchemaRegistry, stableCallbacks],
      );

      // 使用 useMemo 缓存 LinkageStateContext 的 value 对象
      // 避免每次 linkageStates 变化时都创建新对象，导致所有消费该 Context 的组件重新渲染
      const linkageContextValue = useMemo(
        () => ({
          parentLinkageStates: linkageStates,
          parentLinkages: processedLinkages, // 传递静态配置，用于子级过滤
          form: methodsRef.current, // ✅ 使用 ref 避免 methods 变化触发重新计算
          rootSchema: schema,
          pathPrefix: pathPrefix,
          linkageFunctions: effectiveLinkageFunctions,
        }),
        [
          linkageStates,
          processedLinkages,
          schema,
          pathPrefix,
          effectiveLinkageFunctions,
        ], // ✅ 移除 methods 依赖
      );

      // 使用 useMemo 缓存字段内容，避免每次渲染都创建新的 children
      const fieldsContent = useMemo(
        () => (
          <div
            className="dynamic-form__fields"
            style={{
              ...fieldsWrapperStyle,
              ...(columnsCount > 1
                ? {
                    display: "grid",
                    gridTemplateColumns: `repeat(${columnsCount}, 1fr)`,
                    gap: "0 16px",
                  }
                : undefined),
            }}
          >
            {fields.map((field) => {
              const linkageState = linkageStates[field.name];

              // 如果联动状态指定不可见，则不渲染该字段
              if (isFieldHiddenByLinkage(field.name, linkageStates)) {
                return null;
              }

              // 如果存在 schema 联动，合并到字段 schema
              let effectiveField = field;
              if (linkageState?.schema) {
                const mergedSchema = mergeSchemaWithLinkage(
                  field.schema || { type: "object", properties: {} },
                  linkageState.schema,
                );
                effectiveField = {
                  ...field,
                  schema: mergedSchema,
                  // 重新提取 UI 属性到 field 对象，确保 UI 联动生效
                  placeholder:
                    mergedSchema.ui?.placeholder ?? field.placeholder,
                  description: mergedSchema.ui?.help ?? field.description,
                  widget: mergedSchema.ui?.widget ?? field.widget,
                  disabled: mergedSchema.ui?.disabled ?? field.disabled,
                  readonly: mergedSchema.ui?.readonly ?? field.readonly,
                  hidden: mergedSchema.ui?.hidden ?? field.hidden,
                  // 统一在此处应用 options 联动
                  options: linkageState?.options ?? field.options,
                };
              } else if (linkageState?.options) {
                // 只有 options 联动时，也需要更新 field
                effectiveField = {
                  ...field,
                  options: linkageState.options,
                };
              }

              return (
                <FormField
                  key={field.name}
                  field={effectiveField}
                  disabled={
                    disabled ||
                    field.disabled ||
                    loading ||
                    linkageState?.disabled
                  }
                  readonly={
                    readonly || field.readonly || linkageState?.readonly
                  }
                  linkageState={linkageState}
                  layout={layout}
                  labelWidth={labelWidth}
                  fieldRowStyle={fieldRowStyle}
                  fieldLabelStyle={fieldLabelStyle}
                  fieldControlStyle={fieldControlStyle}
                  enableVirtualScroll={enableVirtualScroll}
                  virtualScrollHeight={virtualScrollHeight}
                  columnsCount={columnsCount}
                />
              );
            })}
          </div>
        ),
        [
          disabled,
          enableVirtualScroll,
          fields,
          fieldControlStyle,
          fieldLabelStyle,
          fieldRowStyle,
          linkageStates,
          labelWidth,
          layout,
          loading,
          readonly,
          virtualScrollHeight,
          fieldsWrapperStyle,
          columnsCount,
        ],
      );

      // 使用 useMemo 缓存带 Provider 的字段内容
      const renderedFields = useMemo(() => {
        // 如果不是嵌套表单，提供 LinkageStateContext
        if (!asNestedForm) {
          return (
            <LinkageStateProvider value={linkageContextValue}>
              {fieldsContent}
            </LinkageStateProvider>
          );
        }
        return fieldsContent;
      }, [asNestedForm, linkageContextValue, fieldsContent]);

      // 使用 useMemo 缓存提交按钮
      const submitButton = useMemo(() => {
        if (!showSubmitButton) {
          return null;
        }

        return (
          <div className="dynamic-form__actions" style={{ marginTop: "20px" }}>
            <Button
              type="submit"
              intent="primary"
              loading={loading}
              disabled={loading || disabled}
            >
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </div>
        );
      }, [showSubmitButton, loading, disabled]);

      const formClassName = `dynamic-form dynamic-form--${layout} ${className || ""}`;

      // 使用 useMemo 缓存表单内容，避免每次渲染都创建新的 children
      const formContent = useMemo(() => {
        const content = (
          <PathPrefixProvider prefix={asNestedForm ? "" : pathPrefix}>
            {renderAsForm ? (
              <form
                onSubmit={handleSubmit(onSubmitHandler)}
                className={formClassName}
                style={style}
              >
                {showErrorList && Object.keys(errors).length > 0 && (
                  <ErrorList errors={errors} />
                )}
                {renderedFields}
                {submitButton}
              </form>
            ) : (
              <div className={formClassName} style={style}>
                {showErrorList && Object.keys(errors).length > 0 && (
                  <ErrorList errors={errors} />
                )}
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

        return (
          <CallbacksProvider callbacks={stableCallbacks}>
            <WidgetsProvider widgets={stableWidgets}>{content}</WidgetsProvider>
          </CallbacksProvider>
        );
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
        stableCallbacks,
      ]);

      // 嵌套表单模式下不需要再包裹 FormProvider，因为已经复用了父表单的 context
      if (asNestedForm && parentFormContext) {
        return formContent;
      }

      // 非嵌套表单模式，需要提供 FormProvider
      return <FormProvider {...methods}>{formContent}</FormProvider>;
    },
  ),
);

// 外层组件：提供 NestedSchemaProvider
export const DynamicForm = forwardRef<DynamicFormRef, DynamicFormProps>(
  (props, ref) => {
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
  },
);
