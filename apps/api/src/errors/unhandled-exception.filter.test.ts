import { describe, expect, it, vi } from 'vitest'
import { RequestContext } from '../platform/request-context.js'
import { logUnexpectedException, readCorrelationId } from './unhandled-exception.filter.js'

describe('correlação lida sem lançar', () => {
  it('devolve undefined quando não há requisição em andamento', () => {
    expect(readCorrelationId(new RequestContext())).toBeUndefined()
  })

  it('devolve a correlação da requisição em andamento', () => {
    const requestContext = new RequestContext()

    requestContext.run({ correlationId: 'test-correlation-id' }, () => {
      expect(readCorrelationId(requestContext)).toBe('test-correlation-id')
    })
  })
})

describe('log de exceção inesperada sem lançar', () => {
  it('não lança quando a requisição não tem logger', () => {
    expect(() => { logUnexpectedException({}, new Error('boom')); }).not.toThrow()
  })

  it('loga a exceção quando a requisição tem logger', () => {
    const error = vi.fn<(obj: unknown, message: string) => void>()
    const exception = new Error('boom')

    logUnexpectedException({ log: { error } }, exception)

    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0]?.[1]).toBe('Unhandled exception')
    expect(error.mock.calls[0]?.[0]).toEqual({ err: exception })
  })
})
