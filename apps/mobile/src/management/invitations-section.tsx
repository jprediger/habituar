import { SPACING } from '@habituar/design-tokens/spacing'
import type { InvitationItem, InvitationsView, StaffManagementContext } from '@habituar/react-client/staff-management'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { ChoiceList } from '../components/ui/choice-list'
import { Text } from '../components/ui/text'
import { ConfirmationPanel, FailureNotice, PaginationControls, ResultAnnouncement, StaffListStatus, formatDay, getRoleName } from './staff-feedback'

/**
 * Seção Convites no app: atalho para convidar, filtro por situação, lista paginada e
 * reenvio ou revogação sempre confirmados.
 */
export function InvitationsSection({ context }: Readonly<{ context: StaffManagementContext }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const invitations = habituar.useInvitations(context)
  const { operation } = invitations

  return (
    <View style={styles.stack}>
      {invitations.capabilities.canInvite && (
        <Button icon="person-add-outline" label={t('staff.invitations.new')} onPress={() => { router.push('/professional/management/invite') }} />
      )}
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
      {operation.status === 'revoked' && <ResultAnnouncement><Text>{t('staff.invitations.revoked', { email: operation.email })}</Text></ResultAnnouncement>}
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
        <View style={styles.stack}>
          {invitations.state.items.map((item) => <InvitationCard key={item.invitation.id} item={item} invitations={invitations} />)}
          <PaginationControls pagination={invitations.pagination} page={invitations.state.page} pageCount={invitations.state.pageCount} />
        </View>
      )}
    </View>
  )
}

function InvitationCard({ item, invitations }: Readonly<{ item: InvitationItem; invitations: InvitationsView }>) {
  const { t } = useTranslation()
  const { invitation } = item
  const { operation } = invitations
  const isTarget = 'invitationId' in operation && operation.invitationId === invitation.id

  return (
    <Card>
      <Text weight="medium">{invitation.email}</Text>
      <Text size="caption" tone="muted">{t(`staff.invitations.status.${invitation.state.status}`)}</Text>
      <Text size="caption" tone="muted">
        {`${t(`staff.environments.${invitation.environment}`)} · ${t('staff.invitations.roleSummary', { roles: item.roles.map((role) => getRoleName(role, t)).join(', ') })} · ${t('staff.invitations.expiresAt', { date: formatDay(invitation.expiresAt) })}`}
      </Text>
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
      {!isTarget && invitations.capabilities.canInvite && invitation.state.status !== 'accepted' && (
        <Button variant="outline" label={t('staff.invitations.resend', { email: invitation.email })} onPress={() => { invitations.requestResend(invitation.id) }} />
      )}
      {!isTarget && invitations.capabilities.canRevokeInvitations && invitation.state.status === 'pending' && (
        <Button variant="outline" label={t('staff.invitations.revoke', { email: invitation.email })} onPress={() => { invitations.requestRevocation(invitation.id) }} />
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.md },
})
