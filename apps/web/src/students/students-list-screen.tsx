import { Link } from '@tanstack/react-router'
import { GraduationCap } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { Input } from '../components/ui/input.js'
import { PageHeader } from '../components/ui/page-header.js'
import { useInstitutionSession } from '../session/institution-session.js'

/** Lista paginada de alunos da instituição, com filtros sob alcance do servidor. */
export function StudentsListScreen(): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const students = habituar.useStudentList(session.membership.institution.id)
  const state = students.state
  const [draft, setDraft] = useState(students.search)
  const searchId = useId()
  const canCreate = session.membership.permissions.some((permission) => permission.key === 'student.create')

  return <div className="flex flex-col gap-xxl">
    <div className="flex flex-wrap items-end justify-between gap-md">
      <PageHeader eyebrow={session.membership.institution.name} title={t('students.title')} description={t('students.description')} />
      {canCreate && <Button asChild><Link to="/professional/students/new">{t('students.new')}</Link></Button>}
    </div>
    <form role="search" className="flex flex-wrap items-end gap-sm" onSubmit={(event) => { event.preventDefault(); students.setSearch(draft.trim()) }}>
      <div className="flex min-w-[15rem] flex-1 flex-col gap-xs">
        <label htmlFor={searchId} className="text-body font-medium">{t('students.searchLabel')}</label>
        <Input id={searchId} type="search" value={draft} onChange={(event) => { setDraft(event.target.value) }} />
      </div>
      <Button type="submit">{t('students.search')}</Button>
      <label className="flex min-h-tap-target items-center gap-sm text-body">
        <input type="checkbox" checked={students.archived} onChange={(event) => { students.setArchived(event.target.checked) }} />
        {t('students.showArchived')}
      </label>
    </form>
    {state.status === 'loading' && <p role="status" className="text-text-muted">{t('students.loading')}</p>}
    {state.status === 'error' && <div role="alert" className="flex flex-col items-start gap-sm"><p>{t('students.loadError')}</p><Button type="button" variant="outline" onClick={() => { void students.refresh() }}>{t('students.retry')}</Button></div>}
    {state.status === 'ready' && (state.items.length === 0
      ? <EmptyState icon={GraduationCap} title={students.search ? t('students.noResults') : t('students.empty')} description={t('students.emptyDescription')} />
      : <>
        <p className="text-caption text-text-muted">{t('students.total', { count: state.total })}</p>
        <table className="w-full border-collapse text-left text-body">
          <caption className="sr-only">{t('students.listLabel')}</caption>
          <thead className="hidden md:table-header-group"><tr className="border-b border-hairline text-caption uppercase tracking-widest text-text-muted">
            <th scope="col" className="py-sm pr-md font-medium">{t('students.fullName')}</th>
            <th scope="col" className="py-sm pr-md font-medium">{t('students.birthDate')}</th>
            <th scope="col" className="py-sm font-medium">{t('students.ageRangeLabel')}</th>
          </tr></thead>
          <tbody>{state.items.map((student) => <tr key={student.id} className="flex flex-col gap-xs border-b border-hairline py-md md:table-row">
            <td className="md:py-md md:pr-md"><Link to="/professional/students/$studentId" params={{ studentId: student.id }} className="font-medium text-primary underline-offset-4 hover:underline">{student.socialName ?? student.fullName}</Link>{student.socialName !== null && <span className="block text-caption text-text-muted">{student.fullName}</span>}</td>
            <td className="md:py-md md:pr-md">{formatCalendarDate(student.birthDate)}</td>
            <td className="md:py-md">{t(`students.ageRange.${student.ageRange}`)}</td>
          </tr>)}</tbody>
        </table>
        <nav aria-label={t('students.paginationLabel')} className="flex items-center justify-between gap-sm">
          <Button type="button" variant="outline" disabled={state.page <= 1} onClick={() => { students.setPage(state.page - 1) }}>{t('students.previousPage')}</Button>
          <span aria-live="polite">{t('students.page', { page: state.page })}</span>
          <Button type="button" variant="outline" disabled={state.page * state.pageSize >= state.total} onClick={() => { students.setPage(state.page + 1) }}>{t('students.nextPage')}</Button>
        </nav>
      </>)}
  </div>
}

/** Formata data civil sem deslocamento de fuso. */
export function formatCalendarDate(value: string): string {
  const [year = '', month = '', day = ''] = value.split('-')
  return `${day}/${month}/${year}`
}
