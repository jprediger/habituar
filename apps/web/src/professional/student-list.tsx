import { assertNever } from '@habituar/core/assert-never'
import type { StudentSummary } from '@habituar/core/students'
import type { AccessibleStudents } from '@habituar/react-client/react-client'
import { Link } from '@tanstack/react-router'
import { ChevronRight, LockKeyhole, SearchX, UsersRound } from 'lucide-react'
import { useId } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { Input } from '../components/ui/input.js'
import { LIST_ITEM_INTERACTION } from '../components/ui/list-item.js'
import { cn } from '../lib/utils.js'
import { useInstitutionSession } from '../session/institution-session.js'

const ROW = 'flex min-h-tap-target items-center justify-between gap-md border border-hairline px-lg py-sm text-body text-text'

/**
 * Alunos que o alcance da pessoa cobre, com busca por nome. Cada linha leva à ficha só
 * para quem pode lê-la; quem acompanha sem esse acesso vê o aluno e o motivo do bloqueio.
 */
export function StudentList(): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const students = habituar.useAccessibleStudents(session.membership)
  const searchId = useId()

  return (
    <div className="flex flex-col gap-md">
      <form
        role="search"
        className="flex flex-wrap items-end gap-sm"
        onSubmit={(event) => {
          event.preventDefault()
          students.applySearch()
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-xs">
          <label htmlFor={searchId} className="text-body font-medium">{t('students.list.searchLabel')}</label>
          <Input id={searchId} type="search" value={students.searchDraft} onChange={(event) => { students.setSearchDraft(event.target.value) }} />
        </div>
        <Button type="submit">{t('students.list.search')}</Button>
      </form>
      <StudentListContent students={students} />
    </div>
  )
}

function StudentListContent({ students }: Readonly<{ students: AccessibleStudents }>): ReactElement {
  const { t } = useTranslation()
  const { state } = students

  switch (state.status) {
    case 'loading':
      return <p role="status" className="text-body text-text-muted">{t('students.list.loading')}</p>
    case 'failed':
      return state.failure === 'forbidden'
        ? <EmptyState icon={LockKeyhole} title={t('students.list.forbiddenTitle')} description={t('students.list.forbiddenDescription')} />
        : <p role="alert" className="text-body text-danger">{t('students.list.failed')}</p>
    case 'ready':
      if (state.students.length === 0 && students.activeSearch !== '') {
        return (
          <div className="flex flex-col gap-sm">
            <EmptyState icon={SearchX} title={t('students.list.noMatchTitle')} description={t('students.list.noMatchDescription')} />
            <div><Button type="button" variant="outline" onClick={students.clearSearch}>{t('students.list.clearSearch')}</Button></div>
          </div>
        )
      }
      if (state.students.length === 0) {
        return <EmptyState icon={UsersRound} title={t('students.list.emptyTitle')} description={t('students.list.emptyDescription')} />
      }
      return (
        <>
          <ul className="flex flex-col gap-xs">
            {state.students.map((student) => (
              <li key={student.id}>
                {students.canOpenRecord ? <StudentLink student={student} /> : <StudentWithoutRecord student={student} />}
              </li>
            ))}
          </ul>
          {state.pageCount > 1 && (
            <nav aria-label={t('students.list.paginationLabel')} className="flex flex-wrap items-center justify-between gap-sm">
              <Button type="button" variant="outline" disabled={!students.pagination.hasPreviousPage} onClick={students.pagination.goToPreviousPage}>{t('students.list.previousPage')}</Button>
              <p className="text-caption text-text-muted" aria-live="polite">{t('students.list.pageStatus', { page: state.page, pageCount: state.pageCount })}</p>
              <Button type="button" variant="outline" disabled={!students.pagination.hasNextPage} onClick={students.pagination.goToNextPage}>{t('students.list.nextPage')}</Button>
            </nav>
          )}
        </>
      )
    default:
      return assertNever(state)
  }
}

// Nome social, quando existe, é como a pessoa é chamada; o nome civil fica na ficha.
function displayName(student: StudentSummary): string {
  return student.socialName ?? student.fullName
}

function StudentLink({ student }: Readonly<{ student: StudentSummary }>): ReactElement {
  return (
    <Link to="/professional/students/$studentId" params={{ studentId: student.id }} className={cn(LIST_ITEM_INTERACTION, ROW)}>
      <span className="font-medium">{displayName(student)}</span>
      <ChevronRight aria-hidden="true" focusable="false" className="size-4 shrink-0 text-text-muted" />
    </Link>
  )
}

function StudentWithoutRecord({ student }: Readonly<{ student: StudentSummary }>): ReactElement {
  const { t } = useTranslation()
  return (
    <div className={ROW}>
      <span className="font-medium">{displayName(student)}</span>
      <span className="text-caption text-text-muted">{t('students.list.noRecordAccess')}</span>
    </div>
  )
}
