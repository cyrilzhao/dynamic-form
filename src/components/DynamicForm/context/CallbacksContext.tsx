import React, { createContext, useContext, useMemo } from 'react';

/**
 * Callbacks Context
 * 用于在整个表单树中共享 widget 回调函数注册表
 */
interface CallbacksContextValue {
  callbacks: Record<string, (...args: any[]) => any>;
}

const CallbacksContext = createContext<CallbacksContextValue | null>(null);

export const CallbacksProvider: React.FC<{
  callbacks?: Record<string, (...args: any[]) => any>;
  children: React.ReactNode;
}> = ({ callbacks = {}, children }) => {
  const value = useMemo<CallbacksContextValue>(() => ({ callbacks }), [callbacks]);
  return <CallbacksContext.Provider value={value}>{children}</CallbacksContext.Provider>;
};

export const useCallbacks = (): Record<string, (...args: any[]) => any> => {
  const context = useContext(CallbacksContext);
  return context?.callbacks || {};
};
