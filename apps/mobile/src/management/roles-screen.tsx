import type { RoleSummary } from '@habituar/react-client/staff-management'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { ListSectionSkeleton } from '../components/skeletons/list-section-skeleton'
import { Skeleton } from '../components/skeletons/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import type { InstitutionSession } from '../session/session-screen'
import { toStaffContext } from './staff-context'
import { FailureNotice, getRoleName } from './staff-feedback'

/**
 * Seção Papéis no app: papéis personalizados e modelos do sistema só pelo nome; o que
 * cada um permite fica no editor, aberto na pilha.
 */
export function RolesScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const roles = habituar.useRoles(toStaffContext(session))

  return (
    <StackPage
      title={t('staff.sections.roles')}
      action={roles.capabilities.canManageRoles ? { icon: 'plus', label: t('staff.roles.new'), onPress: () => { router.push('/professional/management/role/new') } } : undefined}
    >
      {roles.state.status === 'loading' && (
        <Skeleton>
          <ListSectionSkeleton hasTitle rows={2} row={{ hasDescription: false }} />
          <ListSectionSkeleton hasTitle rows={4} row={{ hasDescription: false }} />
        </Skeleton>
      )}
      {roles.state.status === 'failed' && <FailureNotice failure={roles.state.failure} onRetry={roles.retry} actionLabel={t('staff.retry')} />}
      {roles.state.status === 'ready' && (
        <>
          <ListSection title={t('staff.roles.customTitle')}>
            {roles.state.custom.length === 0
              ? <EmptyState title={t('staff.roles.customEmptyTitle')} description={t('staff.roles.customEmptyDescription')} />
              : roles.state.custom.map((summary) => <RoleRow key={summary.role.id} summary={summary} />)}
          </ListSection>
          <ListSection title={t('staff.roles.templatesTitle')}>
            {roles.state.templates.map((summary) => <RoleRow key={summary.role.id} summary={summary} />)}
          </ListSection>
        </>
      )}
    </StackPage>
  )
}

function RoleRow({ summary }: Readonly<{ summary: RoleSummary }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const { role } = summary
  const name = getRoleName(role, t)
  return (
    <ListRow
      title={name}
      accessibilityLabel={t('staff.roles.open', { name })}
      onPress={() => { router.push({ pathname: '/professional/management/role/[role-id]', params: { 'role-id': role.id } }) }}
    />
  )
}
