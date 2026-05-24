import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { NestedSchemaProvider } from '../../context/NestedSchemaContext';
import { PathPrefixProvider } from '../../context/PathPrefixContext';

/**
 * 测试用的 FormProvider 包装器
 */
export const FormWrapper: React.FC<{
  children: React.ReactNode;
  defaultValues?: Record<string, any>;
}> = ({ children, defaultValues = {} }) => {
  const methods = useForm({ defaultValues });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

/**
 * 完整的测试包装器（包含所有必要的 Context）
 */
export const TestWrapper: React.FC<{
  children: React.ReactNode;
  defaultValues?: Record<string, any>;
  pathPrefix?: string;
}> = ({ children, defaultValues = {}, pathPrefix = '' }) => {
  const methods = useForm({ defaultValues });
  return (
    <FormProvider {...methods}>
      <NestedSchemaProvider>
        <PathPrefixProvider prefix={pathPrefix}>{children}</PathPrefixProvider>
      </NestedSchemaProvider>
    </FormProvider>
  );
};
