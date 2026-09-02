import type { ArrayAction } from '../types'

const registry = new WeakMap<
  object,
  { current: { path: string; action: ArrayAction } | null }
>()

export function registerArrayActionStore(
  control: object,
  store: { current: { path: string; action: ArrayAction } | null },
): void {
  registry.set(control, store)
}

export function recordArrayAction(
  control: object,
  path: string,
  action: ArrayAction,
): void {
  const store = registry.get(control)
  if (store) store.current = { path, action }
}

export function consumeArrayAction(
  control: object,
  path: string,
): ArrayAction | undefined {
  const store = registry.get(control)
  if (store?.current?.path !== path) return undefined
  const action = store.current.action
  store.current = null
  return action
}

export function consumeLatestArrayAction(
  control: object,
): { path: string; action: ArrayAction } | undefined {
  const store = registry.get(control)
  if (!store?.current) return undefined
  const result = store.current
  store.current = null
  return result
}

export function peekArrayAction(
  control: object,
): { path: string; action: ArrayAction } | undefined {
  return registry.get(control)?.current ?? undefined
}
