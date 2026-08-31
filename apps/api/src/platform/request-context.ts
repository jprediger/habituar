import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Strings cruas no M0 — os branded types de instituição, ator e sessão entram no M1,
 * quando existirem os identificadores concretos (ver CHANGELOG).
 */
export type TenantContext = {
  readonly institutionId: string
  readonly actorId: string
  readonly sessionId: string
}

type Context = {
  readonly correlationId: string
  // `undefined` explícito, não campo opcional: até existir sessão (D6, M1), todo call
  // site precisa decidir o valor. `Database.withTenant` falha alto quando lê o contexto
  // sem tenant — não devolve zero linhas silenciosamente.
  readonly tenant: TenantContext | undefined
}

/**
 * Única fonte da correlação e do tenant da requisição corrente. Nunca montada por
 * parâmetro de call site: quem precisa de tenant lê daqui, não recebe por argumento.
 */
@Injectable()
export class RequestContext {
  private readonly storage = new AsyncLocalStorage<Context>()

  run<T>(context: Context, callback: () => T): T {
    return this.storage.run(context, callback)
  }

  get(): Context {
    const context = this.storage.getStore()

    if (context === undefined) {
      throw new Error('Request context is unavailable')
    }

    return context
  }
}
