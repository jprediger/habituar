import { loginInputSchema } from '@habituar/core/auth/schema'
import { Link, Navigate, createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthenticationCard } from '../authentication-card.js'
import { getWebAuthenticationGuard } from '../authentication-guard.js'
import { getAuthenticationFailureText } from '../authentication-messages.js'
import { Button } from '../components/ui/button.js'
import { FormField } from '../components/ui/form-field.js'
import { Input } from '../components/ui/input.js'
import { PasswordInput } from '../components/ui/password-input.js'
import { getFieldErrorText } from '../form-validation.js'
import { habituar } from '../habituar-client.js'
import { useValidatedForm } from '../use-validated-form.js'

export const Route = createFileRoute('/login')({
  component: LoginRoute,
})

const FAILURE_ID = 'login-failure'

/** Tela de entrada: só autentica quem já tem conta. Criar conta é a rota `/register`. */
export function LoginRoute(): ReactElement {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()
  const form = useValidatedForm(loginInputSchema, { email: '', password: '' })

  const email = form.getField('email')
  const password = form.getField('password')

  const submit = form.handleSubmit(() => {
    void actions.login({ email: email.value, password: password.value })
  })

  const guard = getWebAuthenticationGuard(state, '/login')

  // Sessão pronta não pertence mais a esta tela: o destino é decidido pelo guard, em vez
  // de o usuário ficar preso em `/login` lendo uma mensagem de sucesso.
  if (guard.action === 'redirect') return <Navigate to={guard.route} replace />

  const isSubmitting = state.status === 'authenticating'

  return (
    <AuthenticationCard title={t('authentication.login.title')}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-md">
        <p className="text-caption text-text-muted">{t('authentication.login.description')}</p>

        <FormField
          id="login-email"
          label={t('authentication.login.emailLabel')}
          isRequired
          requiredMarkLabel={t('form.requiredMark')}
          error={email.error === undefined ? undefined : getFieldErrorText(email.error, t)}
        >
          {(control) => (
            <Input
              {...control}
              name="email"
              type="email"
              autoComplete="email"
              value={email.value}
              onBlur={email.markVisited}
              onChange={(event) => {
                email.setValue(event.target.value)
              }}
            />
          )}
        </FormField>

        <FormField
          id="login-password"
          label={t('authentication.login.passwordLabel')}
          isRequired
          requiredMarkLabel={t('form.requiredMark')}
          error={password.error === undefined ? undefined : getFieldErrorText(password.error, t)}
          action={
            <Button asChild variant="link" size="inline">
              <Link to="/forgot-password">{t('authentication.login.forgotPassword')}</Link>
            </Button>
          }
        >
          {(control) => (
            <PasswordInput
              {...control}
              name="password"
              autoComplete="current-password"
              value={password.value}
              onBlur={password.markVisited}
              onChange={(event) => {
                password.setValue(event.target.value)
              }}
            />
          )}
        </FormField>

        {state.status === 'failed' && (
          <p id={FAILURE_ID} role="alert" className="text-caption text-danger">
            {getAuthenticationFailureText(state.failure, t)}
          </p>
        )}

        {/* Respiro maior antes da ação: o botão encerra o formulário, não é mais um campo. */}
        <Button type="submit" disabled={isSubmitting} className="mt-sm">
          <SignInIcon />
          {isSubmitting ? t('authentication.login.submitting') : t('authentication.login.submit')}
        </Button>
      </form>

      <p className="mt-xs text-center text-caption text-text-muted">
        {t('authentication.login.noAccount')}{' '}
        <Button asChild variant="link" size="inline">
          <Link to="/register">{t('authentication.register.title')}</Link>
        </Button>
      </p>
    </AuthenticationCard>
  )
}

function SignInIcon(): ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  )
}
