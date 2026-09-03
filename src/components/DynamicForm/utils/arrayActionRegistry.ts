import type { ArrayAction } from '../types'

export interface ArrayActionRecord {
  path: string
  action: ArrayAction
}
export interface ArrayActionStore {
  current: ArrayActionRecord[]
}

const registry = new WeakMap<object, ArrayActionStore>()
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
  const isMatchingSnapshot = (action: ArrayAction): boolean => {
    if (!Array.isArray(previousValue) || !Array.isArray(value)) return false
    if (action.action === 'insert') {
      return value.length === previousValue.length + 1
    }
    if (action.action === 'remove') {
      return value.length === previousValue.length - 1
    }
    return value.length === previousValue.length
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
  if (globalLatest?.path === path) globalLatest = undefined
  return action
}
export function clearArrayAction(control: object): void {
  const store = registry.get(control)
  if (store) store.current = []
  globalLatest = undefined
}
