import {
  useMemo,
  useEffect,
  useState,
  useRef,
  useCallback,
  useLayoutEffect,
} from "react";
import type { UseFormReturn } from "react-hook-form";
import type {
  LinkageConfig,
  LinkageFunction,
  ConditionExpression,
  LinkageFunctionContext,
} from "../types/linkage";
import type { LinkageResult } from "../types/linkage";
import { ConditionEvaluator } from "../utils/conditionEvaluator";
import { DependencyGraph } from "../utils/dependencyGraph";
import { PathResolver } from "../utils/pathResolver";
import { LinkageTaskQueue } from "../utils/linkageTaskQueue";
import { LinkageResultCache } from "../utils/linkageResultCache";
import { generateCacheKey } from "../utils/generateCacheKey";
import {
  LinkageOperationController,
  type LinkageRunToken,
} from "../utils/linkageOperationController";
import { useHelpers } from "../context/HelpersContext";
import { executeInlineScript } from "../utils/executeInlineScript";

// 用于执行动态脚本
const DynamicFn = globalThis["Function"] as FunctionConstructor; // trusted-dynamic-code
let linkageManagerScopeCounter = 0;

/**
 * 异步结果过期错误
 * 当异步联动函数的结果因为新的计算而过期时抛出
 */
/* istanbul ignore next -- 竞态条件边缘情况，任务队列串行处理机制使得此错误难以在测试中稳定触发 */
class StaleResultError extends Error {
  constructor(fieldPath: string, sequence: number) {
    super(`Stale async result for field: ${fieldPath}, sequence: ${sequence}`);
    this.name = "StaleResultError";
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
function extractArrayContext(fieldPath: string): {
  arrayPath?: string;
  arrayIndex?: number;
} {
  const parts = fieldPath.split(".");
  for (let i = 0; i < parts.length; i++) {
    const index = parseInt(parts[i], 10);
    if (!isNaN(index) && i > 0) {
      return {
        arrayPath: parts.slice(0, i).join("."),
        arrayIndex: index,
      };
    }
  }
  return {};
}

function isSameValue(prev: unknown, next: unknown): boolean {
  if (Object.is(prev, next)) {
    return true;
  }

  if (prev && next && typeof prev === "object" && typeof next === "object") {
    try {
      return JSON.stringify(prev) === JSON.stringify(next);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * 克隆表单快照。
 *
 * React Hook Form 的 watch 回调可能复用并原地修改同一个数据对象。
 * 如果 latestFormDataRef 直接保存这个对象引用，后续字段变化会把“上一份快照”也一起改掉，
 * 导致 previousValue 和 nextValue 总是相同，进而漏掉 contacts.0.type 这类数组内字段变化。
 */
function cloneFormData(data: Record<string, any>): Record<string, any> {
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }

  return JSON.parse(JSON.stringify(data));
}

interface LinkageManagerOptions {
  form: UseFormReturn<any>;
  linkages: Record<string, LinkageConfig[]>; // v3.1: 支持多联动类型
  linkageFunctions?: Record<string, LinkageFunction>;
  linkageContext?: Record<string, any>; // 联动函数的外部上下文数据
  operationController?: LinkageOperationController;
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
  linkageContext = {},
  operationController,
}: LinkageManagerOptions) {
  const { watch, getValues, setValue } = form;

  // 获取 helpers
  const helpers = useHelpers();

  const [ownOperationController] = useState(
    () => new LinkageOperationController(),
  );
  const controller = operationController ?? ownOperationController;
  const [scopeId] = useState(
    () => `linkage-manager-${++linkageManagerScopeCounter}`,
  );

  // 创建异步序列号管理器实例（使用 useRef 保持引用稳定）
  const [asyncSequenceManager] = useState(() => new AsyncSequenceManager());

  // 创建任务队列管理器实例
  const [taskQueue] = useState(() => new LinkageTaskQueue());

  // 创建缓存管理器实例
  const [cache] = useState(() => new LinkageResultCache());

  // 构建依赖图
  // v3.1 更新：支持数组格式的联动配置
  const dependencyGraph = useMemo(() => {
    const graph = new DependencyGraph();

    Object.entries(linkages).forEach(([fieldName, linkageArray]) => {
      // 遍历数组中的每个联动配置
      linkageArray.forEach((linkage) => {
        (linkage.dependencies || []).forEach((dep) => {
          // 标准化路径并添加依赖关系
          const normalizedDep = PathResolver.toFieldPath(dep);
          graph.addDependency(fieldName, normalizedDep);
        });
      });
    });

    // 检测循环依赖
    const cycle = graph.detectCycle();
    if (cycle) {
      console.error("检测到循环依赖:", cycle.join(" -> "));
    }

    return graph;
  }, [linkages]);

  const previousLinkagesRef = useRef(linkages);
  const previousLinkageFunctionsRef = useRef(linkageFunctions);
  // 同步联动配置/函数版本。
  // token 不只保护表单值，也保护“用哪一版规则计算”：
  // linkages 变化意味着依赖图和效果定义变了，linkageFunctions 变化意味着业务计算函数变了，
  // 旧异步结果即使基于相同表单值，也不能再提交。
  const syncOperationVersions = useCallback(() => {
    if (previousLinkagesRef.current !== linkages) {
      controller.markLinkagesChanged(scopeId);
      previousLinkagesRef.current = linkages;
    }
    if (previousLinkageFunctionsRef.current !== linkageFunctions) {
      controller.markLinkageFunctionsChanged(scopeId);
      previousLinkageFunctionsRef.current = linkageFunctions;
    }
  }, [linkages, linkageFunctions, controller, scopeId]);

  useLayoutEffect(() => {
    syncOperationVersions();
  }, [syncOperationVersions]);

  // 联动状态缓存（使用 useState 而不是 useMemo，以便在 useEffect 中更新）
  const [linkageStates, setLinkageStates] = useState<
    Record<string, LinkageResult>
  >({});

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
      token,
    }: {
      fields: string[];
      states: Record<string, LinkageResult>;
      updatedFormData: Record<string, any>;
      preMarkFields?: boolean;
      token?: LinkageRunToken;
    }) => {
      if (token && !controller.canCommit(token)) {
        return { committed: false };
      }

      taskQueue.setUpdatingForm(true);

      try {
        // 预先标记字段：processQueue 场景中，setValue 会触发 watch，
        // watch 会再次检查这些字段是否需要联动。预先标记可防止自己触发自己，避免无限级联。
        // refreshLinkage 场景无需预标记，因为它是主动刷新，不存在触发自身的问题。
        if (preMarkFields) {
          fields.forEach((fieldName) => taskQueue.markFieldUpdating(fieldName));
        }

        // 批量更新表单值（先更新值，再更新状态，避免时序问题）
        fields.forEach((fieldName) => {
          const linkageArray = linkages[fieldName];
          const hasValueLinkage = linkageArray?.some(
            (linkage) => linkage.type === "value",
          );
          const nextValue = PathResolver.getNestedValue(
            updatedFormData,
            fieldName,
          );
          // value 联动的目标可能是数组元素路径（如 features.0.enabled）。
          // 这里必须从嵌套快照读取，而不是只读 updatedFormData[fieldName]：
          // 拓扑计算会同时维护嵌套结构，后续联动函数和 RHF setValue 都依赖该标准路径形态。
          if (hasValueLinkage && nextValue !== undefined) {
            const currentValue = getValues(fieldName);
            if (currentValue !== nextValue) {
              if (!preMarkFields) {
                taskQueue.markFieldUpdating(fieldName);
              }
              setValue(fieldName, nextValue, {
                shouldValidate: false,
                shouldDirty: false,
              });
            }
          }

          // 处理 options 联动：当 options 更新后，原有值可能已不在新选项列表中。
          // 若不清理，表单会包含非法值（UI 显示为空但 getValues() 返回旧值），导致提交数据错误。
          // 多选（数组）只移除非法元素并保留合法元素；单选值非法时清空。
          const hasOptionsLinkage = linkageArray?.some(
            (linkage) => linkage.type === "options",
          );
          // options 结果按配置顺序以后者覆盖，因此失效值策略也取最后一个 options 联动配置。
          const optionsLinkages = linkageArray?.filter(
            (linkage) => linkage.type === "options",
          );
          const effectiveOptionsLinkage =
            optionsLinkages?.[optionsLinkages.length - 1];
          const invalidValuePolicy =
            effectiveOptionsLinkage?.invalidValuePolicy ?? "clear";
          if (
            hasOptionsLinkage &&
            invalidValuePolicy !== "retain" &&
            states[fieldName]?.options
          ) {
            const newOptions = states[fieldName].options;
            const currentValue = getValues(fieldName);

            // 检查当前值是否在新 options 中
            if (
              currentValue !== undefined &&
              currentValue !== null &&
              currentValue !== ""
            ) {
              const optionValues = newOptions.map((opt: any) => opt.value);

              if (Array.isArray(currentValue)) {
                // 多选只移除非法元素，保留仍然有效的已选值
                const nextValue = currentValue.filter((value) =>
                  optionValues.includes(value),
                );
                if (nextValue.length !== currentValue.length) {
                  if (!preMarkFields) {
                    taskQueue.markFieldUpdating(fieldName);
                  }
                  setValue(fieldName, nextValue, {
                    shouldValidate: false,
                    shouldDirty: false,
                  });
                }
              } else if (!optionValues.includes(currentValue)) {
                const fallbackValue = effectiveOptionsLinkage?.fallbackValue;
                const nextValue =
                  invalidValuePolicy === "fallback" &&
                  fallbackValue !== undefined &&
                  optionValues.includes(fallbackValue)
                    ? fallbackValue
                    : undefined;

                // 单选值不再合法时使用有效 fallback，否则清空
                if (!preMarkFields) {
                  taskQueue.markFieldUpdating(fieldName);
                }
                setValue(fieldName, nextValue, {
                  shouldValidate: false,
                  shouldDirty: false,
                });
              }
            }
          }
        });

        // 更新联动状态（在更新表单值之后，确保值和状态同步）
        if (Object.keys(states).length > 0) {
          setLinkageStates((prev) => {
            const nextStates = { ...prev };

            Object.entries(states).forEach(([fieldName, state]) => {
              const hasOptionsLinkage = linkages[fieldName]?.some(
                (linkage) => linkage.type === "options",
              );

              // options 联动函数返回 undefined 表示尚未就绪；保留上一轮有效 options，
              // 防止加载中空结果覆盖控件选项，同时不触发失效值清理。
              if (hasOptionsLinkage && state.options === undefined) {
                nextStates[fieldName] = {
                  ...prev[fieldName],
                  ...state,
                };
                return;
              }

              nextStates[fieldName] = state;
            });

            return nextStates;
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
        return { committed: true };
      } finally {
        taskQueue.clearUpdatingFields();
        taskQueue.setUpdatingForm(false);
      }
    },
    [linkages, getValues, setValue, taskQueue, setLinkageStates, controller],
  );

  // ✅ 运行时依赖 ref：每次 render 阶段同步更新
  // 目的：processQueue 是 useRef 固定函数，需要通过此 ref 读取最新运行时依赖，
  // 避免闭包陈旧（linkages / dependencyGraph / linkageFunctions / applyLinkageResults
  // 都会随 rerender 变化，直接捕获会导致新增联动不生效、函数更新不触发等问题）。
  // 必须在 applyLinkageResults 定义之后声明，以便类型推断正确。
  // render 阶段直接赋值（不用 useLayoutEffect）：React 允许在 render 中写 ref，
  // 且 render 本身是同步的，赋值在任何 setTimeout 回调之前完成，时序安全。
  const runtimeRef = useRef<{
    linkages: Record<string, LinkageConfig[]>;
    linkageFunctions: Record<string, LinkageFunction>;
    dependencyGraph: DependencyGraph;
    getValues: typeof getValues;
    applyLinkageResults: typeof applyLinkageResults;
    linkageContext: Record<string, any>;
    helpers: Record<string, any>;
  }>({
    linkages,
    linkageFunctions,
    dependencyGraph,
    getValues,
    applyLinkageResults,
    linkageContext,
    helpers,
  });
  runtimeRef.current = {
    linkages,
    linkageFunctions,
    dependencyGraph,
    getValues,
    applyLinkageResults,
    linkageContext,
    helpers,
  };

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
        if (!task) {
          break;
        }

        // 检查任务是否仍然有效（可能已被更新的任务替代）
        /* istanbul ignore if -- 竞态条件边缘情况，难以在测试中稳定触发 */
        if (!taskQueue.isTaskValid(task.fieldName, task.timestamp)) {
          continue;
        }

        let taskToken = task.token;
        if (taskToken && !controller.canCommit(taskToken)) {
          // 任务还没有开始计算时，如果 token 已经过期，不直接丢弃任务。
          // 典型场景是初始化阶段连续 setValue：第一个依赖字段创建了任务，
          // 后续字段写入提升了 formMutationVersion，但后续字段本身未必是依赖源。
          // 此时重新签发 token，表示“用最新快照执行这个尚未消费的必要任务”；
          // 已经开始计算的旧异步结果仍会在 applyLinkageResults 被提交校验拦截。
          taskToken = controller.createRun(scopeId);
        }

        // 使用最新的表单数据（优先使用 latestFormDataRef，解决 setValues 批量更新时的时序问题）
        // ✅ 从 runtimeRef 读取最新运行时依赖，避免闭包陈旧
        const {
          linkages: currentLinkages,
          linkageFunctions: currentLinkageFunctions,
          dependencyGraph: currentDependencyGraph,
          getValues: currentGetValues,
          applyLinkageResults: currentApplyLinkageResults,
          linkageContext: currentLinkageContext,
          helpers: currentHelpers,
        } = runtimeRef.current;

        const formData =
          Object.keys(latestFormDataRef.current).length > 0
            ? cloneFormData(latestFormDataRef.current)
            : cloneFormData(currentGetValues());

        // ✅ 优化：直接使用任务中的 affectedFields，避免重复调用 getAffectedFields
        const affectedFields = task.affectedFields;

        // 使用拓扑层级并行计算受影响的字段
        const { states: newStates, updatedFormData } =
          await evaluateLinkagesByLayers({
            fields: affectedFields,
            linkages: currentLinkages,
            formData,
            linkageFunctions: currentLinkageFunctions,
            linkageContext: currentLinkageContext,
            asyncSequenceManager,
            dependencyGraph: currentDependencyGraph,
            cache,
            helpers: currentHelpers,
            _caller: `processQueue(trigger=${task.fieldName})`,
          });

        // ✅ 使用公共函数应用联动结果
        await currentApplyLinkageResults({
          fields: affectedFields,
          states: newStates,
          updatedFormData,
          preMarkFields: true, // processQueue 需要预先标记，防止级联触发
          token: taskToken,
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
  const latestFormDataRef = useRef<Record<string, any>>(
    cloneFormData(getValues()),
  );
  // 延迟执行 processQueue 的定时器（用于批量更新场景）
  const processQueueTimerRef = useRef<number | null>(null);
  // 跳过联动处理的标志（用于外部直接赋值时不触发联动）
  const skipLinkageRef = useRef(false);

  // 统一的字段变化监听和联动处理（使用任务队列）
  useEffect(() => {
    // ✅ 如果没有联动配置，不需要监听字段变化
    if (Object.keys(linkages).length === 0) {
      return;
    }

    const subscription = watch((formData, { name }) => {
      if (!name) {
        return;
      }

      // 如果设置了跳过联动标志，直接返回
      if (skipLinkageRef.current) {
        return;
      }

      const nextFormData = formData as Record<string, any>;
      const previousValue = PathResolver.getNestedValue(
        latestFormDataRef.current,
        name,
      );
      const nextValue = PathResolver.getNestedValue(nextFormData, name);

      // React Hook Form 在字段注册/校验时也可能触发 watch。
      // 只有字段值实际变化时才认为表单版本变化，避免初始化 refresh 被注册事件误判为过期。
      if (isSameValue(previousValue, nextValue)) {
        // 即使值没有变化，也要刷新快照引用。
        // RHF 注册/校验可能触发无值变化 watch；保存克隆后的最新快照可以避免后续比较基于过旧数据。
        latestFormDataRef.current = cloneFormData(nextFormData);
        return;
      }

      // 保存最新的 formData（解决 setValues 批量更新时的时序问题）。
      // 必须保存克隆值，不能保存 RHF 传入对象引用，否则下一次原地修改会污染 previousValue。
      latestFormDataRef.current = cloneFormData(nextFormData);
      controller.markFormMutation();

      if (controller.isBatching()) {
        // setValues 会递归写入多个字段，期间 watch 看到的是中间态。
        // 批处理中只记录“需要刷新联动”，等批量写入结束后统一基于最终快照刷新一次。
        controller.markPendingLinkage();
        return;
      }

      // ✅ 精确监听优化：检查该字段及其所有祖先路径是否被任何联动依赖
      // 支持跨数组边界的依赖：当数组元素内部字段（如 items.0.price）变化时，
      // 也会向上检查数组字段本身（items）是否被外部字段依赖（如 totalPrice 依赖 items）
      let affectedFields = dependencyGraph.getAffectedFields(name);

      if (affectedFields.length === 0) {
        const parts = name.split(".");
        for (let i = parts.length - 1; i > 0; i--) {
          const parentPath = parts.slice(0, i).join(".");
          const parentAffectedFields =
            dependencyGraph.getAffectedFields(parentPath);
          if (parentAffectedFields.length > 0) {
            affectedFields = parentAffectedFields;
            break;
          }
        }
      }

      if (affectedFields.length === 0) {
        return;
      }

      // ✅ 级联传播：字段正在被联动的 setValue 更新时，仍允许触发下游依赖（非自身）的联动。
      // 仅当所有下游字段也都在被更新时（循环依赖），才完全跳过，防止死循环。
      if (taskQueue.isFieldUpdating(name)) {
        const hasCascadeTargets = affectedFields.some(
          (f) => !taskQueue.isFieldUpdating(f),
        );
        if (!hasCascadeTargets) {
          return;
        }
      }

      // 将任务加入队列
      syncOperationVersions();
      const token = controller.createRun(scopeId);
      taskQueue.enqueue(name, affectedFields, token);

      // 如果队列正在处理中，不重复触发（队列会自动继续处理）
      if (taskQueue.getProcessing()) {
        return;
      }

      // 延迟触发队列处理，等待批量 setValue 完成
      // 使用 setTimeout(0) 将执行延迟到下一个事件循环
      if (processQueueTimerRef.current !== null) {
        clearTimeout(processQueueTimerRef.current);
      }
      processQueueTimerRef.current = window.setTimeout(() => {
        processQueueTimerRef.current = null;
        processQueue();
      }, 0);
    });

    return () => {
      subscription.unsubscribe();
      // 清除延迟执行的定时器
      if (processQueueTimerRef.current !== null) {
        clearTimeout(processQueueTimerRef.current);
        processQueueTimerRef.current = null;
      }
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
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 等待其他 refreshLinkage 完成（避免多个 refresh 并发）
      while (taskQueue.getRefreshing()) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // 设置刷新标志，阻止 processQueue 执行
      taskQueue.setRefreshing(true);

      // 先让已排队的 watch 回调完成，再创建本轮 token。
      // 否则初始化 setValue 产生的延迟 watch 可能在 token 创建后才 enqueue，
      // 用旧事件创建的新 run 误杀当前 refresh。
      // 这一步只等待当前事件循环中已存在的 watch，不会放宽提交保护：
      // 如果等待之后又发生新的真实表单变化，formMutationVersion 仍会让当前 token 失效。
      await new Promise((resolve) => setTimeout(resolve, 0));

      syncOperationVersions();
      const token = controller.createRun(scopeId);

      const {
        linkages: currentLinkages,
        linkageFunctions: currentLinkageFunctions,
        dependencyGraph: currentDependencyGraph,
        getValues: currentGetValues,
        applyLinkageResults: currentApplyLinkageResults,
        linkageContext: currentLinkageContext,
        helpers: currentHelpers,
      } = runtimeRef.current;

      const formData = cloneFormData(currentGetValues());
      latestFormDataRef.current = cloneFormData(formData);
      if (!controller.canCommit(token)) {
        return;
      }

      const allFields = Object.keys(currentLinkages);
      const { states, updatedFormData } = await evaluateLinkagesByLayers({
        fields: allFields,
        linkages: currentLinkages,
        formData,
        linkageFunctions: currentLinkageFunctions,
        linkageContext: currentLinkageContext,
        asyncSequenceManager,
        dependencyGraph: currentDependencyGraph,
        cache,
        skipSequenceCheck: true,
        helpers: currentHelpers,
        _caller: "refreshLinkage",
      });
      // 使用公共函数应用联动结果
      await currentApplyLinkageResults({
        fields: allFields,
        states,
        updatedFormData,
        preMarkFields: false, // refreshLinkage 不需要预先标记
        token,
      });
    } catch (error) {
      console.error("[useLinkageManager] Error in refreshLinkage:", error);
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
    controller,
    scopeId,
    syncOperationVersions,
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

  // 监听 linkageContext 变化，自动刷新联动
  // 使用 ref 实现 shallow compare，避免不必要的刷新
  const prevLinkageContextRef = useRef<Record<string, any>>(linkageContext);

  useEffect(() => {
    // 如果没有联动配置，不需要监听
    if (Object.keys(linkages).length === 0) {
      return;
    }

    const prev = prevLinkageContextRef.current;
    const next = linkageContext;

    // Shallow compare：比较 key 集合和每个 key 的引用
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);

    const hasChanged =
      prevKeys.length !== nextKeys.length ||
      nextKeys.some((key) => prev[key] !== next[key]);

    if (hasChanged) {
      prevLinkageContextRef.current = next;
      // linkageContext 变化时，触发联动刷新
      void refreshLinkage();
    }
  }, [linkageContext, linkages, refreshLinkage]);

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
  linkageContext = {},
  asyncSequenceManager,
  dependencyGraph,
  cache,
  skipSequenceCheck = false,
  helpers,
  _caller = "unknown",
}: {
  fields: string[];
  linkages: Record<string, LinkageConfig[]>; // v3.1: 支持多联动类型
  formData: Record<string, any>;
  linkageFunctions: Record<string, LinkageFunction>;
  linkageContext?: Record<string, any>;
  asyncSequenceManager: AsyncSequenceManager;
  dependencyGraph: DependencyGraph;
  cache?: LinkageResultCache;
  skipSequenceCheck?: boolean;
  helpers: Record<string, any>;
  _caller?: string;
}): Promise<{
  states: Record<string, LinkageResult>;
  updatedFormData: Record<string, any>;
}> {
  const callId = ++_evaluateLinkagesByLayersCallCount;
  void callId; // 仅用于调试时标识调用批次，生产环境不输出

  const states: Record<string, LinkageResult> = {};
  const updatedFormData = { ...formData };

  // 获取拓扑层级
  const layers = dependencyGraph.getTopologicalLayers(fields);

  // 按层级串行执行，层内并行计算
  // v3.1 更新：支持多联动类型，并行计算并合并结果
  for (const layer of layers) {
    // 并行计算当前层的所有字段
    const layerResults = await Promise.allSettled(
      layer.map(async (fieldName) => {
        const linkageArray = linkages[fieldName];

        if (!linkageArray || linkageArray.length === 0) {
          return { fieldName, result: null };
        }

        try {
          // 并行计算该字段的所有联动配置
          const linkageResults = await Promise.allSettled(
            linkageArray.map((linkage) =>
              evaluateLinkage({
                linkage,
                formData: updatedFormData,
                linkageFunctions,
                linkageContext,
                fieldPath: fieldName,
                asyncSequenceManager,
                cache,
                skipSequenceCheck,
                helpers,
              }),
            ),
          );

          // 合并多个联动结果
          // v3.1: 支持多联动配置，使用正确的合并策略
          const mergedResult: LinkageResult = {};

          linkageResults.forEach((settledResult, index) => {
            if (settledResult.status === "fulfilled") {
              const linkageResult = settledResult.value;
              const linkageType = linkageArray[index].type;

              // 根据联动类型使用不同的合并策略
              if (linkageType === "visibility") {
                // visibility: 使用 AND 逻辑（所有联动都为 true 才显示）
                if (linkageResult.visible !== undefined) {
                  mergedResult.visible =
                    mergedResult.visible === undefined
                      ? linkageResult.visible
                      : mergedResult.visible && linkageResult.visible;
                }
              } else if (linkageType === "disabled") {
                // disabled: 使用 OR 逻辑（任何一个联动禁用就禁用）
                if (linkageResult.disabled !== undefined) {
                  mergedResult.disabled =
                    mergedResult.disabled === undefined
                      ? linkageResult.disabled
                      : mergedResult.disabled || linkageResult.disabled;
                }
              } else if (linkageType === "readonly") {
                // readonly: 使用 OR 逻辑（任何一个联动只读就只读）
                if (linkageResult.readonly !== undefined) {
                  mergedResult.readonly =
                    mergedResult.readonly === undefined
                      ? linkageResult.readonly
                      : mergedResult.readonly || linkageResult.readonly;
                }
              } else if (linkageType === "value") {
                // value: 后者覆盖前者（按配置顺序）
                if (linkageResult.value !== undefined) {
                  mergedResult.value = linkageResult.value;
                }
              } else if (linkageType === "options") {
                // options: 后者覆盖前者（按配置顺序）
                if (linkageResult.options !== undefined) {
                  mergedResult.options = linkageResult.options;
                }
              } else if (linkageType === "schema") {
                // schema: 浅层合并（后者覆盖前者的属性）
                if (linkageResult.schema !== undefined) {
                  mergedResult.schema = mergedResult.schema
                    ? { ...mergedResult.schema, ...linkageResult.schema }
                    : linkageResult.schema;
                }
              }
            } else if (settledResult.status === "rejected") {
              // 记录联动函数执行失败的错误
              console.error(
                "[evaluateLinkagesByLayers] 联动函数执行失败:",
                fieldName,
                settledResult.reason,
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
          console.error(
            "[evaluateLinkagesByLayers] 联动计算失败:",
            fieldName,
            error,
          );
          // istanbul ignore next
          return { fieldName, result: null };
        }
      }),
    );

    // 收集当前层的计算结果并更新 formData
    layerResults.forEach((settledResult) => {
      if (settledResult.status === "fulfilled") {
        const { fieldName, result } = settledResult.value;

        // 只有当结果不为 null 时才更新状态
        // null 表示异步结果过期，保留之前的状态
        if (result) {
          states[fieldName] = result;

          // 如果是值联动，更新 formData 以供后续层使用。
          // 同时写扁平 key 和嵌套结构：
          // - 扁平 key 兼容历史逻辑和直接字段查找；
          // - 嵌套结构保证 contacts.0.showCompany 这类中间值能被后续条件和函数按标准路径读到。
          if (result.value !== undefined) {
            updatedFormData[fieldName] = result.value;
            PathResolver.setNestedValue(
              updatedFormData,
              fieldName,
              result.value,
            );
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
  linkageContext = {},
  fieldPath,
  asyncSequenceManager,
  cache,
  skipSequenceCheck = false,
  helpers,
}: {
  linkage: LinkageConfig;
  formData: Record<string, any>;
  linkageFunctions: Record<string, LinkageFunction>;
  linkageContext?: Record<string, any>;
  fieldPath: string;
  asyncSequenceManager: AsyncSequenceManager;
  cache?: LinkageResultCache;
  skipSequenceCheck?: boolean;
  helpers: Record<string, any>;
}): Promise<LinkageResult> {
  // ✅ 缓存优化：检查是否启用缓存（默认禁用）
  const isCacheEnabled = linkage.enableCache === true;

  // ✅ 缓存优化：生成缓存键（如果启用缓存）
  const cacheKey =
    cache && isCacheEnabled
      ? generateCacheKey(fieldPath, linkage.dependencies || [], formData)
      : null;

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
    externalData: linkageContext,
  };

  // 如果没有 when 条件，默认使用 fulfill
  const shouldFulfill = linkage.when
    ? await evaluateCondition(
        linkage.when,
        formData,
        linkageFunctions,
        context,
        helpers,
      )
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
    let fn: LinkageFunction | undefined;

    // 判断是函数名还是内联脚本
    if (typeof effect.function === "string") {
      // 函数名：从 linkageFunctions 中查找
      fn = linkageFunctions[effect.function];
      if (!fn) {
        // if (process.env.NODE_ENV !== 'production') {
        //   console.warn('[evaluateLinkage] 联动函数未找到:', {
        //     fieldPath,
        //     functionName: effect.function,
        //     availableFunctions: Object.keys(linkageFunctions),
        //   });
        // }
      }
    } else if (
      typeof effect.function !== "string" &&
      effect.function.type === "script" &&
      effect.function.code.trim()
    ) {
      // 内联脚本：使用 executeInlineScript 执行，支持 helpers
      const scriptCode = effect.function.code; // 类型已收窄
      try {
        fn = (params: { formData: any; context: any; helpers: any }) =>
          executeInlineScript({
            code: scriptCode,
            params: { formData: params.formData, context: params.context },
            helpers: params.helpers,
          });
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[evaluateLinkage] 脚本执行错误:", {
            fieldPath,
            error: (e as Error).message,
            code: scriptCode,
          });
        }
      }
    }

    if (fn) {
      // 使用 fieldPath:type 作为序列号键。
      // 同一字段的不同联动类型（options、value、schema 等）在 evaluateLinkagesByLayers 中
      // 并行执行（Promise.allSettled），若共享同一个 fieldPath 键，后一个 next() 会使
      // 前一个序列号失效，导致 options 等类型永远抛出 StaleResultError。
      // 分开追踪后，每种类型独立判断是否被更新的计算所取代，互不干扰。
      const sequenceKey = `${fieldPath}:${linkage.type}`;
      const sequence = asyncSequenceManager.next(sequenceKey);

      // 使用 await 支持异步函数，传递对象参数（包含 helpers）
      const fnResult = await fn({ formData, context, helpers });

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
        case "value":
          result.value = fnResult;
          break;
        case "options":
          result.options = fnResult;
          break;
        case "schema":
          result.schema = fnResult;
          break;
        case "visibility":
          result.visible = Boolean(fnResult);
          break;
        case "disabled":
          result.disabled = Boolean(fnResult);
          break;
        case "readonly":
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
  context: LinkageFunctionContext,
  helpers: Record<string, any>,
): Promise<boolean> {
  // 如果是字符串，尝试作为函数名调用
  if (typeof when === "string") {
    const fn = linkageFunctions[when];
    if (fn) {
      // 使用 await 支持异步函数，传递对象参数（包含 helpers）
      const result = await fn({ formData, context, helpers });
      return Boolean(result);
    }
    console.warn(`Linkage function "${when}" not found`);
    return false;
  }

  // 否则作为条件表达式求值
  return ConditionEvaluator.evaluate(when, formData);
}
