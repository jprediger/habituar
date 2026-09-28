/**
 * Entrypoint do aceite de convite: dono do cadastro da conta nova, do envio e de quando o
 * aceite terminou. Não decide rota nem visual; a tela só lê estado e dispara ações.
 */
import { acceptInvitationRegistrationInputSchema } from '@habituar/core/invitations'
import { useState } from 'react'
import type { AuthenticationState } from './react-client.js'

export type InvitationAcceptanceFailure = 'invalid-registration' | 'server'

export type InvitationAcceptance = Readonly<{
  name: string
  setName: (value: string) => void
  password: string
  setPassword: (value: string) => void
  isSignedIn: boolean
  submit: () => Promise<void>
  isSubmitting: boolean
  isDone: boolean
  failure: InvitationAcceptanceFailure | undefined
}>

type InvitationActions = Readonly<{
  hasAccount: boolean
  accept: () => Promise<void>
  acceptWithRegistration: (input: Readonly<{ name: string; password: string }>) => Promise<void>
}>

/**
 * Conta existente aceita com a sessão atual; conta nova cria senha e aceita no mesmo envio.
 * O token não passa por aqui: ele pertence ao `useInvitation` que produziu as ações.
 */
export function useInvitationAcceptance(
  options: Readonly<{ token: string; authentication: AuthenticationState; invitation: InvitationActions }>,
): InvitationAcceptance {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [failure, setFailure] = useState<InvitationAcceptanceFailure | undefined>(undefined)
  const status = options.authentication.status

  return {
    name,
    setName,
    password,
    setPassword,
    isSignedIn: status === 'authenticated' || status === 'awaiting-invitation' || status === 'selecting-membership',
    submit: async () => {
      const { invitation } = options
      if (!invitation.hasAccount && !acceptInvitationRegistrationInputSchema.safeParse({ token: options.token, name, password }).success) {
        setFailure('invalid-registration')
        return
      }
      setIsSubmitting(true)
      setFailure(undefined)
      try {
        if (invitation.hasAccount) await invitation.accept()
        else await invitation.acceptWithRegistration({ name, password })
        setIsDone(true)
      } catch {
        setFailure('server')
      } finally {
        setIsSubmitting(false)
      }
    },
    isSubmitting,
    isDone,
    failure,
  }
}
