import type { FieldChange, FormChangeMeta, FieldChangeSource } from '../types'
import { PathResolver } from './pathResolver'

interface ChangeBatch {
  /** 批次内部唯一编号，用于关联延迟通知和联动 run。 */
  id: number
  /** 开启本次稳定事件的顶层来源。 */
  rootSource: FieldChangeSource
  /** 批次创建前的外部快照，用于固定 previousValue。 */
  baseData: Record<string, unknown>
  /** 按首次出现顺序保存字段变化，后续同路径写入只覆盖最终值。 */
  changesByPath: Map<string, FieldChange>
  /** 尚未完成或被淘汰的联动 run，非空时禁止 flush。 */
  pendingLinkageRunIds: Set<number>
  /** 顶层写入是否结束。 */
  rootOperationClosed: boolean
  /** 批次是否已取消或 detach，终态批次拒绝后续写入。 */
  stableCheckCompleted: boolean
  /** 是否已经发送或取消。 */
  flushed: boolean
}

interface BeginBatchParams {
  rootSource: FieldChangeSource
  baseData: Record<string, unknown>
}

interface BatchIdParams {
  batchId: number
}

interface RecordChangeParams extends BatchIdParams {
  change: FieldChange
}

interface CompleteRunParams extends BatchIdParams {
  runId: number
}

/** 管理 DynamicForm 对外字段事件的稳定批次生命周期。 */
export class ChangeBatchController {
  private nextBatchId = 1
  private nextRunId = 1
  private readonly batches = new Map<number, ChangeBatch>()

  /** 创建一个新的顶层变更批次。 */
  beginBatch({ rootSource, baseData }: BeginBatchParams): number {
    this.cancelPendingBatches()
    const id = this.nextBatchId++
    this.batches.set(id, {
      id,
      rootSource,
      baseData,
      changesByPath: new Map(),
      pendingLinkageRunIds: new Set(),
      rootOperationClosed: false,
      stableCheckCompleted: false,
      flushed: false,
    })
    return id
  }

  /** 新的顶层 mutation 会淘汰旧批次中尚未完成的联动结果。 */
  cancelPendingBatches(): void {
    this.batches.forEach((batch) => {
      batch.pendingLinkageRunIds.clear()
      if (!batch.flushed) batch.flushed = true
    })
    this.batches.clear()
  }

  /**
   * 释放控制器持有的全部批次状态。
   *
   * 组件卸载时异步联动可能仍会 settle；统一清理批次和 pending run，确保晚到结果无法写入
   * 事件，也避免控制器闭包继续保留表单快照。
   */
  dispose(): void {
    this.cancelPendingBatches()
  }

  /** 读取批次开始时指定路径的外部值。 */
  getBaseValue({ batchId, path }: BatchIdParams & { path: string }): unknown {
    const batch = this.batches.get(batchId)
    return batch ? PathResolver.getNestedValue(batch.baseData, path) : undefined
  }

  /** 将字段变化按路径归并到批次中。 */
  recordChange({ batchId, change }: RecordChangeParams): boolean {
    const batch = this.batches.get(batchId)
    if (!batch || batch.flushed) return false
    const existing = batch.changesByPath.get(change.path)
    if (existing) {
      existing.value = change.value
      existing.source = change.source
      if (change.arrayAction) existing.arrayAction = change.arrayAction
      else delete existing.arrayAction
    } else {
      batch.changesByPath.set(change.path, { ...change })
    }
    return true
  }

  /** 登记批次关联的联动运行。 */
  trackLinkageRun({ batchId }: BatchIdParams): number | undefined {
    const batch = this.batches.get(batchId)
    if (!batch || batch.flushed) return undefined
    const runId = this.nextRunId++
    batch.pendingLinkageRunIds.add(runId)
    return runId
  }

  /** 解除已完成或已淘汰的联动运行。 */
  completeLinkageRun({ batchId, runId }: CompleteRunParams): boolean {
    const batch = this.batches.get(batchId)
    return Boolean(batch && batch.pendingLinkageRunIds.delete(runId))
  }

  /** 标记顶层直接写入已结束。 */
  closeRoot({ batchId }: BatchIdParams): boolean {
    const batch = this.batches.get(batchId)
    if (!batch || batch.flushed) return false
    batch.rootOperationClosed = true
    return true
  }

  /** 标记至少完成一次 RHF 稳定检查。 */
  markStable({ batchId }: BatchIdParams): boolean {
    const batch = this.batches.get(batchId)
    if (!batch || batch.flushed) return false
    batch.stableCheckCompleted = true
    return true
  }

  /** 在满足稳定条件时原子 detach 批次并返回对外元数据。 */
  tryDetach({ batchId }: BatchIdParams): FormChangeMeta | undefined {
    const batch = this.batches.get(batchId)
    if (
      !batch ||
      batch.flushed ||
      !batch.rootOperationClosed ||
      !batch.stableCheckCompleted ||
      batch.pendingLinkageRunIds.size > 0 ||
      batch.changesByPath.size === 0
    ) {
      return undefined
    }
    batch.flushed = true
    this.batches.delete(batchId)
    return {
      rootSource: batch.rootSource,
      changes: Array.from(batch.changesByPath.values()),
    }
  }
}
