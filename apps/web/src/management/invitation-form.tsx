import type { StaffManagementContext } from '@habituar/react-client/staff-management'
import { useId } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { getFieldErrorText } from '../authentication/form-messages.js'
import { Button } from '../components/ui/button.js'
import { FormField } from '../components/ui/form-field.js'
import { Input } from '../components/ui/input.js'
import { FailureNotice, ResultAnnouncement, getRoleName } from './staff-feedback.js'

const SELECT_CLASS = 'min-h-tap-target rounded-field border border-border bg-surface px-sm text-body text-text'

/**
 * Convite de profissional ou monitor: e-mail, tipo de vínculo e papéis que o ator pode
 * conceder. O link de uso único só aparece depois que o servidor criou o convite.
 */
export function InvitationForm({ context }: Readonly<{ context: StaffManagementContext }>): ReactElement {
  const { t } = useTranslation()
  const composer = habituar.useInvitationComposer(context)
  const emailId = useId()
  const environmentId = useId()
  const rolesHintId = useId()
  const rolesErrorId = useId()
  const { submission } = composer

  if (submission.status === 'created') {
    return (
      <div className="flex flex-col gap-md">
        <ResultAnnouncement>
          <p>{t('staff.invitations.created', { email: submission.email })}</p>
          <OneTimeLink url={submission.inviteUrl} />
        </ResultAnnouncement>
        <div><Button type="button" variant="outline" onClick={composer.startAnother}>{t('staff.invitations.another')}</Button></div>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-md"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void composer.submit()
      }}
    >
      <FormField
        id={emailId}
        label={t('staff.invitations.email')}
        isRequired
        requiredMarkLabel={t('form.requiredMark')}
        error={composer.emailError === undefined ? undefined : getFieldErrorText(composer.emailError, t)}
      >
        {(control) => (
          <Input {...control} type="email" autoComplete="off" value={composer.email} onChange={(event) => { composer.setEmail(event.target.value) }} onBlur={composer.leaveEmail} />
        )}
      </FormField>

      <div className="flex flex-col gap-xs">
        <label htmlFor={environmentId} className="text-body font-medium">
          {t('staff.invitations.environment')}
          <span className="text-danger" title={t('form.requiredMark')} aria-hidden="true">{' *'}</span>
        </label>
        <select id={environmentId} required className={SELECT_CLASS} value={composer.environment} onChange={(event) => { composer.setEnvironment(event.target.value) }}>
          <option value="professional">{t('staff.environments.professional')}</option>
          <option value="monitor">{t('staff.environments.monitor')}</option>
        </select>
      </div>

      <fieldset className="flex flex-col gap-sm" aria-describedby={[rolesHintId, composer.roleError === undefined ? '' : rolesErrorId].join(' ').trim()}>
        <legend className="text-body font-medium">
          {t('staff.invitations.roles')}
          <span className="text-danger" title={t('form.requiredMark')} aria-hidden="true">{' *'}</span>
        </legend>
        <p id={rolesHintId} className="text-caption text-text-muted">{t('staff.invitations.rolesHint')}</p>
        {composer.rolesState.status === 'loading' && <p role="status">{t('staff.loading')}</p>}
        {composer.rolesState.status === 'failed' && <FailureNotice failure={composer.rolesState.failure} onRetry={composer.retryRoles} actionLabel={t('staff.retry')} />}
        {composer.rolesState.status === 'ready' && composer.roleOptions.length === 0 && <p>{t('staff.invitations.noRoles')}</p>}
        {composer.roleOptions.map((option) => (
          <label key={option.role.id} className="flex min-h-tap-target items-center gap-sm">
            <input type="checkbox" className="size-5" checked={option.isSelected} onChange={(event) => { composer.setRoleSelected(option.role.id, event.target.checked) }} />
            <span className="flex flex-col">
              <span>{getRoleName(option.role, t)}</span>
              {option.role.templateKey !== null && <span className="text-caption text-text-muted">{t(`roleDescriptions.${option.role.templateKey}`)}</span>}
            </span>
          </label>
        ))}
        {composer.roleError !== undefined && <p id={rolesErrorId} role="alert" className="text-caption text-danger">{t('staff.invitations.chooseRole')}</p>}
      </fieldset>

      {submission.status === 'failed' && <FailureNotice failure={submission.failure} />}

      <div>
        <Button type="submit" disabled={submission.status === 'submitting'}>
          {submission.status === 'submitting' ? t('staff.invitations.creating') : t('staff.invitations.create')}
        </Button>
      </div>
    </form>
  )
}

/** Link de uso único recém-criado, com cópia por botão; ele não volta a aparecer depois. */
export function OneTimeLink({ url }: Readonly<{ url: string }>): ReactElement {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-sm rounded-field border border-border px-lg py-md">
      <p className="text-caption text-text-muted">{t('staff.invitations.oneTimeWarning')}</p>
      <a className="break-all underline" href={url}>{url}</a>
      <div>
        <Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(url) }}>{t('staff.invitations.copy')}</Button>
      </div>
    </div>
  )
}
