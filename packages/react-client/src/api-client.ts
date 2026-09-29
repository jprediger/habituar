import type { apiContract } from '@habituar/core/contract'
import type { ContractRouterClient } from '@orpc/contract'

/** Cliente tipado do contrato inteiro; interno ao pacote, nunca exportado aos apps. */
export type ApiClient = ContractRouterClient<typeof apiContract>
