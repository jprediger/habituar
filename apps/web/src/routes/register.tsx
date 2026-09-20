import { assertNever } from '@habituar/core/assert-never'
import { registerInputSchema } from '@habituar/core/auth/schema'
import { Link, Navigate, createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthenticationCard } from '../authentication-card.js'
import { getWebAuthenticationGuard } from '../authentication-guard.js'
import { Button } from '../components/ui/button.js'
import { FormField } from '../components/ui/form-field.js'
import { Input } from '../components/ui/input.js'
import { PasswordInput } from '../components/ui/password-input.js'
import { getFieldErrorText } from '../form-validation.js'
import { habituar } from '../habituar-client.js'
import { useValidatedForm } from '../use-validated-form.js'

export const Route = createFileRoute('/register')({
  component: RegisterRoute,
})

const FAILURE_ID = 'register-failure'
const MINIMUM_PASSWORD_LENGTH = 8

// Falhas que o cadastro sabe explicar. Qualquer outra vira `network`: mensagem de erro do
// servidor não chega ao usuário, e o union fechado evita texto genérico por omissão.
type RegisterFailure = 'conflict' | 'network'

type RegisterUiState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'submitting' }>
  | Readonly<{ status: 'succeeded' }>
  | Readonly<{ status: 'failed'; failure: RegisterFailure }>

function toRegisterFailure(error: unknown): RegisterFailure {
  if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'conflict') {
    return 'conflict'
  }

  return 'network'
}

function getRegisterFailureText(
  failure: RegisterFailure,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (failure) {
    case 'conflict':
      return t('authentication.failure.conflict')
    case 'network':
      return t('authentication.failure.network')
    default:
      return assertNever(failure)
  }
}

/**
 * Tela de criação de conta. Registro não emite sessão (ver `auth.contract.ts`), por isso
 * ela tem estado próprio e termina convidando a entrar, nunca autenticando sozinha.
 */
export function RegisterRoute(): ReactElement {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()
  const [registerState, setRegisterState] = useState<RegisterUiState>({ status: 'idle' })
  const form = useValidatedForm(registerInputSchema, { name: '', email: '', password: '' })

  const name = form.getField('name')
  const email = form.getField('email')
  const password = form.getField('password')

  const submit = form.handleSubmit(() => {
    setRegisterState({ status: 'submitting' })

    actions
      .register({ name: name.value, email: email.value, password: password.value })
      .then(() => {
        setRegisterState({ status: 'succeeded' })
      })
      .catch((error: unknown) => {
        setRegisterState({ status: 'failed', failure: toRegisterFailure(error) })
      })
  })

  const guard = getWebAuthenticationGuard(state, '/register')

  if (guard.action === 'block') {
    return (
      <AuthenticationCard title={t('authentication.register.title')}>
        <p role="status" aria-live="polite" className="text-body">
          {t('authentication.loading')}
        </p>
      </AuthenticationCard>
    )
  }

  if (guard.action === 'redirect') return <Navigate to={guard.route} replace />

  const isSubmitting = registerState.status === 'submitting'

  return (
    <AuthenticationCard title={t('authentication.register.title')}>
      {registerState.status === 'succeeded' ? (
        <div className="flex flex-col gap-sm">
          <p role="status" aria-live="polite" className="text-body">
            {t('authentication.register.success')}
          </p>
          <Button asChild>
            <Link to="/login">{t('authentication.login.title')}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-md">
          <p className="text-caption text-text-muted">{t('authentication.register.description')}</p>

          <FormField
            id="register-name"
            label={t('authentication.register.nameLabel')}
            isRequired
            requiredMarkLabel={t('form.requiredMark')}
            error={name.error === undefined ? undefined : getFieldErrorText(name.error, t)}
          >
            {(control) => (
              <Input
                {...control}
                name="name"
                type="text"
                autoComplete="name"
                value={name.value}
                onBlur={name.markVisited}
                onChange={(event) => {
                  name.setValue(event.target.value)
                }}
              />
            )}
          </FormField>

          <FormField
            id="register-email"
            label={t('authentication.register.emailLabel')}
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
            id="register-password"
            label={t('authentication.register.passwordLabel')}
            isRequired
            requiredMarkLabel={t('form.requiredMark')}
            hint={t('authentication.register.passwordHint', { minimum: MINIMUM_PASSWORD_LENGTH })}
            error={password.error === undefined ? undefined : getFieldErrorText(password.error, t)}
          >
            {(control) => (
              <PasswordInput
                {...control}
                name="password"
                autoComplete="new-password"
                value={password.value}
                onBlur={password.markVisited}
                onChange={(event) => {
                  password.setValue(event.target.value)
                }}
              />
            )}
          </FormField>

          {registerState.status === 'failed' && (
            <p id={FAILURE_ID} role="alert" className="text-caption text-danger">
              {getRegisterFailureText(registerState.failure, t)}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('authentication.register.submitting') : t('authentication.register.submit')}
          </Button>
        </form>
      )}

      <p className="mt-xs text-center text-caption text-text-muted">
        {t('authentication.register.haveAccount')}{' '}
        <Button asChild variant="link" size="inline">
          <Link to="/login">{t('authentication.login.title')}</Link>
        </Button>
      </p>
    </AuthenticationCard>
  )
}
