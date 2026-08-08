import React from 'react';
import * as BlueprintCore from '@blueprintjs/core';
import * as BlueprintIcons from '@blueprintjs/icons';
import { ofetch } from 'ofetch';
import * as lodash from 'lodash';
import { z } from 'zod';
import type { ExecuteResult } from '@/features/widget-manager/types/widget';

/**
 * Widget 沙箱执行器
 * 在安全的沙箱环境中执行编译后的代码
 */
export class WidgetSandbox {
  /**
   * 创建沙箱环境
   *
   * 关键设计：helpers 通过沙箱注入，不侵入 widget props
   * - 用户代码中的 import 语句会被 Babel 转换为 require() 调用
   * - require() 函数映射到预定义的依赖对象
   * - Widget 组件的 props 保持纯净，只包含表单字段相关属性
   */
  private createSandbox() {
    const moduleExports: any = {};

    // 真实的内置 helpers
    const builtInHelpers = {
      ofetch,
      _: lodash,
      z: z,
    };

    return {
      // React 核心
      React,
      useState: React.useState,
      useEffect: React.useEffect,
      useMemo: React.useMemo,
      useCallback: React.useCallback,
      useRef: React.useRef,
      useContext: React.useContext,
      forwardRef: React.forwardRef,

      // Blueprint.js
      ...BlueprintCore,
      Icons: BlueprintIcons,

      // DynamicForm helpers
      helpers: builtInHelpers,
      ofetch: builtInHelpers.ofetch,
      _: builtInHelpers._,
      lodash: builtInHelpers._,
      z: builtInHelpers.z,
      zod: builtInHelpers.z,

      // CommonJS 模块系统
      module: { exports: moduleExports },
      exports: moduleExports,
      require: (moduleName: string) => {
        if (moduleName === 'react') return React;
        if (moduleName === 'react/jsx-runtime') {
          // 返回 React 的 jsx-runtime
          return {
            jsx: React.createElement,
            jsxs: React.createElement,
            Fragment: React.Fragment,
          };
        }
        if (moduleName === '@blueprintjs/core') return BlueprintCore;
        if (moduleName === '@blueprintjs/icons') return BlueprintIcons;
        if (moduleName === 'helpers') return builtInHelpers;
        if (moduleName === 'ofetch') return { ofetch: builtInHelpers.ofetch };
        if (moduleName === 'lodash' || moduleName === '_') return builtInHelpers._;
        if (moduleName === 'zod') return { z: builtInHelpers.z };

        throw new Error(`Module "${moduleName}" is not available in sandbox`);
      },

      // 受控的 console
      console: {
        log: (...args: any[]) => console.log('[Widget]', ...args),
        warn: (...args: any[]) => console.warn('[Widget]', ...args),
        error: (...args: any[]) => console.error('[Widget]', ...args),
      },

      // 禁用危险 API
      eval: undefined,
      Function: undefined,
      window: undefined,
      document: undefined,
      global: undefined,
      globalThis: undefined,
    };
  }

  /**
   * 执行 Widget 代码
   */
  execute(compiledCode: string): ExecuteResult {
    try {
      const sandbox = this.createSandbox();

      // 移除 Babel 生成的严格模式声明，避免与编译后的代码冲突
      const cleanedCode = compiledCode.replace(/["']use strict["'];?\s*/g, '');

      const functionBody = `
        ${cleanedCode}
        return module.exports.default || module.exports;
      `;

      // 使用 Function Constructor 执行
      // 这是受控环境，用于动态 widget 代码执行，已做沙箱隔离
      const fn = new Function(...Object.keys(sandbox), functionBody);
      const component = fn(...Object.values(sandbox));

      if (typeof component !== 'function') {
        throw new Error('Widget must export a React component');
      }

      return {
        success: true,
        component,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
      };
    }
  }
}
