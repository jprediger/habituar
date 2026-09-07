import { oc } from '@orpc/contract'
import { authContract } from '../auth/auth.contract.js'
import { healthContract } from '../health/health.contract.js'
import { FAILURE_ERROR_MAP } from './failure.js'

/** D15: a versão da API vive só aqui. /v2 é outra composição sobre as mesmas fatias. */
export const API_VERSION = 'v1'

/**
 * Toda procedure herda o catálogo fechado de falhas por mescla do oRPC — nenhuma fatia
 * redeclara erro. `throw errors.<code>()` dentro de um handler é o único jeito de sair
 * daqui com uma falha esperada.
 */
export const apiContract = oc
  .errors(FAILURE_ERROR_MAP)
  .prefix(`/${API_VERSION}`)
  .router({ health: healthContract, auth: authContract })