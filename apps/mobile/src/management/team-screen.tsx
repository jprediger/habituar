import type { StaffManagementContext } from '@habituar/react-client/staff-management'
import { getMembershipCapabilities } from '@habituar/react-client/staff-management'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { SearchField } from '../components/ui/search-field'
import type { InstitutionSession } from '../session/session-screen'
import { toStaffContext } from './staff-context'
import { PaginationControls, StaffListStatus, getRoleName } from './staff-feedback'

/**
 * Seção Equipe no app: busca no topo e lista paginada de todos os vínculos;
 * tocar numa pessoa abre os papéis dela.
 */
export function TeamScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <StackPage
      title={t('staff.sections.team')}
      action={getMembershipCapabilities(session.membership.permissions).canInvite ? { icon: 'user-plus', label: t('staff.invitations.new'), onPress: () => { router.push('/professional/management/invite') } } : undefined}
    >
      <TeamList context={toStaffContext(session)} />
    </StackPage>
  )
}

function TeamList({ context }: Readonly<{ context: StaffManagementContext }>) {
  const { t } = useTranslation()
  const router = useRouter()
  const team = habituar.useTeam(context)

  return (
    <>
      <SearchField label={t('staff.team.searchLabel')} value={team.searchDraft} onChangeText={team.setSearchDraft} onSubmit={team.applySearch} />

      <StaffListStatus
        state={team.state}
        onRetry={team.retry}
        empty={{ title: t('staff.team.emptyTitle'), description: t('staff.team.emptyDescription') }}
        noResults={{
          title: t('staff.team.noResultsTitle'),
          description: t('staff.team.noResultsDescription'),
          action: <Button variant="outline" label={t('staff.team.clearSearch')} onPress={team.clearSearch} />,
        }}
      />

      {team.state.status === 'ready' && (
        <>
          <ListSection title={t('staff.total', { count: team.state.total })}>
            {team.state.items.map((member) => {
              const summary = `${t(`staff.environments.${member.environment}`)} · ${member.roles.map((role) => getRoleName(role, t)).join(', ')}`
              return (
                <ListRow
                  key={member.id}
                  title={member.user.name}
                  description={`${member.user.email}\n${summary}`}
                  accessibilityLabel={t('staff.team.open', { name: member.user.name })}
                  accessibilityHint={summary}
                  onPress={() => { router.push({ pathname: '/professional/management/member/[membership-id]', params: { 'membership-id': member.id } }) }}
                />
              )
            })}
          </ListSection>
          <PaginationControls pagination={team.pagination} page={team.state.page} pageCount={team.state.pageCount} />
        </>
      )}
    </>
  )
}
