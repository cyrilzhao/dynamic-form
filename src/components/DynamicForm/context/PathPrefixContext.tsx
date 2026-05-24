import React, { createContext, useContext } from 'react';

/**
 * 路径前缀 Context
 * 用于在嵌套表单中传递完整的字段路径前缀
 */
const PathPrefixContext = createContext<string>('');

export const PathPrefixProvider: React.FC<{
  prefix: string;
  children: React.ReactNode;
}> = ({ prefix, children }) => {
  return <PathPrefixContext.Provider value={prefix}>{children}</PathPrefixContext.Provider>;
};

/**
 * 获取当前的路径前缀
 */
export const usePathPrefix = () => {
  return useContext(PathPrefixContext);
};

/**
 * 拼接完整路径
 * @param prefix - 父级路径前缀
 * @param name - 当前字段名
 * @returns 完整路径
 */
export const joinPath = (prefix: string, name: string): string => {
  if (!prefix) return name;
  if (!name) return prefix;
  return `${prefix}.${name}`;
};

/**
 * 从完整路径中移除前缀，得到相对路径
 * @param fullPath - 完整路径（如 'company.details.name'）
 * @param prefix - 要移除的前缀（如 'company.details'）
 * @returns 相对路径（如 'name'）
 *
 * @example
 * removePrefix('company.type', 'company') // 'type'
 * removePrefix('company.details.name', 'company.details') // 'name'
 * removePrefix('company.type', '') // 'company.type'
 * removePrefix('type', 'company') // 'type' (前缀不匹配，返回原路径)
 */
export const removePrefix = (fullPath: string, prefix: string): string => {
  if (!prefix) return fullPath;
  if (!fullPath) return fullPath;

  // 如果完整路径以 "prefix." 开头，则移除前缀
  if (fullPath.startsWith(`${prefix}.`)) {
    return fullPath.slice(prefix.length + 1);
  }

  // 如果完整路径等于前缀，返回空字符串
  if (fullPath === prefix) {
    return '';
  }

  // 前缀不匹配，返回原路径
  return fullPath;
};
