import { describe, expect, it } from 'vitest'
import { API_VERSION, apiContract } from './api-contract'
import { FAILURE_CODES } from './failure'

describe('contrato da api', () => {
  it('prefixa a rota de saúde com a versão da api', () => {
    // `~orpc` é como o oRPC expõe a definição de uma procedure; é o que o `@Implement`
    // lê para montar a rota do Nest. Ler daqui é ler a mesma fonte que o servidor lê.
    expect(apiContract.health.getHealth['~orpc'].route.path).toBe(`/${API_VERSION}/health`)
  })

  it('herda o catálogo fechado de falhas em toda procedure, sem redeclaração por fatia', () => {
    const errorMap = apiContract.health.getHealth['~orpc'].errorMap

    for (const code of FAILURE_CODES) {
      expect(errorMap).toHaveProperty(code)
    }
  })
})
