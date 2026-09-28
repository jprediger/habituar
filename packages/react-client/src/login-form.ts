/**
 * Entrypoint da tela de entrada: dono do preenchimento, do envio e de *qual falha a tela
 * deve mostrar*. Não conhece navegação, DOM nem primitivo nativo — cada plataforma só
 * decide o visual, e a decisão de quando a mensagem de falha ainda vale mora aqui para não
 * ser escrita duas vezes.
 */
import { loginInputSchema } from '@habituar/core/auth/schema'
import { useState } from 'react'
import type { AuthenticationActions, AuthenticationFailure, AuthenticationState } from './react-client.js'
import type { ValidatedField } from './form.js'
import { useValidatedForm } from './form.js'

export type LoginFormField = 'email' | 'password'

/**
 * A autenticação chega por parâmetro, não por contexto de módulo: o `Provider` pertence à
 * instância que cada app cria, e um singleton aqui furaria esse isolamento.
 */
export type LoginAuthentication = Readonly<{
  state: AuthenticationState
  actions: AuthenticationActions
}>

export type LoginForm = Readonly<{
  getField: (name: LoginFormField) => ValidatedField
  submit: () => void
  isSubmitting: boolean
  failure: AuthenticationFailure | undefined
}>

// Credenciais do último envio. Não é estado de sessão: morre com a tela, como a digitação.
type Attempt = Readonly<{ email: string; password: string }>

function hasChangedSince(attempt: Attempt | undefined, email: string, password: string): boolean {
  // Sem tentativa registrada, a falha não nasceu deste formulário — veio da restauração da
  // sessão, e continua valendo.
  if (attempt === undefined) return false
  return attempt.email !== email || attempt.password !== password
}

/**
 * Estado pronto da tela de entrada. `submit()` não recebe evento: no nativo o envio nasce
 * de um toque, e tratar evento é trabalho de quem tem um.
 */
export function useLoginForm(authentication: LoginAuthentication): LoginForm {
  const { state, actions } = authentication
  const form = useValidatedForm(loginInputSchema, { email: '', password: '' })
  const [attempt, setAttempt] = useState<Attempt | undefined>(undefined)

  const email = form.getField('email')
  const password = form.getField('password')

  const handleSubmit = form.handleSubmit(() => {
    setAttempt({ email: email.value, password: password.value })
    void actions.login({ email: email.value, password: password.value })
  })

  // A falha descreve a tentativa enviada, não o formulário: mantê-la depois que a pessoa
  // corrige o campo acusa um erro que já não existe, e o estado da sessão só muda no
  // próximo envio.
  const failure =
    state.status === 'failed' && !hasChangedSince(attempt, email.value, password.value)
      ? state.failure
      : undefined

  return {
    getField: form.getField,
    submit: () => {
      handleSubmit({ preventDefault: () => undefined })
    },
    isSubmitting: state.status === 'authenticating',
    failure,
  }
}
