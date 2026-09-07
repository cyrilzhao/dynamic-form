import type { ArrayAction } from '../types'

export interface ArrayActionRecord {
  /** 数组字段的标准路径，用于隔离不同数组及不同表单控制器的动作。 */
  path: string
  /** 操作开始前捕获的结构动作，包含元素索引和值。 */
  action: ArrayAction
}
export interface ArrayActionStore {
  /** 按操作登记顺序保存尚未被 RHF watch 快照消费的动作。 */
  current: ArrayActionRecord[]
}

// 以 RHF control 为键隔离多个 DynamicForm，避免一个表单的数组动作污染另一个表单。
const registry = new WeakMap<object, ArrayActionStore>()
// 兼容 watch 未提供 control 对应路径的兜底记录；消费成功后立即清除，避免跨批次复用。
let globalLatest: ArrayActionRecord | undefined

export function registerArrayActionStore(
  control: object,
  store: ArrayActionStore,
): void {
  registry.set(control, store)
}
export function recordArrayAction(
  control: object,
  path: string,
  action: ArrayAction,
): void {
  // 动作必须在 useFieldArray 执行变更前登记，才能用操作前元素值校验后续快照。
  registry.get(control)?.current.push({ path, action })
  globalLatest = { path, action }
}
export function consumeArrayActionForSnapshot(
  control: object,
  path: string,
  previousValue: unknown,
  value: unknown,
): ArrayAction | undefined {
  const records = registry.get(control)?.current ?? []
  // 结构化动作中的 value 是操作边界捕获的元素快照。使用深度比较校验元素身份，
  // 避免连续 move 都满足“数组长度不变”时误消费上一条延迟动作。
  const isEqual = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) return true
    if (
      !left ||
      !right ||
      typeof left !== 'object' ||
      typeof right !== 'object'
    ) {
      return false
    }
    try {
      return JSON.stringify(left) === JSON.stringify(right)
    } catch {
      return false
    }
  }
  const isMatchingSnapshot = (action: ArrayAction): boolean => {
    if (!Array.isArray(previousValue) || !Array.isArray(value)) return false
    if (action.action === 'insert') {
      return value.length === previousValue.length + 1
    }
    if (action.action === 'remove') {
      return (
        value.length === previousValue.length - 1 &&
        isEqual(previousValue[action.index], action.value)
      )
    }
    return (
      value.length === previousValue.length &&
      isEqual(previousValue[action.fromIndex], action.value) &&
      isEqual(value[action.toIndex], action.value)
    )
  }
  let index = -1
  for (let i = records.length - 1; i >= 0; i -= 1) {
    if (records[i].path === path && isMatchingSnapshot(records[i].action)) {
      index = i
      break
    }
  }
  if (index < 0) {
    if (
      globalLatest?.path === path &&
      isMatchingSnapshot(globalLatest.action)
    ) {
      const action = globalLatest.action
      globalLatest = undefined
      return action
    }
    return undefined
  }
  const action = records.splice(index, 1)[0].action
  // 同一路径只允许最近一次结构操作参与当前快照匹配。更早记录若仍未消费，
  // 通常对应延迟到达的旧 watch 通知；继续保留会把上一次 move 的索引污染到下一批。
  for (let i = records.length - 1; i >= 0; i -= 1) {
    if (records[i].path === path) records.splice(i, 1)
  }
  if (globalLatest?.path === path) globalLatest = undefined
  return action
}
export function clearArrayAction(control: object): void {
  const store = registry.get(control)
  if (store) store.current = []
  globalLatest = undefined
}
