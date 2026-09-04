import type { FormMutationContext } from '../types'

/** 单次 RHF 写入的私有身份；同一 context 可对应多次写入，不能以 context 代替它。 */
export interface PendingMutationToken {
  context: FormMutationContext
}

interface PendingMutationPathParams {
  path: string
}

interface RegisterPendingMutationParams extends PendingMutationPathParams {
  context: FormMutationContext
}

interface CancelPendingMutationParams extends PendingMutationPathParams {
  token: PendingMutationToken
}

/**
 * 管理 RHF 写入与 watch 通知之间的路径令牌。
 *
 * 每个令牌代表一次真实 setValue，而不是某个“当前来源”全局状态；因此延迟通知可以按
 * 路径 FIFO 找回自身上下文，写入失败时也能按令牌对象精确撤销，不会误删同路径后续写入。
 */
export class PendingMutationContextQueue {
  private readonly tokensByPath = new Map<string, PendingMutationToken[]>()

  /** 登记一次即将执行的 RHF 写入，并返回可用于失败撤销的令牌。 */
  register({ path, context }: RegisterPendingMutationParams): PendingMutationToken {
    const token = { context }
    const tokens = this.tokensByPath.get(path) ?? []
    tokens.push(token)
    this.tokensByPath.set(path, tokens)
    return token
  }

  /** 按路径 FIFO 消费最早登记的 watch 上下文。 */
  consume({ path }: PendingMutationPathParams): FormMutationContext | undefined {
    const tokens = this.tokensByPath.get(path)
    const token = tokens?.shift()
    if (!tokens?.length) this.tokensByPath.delete(path)
    return token?.context
  }

  /** 精确撤销一次失败写入，保留同路径的其他令牌及其顺序。 */
  cancel({ path, token }: CancelPendingMutationParams): boolean {
    const tokens = this.tokensByPath.get(path)
    if (!tokens) return false
    const index = tokens.indexOf(token)
    if (index < 0) return false
    tokens.splice(index, 1)
    if (!tokens.length) this.tokensByPath.delete(path)
    return true
  }

  /** 清理组件卸载或新批次淘汰时仍未消费的令牌。 */
  clear(): void {
    this.tokensByPath.clear()
  }
}
