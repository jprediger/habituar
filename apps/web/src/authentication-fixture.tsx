import { Navigate } from '@tanstack/react-router'
import { assertNever } from '@habituar/core/assert-never'
import type { HomeDestination } from '@habituar/core/home-destination'
import type { AuthenticationFailure } from '@habituar/react-client/react-client'
import type { FormEvent, ReactElement } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getWebAuthenticationGuard } from './authentication-guard.js'
import { habituar } from './habituar-client.js'
import { Button } from './components/ui/button.js'

/** Renderiza a experiência visual de autenticação sem assumir dados ou transporte da sessão. */
export function AuthenticationFixture(props: Readonly<{ route: '/login' | '/select-institution' | '/student' | '/professional' | '/monitor' }>): ReactElement | null {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()
  const guard = getWebAuthenticationGuard(state, props.route)

  if (guard.action === 'block') return <AuthenticationLoading />
  if (guard.action === 'redirect') return <Navigate to={guard.route} replace />

  switch (state.status) {
    case 'restoring':
    case 'authenticating':
      return <AuthenticationLoading />
    case 'unauthenticated':
      return <LoginScreen />
    case 'selecting-membership':
      return <main className="app-shell"><InstitutionSelectionScreen /></main>
    case 'authenticated':
      return <main className="app-shell"><HomeScreen destination={state.session.destination} /></main>
    case 'failed':
      return state.failure === 'no-memberships'
        ? <main className="app-shell"><FailureScreen failure={state.failure} /></main>
        : <LoginScreen failure={state.failure} />
    default:
      return assertNever(state)
  }
}

function AuthenticationLoading(): ReactElement {
  const { t } = useTranslation()

  return <main className="app-shell" aria-busy="true"><p role="status">{t('authentication.loading')}</p></main>
}

function LoginScreen(props: Readonly<{ failure?: Exclude<AuthenticationFailure, 'no-memberships'> }>): ReactElement {
  const { t } = useTranslation()
  const { actions, state } = habituar.useAuthentication()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const isSubmitting = state.status === 'authenticating'
  const hasFailure = props.failure !== undefined
  const failureId = 'login-failure'

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    void actions.login({ email, password })
  }

  return (
    <main className="auth-layout">
      <section className="auth-content" aria-labelledby="login-title">
        <div className="auth-form">
          <p className="brand-name">Habituar</p>
          <div className="auth-heading">
            <h1 id="login-title">{t('authentication.login.title')}</h1>
            <p>{t('authentication.login.description')}</p>
          </div>
          {hasFailure ? <p id={failureId} className="form-alert" role="alert">{getFailureText(props.failure, t)}</p> : null}
          <form className="auth-fields" onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="email">{t('authentication.login.emailLabel')}</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                aria-describedby={hasFailure ? failureId : undefined}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="password">{t('authentication.login.passwordLabel')}</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                aria-describedby={hasFailure ? failureId : undefined}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button className="w-full" type="submit" disabled={isSubmitting} aria-describedby={isSubmitting ? 'login-progress' : undefined}>
              {isSubmitting ? t('authentication.login.submitting') : t('authentication.login.submit')}
            </Button>
            {isSubmitting ? <p id="login-progress" className="sr-only" role="status">{t('authentication.login.submitting')}</p> : null}
          </form>
          {props.failure === 'network' ? <Button variant="link" onClick={() => actions.retry()}>{t('authentication.retry')}</Button> : null}
        </div>
      </section>
      <InstitutionalPanel />
    </main>
  )
}

function InstitutionalPanel(): ReactElement {
  const { t } = useTranslation()

  return (
    <aside className="institutional-panel" aria-label={t('authentication.panel.label')}>
      <div className="panel-pattern" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <div className="panel-copy">
        <p className="brand-name">Habituar</p>
        <p>{t('authentication.panel.message')}</p>
      </div>
    </aside>
  )
}

function InstitutionSelectionScreen(): ReactElement {
  const { t } = useTranslation()
  const { state, actions } = habituar.useAuthentication()

  if (state.status !== 'selecting-membership') return <AuthenticationLoading />

  return (
    <section className="selection-card" aria-labelledby="selection-title">
      <p className="brand-name">Habituar</p>
      <h1 id="selection-title">{t('authentication.selection.title')}</h1>
      <p className="screen-description">{t('authentication.selection.description')}</p>
      <div className="selection-list">
        {state.context.memberships.map((membership) => (
          <Button key={membership.institution.id} variant="outline" className="selection-option" onClick={() => actions.selectMembership(membership.institution.id)}>
            <span>{membership.institution.name}</span>
            <span>{membership.role.name}</span>
          </Button>
        ))}
      </div>
    </section>
  )
}

function HomeScreen(props: Readonly<{ destination: HomeDestination }>): ReactElement {
  const { t } = useTranslation()
  const { actions, state } = habituar.useAuthentication()
  const isLoggingOut = state.status === 'authenticating'

  return (
    <section className="home-card" aria-labelledby="home-title">
      <p className="brand-name">Habituar</p>
      <h1 id="home-title">{getHomeTitle(props.destination, t)}</h1>
      <p className="screen-description">{getHomeText(props.destination, t)}</p>
      <Button variant="outline" onClick={() => void actions.logout()} disabled={isLoggingOut}>
        {isLoggingOut ? t('authentication.logoutSubmitting') : t('authentication.logout')}
      </Button>
    </section>
  )
}

function FailureScreen(props: Readonly<{ failure: 'no-memberships' }>): ReactElement {
  const { t } = useTranslation()

  return (
    <section className="home-card" aria-labelledby="failure-title">
      <p className="brand-name">Habituar</p>
      <h1 id="failure-title">{t('authentication.failure.no-membershipsTitle')}</h1>
      <p className="screen-description" role="alert">{getFailureText(props.failure, t)}</p>
    </section>
  )
}

function getHomeTitle(destination: HomeDestination, t: ReturnType<typeof useTranslation>['t']): string {
  switch (destination) {
    case 'student-home': return t('home.student-home.title')
    case 'professional-home': return t('home.professional-home.title')
    case 'monitor-home': return t('home.monitor-home.title')
    default: return assertNever(destination)
  }
}

function getHomeText(destination: HomeDestination, t: ReturnType<typeof useTranslation>['t']): string {
  switch (destination) {
    case 'student-home': return t('home.student-home.description')
    case 'professional-home': return t('home.professional-home.description')
    case 'monitor-home': return t('home.monitor-home.description')
    default: return assertNever(destination)
  }
}

function getFailureText(failure: AuthenticationFailure, t: ReturnType<typeof useTranslation>['t']): string {
  switch (failure) {
    case 'invalid-credentials': return t('authentication.failure.invalid-credentials')
    case 'network': return t('authentication.failure.network')
    case 'no-memberships': return t('authentication.failure.no-memberships')
    case 'forbidden': return t('authentication.failure.forbidden')
    default: return assertNever(failure)
  }
}
