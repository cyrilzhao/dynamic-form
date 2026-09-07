import React, { createContext, useContext, useMemo, useRef } from "react";

export interface FieldVariantStore {
  getActive: (path: string) => string | undefined;
  setActive: (path: string, name: string) => void;
  getCachedValue: (path: string, name: string) => unknown;
  setCachedValue: (path: string, name: string, value: unknown) => void;
  clear: (path: string) => void;
}

const FieldVariantContext = createContext<FieldVariantStore | null>(null);

/** 创建一个与 DynamicForm 实例绑定的独立 Variant store。 */
export const createFieldVariantStore = (): FieldVariantStore => {
  const values = new Map<
    string,
    { active?: string; cache: Map<string, unknown> }
  >();
  return {
    getActive: (path) => values.get(path)?.active,
    setActive: (path, name) => {
      const item = values.get(path) || {
        active: undefined,
        cache: new Map<string, unknown>(),
      };
      item.active = name;
      values.set(path, item);
    },
    getCachedValue: (path, name) => values.get(path)?.cache.get(name),
    setCachedValue: (path, name, value) => {
      const item = values.get(path) || {
        active: undefined,
        cache: new Map<string, unknown>(),
      };
      item.cache.set(name, value);
      values.set(path, item);
    },
    clear: (path) => values.delete(path),
  };
};

export const FieldVariantProvider: React.FC<{
  children: React.ReactNode;
  store?: FieldVariantStore;
}> = ({ children, store }) => {
  const local = useRef(createFieldVariantStore()).current;
  const value = useMemo<FieldVariantStore>(
    () =>
      store || {
        getActive: local.getActive,
        setActive: local.setActive,
        getCachedValue: local.getCachedValue,
        setCachedValue: local.setCachedValue,
        clear: local.clear,
      },
    [local, store],
  );
  return (
    <FieldVariantContext.Provider value={value}>
      {children}
    </FieldVariantContext.Provider>
  );
};

export const useFieldVariantStore = (): FieldVariantStore => {
  const context = useContext(FieldVariantContext);
  if (!context)
    throw new Error(
      "useFieldVariantStore must be used inside FieldVariantProvider",
    );
  return context;
};

/** 在嵌套 DynamicForm 场景中读取父级 store；无 Provider 时返回 undefined。 */
export const useFieldVariantStoreOptional = (): FieldVariantStore | undefined =>
  useContext(FieldVariantContext) || undefined;
