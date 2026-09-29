import type { InvitationItem, InvitationOperation, InvitationsView } from '@habituar/react-client/staff-management'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { Button } from '../components/ui/button'
import { ChoiceList } from '../components/ui/choice-list'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'
import { toStaffContext } from './staff-context'
import { FailureNotice, PaginationControls, ResultAnnouncement, StaffListStatus, formatDay, getRoleName } from './staff-feedback'

/**
 * Seção Convites no app: atalho para convidar, filtro por situação, lista paginada e
 * reenvio ou revogação sempre confirmados.
 */
export function InvitationsScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const invitations = habituar.useInvitations(toStaffContext(session))
  const { operation } = invitations

  return (
    <StackPage
      title={t('staff.sections.invitations')}
      action={invitations.capabilities.canInvite ? { icon: 'user-plus', label: t('staff.invitations.new'), onPress: () => { router.push('/professional/management/invite') } } : undefined}
    >
      <ChoiceList
        label={t('staff.invitations.statusFilter')}
        choices={[
          { value: 'all', label: t('staff.invitations.allStatuses') },
          { value: 'pending', label: t('staff.invitations.status.pending') },
          { value: 'accepted', label: t('staff.invitations.status.accepted') },
          { value: 'revoked', label: t('staff.invitations.status.revoked') },
          { value: 'expired', label: t('staff.invitations.status.expired') },
        ]}
        value={invitations.statusFilter}
        onChange={invitations.setStatusFilter}
      />

      {operation.status === 'failed' && <FailureNotice failure={operation.failure} />}
      {operation.status === 'resent' && (
        <ResultAnnouncement>
          <Text>{t('staff.invitations.resent', { email: operation.email })}</Text>
          <Text size="caption" tone="muted">{t('staff.invitations.oneTimeWarning')}</Text>
          <Text selectable>{operation.inviteUrl}</Text>
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
          <ListSection>
            {invitations.state.items.map((item) => <InvitationRow key={item.invitation.id} item={item} invitations={invitations} />)}
          </ListSection>
          <PaginationControls pagination={invitations.pagination} page={invitations.state.page} pageCount={invitations.state.pageCount} />
        </>
      )}
    </StackPage>
  )
}

function InvitationRow({ item, invitations }: Readonly<{ item: InvitationItem; invitations: InvitationsView }>) {
  const { t } = useTranslation()
  const showToast = useToast()
  // Revogação vira aviso passageiro; o reenvio fica na tela porque traz o link de uso único.
  const finish = (outcome: InvitationOperation | undefined) => {
    if (outcome?.status === 'revoked') showToast(t('staff.invitations.revoked', { email: outcome.email }))
  }
  const { invitation } = item
  const { operation } = invitations
  const isTarget = 'invitationId' in operation && operation.invitationId === invitation.id

  return (
    <ListRow
      title={invitation.email}
      value={t(`staff.invitations.status.${invitation.state.status}`)}
      description={`${t(`staff.environments.${invitation.environment}`)} · ${t('staff.invitations.roleSummary', { roles: item.roles.map((role) => getRoleName(role, t)).join(', ') })} · ${t('staff.invitations.expiresAt', { date: formatDay(invitation.expiresAt) })}`}
    >
      {isTarget && (operation.status === 'confirming-revocation' || operation.status === 'revoking') && (
        <ConfirmationSheet
          title={t('staff.invitations.revokeTitle')}
          confirmVariant="danger"
          message={t('staff.invitations.revokeConfirmation', { email: invitation.email })}
          confirmLabel={t('staff.invitations.confirmRevoke')}
          cancelLabel={t('staff.cancel')}
          isBusy={operation.status === 'revoking'}
          onConfirm={() => { void invitations.confirm().then(finish) }}
          onCancel={invitations.cancel}
        />
      )}
      {isTarget && (operation.status === 'confirming-resend' || operation.status === 'resending') && (
        <ConfirmationSheet
          title={t('staff.invitations.resendTitle')}
          confirmVariant="primary"
          message={t('staff.invitations.resendConfirmation', { email: invitation.email })}
          confirmLabel={t('staff.invitations.confirmResend')}
          cancelLabel={t('staff.cancel')}
          isBusy={operation.status === 'resending'}
          onConfirm={() => { void invitations.confirm().then(finish) }}
          onCancel={invitations.cancel}
        />
      )}
      {!isTarget && invitations.capabilities.canInvite && invitation.state.status !== 'accepted' && (
        <Button variant="outline" label={t('staff.invitations.resend', { email: invitation.email })} onPress={() => { invitations.requestResend(invitation.id) }} />
      )}
      {!isTarget && invitations.capabilities.canRevokeInvitations && invitation.state.status === 'pending' && (
        <Button variant="dangerOutline" label={t('staff.invitations.revoke', { email: invitation.email })} onPress={() => { invitations.requestRevocation(invitation.id) }} />
      )}
    </ListRow>
  )
}
