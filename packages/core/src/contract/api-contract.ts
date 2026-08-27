import { initContract } from '@ts-rest/core'
import { healthContract } from '../health/health.contract'

const c = initContract()

/** D15: a versão da API vive só aqui. /v2 é outra composição sobre as mesmas fatias. */
export const API_VERSION = 'v1'

export const apiContract = c.router(
  { health: healthContract },
  { pathPrefix: `/${API_VERSION}` },
)
