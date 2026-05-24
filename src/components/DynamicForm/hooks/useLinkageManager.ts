import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type {
  LinkageConfig,
  LinkageFunction,
  ConditionExpression,
  LinkageFunctionContext,
} from '../types/linkage';
import type { LinkageResult } from '../types/linkage';
import { ConditionEvaluator } from '../utils/conditionEvaluator';
import { DependencyGraph } from '../utils/dependencyGraph';
import { PathResolver } from '../utils/pathResolver';
import { LinkageTaskQueue } from '../utils/linkageTaskQueue';
import { LinkageResultCache } from '../utils/linkageResultCache';
import { generateCacheKey } from '../utils/generateCacheKey';

/**
 * 异步结果过期错误
 * 当异步联动函数的结果因为新的计算而过期时抛出
 */
/* istanbul ignore next -- 竞态条件边缘情况，任务队列串行处理机制使得此错误难以在测试中稳定触发 */
class StaleResultError extends Error {
  constructor(fieldPath: string, sequence: number) {
    super(`Stale async result for field: ${fieldPath}, sequence: ${sequence}`);
    this.name = 'StaleResultError';
  }
}

/**
 * 异步请求序列号管理器
 * 用于解决异步联动函数的竞态条件问题
 */
class AsyncSequenceManager {
  private sequences: Map<string, number> = new Map();

  /**
   * 为指定字段生成新的序列号
   */
  next(fieldName: string): number {
    const current = this.sequences.get(fieldName) || 0;
    const next = current + 1;
    this.sequences.set(fieldName, next);
    return next;
  }

  /**
   * 检查序列号是否是最新的
   */
  isLatest(fieldName: string, sequence: number): boolean {
    const current = this.sequences.get(fieldName) || 0;
    return sequence === current;
  }

  /**
   * 清除指定字段的序列号
   */
  /* istanbul ignore next -- 预留 API，当前未使用 */
  clear(fieldName: string): void {
    this.sequences.delete(fieldName);
  }

  /**
   * 清除所有序列号
   */
  /* istanbul ignore next -- 预留 API，当前未使用 */
  clearAll(): void {
    this.sequences.clear();
  }
}

/**
 * 获取嵌套对象的值
 */
// function getNestedValue(obj: any, path: string): any {
//   if (!path) return obj;
//   const keys = path.split('.');
//   let result = obj;
//   for (const key of keys) {
//     if (result == null) return undefined;
//     result = result[key];
//   }
//   return result;
// }

/**
 * 设置嵌套对象的值
 */
// function setNestedValue(obj: any, path: string, value: any): void {
//   if (!path) return;
//   const keys = path.split('.');
//   let current = obj;
//   for (let i = 0; i < keys.length - 1; i++) {
//     const key = keys[i];
//     if (current[key] == null || typeof current[key] !== 'object') {
//       current[key] = {};
//     }
//     current = current[key];
//   }
//   current[keys[keys.length - 1]] = value;
// }

/**
 * 从字段路径中提取数组上下文信息
 * 例如: 'contacts.0.showCompany' => { arrayPath: 'contacts', arrayIndex: 0 }
 */
function extractArrayContext(fieldPath: string): { arrayPath?: string; arrayIndex?: number } {
  const parts = fieldPath.split('.');
  for (let i = 0; i < parts.length; i++) {
    const index = parseInt(parts[i], 10);
    if (!isNaN(index) && i > 0) {
      return {
        arrayPath: parts.slice(0, i).join('.'),
        arrayIndex: index,
      };
    }
  }
  return {};
}

interface LinkageManagerOptions {
  form: UseFormReturn<any>;
  linkages: Record<string, LinkageConfig[]>; // v3.1: 支持多联动类型
  linkageFunctions?: Record<string, LinkageFunction>;
}

/**
 * 联动管理器 Hook
 *
 * v4.1：新增字段级操作版本号，解决初始化路径与 processQueue 路径之间的跨路径竞态条件
 */
export function useLinkageManager({
  form,
  linkages,
  linkageFunctions = {},
}: LinkageManagerOptions) {
  const { watch, getValues, setValue } = form;

  // 创建异步序列号管理器实例（使用 useRef 保持引用稳定）
  const asyncSequenceManager = useRef(new AsyncSequenceManager()).current;

  // 创建任务队列管理器实例
  const taskQueue = useRef(new LinkageTaskQueue()).current;

  // 创建缓存管理器实例
  const cache = useRef(new LinkageResultCache()).current;

  // 构建依赖图
  // v3.1 更新：支持数组格式的联动配置
  const dependencyGraph = useMemo(() => {
    const graph = new DependencyGraph();

    Object.entries(linkages).forEach(([fieldName, linkageArray]) => {
      // 遍历数组中的每个联动配置
      linkageArray.forEach(linkage => {
        linkage.dependencies.forEach(dep => {
          // 标准化路径并添加依赖关系
          const normalizedDep = PathResolver.toFieldPath(dep);
          graph.addDependency(fieldName, normalizedDep);
        });
      });
    });

    // 检测循环依赖
    const cycle = graph.detectCycle();
    if (cycle) {
      console.error('检测到循环依赖:', cycle.join(' -> '));
    }

    return graph;
  }, [linkages]);

  // 联动状态缓存（使用 useState 而不是 useMemo，以便在 useEffect 中更新）
  const [linkageStates, setLinkageStates] = useState<Record<string, LinkageResult>>({});

  /**
   * 应用联动计算结果到表单和状态
   * 复用于 processQueue 和 refreshLinkage
   */
  const applyLinkageResults = useCallback(
    async ({
      fields,
      states,
      updatedFormData,
      preMarkFields = false,
    }: {
      fields: string[];
      states: Record<string, LinkageResult>;
      updatedFormData: Record<string, any>;
      preMarkFields?: boolean;
    }) => {
      taskQueue.setUpdatingForm(true);

      // 更新联动状态
      if (Object.keys(states).length > 0) {
        setLinkageStates(prev => ({ ...prev, ...states }));
      }

      // 预先标记字段（processQueue 需要，防止级联触发）
      if (preMarkFields) {
        fields.forEach(fieldName => taskQueue.markFieldUpdating(fieldName));
      }

      // 批量更新表单值
      fields.forEach(fieldName => {
        const linkageArray = linkages[fieldName];
        const hasValueLinkage = linkageArray?.some(linkage => linkage.type === 'value');
        if (hasValueLinkage && updatedFormData[fieldName] !== undefined) {
          const currentValue = getValues(fieldName);
          if (currentValue !== updatedFormData[fieldName]) {
            if (!preMarkFields) {
              taskQueue.markFieldUpdating(fieldName);
            }
            setValue(fieldName, updatedFormData[fieldName], {
              shouldValidate: false,
              shouldDirty: false,
            });
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      taskQueue.clearUpdatingFields();
      taskQueue.setUpdatingForm(false);
    },
    [linkages, getValues, setValue, taskQueue, setLinkageStates]
  );

  /**
   * 队列处理器：使用拓扑层级并行执行联动任务
   */
  const processQueue = useRef(async () => {
    // 如果正在刷新，直接返回（避免与 refreshLinkage 并发）
    if (taskQueue.getRefreshing()) {
      return;
    }

    // 如果已经在处理中，直接返回（避免并发执行）
    /* istanbul ignore if -- 竞态条件边缘情况，难以在测试中稳定触发 */
    if (taskQueue.getProcessing()) {
      return;
    }

    taskQueue.setProcessing(true);

    try {
      // let iterationCount = 0;
      while (!taskQueue.isEmpty()) {
        // iterationCount++;

        const task = taskQueue.dequeue();
        if (!task) break;

        // 检查任务是否仍然有效（可能已被更新的任务替代）
        /* istanbul ignore if -- 竞态条件边缘情况，难以在测试中稳定触发 */
        if (!taskQueue.isTaskValid(task.fieldName, task.timestamp)) {
          continue;
        }

        // 使用最新的表单数据（优先使用 latestFormDataRef，解决 setValues 批量更新时的时序问题）
        const formData = Object.keys(latestFormDataRef.current).length > 0
          ? { ...latestFormDataRef.current }
          : { ...getValues() };

        console.log(`[DEBUG processQueue] task=${task.fieldName}, formData=`, JSON.stringify(formData));

        // ✅ 优化：直接使用任务中的 affectedFields，避免重复调用 getAffectedFields
        const affectedFields = task.affectedFields;

        // 使用拓扑层级并行计算受影响的字段
        console.log(`[DEBUG processQueue] 开始计算 affectedFields=${JSON.stringify(affectedFields)}, trigger=${task.fieldName}`);
        const { states: newStates, updatedFormData } = await evaluateLinkagesByLayers({
          fields: affectedFields,
          linkages,
          formData,
          linkageFunctions,
          asyncSequenceManager,
          dependencyGraph,
          cache,
          _caller: `processQueue(trigger=${task.fieldName})`,
        });
        console.log(`[DEBUG processQueue] 计算完成 states=${JSON.stringify(newStates)}`);

        // ✅ 使用公共函数应用联动结果
        await applyLinkageResults({
          fields: affectedFields,
          states: newStates,
          updatedFormData,
          preMarkFields: true, // processQueue 需要预先标记，防止级联触发
        });
      }
    } finally {
      taskQueue.setProcessing(false);

      // 处理完成后，如果队列中有新任务，继续处理
      /* istanbul ignore if -- 竞态条件边缘情况，难以在测试中稳定触发 */
      if (!taskQueue.isEmpty()) {
        processQueue();
      }
    }
  }).current;

  // 保存最新的 formData（用于解决 setValues 批量更新时的时序问题）
  const latestFormDataRef = useRef<Record<string, any>>({});
  // 跳过联动处理的标志（用于外部直接赋值时不触发联动）
  const skipLinkageRef = useRef(false);

  // 统一的字段变化监听和联动处理（使用任务队列）
  useEffect(() => {
    // ✅ 如果没有联动配置，不需要监听字段变化
    if (Object.keys(linkages).length === 0) {
      return;
    }

    const subscription = watch((formData, { name }) => {
      if (!name) return;

      // 如果设置了跳过联动标志，直接返回
      if (skipLinkageRef.current) {
        console.log(`[DEBUG watch] field=${name}, skipped (skipLinkage=true)`);
        return;
      }

      // 保存最新的 formData（解决 setValues 批量更新时的时序问题）
      latestFormDataRef.current = formData as Record<string, any>;
      console.log(`[DEBUG watch] field=${name}, formData=`, JSON.stringify(formData));

      // ✅ 精确监听优化：检查该字段是否被任何联动依赖
      const affectedFields = dependencyGraph.getAffectedFields(name);
      if (affectedFields.length === 0) {
        return;
      }

      // ✅ 级联传播：字段正在被联动的 setValue 更新时，仍允许触发下游依赖（非自身）的联动。
      // 仅当所有下游字段也都在被更新时（循环依赖），才完全跳过，防止死循环。
      if (taskQueue.isFieldUpdating(name)) {
        const hasCascadeTargets = affectedFields.some(f => !taskQueue.isFieldUpdating(f));
        if (!hasCascadeTargets) return;
      }

      // 将任务加入队列
      taskQueue.enqueue(name, affectedFields);

      // 如果队列正在处理中，不重复触发（队列会自动继续处理）
      if (taskQueue.getProcessing()) {
        return;
      }

      // 触发队列处理
      processQueue();
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, linkages, dependencyGraph]);

  /**
   * 手动刷新所有字段的联动状态
   * 用于初始化或需要重新计算所有联动的场景
   */
  const refreshLinkage = useCallback(async () => {
    try {
      // 等待 processQueue 完成（避免并发）
      while (taskQueue.getProcessing()) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 等待其他 refreshLinkage 完成（避免多个 refresh 并发）
      while (taskQueue.getRefreshing()) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 设置刷新标志，阻止 processQueue 执行
      taskQueue.setRefreshing(true);

      const formData = { ...getValues() };
      const allFields = Object.keys(linkages);

      console.log(`[DEBUG refreshLinkage] 开始刷新所有联动`);
      const { states, updatedFormData } = await evaluateLinkagesByLayers({
        fields: allFields,
        linkages,
        formData,
        linkageFunctions,
        asyncSequenceManager,
        dependencyGraph,
        cache,
        skipSequenceCheck: true,
        _caller: 'refreshLinkage',
      });
      console.log(`[DEBUG refreshLinkage] 计算完成`);

      // 使用公共函数应用联动结果
      await applyLinkageResults({
        fields: allFields,
        states,
        updatedFormData,
        preMarkFields: false, // refreshLinkage 不需要预先标记
      });

      console.log(`[DEBUG refreshLinkage] 刷新完成`);
    } catch (error) {
      console.error('[useLinkageManager] Error in refreshLinkage:', error);
    } finally {
      // 清除刷新标志
      taskQueue.setRefreshing(false);
    }
  }, [
    linkages,
    linkageFunctions,
    dependencyGraph,
    getValues,
    taskQueue,
    asyncSequenceManager,
    cache,
    applyLinkageResults,
  ]);

  /**
   * 在不触发联动的情况下设置表单值
   * 用于外部直接赋值时避免触发联动计算
   */
  const setValueWithoutLinkage = useCallback((callback: () => void) => {
    skipLinkageRef.current = true;
    try {
      callback();
    } finally {
      // 延迟清除标志，确保 watch 已经被跳过
      setTimeout(() => {
        skipLinkageRef.current = false;
      }, 0);
    }
  }, []);

  return { linkageStates, refreshLinkage, setValueWithoutLinkage };
}

/**
 * 按拓扑层级并行计算联动
 *
 * 核心保证：
 * 1. 同一层级的字段之间没有依赖关系，可以安全并行计算
 * 2. 层级之间串行执行，确保依赖顺序正确
 * 3. 每层计算完成后更新 formData，供下一层使用
 *
 * @param params - 计算参数
 * @returns 所有字段的联动结果
 */
let _evaluateLinkagesByLayersCallCount = 0;

async function evaluateLinkagesByLayers({
  fields,
  linkages,
  formData,
  linkageFunctions,
  asyncSequenceManager,
  dependencyGraph,
  cache,
  skipSequenceCheck = false,
  _caller = 'unknown',
}: {
  fields: string[];
  linkages: Record<string, LinkageConfig[]>; // v3.1: 支持多联动类型
  formData: Record<string, any>;
  linkageFunctions: Record<string, LinkageFunction>;
  asyncSequenceManager: AsyncSequenceManager;
  dependencyGraph: DependencyGraph;
  cache?: LinkageResultCache;
  skipSequenceCheck?: boolean;
  _caller?: string;
}): Promise<{
  states: Record<string, LinkageResult>;
  updatedFormData: Record<string, any>;
}> {
  const callId = ++_evaluateLinkagesByLayersCallCount;
  console.log(
    `[DEBUG evaluateLinkagesByLayers #${callId}] 调用来源: ${_caller}, fields=${JSON.stringify(fields)}, skipSequenceCheck=${skipSequenceCheck}`
  );
  console.trace(`[DEBUG evaluateLinkagesByLayers #${callId}] 调用堆栈`);

  const states: Record<string, LinkageResult> = {};
  const updatedFormData = { ...formData };

  // 获取拓扑层级
  const layers = dependencyGraph.getTopologicalLayers(fields);

  // 按层级串行执行，层内并行计算
  // v3.1 更新：支持多联动类型，并行计算并合并结果
  for (const layer of layers) {
    // 并行计算当前层的所有字段
    const layerResults = await Promise.allSettled(
      layer.map(async fieldName => {
        const linkageArray = linkages[fieldName];

        if (!linkageArray || linkageArray.length === 0) return { fieldName, result: null };

        try {
          // 并行计算该字段的所有联动配置
          const linkageResults = await Promise.allSettled(
            linkageArray.map(linkage =>
              evaluateLinkage({
                linkage,
                formData: updatedFormData,
                linkageFunctions,
                fieldPath: fieldName,
                asyncSequenceManager,
                cache,
                skipSequenceCheck,
              })
            )
          );

          // 合并多个联动结果
          // v3.1: 支持多联动配置，使用正确的合并策略
          const mergedResult: LinkageResult = {};

          linkageResults.forEach((settledResult, index) => {
            if (settledResult.status === 'fulfilled') {
              const linkageResult = settledResult.value;
              const linkageType = linkageArray[index].type;

              // 根据联动类型使用不同的合并策略
              if (linkageType === 'visibility') {
                // visibility: 使用 AND 逻辑（所有联动都为 true 才显示）
                if (linkageResult.visible !== undefined) {
                  mergedResult.visible =
                    mergedResult.visible === undefined
                      ? linkageResult.visible
                      : mergedResult.visible && linkageResult.visible;
                }
              } else if (linkageType === 'disabled') {
                // disabled: 使用 OR 逻辑（任何一个联动禁用就禁用）
                if (linkageResult.disabled !== undefined) {
                  mergedResult.disabled =
                    mergedResult.disabled === undefined
                      ? linkageResult.disabled
                      : mergedResult.disabled || linkageResult.disabled;
                }
              } else if (linkageType === 'readonly') {
                // readonly: 使用 OR 逻辑（任何一个联动只读就只读）
                if (linkageResult.readonly !== undefined) {
                  mergedResult.readonly =
                    mergedResult.readonly === undefined
                      ? linkageResult.readonly
                      : mergedResult.readonly || linkageResult.readonly;
                }
              } else if (linkageType === 'value') {
                // value: 后者覆盖前者（按配置顺序）
                if (linkageResult.value !== undefined) {
                  mergedResult.value = linkageResult.value;
                }
              } else if (linkageType === 'options') {
                // options: 后者覆盖前者（按配置顺序）
                if (linkageResult.options !== undefined) {
                  mergedResult.options = linkageResult.options;
                }
              } else if (linkageType === 'schema') {
                // schema: 深度合并（后者覆盖前者的属性）
                if (linkageResult.schema !== undefined) {
                  mergedResult.schema = mergedResult.schema
                    ? { ...mergedResult.schema, ...linkageResult.schema }
                    : linkageResult.schema;
                }
              }
            } else if (settledResult.status === 'rejected') {
              // 记录联动函数执行失败的错误
              console.error(
                '[evaluateLinkagesByLayers] 联动函数执行失败:',
                fieldName,
                settledResult.reason
              );
            }
          });

          return { fieldName, result: mergedResult };
        } catch (error) {
          // istanbul ignore next -- Promise.allSettled 捕获所有错误为 rejected 状态，此 catch 块作为防御性代码保留
          // 如果是过期的异步结果，返回 null
          if (error instanceof StaleResultError) {
            return { fieldName, result: null };
          }
          // istanbul ignore next
          console.error('[evaluateLinkagesByLayers] 联动计算失败:', fieldName, error);
          // istanbul ignore next
          return { fieldName, result: null };
        }
      })
    );

    // 收集当前层的计算结果并更新 formData
    layerResults.forEach(settledResult => {
      if (settledResult.status === 'fulfilled') {
        const { fieldName, result } = settledResult.value;

        // 只有当结果不为 null 时才更新状态
        // null 表示异步结果过期，保留之前的状态
        if (result) {
          states[fieldName] = result;

          // 如果是值联动，更新 formData 以供后续层使用
          if (result.value !== undefined) {
            updatedFormData[fieldName] = result.value;
          }
        }
      }
    });
  }

  return { states, updatedFormData };
}

/**
 * 求值单个联动配置（支持异步函数）
 */
async function evaluateLinkage({
  linkage,
  formData,
  linkageFunctions,
  fieldPath,
  asyncSequenceManager,
  cache,
  skipSequenceCheck = false,
}: {
  linkage: LinkageConfig;
  formData: Record<string, any>;
  linkageFunctions: Record<string, LinkageFunction>;
  fieldPath: string;
  asyncSequenceManager: AsyncSequenceManager;
  cache?: LinkageResultCache;
  skipSequenceCheck?: boolean;
}): Promise<LinkageResult> {
  // ✅ 缓存优化：检查是否启用缓存（默认禁用）
  const isCacheEnabled = linkage.enableCache === true;

  // ✅ 缓存优化：生成缓存键（如果启用缓存）
  const cacheKey =
    cache && isCacheEnabled ? generateCacheKey(fieldPath, linkage.dependencies, formData) : null;

  // ✅ 缓存优化：尝试从缓存获取结果
  if (cacheKey && cache) {
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  const result: LinkageResult = {};

  // 构建联动函数上下文
  const { arrayPath, arrayIndex } = extractArrayContext(fieldPath);
  const context: LinkageFunctionContext = {
    fieldPath,
    arrayPath,
    arrayIndex,
  };

  // 如果没有 when 条件，默认使用 fulfill
  const shouldFulfill = linkage.when
    ? await evaluateCondition(linkage.when, formData, linkageFunctions, context)
    : true;

  const effect = shouldFulfill ? linkage.fulfill : linkage.otherwise;

  if (!effect) {
    return result;
  }

  // 1. 应用状态变更
  if (effect.state) {
    Object.assign(result, effect.state);
  }

  // 2. 应用函数计算
  if (effect.function) {
    const fn = linkageFunctions[effect.function];
    if (fn) {
      // 使用 fieldPath:type 作为序列号键。
      // 同一字段的不同联动类型（options、value、schema 等）在 evaluateLinkagesByLayers 中
      // 并行执行（Promise.allSettled），若共享同一个 fieldPath 键，后一个 next() 会使
      // 前一个序列号失效，导致 options 等类型永远抛出 StaleResultError。
      // 分开追踪后，每种类型独立判断是否被更新的计算所取代，互不干扰。
      const sequenceKey = `${fieldPath}:${linkage.type}`;
      const sequence = asyncSequenceManager.next(sequenceKey);

      // 使用 await 支持异步函数，传递 context
      const fnResult = await fn(formData, context);

      // 检查序列号是否仍然是最新的（防止竞态条件）
      // 注意：初始化阶段跳过序列号检查，因为不存在竞态条件
      if (!skipSequenceCheck) {
        const isLatest = asyncSequenceManager.isLatest(sequenceKey, sequence);
        /* istanbul ignore if -- 竞态条件边缘情况，任务队列串行处理机制使得此分支难以在测试中稳定触发 */
        if (!isLatest) {
          // 抛出过期错误，让调用方决定如何处理
          throw new StaleResultError(sequenceKey, sequence);
        }
      }

      // 根据 linkage.type 决定将结果赋值给哪个字段
      switch (linkage.type) {
        case 'value':
          result.value = fnResult;
          break;
        case 'options':
          result.options = fnResult;
          break;
        case 'schema':
          result.schema = fnResult;
          break;
        case 'visibility':
          result.visible = Boolean(fnResult);
          break;
        case 'disabled':
          result.disabled = Boolean(fnResult);
          break;
        case 'readonly':
          result.readonly = Boolean(fnResult);
          break;
      }
    } else {
      // if (process.env.NODE_ENV !== 'production') {
      //   console.warn('[evaluateLinkage] 联动函数未找到:', {
      //     fieldPath,
      //     functionName: effect.function,
      //     availableFunctions: Object.keys(linkageFunctions),
      //   });
      // }
    }
  }

  // 3. 应用直接指定的值（优先级低于函数）
  if (effect.value !== undefined && !effect.function) {
    result.value = effect.value;
  }

  // 4. 应用直接指定的选项（优先级低于函数）
  if (effect.options !== undefined && !effect.function) {
    result.options = effect.options;
  }

  // ✅ 缓存优化：将计算结果存入缓存
  if (cacheKey && cache) {
    cache.set(cacheKey, result);
  }

  return result;
}

/**
 * 求值条件（支持表达式对象或函数名，支持异步函数）
 */
async function evaluateCondition(
  when: ConditionExpression | string,
  formData: Record<string, any>,
  linkageFunctions: Record<string, LinkageFunction>,
  context: LinkageFunctionContext
): Promise<boolean> {
  // 如果是字符串，尝试作为函数名调用
  if (typeof when === 'string') {
    const fn = linkageFunctions[when];
    if (fn) {
      // 使用 await 支持异步函数，传递 context
      const result = await fn(formData, context);
      return Boolean(result);
    }
    console.warn(`Linkage function "${when}" not found`);
    return false;
  }

  // 否则作为条件表达式求值
  return ConditionEvaluator.evaluate(when, formData);
}
