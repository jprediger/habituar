import type { StudentId } from '@habituar/core/identity/ids'
import type { StudentDetail } from '@habituar/core/students'
import { Link } from '@tanstack/react-router'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { Input } from '../components/ui/input.js'
import { PageHeader } from '../components/ui/page-header.js'
import { Section } from '../components/ui/section.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { StudentFormScreen } from './student-form-screen.js'
import { formatCalendarDate } from './students-list-screen.js'
import { StudentAssignmentsEditor } from './student-assignments-editor.js'

/** Detalhe cadastral do aluno e ações autorizadas do acompanhamento institucional. */
export function StudentDetailScreen({ studentId }: Readonly<{ studentId: StudentId }>): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const detail = habituar.useStudentDetail(session.membership.institution.id, studentId)
  const [isEditing, setEditing] = useState(false)
  if (detail.state.status === 'loading') return <p role="status">{t('students.loading')}</p>
  if (detail.state.status === 'error') return <div role="alert" className="flex flex-col items-start gap-sm"><p>{t('students.loadError')}</p><Button type="button" variant="outline" onClick={() => { void detail.refresh() }}>{t('students.retry')}</Button></div>
  const student = detail.state.student
  if (isEditing) return <StudentFormScreen student={student} onClose={() => { setEditing(false) }} />
  return <StudentDetails student={student} onEdit={() => { setEditing(true) }} />
}

function StudentDetails({ student, onEdit }: Readonly<{ student: StudentDetail; onEdit: () => void }>): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const actions = habituar.useStudentActions(session.membership.institution.id, student.id)
  const [guardianName, setGuardianName] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianRelationship, setGuardianRelationship] = useState<'mother' | 'father' | 'grandparent' | 'legal-guardian' | 'other'>('mother')
  const [invitationLink, setInvitationLink] = useState('')
  const [studentEmail, setStudentEmail] = useState('')
  const [message, setMessage] = useState('')
  const [failure, setFailure] = useState('')
  const prefix = useId()
  const permissions = session.membership.permissions
  const canUpdate = permissions.some((permission) => permission.key === 'student.update')
  const canLink = permissions.some((permission) => permission.key === 'guardian.link')
  const canUnlink = permissions.some((permission) => permission.key === 'guardian.unlink')
  const canAssign = permissions.some((permission) => permission.key === 'assignment.manage') && permissions.some((permission) => permission.key === 'membership.read')
  const canArchive = permissions.some((permission) => permission.key === 'student.update' && permission.scope === 'institution')

  async function addGuardian(): Promise<void> {
    setFailure('')
    try {
      await actions.addGuardian({ institutionId: session.membership.institution.id, studentId: student.id, guardian: { fullName: guardianName, relationship: guardianRelationship, email: guardianEmail || null, phone: null } })
      setGuardianName(''); setGuardianEmail(''); setMessage(t('students.guardianAdded'))
    } catch { setFailure(t('students.actionError')) }
  }

  async function inviteGuardian(guardianId: StudentDetail['guardians'][number]['id'], email: string): Promise<void> {
    setFailure(''); setInvitationLink('')
    try {
      const invitation = await actions.invite({ institutionId: session.membership.institution.id, studentId: student.id, target: 'guardian', guardianId, email })
      setInvitationLink(invitation.inviteUrl)
    } catch { setFailure(t('students.actionError')) }
  }

  async function downloadDocument(): Promise<void> {
    if (student.institutionalDocumentId === null) return
    setFailure('')
    try {
      const document = await actions.getConsentDocument({ institutionId: session.membership.institution.id, studentId: student.id, consentId: student.institutionalDocumentId })
      const bytes = Uint8Array.from(atob(document.base64), character => character.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: document.mediaType }))
      const link = window.document.createElement('a')
      link.href = url; link.download = document.fileName; link.click()
      window.setTimeout(() => { URL.revokeObjectURL(url) }, 0)
    } catch { setFailure(t('students.documentLoadFailed')) }
  }

  async function inviteStudent(): Promise<void> {
    setFailure(''); setInvitationLink('')
    try {
      const invitation = await actions.invite({ institutionId: session.membership.institution.id, studentId: student.id, target: 'student', guardianId: null, email: studentEmail })
      setInvitationLink(invitation.inviteUrl)
    } catch { setFailure(t('students.actionError')) }
  }

  return <div className="flex flex-col gap-xxl">
    <Link to="/professional/students" className="text-body text-primary underline-offset-4 hover:underline">{t('students.back')}</Link>
    <div className="flex flex-wrap items-end justify-between gap-md"><PageHeader eyebrow={session.membership.institution.name} title={student.socialName ?? student.fullName} description={t('students.detailDescription')} />
      {canUpdate && !student.archivedAt && <Button type="button" variant="outline" onClick={onEdit}>{t('students.edit')}</Button>}
    </div>
    {message && <p role="status" className="text-body text-primary">{message}</p>}
    {(failure || actions.failure) && <p role="alert" className="text-body text-danger">{failure || t('students.actionError')}</p>}
    <Section title={t('students.dataSection')}><dl className="grid gap-md sm:grid-cols-2">
      <div><dt className="text-caption text-text-muted">{t('students.fullName')}</dt><dd>{student.fullName}</dd></div>
      {student.socialName && <div><dt className="text-caption text-text-muted">{t('students.socialName')}</dt><dd>{student.socialName}</dd></div>}
      <div><dt className="text-caption text-text-muted">{t('students.birthDate')}</dt><dd>{formatCalendarDate(student.birthDate)}</dd></div>
      <div><dt className="text-caption text-text-muted">{t('students.ageRangeLabel')}</dt><dd>{t(`students.ageRange.${student.ageRange}`)}</dd></div>
      <div><dt className="text-caption text-text-muted">{t('students.account')}</dt><dd>{t(`students.accountStatus.${student.accountStatus}`)}</dd></div>
      <div><dt className="text-caption text-text-muted">{t('students.consent')}</dt><dd>{t(`students.consentStatus.${student.consentStatus}`)}</dd></div>
      {student.institutionalDocumentId && <div><dt className="text-caption text-text-muted">{t('students.consentDocument')}</dt><dd><button className="text-primary underline" onClick={() => { void downloadDocument() }}>{student.institutionalDocumentName}</button></dd></div>}
    </dl></Section>
    {canLink && student.accountStatus === 'none' && !student.archivedAt && <Section title={t('students.studentAccountSection')} description={t('students.studentAccountHint')}>
      <form className="flex flex-wrap items-end gap-sm" onSubmit={(event) => { event.preventDefault(); void inviteStudent() }}><label htmlFor={`${prefix}-student-email`} className="flex min-w-[15rem] flex-1 flex-col gap-xs">{t('students.studentEmail')}<Input id={`${prefix}-student-email`} type="email" required value={studentEmail} onChange={(event) => { setStudentEmail(event.target.value) }} /></label><Button type="submit" disabled={actions.pending}>{t('students.inviteStudent')}</Button></form>
      {invitationLink && <div role="status"><p>{t('students.invitationLink')}</p><Input readOnly value={invitationLink} aria-label={t('students.invitationLink')} /></div>}
    </Section>}
    <Section title={t('students.guardiansSection')}>
      {student.guardians.length === 0 ? <p className="text-text-muted">{t('students.noGuardians')}</p> : <ul className="divide-y divide-hairline">{student.guardians.map((guardian) => <li key={guardian.id} className="flex flex-wrap items-center justify-between gap-md py-md">
        <div><p className="font-medium">{t('students.personWithRole', { name: guardian.fullName, role: t(`students.relationships.${guardian.relationship}`) })}</p>{canLink && guardian.email && <p className="text-caption text-text-muted">{guardian.email}</p>}</div>
        <div className="flex flex-wrap gap-sm">{canLink && guardian.email && <Button type="button" variant="outline" size="sm" disabled={actions.pending} onClick={() => { void inviteGuardian(guardian.id, guardian.email ?? '') }}>{t('students.invite')}</Button>}
          {canUnlink && <Button type="button" variant="outline" size="sm" disabled={actions.pending} onClick={() => { void actions.removeGuardian({ institutionId: session.membership.institution.id, studentId: student.id, guardianId: guardian.id }).then(() => { setMessage(t('students.guardianRemoved')) }).catch(() => { setFailure(t('students.actionError')) }) }}>{t('students.remove')}</Button>}</div>
      </li>)}</ul>}
      {canLink && !student.archivedAt && <form className="grid gap-sm sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); void addGuardian() }}>
        <label htmlFor={`${prefix}-guardian`}>{t('students.guardianName')}<Input id={`${prefix}-guardian`} required value={guardianName} onChange={(event) => { setGuardianName(event.target.value) }} /></label>
        <label htmlFor={`${prefix}-email`}>{t('students.email')}<Input id={`${prefix}-email`} type="email" value={guardianEmail} onChange={(event) => { setGuardianEmail(event.target.value) }} /></label>
        <label htmlFor={`${prefix}-relationship`}>{t('students.relationship')}<select id={`${prefix}-relationship`} className="block min-h-tap-target w-full rounded-field border border-border bg-surface px-sm" value={guardianRelationship} onChange={(event) => { setGuardianRelationship(event.target.value === 'father' ? 'father' : event.target.value === 'grandparent' ? 'grandparent' : event.target.value === 'legal-guardian' ? 'legal-guardian' : event.target.value === 'other' ? 'other' : 'mother') }}>{(['mother', 'father', 'grandparent', 'legal-guardian', 'other'] as const).map((value) => <option key={value} value={value}>{t(`students.relationships.${value}`)}</option>)}</select></label>
        <Button type="submit" disabled={actions.pending}>{t('students.addGuardian')}</Button>
      </form>}
      {invitationLink && <div role="status"><p>{t('students.invitationLink')}</p><Input readOnly value={invitationLink} aria-label={t('students.invitationLink')} /></div>}
    </Section>
    <Section title={t('students.assignmentsSection')}>
      {student.assignments.length ? <ul>{student.assignments.map((assignment) => <li key={assignment.id} className="border-b border-hairline py-sm">{t('students.personWithRole', { name: assignment.name, role: t(`students.assignmentEnvironment.${assignment.environment}`) })}</li>)}</ul> : <p className="text-text-muted">{t('students.noAssignments')}</p>}
      {canAssign && <StudentAssignmentsEditor student={student} />}
    </Section>
      {canArchive && <Section title={t('students.archiveSection')}><div><Button type="button" variant="outline" disabled={actions.pending} onClick={() => { const operation = student.archivedAt ? actions.unarchive() : actions.archive(); void operation.then(() => { setMessage(t(student.archivedAt ? 'students.unarchived' : 'students.archived')) }).catch(() => { setFailure(t('students.actionError')) }) }}>{t(student.archivedAt ? 'students.unarchive' : 'students.archive')}</Button></div></Section>}
  </div>
}
