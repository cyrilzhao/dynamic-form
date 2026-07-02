import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { LinkageConfig, LinkageFunction } from '../types/linkage';
import type { ExtendedJSONSchema } from '../types/schema';
import { useLinkageManager as useBaseLinkageManager } from './useLinkageManager';
import {
  isArrayElementPath,
  resolveArrayElementLinkage,
  findArrayInPath,
} from '../utils/arrayLinkageHelper';
import { DependencyGraph } from '../utils/dependencyGraph';
import { PathResolver } from '../utils/pathResolver';

interface ArrayLinkageManagerOptions {
  form: UseFormReturn<any>;
  baseLinkages: Record<string, LinkageConfig[]>; // v3.1: 支持多联动类型
  linkageFunctions?: Record<string, LinkageFunction>;
  schema?: ExtendedJSONSchema; // 用于完整的路径解析
  /** 检测到循环依赖时的回调 */
  onCycleDetected?: (cycle: string[]) => void;
  /** 是否在检测到循环依赖时抛出错误（默认 false） */
  throwOnCycle?: boolean;
}

/**
 * 数组联动管理器 Hook
 *
 * 扩展基础联动管理器，支持数组元素内部的相对路径联动和 JSON Pointer 路径解析。
 *
 * 分层职责说明：
 * - 数组字段以外（根字段、普通嵌套对象字段）的联动由根级 DynamicForm 统一管理
 * - 数组元素内部字段的联动由各元素对应的独立 DynamicForm 通过本 Hook 管理
 * - baseLinkages 中已通过 parentLinkages 过滤掉了根级负责的联动，不会重复计算
 */
export function useArrayLinkageManager({
  form,
  baseLinkages,
  linkageFunctions = {},
  schema,
  onCycleDetected,
  throwOnCycle = false,
}: ArrayLinkageManagerOptions) {
  const { watch, getValues } = form;

  // 动态联动配置（包含运行时生成的数组元素联动）
  // v3.1: 支持多联动类型，值为数组格式
  const [dynamicLinkages, setDynamicLinkages] = useState<Record<string, LinkageConfig[]>>({});

  // 强制刷新计数器，用于触发联动重新初始化
  const [refreshCounter, setRefreshCounter] = useState(0);

  /**
   * 根据当前表单数据生成动态联动配置
   * 这个函数会被 watch 回调和 refresh 函数调用
   *
   * v3.1 更新：支持多联动类型，处理数组格式的联动配置
   */
  const generateDynamicLinkages = useCallback((): Record<string, LinkageConfig[]> => {
    if (!schema || Object.keys(baseLinkages).length === 0) {
      return {};
    }

    const formData = getValues();
    const newDynamicLinkages: Record<string, LinkageConfig[]> = {};

    // 遍历基础联动配置，找出数组相关的联动
    Object.entries(baseLinkages).forEach(([fieldPath, linkageArray]) => {
      // 如果路径已经包含数字索引（已实例化的联动），需要解析内部的 JSON Pointer 路径
      if (isArrayElementPath(fieldPath)) {
        const resolvedLinkages = linkageArray.map(linkage =>
          resolveArrayElementLinkage(linkage, fieldPath)
        );
        newDynamicLinkages[fieldPath] = resolvedLinkages;
        return;
      }

      // 使用 schema 查找路径中的数组字段
      const arrayInfo = findArrayInPath(fieldPath, schema);

      if (!arrayInfo) {
        // 非数组字段已经在 baseLinkages 中，dynamicLinkages 无需重复存储。
        // 若将其加入 dynamicLinkages，会导致 allLinkages 在内容不变的情况下产生新引用，
        // 触发 useLinkageManager 的 init useEffect 重复执行，形成死循环。
        return;
      }

      const { arrayPath, fieldPathInArray } = arrayInfo;

      // 从 formData 中获取数组值
      const arrayValue = formData[arrayPath];

      if (!Array.isArray(arrayValue)) {
        return;
      }

      // 为每个数组元素生成联动配置
      arrayValue.forEach((_, index) => {
        const elementFieldPath = `${arrayPath}.${index}.${fieldPathInArray}`;
        newDynamicLinkages[elementFieldPath] = linkageArray.map(linkage =>
          resolveArrayElementLinkage(linkage, elementFieldPath)
        );
      });
    });

    return newDynamicLinkages;
  }, [baseLinkages, schema, getValues]);

  // 合并基础联动和动态联动，并进行循环依赖检测
  // v3.1 更新：支持数组格式的联动配置
  // ✅ 优化：使用 useRef 做引用稳定化，避免内容未变时产生新对象触发下游重算。
  // 背景：baseLinkages 会因 parentLinkages 变化而产生新引用（即使内容不变），
  // 若直接将其传入 useLinkageManager，会导致 dependencyGraph → init useEffect 不断重跑，形成死循环。
  const allLinkagesRef = useRef<Record<string, LinkageConfig[]>>({});

  const allLinkages = useMemo(() => {
    // ✅ 优化：dynamicLinkages 为空时直接返回 baseLinkages 引用，避免产生新对象。
    // 背景：React 18 Strict Mode 会在开发模式下重挂载组件，导致 dynamicLinkages 重置为新的 {}
    // 对象（引用变化）。若此时创建新的 merged 对象，会触发 useLinkageManager 的 init useEffect
    // 重新执行，进而调用 setValue 触发 watch，形成死循环。
    const candidate =
      Object.keys(dynamicLinkages).length === 0
        ? baseLinkages
        : { ...baseLinkages, ...dynamicLinkages };

    // ✅ 引用稳定化：若合并后的 key 集合与内容均未变化，返回上一次的引用，避免下游重算。
    // 比对策略：key 集合相同 + 每个 key 对应的 value 引用相同（LinkageConfig[] 数组引用）。
    // value 引用比对足够，因为 baseLinkages 和 dynamicLinkages 内部的数组只在真正变化时才产生新引用。
    const prev = allLinkagesRef.current;
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(candidate);
    const isSame =
      prevKeys.length === nextKeys.length &&
      nextKeys.every(k => k in prev && prev[k] === candidate[k]);

    if (isSame) {
      return prev;
    }

    // 内容有变化，构建临时依赖图进行循环依赖检测
    const tempGraph = new DependencyGraph();
    Object.entries(candidate).forEach(([fieldName, linkageArray]) => {
      // 遍历数组中的每个联动配置
      linkageArray.forEach(linkage => {
        linkage.dependencies.forEach(dep => {
          const normalizedDep = PathResolver.toFieldPath(dep);
          tempGraph.addDependency(fieldName, normalizedDep);
        });
      });
    });

    // 检测循环依赖
    const validation = tempGraph.validate();
    if (!validation.isValid && validation.cycle) {
      console.error('[useArrayLinkageManager] 检测到循环依赖:', validation.cycle.join(' -> '));

      if (onCycleDetected) {
        onCycleDetected(validation.cycle);
      }

      if (throwOnCycle) {
        throw new Error(`循环依赖: ${validation.cycle.join(' -> ')}`);
      }
    }

    allLinkagesRef.current = candidate;
    return candidate;
  }, [baseLinkages, dynamicLinkages, onCycleDetected, throwOnCycle, refreshCounter]);

  // 使用基础联动管理器
  const { linkageStates, refreshLinkage: baseLinkageRefresh, setValueWithoutLinkage } = useBaseLinkageManager({
    form,
    linkages: allLinkages,
    linkageFunctions,
  });

  // 监听 allLinkages 变化，自动触发联动刷新
  const allLinkagesKeysRef = useRef<string>('');
  const lastRefreshCounterRef = useRef<number>(0);

  useEffect(() => {
    const currentKeys = Object.keys(allLinkages).sort().join(',');
    const prevKeys = allLinkagesKeysRef.current;
    const isKeysChanged = currentKeys !== prevKeys && currentKeys !== '';
    const isRefreshCounterChanged = refreshCounter !== lastRefreshCounterRef.current && refreshCounter > 0;

    // 如果 keys 发生变化或 refreshCounter 变化，触发联动刷新
    if (isKeysChanged || isRefreshCounterChanged) {
      allLinkagesKeysRef.current = currentKeys;
      lastRefreshCounterRef.current = refreshCounter;
      baseLinkageRefresh();
    } else if (prevKeys === '') {
      // 首次初始化，记录状态但不触发刷新
      allLinkagesKeysRef.current = currentKeys;
      lastRefreshCounterRef.current = refreshCounter;
    }
  }, [allLinkages, refreshCounter, baseLinkageRefresh]);

  // 监听表单数据变化，动态注册数组元素的联动
  useEffect(() => {
    // ✅ 如果没有基础联动配置，不需要监听字段变化
    if (Object.keys(baseLinkages).length === 0) {
      return;
    }

    const subscription = watch(() => {
      // ✅ 使用函数式更新 + key 集合比对，保持引用稳定。
      // 背景：watch 在每次表单值变化时都触发，generateDynamicLinkages 每次返回新对象。
      // 若直接 setDynamicLinkages(newObj)，allLinkages → dependencyGraph 均产生新引用，
      // 导致 useLinkageManager 的初始化 useEffect 重复执行，触发 value 联动将字段重置为默认值。
      // key 集合变化（数组增减元素）才是真正需要更新联动配置的时机。
      setDynamicLinkages(prev => {
        const next = generateDynamicLinkages();
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length === nextKeys.length && nextKeys.every(k => k in prev)) {
          return prev;
        }
        return next;
      });
    });

    return () => subscription.unsubscribe();
  }, [watch, baseLinkages, generateDynamicLinkages]);

  /**
   * 刷新联动状态
   * 1. 重新生成动态联动配置（基于当前表单数据和最新的异步数据）
   * 2. 更新 refreshCounter 触发 allLinkages 重新计算
   * 3. 调用基础联动管理器的 refresh 触发联动重新初始化
   */
  const refresh = useCallback(async () => {
    // 步骤1: 重新生成动态联动配置
    const newDynamicLinkages = generateDynamicLinkages();
    setDynamicLinkages(newDynamicLinkages);

    // 步骤2: 更新计数器，触发 allLinkages 重新计算
    setRefreshCounter(prev => prev + 1);

    // 步骤3: 等待状态更新完成
    // allLinkages 的变化会通过 useEffect 自动触发 baseLinkageRefresh
    await new Promise(resolve => setTimeout(resolve, 0));
  }, [generateDynamicLinkages]);

  return { linkageStates, refresh, setValueWithoutLinkage };
}
