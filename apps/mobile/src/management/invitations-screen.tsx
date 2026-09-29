import type { InvitationsView } from '@habituar/react-client/staff-management'
import { SPACING } from '@habituar/design-tokens/spacing'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { ChoiceList } from '../components/ui/choice-list'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { Text } from '../components/ui/text'
import { useThemeTokens } from '../theme/tokens'
import type { InstitutionSession } from '../session/session-screen'
import { toStaffContext } from './staff-context'
import { PaginationControls, StaffListStatus, formatDay, getRoleName } from './staff-feedback'

/**
 * Histórico de convites: filtro compacto, lista paginada e reenvio ou revogação confirmados.
 */
export function InvitationsScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const invitations = habituar.useInvitations(toStaffContext(session))

  return (
    <StackPage
      title={t('staff.sections.invitations')}
    >
      {invitations.state.status !== 'empty' && (
        <InvitationStatusFilter value={invitations.statusFilter} onChange={invitations.setStatusFilter} />
      )}

      {invitations.state.status === 'empty'
        ? <Text size="caption" tone="muted">{t('staff.invitations.emptyDescription')}</Text>
        : <StaffListStatus
            state={invitations.state}
            onRetry={invitations.retry}
            empty={{ title: t('staff.invitations.emptyTitle'), description: t('staff.invitations.emptyDescription') }}
            noResults={{ title: t('staff.invitations.noResultsTitle'), description: t('staff.invitations.noResultsDescription') }}
          />}

      {invitations.state.status === 'ready' && (
        <>
          <ListSection>
            {invitations.state.items.map(({ invitation, roles }) => {
              const name = invitation.email
              const roleSummary = t('staff.invitations.roleSummary', { roles: roles.map((role) => getRoleName(role, t)).join(', ') })
              return (
                <ListRow
                  key={invitation.id}
                  title={name}
                  value={t(`staff.invitations.status.${invitation.state.status}`)}
                  description={`${t(`staff.environments.${invitation.environment}`)} · ${roleSummary} · ${t('staff.invitations.expiresAt', { date: formatDay(invitation.expiresAt) })}`}
                  accessibilityLabel={t('staff.invitations.open', { email: name })}
                  onPress={() => { router.push({ pathname: '/professional/management/invitation/[invitation-id]', params: { 'invitation-id': invitation.id } }) }}
                />
              )
            })}
          </ListSection>
          <PaginationControls pagination={invitations.pagination} page={invitations.state.page} pageCount={invitations.state.pageCount} />
        </>
      )}
    </StackPage>
  )
}

function InvitationStatusFilter({ value, onChange }: Readonly<{ value: InvitationsView['statusFilter']; onChange: (value: InvitationsView['statusFilter']) => void }>) {
  const { t } = useTranslation()
  const { colors, radius } = useThemeTokens()
  const insets = useSafeAreaInsets()
  const [isOpen, setIsOpen] = useState(false)
  const choices = [
    { value: 'all', label: t('staff.invitations.allStatuses') },
    { value: 'pending', label: t('staff.invitations.status.pending') },
    { value: 'accepted', label: t('staff.invitations.status.accepted') },
    { value: 'revoked', label: t('staff.invitations.status.revoked') },
    { value: 'expired', label: t('staff.invitations.status.expired') },
  ] as const
  const selectedLabel = choices.find((choice) => choice.value === value)?.label ?? t('staff.invitations.allStatuses')

  return (
    <>
      <Button
        variant="outline"
        size="inlineBody"
        label={`${t('staff.invitations.statusFilter')}: ${selectedLabel}`}
        onPress={() => { setIsOpen(true) }}
      />
      <Modal transparent visible={isOpen} animationType="fade" onRequestClose={() => { setIsOpen(false) }}>
        <View style={styles.filterOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('staff.close')}
            style={StyleSheet.absoluteFill}
            onPress={() => { setIsOpen(false) }}
          />
          <View accessibilityViewIsModal style={[styles.filterSheet, { backgroundColor: colors.surface, borderRadius: radius.surface, paddingBottom: SPACING.xl + insets.bottom }]}>
            <Text accessibilityRole="header" size="title" weight="bold">{t('staff.invitations.statusFilter')}</Text>
            <ChoiceList
              label={t('staff.invitations.statusFilter')}
              choices={choices}
              value={value}
              onChange={(nextValue) => { onChange(nextValue); setIsOpen(false) }}
            />
            <Button variant="outline" label={t('staff.close')} onPress={() => { setIsOpen(false) }} />
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  filterOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  filterSheet: { padding: SPACING.xl, gap: SPACING.lg },
})
