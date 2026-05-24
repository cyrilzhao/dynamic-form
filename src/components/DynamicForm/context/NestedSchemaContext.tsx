import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import type { ExtendedJSONSchema } from '../types/schema';

/**
 * NestedSchemaContext 用于收集所有嵌套表单的当前 schema
 *
 * 当嵌套表单使用动态 schema（通过 schema 联动切换）时，
 * 每个 NestedFormWidget 会将自己当前使用的 schema 注册到这个 Context 中。
 *
 * 在表单提交时，DynamicForm 会使用这些注册的 schema 来正确过滤数据。
 */

interface NestedSchemaRegistry {
  // 注册嵌套表单的当前 schema
  register: (fieldPath: string, schema: ExtendedJSONSchema) => void;
  // 注销嵌套表单的 schema
  unregister: (fieldPath: string) => void;
  // 获取指定字段的当前 schema
  getSchema: (fieldPath: string) => ExtendedJSONSchema | undefined;
  // 获取所有注册的 schema
  getAllSchemas: () => Map<string, ExtendedJSONSchema>;
}

const NestedSchemaContext = createContext<NestedSchemaRegistry | null>(null);

export const NestedSchemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 使用 Map 存储字段路径 -> schema 的映射
  const schemasRef = useRef<Map<string, ExtendedJSONSchema>>(new Map());

  const register = useCallback((fieldPath: string, schema: ExtendedJSONSchema) => {
    schemasRef.current.set(fieldPath, schema);
  }, []);

  const unregister = useCallback((fieldPath: string) => {
    schemasRef.current.delete(fieldPath);
  }, []);

  const getSchema = useCallback((fieldPath: string) => {
    return schemasRef.current.get(fieldPath);
  }, []);

  const getAllSchemas = useCallback(() => {
    return schemasRef.current;
  }, []);

  // 使用 useMemo 缓存 value 对象，避免每次渲染都创建新对象
  const value = useMemo<NestedSchemaRegistry>(
    () => ({
      register,
      unregister,
      getSchema,
      getAllSchemas,
    }),
    [register, unregister, getSchema, getAllSchemas]
  );

  return <NestedSchemaContext.Provider value={value}>{children}</NestedSchemaContext.Provider>;
};

export const useNestedSchemaRegistry = () => {
  const context = useContext(NestedSchemaContext);
  if (!context) {
    throw new Error('useNestedSchemaRegistry must be used within NestedSchemaProvider');
  }
  return context;
};

// 可选的 hook，用于不在 Provider 内部的场景
export const useNestedSchemaRegistryOptional = () => {
  return useContext(NestedSchemaContext);
};
