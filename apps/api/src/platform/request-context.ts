import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'

type Context = {
  readonly correlationId: string
}

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
