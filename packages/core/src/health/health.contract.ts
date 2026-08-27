import { oc } from '@orpc/contract'
import { healthStatusSchema } from './health.schema'

// A fatia declara o caminho sem versão: o prefixo é responsabilidade da composição raiz.
export const healthContract = {
    getHealth: oc
    .route({ method: 'GET', path: '/health', summary: 'Liveness do serviço' })
    .output(healthStatusSchema),
}
