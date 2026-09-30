import type { InstitutionId, MembershipId, StudentId } from '@habituar/core/identity/ids'
import type { StudentDetail } from '@habituar/core/students'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import type { StaffManagementContext } from '@habituar/react-client/staff-management'
import { useInstitutionSession } from '../session/institution-session.js'

/** Edição atômica do conjunto de profissionais e monitores que acompanham o aluno. */
export function StudentAssignmentsEditor({ student }: Readonly<{ student: StudentDetail }>): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const context: StaffManagementContext = { kind: 'institution', institutionId: session.membership.institution.id, permissions: session.membership.permissions }
  const team = habituar.useTeam(context)
  const actions = habituar.useStudentActions(session.membership.institution.id, student.id)
  const [selected, setSelected] = useState<readonly MembershipId[]>(student.assignments.map((assignment) => assignment.membershipId))
  const [feedback, setFeedback] = useState('')
  const [failed, setFailed] = useState(false)

  async function save(institutionId: InstitutionId, studentId: StudentId): Promise<void> {
    setFailed(false)
    try {
      await actions.replaceAssignments({ institutionId, studentId, membershipIds: selected })
      setFeedback(t('students.assignmentsSaved'))
    } catch { setFailed(true) }
  }

  return <div className="flex flex-col gap-md">
    {team.state.status === 'loading' && <p role="status">{t('students.loadingTeam')}</p>}
    {team.state.status === 'failed' && <p role="alert">{t('students.teamError')}</p>}
    {team.state.status === 'empty' && <p>{t('students.noTeam')}</p>}
    {team.state.status === 'ready' && <>
      <ul className="divide-y divide-hairline">{team.state.items.map((member) => <li key={member.id} className="py-sm">
        <label className="flex min-h-tap-target items-center gap-sm"><input type="checkbox" checked={selected.includes(member.id)} onChange={(event) => { setSelected((current) => event.target.checked ? [...current, member.id] : current.filter((id) => id !== member.id)) }} />
          <span>{t('students.personWithRole', { name: member.user.name, role: t(`students.assignmentEnvironment.${member.environment}`) })}</span></label>
      </li>)}</ul>
      <div className="flex items-center justify-between gap-sm"><Button type="button" variant="outline" disabled={!team.pagination.hasPreviousPage} onClick={team.pagination.goToPreviousPage}>{t('students.previousPage')}</Button><span>{t('students.page', { page: team.state.page })}</span><Button type="button" variant="outline" disabled={!team.pagination.hasNextPage} onClick={team.pagination.goToNextPage}>{t('students.nextPage')}</Button></div>
    </>}
    <Button type="button" disabled={actions.pending} onClick={() => { void save(session.membership.institution.id, student.id) }}>{t('students.saveAssignments')}</Button>
    {feedback && <p role="status">{feedback}</p>}{failed && <p role="alert" className="text-danger">{t('students.actionError')}</p>}
  </div>
}
