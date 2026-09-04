import type { FieldChange } from '../../types'
import { ChangeBatchController } from '../changeBatchController'

describe('ChangeBatchController', () => {
  const change = (
    path: string,
    value: unknown,
    source: FieldChange['source'],
  ): FieldChange => ({
    path,
    previousValue: undefined,
    value,
    source,
  })

  it('按首次路径顺序归并变化并保留批次开始前的 previousValue', () => {
    const controller = new ChangeBatchController()
    const batchId = controller.beginBatch({
      rootSource: 'setValues',
      baseData: { first: 'old', second: undefined },
    })

    controller.recordChange({
      batchId,
      change: {
        ...change('second', 'B', 'setValues'),
        previousValue: undefined,
      },
    })
    controller.recordChange({
      batchId,
      change: { ...change('first', 'A', 'setValues'), previousValue: 'old' },
    })
    controller.recordChange({
      batchId,
      change: { ...change('second', 'C', 'linkage'), previousValue: 'B' },
    })
    controller.closeRoot({ batchId })
    controller.markStable({ batchId })

    expect(controller.tryDetach({ batchId })).toEqual({
      rootSource: 'setValues',
      changes: [
        {
          path: 'second',
          previousValue: undefined,
          value: 'C',
          source: 'linkage',
        },
        {
          path: 'first',
          previousValue: 'old',
          value: 'A',
          source: 'setValues',
        },
      ],
    })
  })

  it('根操作关闭、联动 run 完成且稳定检查完成前不可 flush', () => {
    const controller = new ChangeBatchController()
    const batchId = controller.beginBatch({ rootSource: 'user', baseData: {} })
    controller.recordChange({
      batchId,
      change: change('country', 'CN', 'user'),
    })
    const runId = controller.trackLinkageRun({ batchId })

    expect(controller.tryDetach({ batchId })).toBeUndefined()
    controller.closeRoot({ batchId })
    expect(controller.tryDetach({ batchId })).toBeUndefined()
    controller.markStable({ batchId })
    expect(controller.tryDetach({ batchId })).toBeUndefined()

    controller.completeLinkageRun({ batchId, runId })
    expect(controller.tryDetach({ batchId })).toEqual({
      rootSource: 'user',
      changes: [change('country', 'CN', 'user')],
    })
  })

  it('首次稳定检查没有变化时，晚到变化仍可在重新检查后 flush', () => {
    const controller = new ChangeBatchController()
    const batchId = controller.beginBatch({
      rootSource: 'setValues',
      baseData: {},
    })

    controller.closeRoot({ batchId })
    controller.markStable({ batchId })
    // 首次检查没有收到 RHF watch，不能把批次当作已发送或永久终止。
    expect(controller.tryDetach({ batchId })).toBeUndefined()

    controller.recordChange({
      batchId,
      change: change('name', 'Ada', 'setValues'),
    })
    // 模拟晚到 watch 触发的第二次稳定检查。
    controller.markStable({ batchId })
    expect(controller.tryDetach({ batchId })).toEqual({
      rootSource: 'setValues',
      changes: [change('name', 'Ada', 'setValues')],
    })
  })

  it('detach 后拒绝写入，且新批次不影响旧批次结果', () => {
    const controller = new ChangeBatchController()
    const firstBatch = controller.beginBatch({
      rootSource: 'user',
      baseData: {},
    })
    controller.recordChange({
      batchId: firstBatch,
      change: change('name', 'Ada', 'user'),
    })
    controller.closeRoot({ batchId: firstBatch })
    controller.markStable({ batchId: firstBatch })
    expect(controller.tryDetach({ batchId: firstBatch })).toBeDefined()
    expect(
      controller.recordChange({
        batchId: firstBatch,
        change: change('name', 'Grace', 'user'),
      }),
    ).toBe(false)

    const secondBatch = controller.beginBatch({
      rootSource: 'setValue',
      baseData: {},
    })
    controller.recordChange({
      batchId: secondBatch,
      change: change('name', 'Grace', 'setValue'),
    })
    controller.closeRoot({ batchId: secondBatch })
    controller.markStable({ batchId: secondBatch })
    expect(controller.tryDetach({ batchId: secondBatch })).toEqual({
      rootSource: 'setValue',
      changes: [change('name', 'Grace', 'setValue')],
    })
  })

  it('dispose 会取消所有批次并使已有 run 失效', () => {
    const controller = new ChangeBatchController()
    const batchId = controller.beginBatch({ rootSource: 'user', baseData: {} })
    const runId = controller.trackLinkageRun({ batchId })

    controller.dispose()

    expect(controller.completeLinkageRun({ batchId, runId })).toBe(false)
    expect(
      controller.recordChange({
        batchId,
        change: change('name', 'Ada', 'user'),
      }),
    ).toBe(false)
    expect(controller.tryDetach({ batchId })).toBeUndefined()
  })
})
