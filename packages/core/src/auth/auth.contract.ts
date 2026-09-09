import { oc } from '@orpc/contract'
import { authenticationContextSchema } from './auth-context.js'
import {
  authenticatedUserSchema,
  loginInputSchema,
  logoutOutputSchema,
  mobileSessionIssuedSchema,
  registerInputSchema,
  webSessionIssuedSchema,
} from './auth.schema.js'

// Fatia de autenticação: registro, login e logout. Caminho sem versão — o prefixo é
// responsabilidade da composição raiz (ver api-contract.ts), igual a health.contract.ts.
export const authContract = {
  register: oc
    .route({ method: 'POST', path: '/auth/register', summary: 'Cria um novo usuário' })
    .input(registerInputSchema)
    .output(authenticatedUserSchema),
  loginWeb: oc
    .route({ method: 'POST', path: '/auth/login', summary: 'Autentica web por cookie' })
    .input(loginInputSchema)
    .output(webSessionIssuedSchema),
  loginMobile: oc
    .route({ method: 'POST', path: '/auth/mobile/login', summary: 'Autentica mobile por Bearer' })
    .input(loginInputSchema)
    .output(mobileSessionIssuedSchema),
  context: oc
    .route({ method: 'GET', path: '/auth/context', summary: 'Resolve o contexto autenticado' })
    .output(authenticationContextSchema),
  // Sem input: a sessão a revogar é a do ator autenticado da requisição corrente, nunca
  // um id recebido no corpo — ver authentication.controller.ts do apps/api.
  logout: oc
    .route({ method: 'POST', path: '/auth/logout', summary: 'Revoga a sessão corrente' })
    .output(logoutOutputSchema),
}
