import { initContract } from '@ts-rest/core'
import { healthStatusSchema } from './health.schema'

const c = initContract()

// A fatia declara o caminho sem versão: o prefixo é responsabilidade da composição raiz.
export const healthContract = c.router({
  getHealth: {
    method: 'GET',
    path: '/health',
    responses: { 200: healthStatusSchema },
    summary: 'Liveness do serviço',
  },
})
