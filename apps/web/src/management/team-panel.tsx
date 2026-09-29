import type { MembershipId } from '@habituar/core/identity/ids'
import type { StaffManagementContext, StaffMemberSummary } from '@habituar/react-client/staff-management'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button.js'
import { Input } from '../components/ui/input.js'
import { habituar } from '../client/habituar-client.js'
import { MemberDialog } from './member-dialog.js'
import { PaginationControls, StaffListStatus, getRoleName } from './staff-feedback.js'

const SELECT_CLASS = 'min-h-tap-target rounded-field border border-border bg-surface px-sm text-body text-text'

/**
 * Seção Equipe: busca, filtro por tipo de vínculo, lista paginada e abertura de um membro
 * em diálogo. Serve à gestão institucional e à plataforma; o contexto decide o transporte.
 */
export function TeamPanel({ context, institutionName }: Readonly<{ context: StaffManagementContext; institutionName: string }>): ReactElement {
  const { t } = useTranslation()
  const team = habituar.useTeam(context)
  // O diálogo fecha sem desmontar: é no fechamento que o Radix devolve o foco a quem o abriu.
  const [dialog, setDialog] = useState<Readonly<{ membershipId: MembershipId; isOpen: boolean }> | undefined>(undefined)
  const searchId = useId()
  const filterId = useId()

  return (
    <div className="flex flex-col gap-lg">
      <form
        role="search"
        className="flex flex-col gap-sm md:flex-row md:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          team.applySearch()
        }}
      >
        <div className="flex flex-1 flex-col gap-xs">
          <label htmlFor={searchId} className="text-body font-medium">{t('staff.team.searchLabel')}</label>
          <Input id={searchId} type="search" value={team.searchDraft} onChange={(event) => { team.setSearchDraft(event.target.value) }} />
        </div>
        <Button type="submit">{t('staff.team.search')}</Button>
        <div className="flex flex-col gap-xs">
          <label htmlFor={filterId} className="text-body font-medium">{t('staff.team.environmentFilter')}</label>
          <select id={filterId} className={SELECT_CLASS} value={team.environmentFilter} onChange={(event) => { team.setEnvironmentFilter(event.target.value) }}>
            <option value="all">{t('staff.team.allEnvironments')}</option>
            <option value="professional">{t('staff.environments.professional')}</option>
            <option value="monitor">{t('staff.environments.monitor')}</option>
          </select>
        </div>
      </form>

      <StaffListStatus
        state={team.state}
        onRetry={team.retry}
        empty={{ title: t('staff.team.emptyTitle'), description: t('staff.team.emptyDescription') }}
        noResults={{
          title: t('staff.team.noResultsTitle'),
          description: t('staff.team.noResultsDescription'),
          action: <div><Button type="button" variant="outline" onClick={team.clearSearch}>{t('staff.team.clearSearch')}</Button></div>,
        }}
      />

      {team.state.status === 'ready' && (
        <>
          <p className="text-caption text-text-muted">{t('staff.total', { count: team.state.total })}</p>
          <MemberList members={team.state.items} onOpen={(membershipId) => { setDialog({ membershipId, isOpen: true }) }} />
          <PaginationControls pagination={team.pagination} page={team.state.page} pageCount={team.state.pageCount} />
        </>
      )}

      {dialog !== undefined && (
        <MemberDialog
          context={context}
          institutionName={institutionName}
          membershipId={dialog.membershipId}
          isOpen={dialog.isOpen}
          onClose={() => { setDialog({ ...dialog, isOpen: false }) }}
        />
      )}
    </div>
  )
}

// Tabela no desktop e cartões empilhados no celular: a mesma lista semântica, só a
// disposição muda, para o leitor de tela ouvir cabeçalhos em qualquer largura.
function MemberList({ members, onOpen }: Readonly<{ members: readonly StaffMemberSummary[]; onOpen: (membershipId: MembershipId) => void }>): ReactElement {
  const { t } = useTranslation()
  return (
    <table className="w-full border-collapse text-left text-body">
      <caption className="sr-only">{t('staff.team.listLabel')}</caption>
      <thead className="hidden md:table-header-group">
        <tr className="border-b border-hairline text-caption uppercase tracking-widest text-text-muted">
          <th scope="col" className="py-sm pr-md font-medium">{t('staff.team.name')}</th>
          <th scope="col" className="py-sm pr-md font-medium">{t('staff.team.environment')}</th>
          <th scope="col" className="py-sm pr-md font-medium">{t('staff.team.roles')}</th>
          <th scope="col" className="py-sm font-medium"><span className="sr-only">{t('staff.team.actions')}</span></th>
        </tr>
      </thead>
      <tbody>
        {members.map((member) => (
          <tr key={member.id} className="flex flex-col gap-xs border-b border-hairline py-md md:table-row">
            <td className="md:py-md md:pr-md">
              <span className="block font-medium">{member.user.name}</span>
              <span className="block break-all text-caption text-text-muted">{member.user.email}</span>
            </td>
            <td className="md:py-md md:pr-md">{t(`staff.environments.${member.environment}`)}</td>
            <td className="md:py-md md:pr-md">{member.roles.map((role) => getRoleName(role, t)).join(', ')}</td>
            <td className="md:py-md md:text-right">
              <Button type="button" variant="outline" size="sm" onClick={() => { onOpen(member.id) }}>
                {t('staff.team.open', { name: member.user.name })}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
