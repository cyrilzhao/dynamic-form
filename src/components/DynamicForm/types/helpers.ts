import type { ofetch } from 'ofetch';
import type * as v from 'valibot';
import type _ from 'lodash';

/**
 * 内置 Helpers 类型定义
 *
 * DynamicForm 默认提供以下 helpers：
 * - ofetch: 异步请求能力
 * - _: lodash 完整功能
 * - v: Valibot 校验工具
 */
export interface BuiltInHelpers {
  /**
   * 异步请求能力（基于 ofetch）
   *
   * ofetch 提供跨浏览器和 Node.js 环境的一致请求 API。
   * DynamicForm 不额外封装业务请求策略；如需 baseURL、鉴权、
   * 重试或拦截逻辑，可由用户通过 ofetch.create(...) 后覆盖注入。
   */
  ofetch: typeof ofetch;

  /**
   * lodash 完整功能
   * 提供数据处理、数组操作、对象操作等工具函数
   */
  _: typeof _;

  /**
   * Valibot 校验工具
   * 提供轻量、类型友好的运行时校验能力
   */
  v: typeof v;
}

/**
 * Helpers 类型
 * 包含内置 helpers 和用户自定义 helpers
 */
export type Helpers = BuiltInHelpers & Record<string, any>;
