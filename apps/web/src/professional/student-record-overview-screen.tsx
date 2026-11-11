import type { StudentId } from '@habituar/core/identity/ids'
import { parseStudentRecordSearch, resolveStudentRecordNavigation } from '@habituar/react-client/student-record-navigation'
import type { StudentRecordSection } from '@habituar/react-client/student-record-navigation'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { PageHeader } from '../components/ui/page-header.js'
import { Section } from '../components/ui/section.js'
import { LIST_ITEM_INTERACTION } from '../components/ui/list-item.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { StudentManagementSection, StudentRegistrationSection } from '../students/student-detail-screen.js'
import { StudentRecordSections } from './student-record-screen.js'

const LABELS = {
  registration: { title: 'students.record.registration.title', description: 'students.record.sections.registration' },
  profile: { title: 'students.profile.title', description: 'students.record.sections.profile' },
  agenda: { title: 'students.record.agendaTitle', description: 'students.record.sections.agenda' },
  consultations: { title: 'students.consultations.title', description: 'students.record.sections.consultations' },
  history: { title: 'students.history.title', description: 'students.record.sections.history' },
  management: { title: 'students.record.management.title', description: 'students.record.sections.management' },
} as const satisfies Readonly<Record<StudentRecordSection, Readonly<{ title: string; description: string }>>>

/** Ficha única para a lista de acompanhamento e a gestão, com seções conforme as concessões. */
export function StudentRecordOverviewScreen({ studentId }: Readonly<{ studentId: StudentId }>) {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const detail = habituar.useStudentDetail(session.membership.institution.id, studentId)
  const navigate = useNavigate({ from: '/professional/students/$studentId' })
  const { origin, sections, section } = resolveStudentRecordNavigation(session.membership.permissions, useSearch({ strict: false }))
  const selectSection = (section: StudentRecordSection | undefined) => { void navigate({ search: (previous) => parseStudentRecordSearch({ ...previous, section }) }) }
  const student = detail.state.status === 'ready' ? detail.state.student : undefined
  return <div className="flex flex-col gap-xxl">
    <Link to={origin === 'management' ? '/professional/students' : '/professional'} className="self-start text-body text-primary underline">{t(origin === 'management' ? 'students.back' : 'students.record.back')}</Link>
    <PageHeader eyebrow={t('students.record.eyebrow')} title={student?.socialName ?? student?.fullName ?? t('students.record.eyebrow')} description={t('students.record.overviewDescription')} />
    {detail.state.status === 'loading' && <p role="status">{t('students.loading')}</p>}
    {detail.state.status === 'error' && <div role="alert"><p>{t('students.loadError')}</p><Button variant="outline" onClick={() => { void detail.refresh() }}>{t('students.retry')}</Button></div>}
    {student !== undefined && <>
      {student.archivedAt !== null && <p role="status">{t('students.record.archived')}</p>}
      {section === undefined ? <Section title={t('students.record.sectionsTitle')}>
        <ul className="divide-y divide-hairline">{sections.map((key) => <li key={key}>
          <button type="button" className={`${LIST_ITEM_INTERACTION} flex min-h-tap-target w-full items-center justify-between gap-md px-lg py-md text-left`} onClick={() => { selectSection(key) }}>
            <span className="flex flex-col gap-xs"><span className="font-medium">{t(LABELS[key].title)}</span><span className="text-body text-text-muted">{t(LABELS[key].description)}</span></span>
            <ChevronRight aria-hidden className="size-4 shrink-0" />
          </button>
        </li>)}</ul>
      </Section> : <>
        <div><Button variant="outline" onClick={() => { selectSection(undefined) }}>{t('students.record.backToSections')}</Button></div>
        <div key={section}>
          {section === 'registration'
            ? <StudentRegistrationSection studentId={studentId} />
            : section === 'management'
              ? <StudentManagementSection studentId={studentId} />
              : <StudentRecordSections studentId={studentId} section={section} />}
        </div>
      </>}
    </>}
  </div>
}
