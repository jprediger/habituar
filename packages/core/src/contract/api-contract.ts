import { oc } from '@orpc/contract'
import { healthContract } from '../health/health.contract'

/** D15: a versão da API vive só aqui. /v2 é outra composição sobre as mesmas fatias. */
export const API_VERSION = 'v1'

export const apiContract = oc.prefix(`/${API_VERSION}`).router({ health: healthContract })
