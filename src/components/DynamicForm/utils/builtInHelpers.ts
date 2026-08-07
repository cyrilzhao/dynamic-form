import { ofetch } from 'ofetch';
import _ from 'lodash';
import * as v from 'valibot';
import type { BuiltInHelpers } from '../types/helpers';

/**
 * 内置 Helpers
 *
 * DynamicForm 默认提供的工具函数和依赖：
 * - ofetch: 跨浏览器和 Node.js 环境的请求能力
 * - _: lodash 完整功能
 * - v: Valibot 校验工具
 */
export const builtInHelpers: BuiltInHelpers = {
  ofetch,
  _,
  v,
};
