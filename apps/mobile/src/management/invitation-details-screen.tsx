import type { InvitationId } from '@habituar/core/identity/ids'
import type { InvitationItem, InvitationOperation, InvitationsView } from '@habituar/react-client/staff-management'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { ListSectionSkeleton } from '../components/skeletons/list-section-skeleton'
import { Skeleton } from '../components/skeletons/skeleton'
import { Button } from '../components/ui/button'
import { ConfirmationSheet } from '../components/ui/confirmation-sheet'
import { EmptyState } from '../components/ui/empty-state'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'
import { toStaffContext } from './staff-context'
import { FailureNotice, ResultAnnouncement, formatDay, getRoleName } from './staff-feedback'

/** Detalhe de um convite, com os mesmos dados e operações da lista. */
export function InvitationDetailsScreen({ session, invitationId }: Readonly<{ session: InstitutionSession; invitationId: InvitationId }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const showToast = useToast()
  const invitations = habituar.useInvitations(toStaffContext(session))
  const { state, operation } = invitations
  const item = state.status === 'ready' ? state.items.find((candidate) => candidate.invitation.id === invitationId) : undefined
  const itemKey = item === undefined ? '' : `${invitationId}:${item.invitation.state.status}`
  const [cached, setCached] = useState<Readonly<{ key: string; id: InvitationId; item: InvitationItem }> | undefined>(undefined)
  if (item !== undefined && cached?.key !== itemKey) setCached({ key: itemKey, id: invitationId, item })
  const currentItem = item ?? (cached?.id === invitationId ? cached.item : undefined)
  const invitation = currentItem?.invitation
  const isTarget = isInvitationOperation(operation) && operation.invitationId === invitationId
  const hasResentResult = operation.status === 'resent' && operation.email === invitation?.email

  const finish = (outcome: InvitationOperation | undefined) => {
    if (outcome?.status === 'revoked') {
      showToast({ type: 'success', title: t('toast.invitation.revoked.title'), subtitle: t('toast.invitation.revoked.description', { email: outcome.email }) })
      invitations.cancel()
      router.back()
    }
  }

  return (
    <StackPage title={t('staff.invitations.detailsTitle')}>
      {state.status === 'loading' && <Skeleton><ListSectionSkeleton hasTitle rows={4} /></Skeleton>}
      {state.status === 'failed' && <FailureNotice failure={state.failure} onRetry={invitations.retry} actionLabel={t('staff.retry')} />}
      {state.status !== 'loading' && state.status !== 'failed' && invitation === undefined && (
        <EmptyState title={t('staff.invitations.notFoundTitle')} description={t('staff.invitations.notFoundDescription')} />
      )}

      {invitation !== undefined && currentItem !== undefined && (
        <>
          <Text accessibilityRole="header" size="title" weight="bold">{invitation.email}</Text>
          <ListSection title={t('staff.invitations.detailsSection')}>
            <ListRow title={t('staff.invitations.statusFilter')} value={t(`staff.invitations.status.${invitation.state.status}`)} />
            <ListRow title={t('staff.invitations.environment')} value={t(`staff.environments.${invitation.environment}`)} />
            <ListRow title={t('staff.invitations.roles')} description={currentItem.roles.map((role) => getRoleName(role, t)).join(', ')} />
            <ListRow title={t('staff.invitations.sentAt')} value={formatDay(invitation.createdAt)} />
            <ListRow title={t('staff.invitations.expiresAtLabel')} value={formatDay(invitation.expiresAt)} />
          </ListSection>

          {operation.status === 'failed' && <FailureNotice failure={operation.failure} />}
          {operation.status === 'resent' && operation.email === invitation.email && (
            <ResultAnnouncement>
              <Text>{t('staff.invitations.resent', { email: operation.email })}</Text>
              <Text size="caption" tone="muted">{t('staff.invitations.oneTimeWarning')}</Text>
              <Text selectable>{operation.inviteUrl}</Text>
            </ResultAnnouncement>
          )}

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

          {!isTarget && !hasResentResult && (
            invitations.capabilities.canInvite && invitation.state.status !== 'accepted'
            || invitations.capabilities.canRevokeInvitations && invitation.state.status === 'pending'
          ) && (
            <View style={styles.actions}>
              {invitations.capabilities.canInvite && invitation.state.status !== 'accepted' && (
                <Button
                  variant="outline"
                  icon="envelope-simple"
                  label={t('staff.invitations.resendAction')}
                  accessibilityLabel={t('staff.invitations.resend', { email: invitation.email })}
                  onPress={() => { invitations.requestResend(invitation.id) }}
                />
              )}
              {invitations.capabilities.canRevokeInvitations && invitation.state.status === 'pending' && (
                <Button
                  variant="dangerOutline"
                  icon="trash"
                  label={t('staff.invitations.revokeAction')}
                  accessibilityLabel={t('staff.invitations.revoke', { email: invitation.email })}
                  onPress={() => { invitations.requestRevocation(invitation.id) }}
                />
              )}
            </View>
          )}
        </>
      )}
    </StackPage>
  )
}

function isInvitationOperation(operation: InvitationsView['operation']): operation is Extract<InvitationOperation, { invitationId: InvitationId }> {
  return 'invitationId' in operation
}

const styles = StyleSheet.create({
  actions: { gap: SPACING.sm },
})
