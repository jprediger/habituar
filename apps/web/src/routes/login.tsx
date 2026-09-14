import { createFileRoute } from '@tanstack/react-router'
import type { FormEvent, ReactElement } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button.js'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.js'
import { habituar } from '../habituar-client.js'
import { assertNever } from '@habituar/core/assert-never'
import type { HomeDestination } from '@habituar/core/home-destination'

export const Route = createFileRoute('/login')({
  component: LoginRoute,
})

type Mode = 'login' | 'register'
type RegisterUiState = { status: 'idle' } | { status: 'succeeded' } | { status: 'failed'; code: string }

type TFunction = ReturnType<typeof useTranslation>['t']

function failureText(code: string, t: TFunction): string {
  switch (code) {
    case 'invalid-credentials': return t('authentication.failure.invalid-credentials')
    case 'network': return t('authentication.failure.network')
    case 'conflict': return t('authentication.failure.conflict')
    case 'no-memberships': return t('authentication.failure.no-memberships')
    case 'forbidden': return t('authentication.failure.forbidden')
    default: return t('authentication.failure.network')
  }
}

function modeTitle(mode: Mode, t: TFunction): string {
  return mode === 'login' ? t('authentication.login.title') : t('authentication.register.title')
}

function modeDescription(mode: Mode, t: TFunction): string {
  return mode === 'login' ? t('authentication.login.description') : t('authentication.register.description')
}

function modeEmailLabel(mode: Mode, t: TFunction): string {
  return mode === 'login' ? t('authentication.login.emailLabel') : t('authentication.register.emailLabel')
}

function modePasswordLabel(mode: Mode, t: TFunction): string {
  return mode === 'login' ? t('authentication.login.passwordLabel') : t('authentication.register.passwordLabel')
}

function modeSubmit(mode: Mode, t: TFunction): string {
  return mode === 'login' ? t('authentication.login.submit') : t('authentication.register.submit')
}

export function LoginRoute(): ReactElement {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [registerState, setRegisterState] = useState<RegisterUiState>({ status: 'idle' })

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    if (mode === 'login') {
      void actions.login({ email, password })
      return
    }

    setRegisterState({ status: 'idle' })
    actions
      .register({ email, password, name })
      .then(() => {
        setRegisterState({ status: 'succeeded' })
      })
      .catch((error: unknown) => {
        const code =
          error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
            ? error.code
            : 'network'
        setRegisterState({ status: 'failed', code })
      })
  }

  const isSubmitting = mode === 'login' && state.status === 'authenticating'
  const isLoginTerminal =
    mode === 'login' && (state.status === 'authenticated' || state.status === 'selecting-membership')

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-lg">
      <div className="flex w-full max-w-[24rem] flex-col gap-md">
        <Card>
          <CardHeader>
            <CardTitle>{modeTitle(mode, t)}</CardTitle>
          </CardHeader>
          <CardContent>
            {mode === 'login' && state.status === 'authenticated' && (
              <p role="status" aria-live="polite" className="text-body">
                {t('authentication.loginSuccess', {
                  destination: destinationText(state.session.destination, t),
                })}
              </p>
            )}
            {mode === 'login' && state.status === 'selecting-membership' && (
              <p role="status" aria-live="polite" className="text-body">
                {t('authentication.selection.title')}
              </p>
            )}

            {!isLoginTerminal && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-sm">
                <p className="text-caption text-text-muted">{modeDescription(mode, t)}</p>

                {mode === 'register' && (
                  <label className="flex flex-col gap-xs text-body">
                    {t('authentication.register.nameLabel')}
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => { setName(event.target.value); }}
                      required
                      className="rounded-md border border-border bg-surface p-xs text-text"
                    />
                  </label>
                )}
                <label className="flex flex-col gap-xs text-body">
                  {modeEmailLabel(mode, t)}
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => { setEmail(event.target.value); }}
                    required
                    className="rounded-md border border-border bg-surface p-xs text-text"
                  />
                </label>
                <label className="flex flex-col gap-xs text-body">
                  {modePasswordLabel(mode, t)}
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => { setPassword(event.target.value); }}
                    required
                    minLength={mode === 'register' ? 8 : undefined}
                    className="rounded-md border border-border bg-surface p-xs text-text"
                  />
                </label>

                {mode === 'login' && state.status === 'failed' && (
                  <p role="alert" className="text-caption text-danger">
                    {failureText(state.failure, t)}
                  </p>
                )}
                {mode === 'register' && registerState.status === 'failed' && (
                  <p role="alert" className="text-caption text-danger">
                    {failureText(registerState.code, t)}
                  </p>
                )}
                {mode === 'register' && registerState.status === 'succeeded' && (
                  <p role="status" aria-live="polite" className="text-caption text-text-muted">
                    {t('authentication.register.success')}
                  </p>
                )}

                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('authentication.login.submitting') : modeSubmit(mode, t)}
                </Button>
              </form>
            )}

            <Button
              type="button"
              variant="link"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
              }}
            >
              {mode === 'login' ? t('authentication.register.title') : t('authentication.login.title')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )

  function destinationText(destination: HomeDestination, t: TFunction): string {
  switch (destination) {
    case 'student-home': return t('home.student-home.title')
    case 'professional-home': return t('home.professional-home.title')
    case 'monitor-home': return t('home.monitor-home.title')
    default: return assertNever(destination)
  }
}
}