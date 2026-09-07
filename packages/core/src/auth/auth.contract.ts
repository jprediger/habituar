import { oc } from '@orpc/contract'
import {
  authenticatedUserSchema,
  loginInputSchema,
  logoutOutputSchema,
  registerInputSchema,
  sessionIssuedSchema,
} from './auth.schema.js'

// Fatia de autenticação: registro, login e logout. Caminho sem versão — o prefixo é
// responsabilidade da composição raiz (ver api-contract.ts), igual a health.contract.ts.
export const authContract = {
  register: oc
    .route({ method: 'POST', path: '/auth/register', summary: 'Cria um novo usuário' })
    .input(registerInputSchema)
    .output(authenticatedUserSchema),
  login: oc
    .route({ method: 'POST', path: '/auth/login', summary: 'Autentica um usuário e emite uma sessão' })
    .input(loginInputSchema)
    .output(sessionIssuedSchema),
  // Sem input: a sessão a revogar é a do ator autenticado da requisição corrente, nunca
  // um id recebido no corpo — ver authentication.controller.ts do apps/api.
  logout: oc
    .route({ method: 'POST', path: '/auth/logout', summary: 'Revoga a sessão corrente' })
    .output(logoutOutputSchema),
}
