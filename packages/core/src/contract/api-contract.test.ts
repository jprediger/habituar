import { describe, expect, it } from 'vitest'
import { API_VERSION, apiContract } from './api-contract'

describe('contrato da api', () => {
  it('prefixa a rota de saúde com a versão da api', () => {
    expect(apiContract.health.getHealth.path).toBe(`/${API_VERSION}/health`)
  })
})
