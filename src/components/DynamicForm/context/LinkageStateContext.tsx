import React, { createContext, useContext } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { LinkageResult, LinkageFunction } from '../types/linkage';
import type { ExtendedJSONSchema } from '../types/schema';

/**
 * 联动状态 Context 值类型
 */
export interface LinkageStateContextValue {
  /** 父级联动状态（只包含父级范围内的字段） */
  parentLinkageStates: Record<string, LinkageResult>;
  /** 共享的表单实例 */
  form: UseFormReturn<any>;
  /** 完整的 schema（用于路径解析） */
  rootSchema: ExtendedJSONSchema;
  /** 当前路径前缀（用于路径转换） */
  pathPrefix: string;
  /** 联动函数（用于嵌套表单执行联动） */
  linkageFunctions: Record<string, LinkageFunction>;
}

/**
 * 联动状态 Context
 * 用于在父子 DynamicForm 之间传递联动计算能力
 */
const LinkageStateContext = createContext<LinkageStateContextValue | null>(null);

/**
 * LinkageStateContext Provider 组件
 */
export const LinkageStateProvider: React.FC<{
  value: LinkageStateContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return <LinkageStateContext.Provider value={value}>{children}</LinkageStateContext.Provider>;
};

/**
 * 使用 LinkageStateContext 的 Hook
 * @returns LinkageStateContext 值，如果不在 Provider 内部则返回 null
 */
export function useLinkageStateContext(): LinkageStateContextValue | null {
  return useContext(LinkageStateContext);
}

/**
 * 使用 LinkageStateContext 的 Hook（必须在 Provider 内部）
 * @throws 如果不在 Provider 内部则抛出错误
 */
export function useLinkageStateContextRequired(): LinkageStateContextValue {
  const context = useContext(LinkageStateContext);
  if (!context) {
    throw new Error('useLinkageStateContextRequired must be used within LinkageStateProvider');
  }
  return context;
}
