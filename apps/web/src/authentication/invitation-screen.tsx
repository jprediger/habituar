import { Navigate } from '@tanstack/react-router'
import { useLoginForm } from '@habituar/react-client/login-form'
import { useInvitationAcceptance } from '@habituar/react-client/invitation-acceptance'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { CenteredPage } from '../components/ui/centered-page.js'
import { FormField } from '../components/ui/form-field.js'
import { Input } from '../components/ui/input.js'
import { PasswordInput } from '../components/ui/password-input.js'
import { getDestinationPath } from './authentication-guard.js'
import { getFieldErrorText } from './form-messages.js'

/** Aceite web de uma credencial de convite sem mostrar dados de outro tenant. */
export function InvitationScreen({ token }: Readonly<{ token: string }>): ReactElement {
  const { t } = useTranslation()
  const authentication = habituar.useAuthentication()
  const login = useLoginForm(authentication)
  const loginEmail = login.getField('email')
  const loginPassword = login.getField('password')
  const invitation = habituar.useInvitation(token)
  const preview = invitation.preview
  const acceptance = useInvitationAcceptance({
    token,
    authentication: authentication.state,
    invitation: { hasAccount: preview?.hasAccount ?? false, accept: invitation.accept, acceptWithRegistration: invitation.acceptWithRegistration },
  })
  if (acceptance.isDone && authentication.state.status === 'authenticated') {
    return <Navigate to={getDestinationPath(authentication.state.session.destination)} replace />
  }
  return <CenteredPage title={t('invitation.title')}>
    {invitation.isLoading && <p role="status">{t('authentication.loading')}</p>}
    {invitation.error && <p role="alert">{t('invitation.unavailable')}</p>}
    {preview && <div className="flex flex-col gap-md">
      <p>{t('invitation.from', { institution: preview.institution.name, email: preview.email })}</p>
      {preview.state.status !== 'pending' ? <p role="status">{t(`invitation.status.${preview.state.status}`)}</p> : <>
        {preview.hasAccount && !acceptance.isSignedIn ? <form className="flex flex-col gap-md" onSubmit={(event) => { event.preventDefault(); login.submit() }}>
          <p>{t('invitation.signInFirst')}</p>
          <FormField id="invitation-login-email" label={t('authentication.login.emailLabel')} isRequired requiredMarkLabel={t('form.requiredMark')} error={loginEmail.error === undefined ? undefined : getFieldErrorText(loginEmail.error, t)}>
            {(control) => <Input {...control} type="email" autoComplete="email" value={loginEmail.value} onBlur={loginEmail.markVisited} onChange={(event) => { loginEmail.setValue(event.target.value) }} />}
          </FormField>
          <FormField id="invitation-login-password" label={t('authentication.login.passwordLabel')} isRequired requiredMarkLabel={t('form.requiredMark')} error={loginPassword.error === undefined ? undefined : getFieldErrorText(loginPassword.error, t)}>
            {(control) => <PasswordInput {...control} autoComplete="current-password" value={loginPassword.value} onBlur={loginPassword.markVisited} onChange={(event) => { loginPassword.setValue(event.target.value) }} />}
          </FormField>
          {login.failure && <p role="alert">{t('invitation.signInError')}</p>}
          <Button type="submit" disabled={login.isSubmitting}>{t('authentication.login.submit')}</Button>
        </form> : <form className="flex flex-col gap-md" onSubmit={(event) => { event.preventDefault(); void acceptance.submit() }}>
          {!preview.hasAccount && <>
            <FormField id="invitation-register-name" label={t('authentication.register.nameLabel')} isRequired requiredMarkLabel={t('form.requiredMark')}>
              {(control) => <Input {...control} autoComplete="name" value={acceptance.name} onChange={(event) => { acceptance.setName(event.target.value) }} />}
            </FormField>
            <FormField id="invitation-register-password" label={t('authentication.register.passwordLabel')} isRequired requiredMarkLabel={t('form.requiredMark')}>
              {(control) => <PasswordInput {...control} autoComplete="new-password" minLength={8} value={acceptance.password} onChange={(event) => { acceptance.setPassword(event.target.value) }} />}
            </FormField>
          </>}
          {acceptance.failure && <p role="alert">{acceptance.failure === 'invalid-registration' ? t('invitation.invalidRegistration') : t('invitation.acceptError')}</p>}
          <Button type="submit" disabled={acceptance.isSubmitting}>{preview.hasAccount ? t('invitation.accept') : t('invitation.createAndAccept')}</Button>
        </form>}
      </>}
    </div>}
  </CenteredPage>
}
