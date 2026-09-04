import type { FormMutationContext } from '../../types'
import { PendingMutationContextQueue } from '../pendingMutationContextQueue'

describe('PendingMutationContextQueue', () => {
  const createContext = ({ batchId }: { batchId: number }): FormMutationContext => ({
    batchId,
    source: 'setValue',
    isLinkageWrite: false,
  })

  it('应按同一路径的登记顺序消费令牌', () => {
    const queue = new PendingMutationContextQueue()
    const firstContext = createContext({ batchId: 1 })
    const secondContext = createContext({ batchId: 2 })

    queue.register({ path: 'profile.name', context: firstContext })
    queue.register({ path: 'profile.name', context: secondContext })

    expect(queue.consume({ path: 'profile.name' })).toBe(firstContext)
    expect(queue.consume({ path: 'profile.name' })).toBe(secondContext)
  })

  it('撤销写入失败的令牌时不应移除同路径其他写入', () => {
    const queue = new PendingMutationContextQueue()
    const failedContext = createContext({ batchId: 1 })
    const validContext = createContext({ batchId: 2 })

    const failedToken = queue.register({ path: 'profile.name', context: failedContext })
    queue.register({ path: 'profile.name', context: validContext })

    queue.cancel({ path: 'profile.name', token: failedToken })

    expect(queue.consume({ path: 'profile.name' })).toBe(validContext)
    expect(queue.consume({ path: 'profile.name' })).toBeUndefined()
  })

  it('不同路径的撤销不应影响其他路径的令牌', () => {
    const queue = new PendingMutationContextQueue()
    const firstContext = createContext({ batchId: 1 })
    const secondContext = createContext({ batchId: 2 })

    const firstToken = queue.register({ path: 'first', context: firstContext })
    queue.register({ path: 'second', context: secondContext })
    queue.cancel({ path: 'first', token: firstToken })

    expect(queue.consume({ path: 'second' })).toBe(secondContext)
  })
})
