import React, { createContext, useContext, useMemo } from 'react';

/**
 * Helpers Context
 * 用于在整个表单树中共享 helpers（工具函数和依赖）
 *
 * helpers 包括：
 * - 内置 helpers（ofetch、lodash、zod 等）
 * - 用户自定义 helpers
 */
export interface HelpersContextValue {
  helpers: Record<string, any>;
}

const HelpersContext = createContext<HelpersContextValue>({
  helpers: {},
});

export const HelpersProvider: React.FC<{
  helpers: Record<string, any>;
  children: React.ReactNode;
}> = ({ helpers, children }) => {
  const value = useMemo<HelpersContextValue>(
    () => ({ helpers }),
    [helpers]
  );
  return (
    <HelpersContext.Provider value={value}>
      {children}
    </HelpersContext.Provider>
  );
};

/**
 * 获取 helpers 对象
 * @returns helpers 对象
 */
export const useHelpers = (): Record<string, any> => {
  const context = useContext(HelpersContext);
  return context.helpers;
};
