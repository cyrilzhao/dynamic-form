/**
 * 联动运行令牌
 * 捕获一次联动计算开始时的版本快照，用于提交前判断结果是否过期。
 */
export interface LinkageRunToken {
  scopeId: string;
  runId: number;
  formMutationVersion: number;
  linkagesVersion: number;
  linkageFunctionsVersion: number;
}

/**
 * 联动事务控制器
 * 负责标记表单/联动配置/联动函数变化，并判断异步联动结果是否仍可提交。
 */
export class LinkageOperationController {
  // 全表单共享版本：任何用户输入、外部 ref API 写入、reset 或批量写入都会递增。
  // 它用于让“基于旧表单快照启动的异步联动”在提交前自动失效。
  private formMutationVersion = 0;

  // runId/linkages/linkageFunctions 按 scope 隔离。
  // 一个 DynamicForm 页面中可能同时存在根表单和多个数组元素嵌套表单；
  // 它们需要共享表单 mutation 版本，但不能让某个子表单的联动配置变化误杀其他 scope 的计算。
  private runIds = new Map<string, number>();
  private linkagesVersions = new Map<string, number>();
  private linkageFunctionsVersions = new Map<string, number>();

  // batchDepth/pendingLinkage 用于把 setValues 递归触发的多次 watch 合并为一次最终快照联动。
  // 这样联动不会基于批量写值的中间态计算，也不会提交中间态结果。
  private batchDepth = 0;
  private pendingLinkage = false;

  /**
   * 标记表单快照发生变化。
   *
   * 只要表单内容变化，旧 token 捕获的 formMutationVersion 就不再可信，
   * 因此必须在所有外部写入和真实用户输入入口递增该版本。
   */
  markFormMutation(): void {
    this.formMutationVersion += 1;
  }

  /**
   * 标记指定 scope 的联动配置发生变化。
   *
   * linkages 变化后，旧计算使用的是旧依赖图和旧效果定义；
   * 即使表单值没变，也不能再允许旧结果提交。
   */
  markLinkagesChanged(scopeId: string): void {
    this.linkagesVersions.set(
      scopeId,
      (this.linkagesVersions.get(scopeId) ?? 0) + 1,
    );
  }

  /**
   * 标记指定 scope 的联动函数发生变化。
   *
   * linkageFunctions 通常由业务侧 props 传入，异步函数晚返回时可能已经不是最新业务逻辑；
   * 版本变化会让旧函数计算结果在提交阶段被丢弃。
   */
  markLinkageFunctionsChanged(scopeId: string): void {
    this.linkageFunctionsVersions.set(
      scopeId,
      (this.linkageFunctionsVersions.get(scopeId) ?? 0) + 1,
    );
  }

  /**
   * 开始一次批量表单写入。
   *
   * 批处理中 watch 仍会收到字段变化，但不应立即调度多轮联动；
   * 调用方会在 endBatch 后根据 pendingLinkage 决定是否只刷新一次最终快照。
   */
  beginBatch(): void {
    this.batchDepth += 1;
  }

  /**
   * 结束一次批量表单写入。
   *
   * @returns 是否需要基于批量写入后的最终快照刷新联动。
   */
  endBatch(): boolean {
    this.batchDepth = Math.max(0, this.batchDepth - 1);
    if (this.batchDepth > 0 || !this.pendingLinkage) {
      return false;
    }
    this.pendingLinkage = false;
    return true;
  }

  /**
   * 判断当前是否处于批量写入中。
   *
   * watch 回调使用该状态决定是立即 enqueue，还是只记录“批量结束后需要刷新”。
   */
  isBatching(): boolean {
    return this.batchDepth > 0;
  }

  /**
   * 记录批量写入期间发生过会影响联动的字段变化。
   */
  markPendingLinkage(): void {
    this.pendingLinkage = true;
  }

  /**
   * 创建一次联动运行令牌。
   *
   * token 捕获当前表单版本、联动配置版本和联动函数版本。
   * 后续异步计算即使晚返回，也必须拿这个 token 通过 canCommit 才能写回。
   */
  createRun(scopeId: string): LinkageRunToken {
    const runId = (this.runIds.get(scopeId) ?? 0) + 1;
    this.runIds.set(scopeId, runId);
    return {
      scopeId,
      runId,
      formMutationVersion: this.formMutationVersion,
      linkagesVersion: this.linkagesVersions.get(scopeId) ?? 0,
      linkageFunctionsVersion: this.linkageFunctionsVersions.get(scopeId) ?? 0,
    };
  }

  /**
   * 判断某次联动计算是否仍然允许提交。
   *
   * 这里是竞态防护的最终边界：只要计算期间发生了新 run、新表单写入、
   * 新联动配置或新联动函数，旧 token 都会失效，结果只能丢弃。
   */
  canCommit(token: LinkageRunToken): boolean {
    return (
      token.runId === (this.runIds.get(token.scopeId) ?? 0) &&
      token.formMutationVersion === this.formMutationVersion &&
      token.linkagesVersion ===
        (this.linkagesVersions.get(token.scopeId) ?? 0) &&
      token.linkageFunctionsVersion ===
        (this.linkageFunctionsVersions.get(token.scopeId) ?? 0)
    );
  }
}
