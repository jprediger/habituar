import type { InvitationItem, InvitationsView, StaffManagementContext } from '@habituar/react-client/staff-management'
import { useId } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { Section } from '../components/ui/section.js'
import { InvitationForm, OneTimeLink } from './invitation-form.js'
import { ConfirmationPanel, FailureNotice, PaginationControls, ResultAnnouncement, StaffListStatus, formatDay, getRoleName } from './staff-feedback.js'

const SELECT_CLASS = 'min-h-tap-target rounded-field border border-border bg-surface px-sm text-body text-text'

/**
 * Seção Convites: formulário de convite para quem pode convidar, lista por situação,
 * reenvio e revogação confirmados. Mesma seção na instituição e na plataforma.
 */
export function InvitationsPanel({ context }: Readonly<{ context: StaffManagementContext }>): ReactElement {
  const { t } = useTranslation()
  const invitations = habituar.useInvitations(context)
  const filterId = useId()
  const { operation } = invitations

  return (
    <div className="flex flex-col gap-xxl">
      {invitations.capabilities.canInvite && (
        <Section title={t('staff.invitations.new')}>
          <InvitationForm context={context} />
        </Section>
      )}

      <Section title={t('staff.sections.invitations')}>
        <div className="flex flex-col gap-xs">
          <label htmlFor={filterId} className="text-body font-medium">{t('staff.invitations.statusFilter')}</label>
          <select id={filterId} className={SELECT_CLASS} value={invitations.statusFilter} onChange={(event) => { invitations.setStatusFilter(event.target.value) }}>
            <option value="all">{t('staff.invitations.allStatuses')}</option>
            <option value="pending">{t('staff.invitations.status.pending')}</option>
            <option value="accepted">{t('staff.invitations.status.accepted')}</option>
            <option value="revoked">{t('staff.invitations.status.revoked')}</option>
            <option value="expired">{t('staff.invitations.status.expired')}</option>
          </select>
        </div>

        {operation.status === 'failed' && <FailureNotice failure={operation.failure} />}
        {operation.status === 'revoked' && <ResultAnnouncement>{t('staff.invitations.revoked', { email: operation.email })}</ResultAnnouncement>}
        {operation.status === 'resent' && (
          <ResultAnnouncement>
            <p>{t('staff.invitations.resent', { email: operation.email })}</p>
            <OneTimeLink url={operation.inviteUrl} />
          </ResultAnnouncement>
        )}

        <StaffListStatus
          state={invitations.state}
          onRetry={invitations.retry}
          empty={{ title: t('staff.invitations.emptyTitle'), description: t('staff.invitations.emptyDescription') }}
          noResults={{ title: t('staff.invitations.noResultsTitle'), description: t('staff.invitations.noResultsDescription') }}
        />

        {invitations.state.status === 'ready' && (
          <>
            <ul aria-label={t('staff.invitations.listLabel')} className="flex flex-col gap-sm">
              {invitations.state.items.map((item) => (
                <InvitationRow key={item.invitation.id} item={item} invitations={invitations} />
              ))}
            </ul>
            <PaginationControls pagination={invitations.pagination} page={invitations.state.page} pageCount={invitations.state.pageCount} />
          </>
        )}
      </Section>
    </div>
  )
}

function InvitationRow({ item, invitations }: Readonly<{ item: InvitationItem; invitations: InvitationsView }>): ReactElement {
  const { t } = useTranslation()
  const { invitation } = item
  const { operation } = invitations
  const isTarget = 'invitationId' in operation && operation.invitationId === invitation.id
  const isPending = invitation.state.status === 'pending'

  return (
    <li className="flex flex-col gap-sm rounded-field border border-hairline px-lg py-md">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <span className="break-all font-medium">{invitation.email}</span>
        <span className="text-caption font-medium uppercase tracking-widest text-text-muted">{t(`staff.invitations.status.${invitation.state.status}`)}</span>
      </div>
      <p className="text-caption text-text-muted">
        {t(`staff.environments.${invitation.environment}`)}
        {' · '}
        {t('staff.invitations.roleSummary', { roles: item.roles.map((role) => getRoleName(role, t)).join(', ') })}
        {' · '}
        {t('staff.invitations.expiresAt', { date: formatDay(invitation.expiresAt) })}
      </p>

      {isTarget && (operation.status === 'confirming-revocation' || operation.status === 'revoking') && (
        <ConfirmationPanel
          message={t('staff.invitations.revokeConfirmation', { email: invitation.email })}
          confirmLabel={t('staff.invitations.confirmRevoke')}
          cancelLabel={t('staff.cancel')}
          isBusy={operation.status === 'revoking'}
          onConfirm={() => { void invitations.confirm() }}
          onCancel={invitations.cancel}
        />
      )}
      {isTarget && (operation.status === 'confirming-resend' || operation.status === 'resending') && (
        <ConfirmationPanel
          message={t('staff.invitations.resendConfirmation', { email: invitation.email })}
          confirmLabel={t('staff.invitations.confirmResend')}
          cancelLabel={t('staff.cancel')}
          isBusy={operation.status === 'resending'}
          onConfirm={() => { void invitations.confirm() }}
          onCancel={invitations.cancel}
        />
      )}

      {!isTarget && (
        <div className="flex flex-wrap gap-sm">
          {invitations.capabilities.canInvite && invitation.state.status !== 'accepted' && (
            <Button type="button" variant="outline" size="sm" onClick={() => { invitations.requestResend(invitation.id) }}>
              {t('staff.invitations.resend', { email: invitation.email })}
            </Button>
          )}
          {invitations.capabilities.canRevokeInvitations && isPending && (
            <Button type="button" variant="outline" size="sm" onClick={() => { invitations.requestRevocation(invitation.id) }}>
              {t('staff.invitations.revoke', { email: invitation.email })}
            </Button>
          )}
        </div>
      )}
    </li>
  )
}
