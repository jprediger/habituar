import { SPACING } from '@habituar/design-tokens/spacing'
import type { RoleSummary, StaffManagementContext } from '@habituar/react-client/staff-management'
import { ROLE_BUNDLE_LABEL_KEYS } from '@habituar/react-client/staff-management'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { Section } from '../components/ui/section'
import { Text } from '../components/ui/text'
import { useThemeTokens } from '../theme/tokens'
import { FailureNotice, getRoleName } from './staff-feedback'

/**
 * Seção Papéis no app: papéis personalizados e modelos do sistema com o resumo do que
 * permitem e de quantas pessoas os usam; criação e edição abrem o editor na pilha.
 */
export function RolesSection({ context }: Readonly<{ context: StaffManagementContext }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const roles = habituar.useRoles(context)

  return (
    <View style={styles.stack}>
      {roles.state.status === 'loading' && <Text accessibilityLiveRegion="polite" tone="muted">{t('staff.loading')}</Text>}
      {roles.state.status === 'failed' && <FailureNotice failure={roles.state.failure} onRetry={roles.retry} actionLabel={t('staff.retry')} />}
      {roles.state.status === 'ready' && (
        <>
          <Section title={t('staff.roles.customTitle')}>
            {roles.capabilities.canManageRoles && (
              <Button icon="add-outline" label={t('staff.roles.new')} onPress={() => { router.push('/professional/management/role/new') }} />
            )}
            {roles.state.custom.length === 0
              ? <EmptyState title={t('staff.roles.customEmptyTitle')} description={t('staff.roles.customEmptyDescription')} />
              : roles.state.custom.map((summary) => <RoleRow key={summary.role.id} summary={summary} />)}
          </Section>
          <Section title={t('staff.roles.templatesTitle')}>
            <Text size="caption" tone="muted">{t('staff.roles.templatesDescription')}</Text>
            {roles.state.templates.map((summary) => <RoleRow key={summary.role.id} summary={summary} />)}
          </Section>
        </>
      )}
    </View>
  )
}

function RoleRow({ summary }: Readonly<{ summary: RoleSummary }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors, radius, minimumTouchTarget } = useThemeTokens()
  const { role } = summary
  const name = getRoleName(role, t)
  const bundles = role.bundles === null
    ? t('staff.roles.notRepresentable')
    : role.bundles.map((selection) => `${t(ROLE_BUNDLE_LABEL_KEYS[selection.bundle])} (${t(`staff.scopes.${selection.scope}`)})`).join(' · ')
  const counts = `${t('staff.roles.activeMembers', { count: role.activeMemberCount })} · ${t('staff.roles.pendingInvitations', { count: role.pendingInvitationCount })}`

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('staff.roles.open', { name })}
      accessibilityHint={`${bundles}. ${counts}`}
      onPress={() => { router.push({ pathname: '/professional/management/role/[role-id]', params: { 'role-id': role.id } }) }}
      style={({ pressed }) => [styles.row, { minHeight: minimumTouchTarget, borderColor: colors.border, borderRadius: radius.field, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text weight="medium">{name}</Text>
      <Text size="caption" tone="muted">{t(`staff.environments.${role.environment}`)}</Text>
      <Text size="caption" tone="muted">{bundles}</Text>
      <Text size="caption" tone="muted">{counts}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.md },
  row: { borderWidth: 1, padding: SPACING.md, gap: SPACING.xs },
})
