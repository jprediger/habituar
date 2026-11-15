import type { ClassDetail } from '@habituar/core/classes'
import type { MembershipId, StudentId } from '@habituar/core/identity/ids'
import type { ClassCapabilities, ClassHooks } from '@habituar/react-client/class-hooks'
import { Archive, Pencil, RefreshCw, RotateCcw, UserRoundPlus, UsersRound } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/button.js'
import { Section } from '../components/ui/section.js'

type Candidates = ReturnType<ClassHooks['useClassCandidates']>
type Actions = ReturnType<ClassHooks['useClassActions']>
type Confirmation =
  | Readonly<{ kind: 'archive' }>
  | Readonly<{ kind: 'enroll'; studentId: StudentId; name: string }>
  | Readonly<{ kind: 'removeStudent'; studentId: StudentId; name: string }>
  | Readonly<{ kind: 'removeStaff'; membershipId: MembershipId; name: string }>

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
}

/** Gerenciamento de vínculos sem conceder acesso a acompanhamentos individuais. */
export function ClassDetailPanel({ detail, capabilities, candidates, actions, onEdit, onRefresh, onStatusChange }: Readonly<{
  detail: ClassDetail
  capabilities: ClassCapabilities
  candidates: Candidates
  actions: Actions
  onEdit(): void
  onRefresh(): void
  onStatusChange(archived: boolean): void
}>): ReactElement {
  const { t } = useTranslation('classes')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedStaff, setSelectedStaff] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation | undefined>()
  const [failed, setFailed] = useState(false)
  const [success, setSuccess] = useState<string | undefined>()
  const studentId = useId()
  const staffId = useId()
  const activeStudents = detail.enrollments.filter(item => item.leftAt === null)
  const pastStudents = detail.enrollments.filter(item => item.leftAt !== null)
  const activeStaff = detail.staff.filter(item => item.leftAt === null)
  const pastStaff = detail.staff.filter(item => item.leftAt !== null)
  const isArchived = detail.archivedAt !== null

  async function execute(operation: () => Promise<ClassDetail>, message?: string): Promise<void> {
    setFailed(false)
    setSuccess(undefined)
    try {
      await operation()
      setConfirmation(undefined)
      setSelectedStudent('')
      setSelectedStaff('')
      setSuccess(message)
    } catch {
      setFailed(true)
    }
  }

  async function confirm(): Promise<void> {
    const target = confirmation
    if (target === undefined) return
    switch (target.kind) {
      case 'archive':
        await execute(async () => {
          const result = await actions.archive(detail.id, detail.version)
          onStatusChange(true)
          return result
        })
        return
      case 'enroll':
        await execute(() => actions.enrollStudent(detail.id, target.studentId), t('messages.enrolled'))
        return
      case 'removeStudent':
        await execute(() => actions.removeStudent(detail.id, target.studentId), t('messages.studentRemoved'))
        return
      case 'removeStaff':
        await execute(() => actions.removeStaff(detail.id, target.membershipId), t('messages.staffRemoved'))
    }
  }

  const candidateStudent = candidates.students.status === 'ready' ? candidates.students.items.find(item => item.id === selectedStudent) : undefined
  const candidateStaff = candidates.staff.status === 'ready' ? candidates.staff.items.find(item => item.id === selectedStaff) : undefined

  return (
    <div className="flex min-w-0 flex-col gap-xl rounded-field border border-hairline bg-surface p-lg">
      <header className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0 flex-1">
          <p className="text-caption font-medium uppercase tracking-widest text-text-muted">{t(isArchived ? 'archived' : 'active')}</p>
          <h2 className="break-words text-title font-bold text-text">{detail.name}</h2>
          {detail.description !== null && <p className="mt-xs whitespace-pre-wrap text-body text-text-muted">{detail.description}</p>}
          <p className="mt-sm text-caption text-text-muted">{t('membersSummary', { students: detail.studentCount, staff: detail.staffCount })}</p>
        </div>
        <div className="flex flex-wrap gap-sm">
          <Button type="button" variant="outline" size="sm" onClick={onRefresh}><RefreshCw aria-hidden="true" className="size-4" />{t('actions.refresh')}</Button>
          {capabilities.canManage && (
            <>
            {!isArchived && <Button type="button" variant="outline" size="sm" onClick={onEdit}><Pencil aria-hidden="true" className="size-4" />{t('actions.edit')}</Button>}
            {isArchived ? (
              <Button type="button" variant="outline" size="sm" disabled={actions.pending} onClick={() => { void execute(async () => {
                const result = await actions.unarchive(detail.id, detail.version)
                onStatusChange(false)
                return result
              }) }}><RotateCcw aria-hidden="true" className="size-4" />{t('actions.reopen')}</Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => { setConfirmation({ kind: 'archive' }); setFailed(false) }}><Archive aria-hidden="true" className="size-4" />{t('actions.archive')}</Button>
            )}
            </>
          )}
        </div>
      </header>

      {success !== undefined && <p role="status" aria-live="polite" className="text-body text-primary">{success}</p>}
      {failed && <p role="alert" className="text-body text-danger">{t(actions.failure === 'conflict' ? 'errors.conflict' : actions.failure === 'forbidden' ? 'errors.forbidden' : 'errors.save')}</p>}

      {confirmation !== undefined && (
        <div role="group" aria-label={t('confirm.title')} className="flex flex-col gap-md rounded-field border border-primary bg-surface-muted p-md">
          <p className="text-body font-semibold">{t('confirm.title')}</p>
          <p className="text-body text-text-muted">{confirmation.kind === 'archive' ? t('confirm.archive', { name: detail.name }) : confirmation.kind === 'enroll' ? t('confirm.transfer', { name: confirmation.name, className: detail.name }) : confirmation.kind === 'removeStudent' ? t('confirm.removeStudent', { name: confirmation.name }) : t('confirm.removeStaff', { name: confirmation.name })}</p>
          <div className="flex flex-wrap gap-sm">
            <Button type="button" variant="outline" onClick={() => { setConfirmation(undefined); setFailed(false) }} disabled={actions.pending}>{t('actions.cancel')}</Button>
            <Button type="button" onClick={() => { void confirm() }} disabled={actions.pending}>{actions.pending ? t('actions.saving') : t('actions.confirm')}</Button>
          </div>
        </div>
      )}

      <Section title={t('students.title')} description={t('students.description')}>
        {activeStudents.length === 0 ? <p className="text-body text-text-muted">{t('students.empty')}</p> : (
          <ul className="flex flex-col gap-sm">
            {activeStudents.map(item => (
              <li key={item.studentId} className="flex flex-wrap items-center justify-between gap-sm border-b border-hairline pb-sm">
                <div className="min-w-0">
                  <p className="text-body font-medium">{item.name}</p>
                  <p className="text-caption text-text-muted">{t('students.enrolledAt', { date: formatDate(item.enrolledAt) })}</p>
                </div>
                {capabilities.canManage && !isArchived && <Button type="button" variant="outline" size="sm" disabled={actions.pending} onClick={() => { setConfirmation({ kind: 'removeStudent', studentId: item.studentId, name: item.name }); setFailed(false) }}>{t('actions.remove')}</Button>}
              </li>
            ))}
          </ul>
        )}
        {capabilities.canManage && !isArchived && (
          <div className="flex flex-col gap-sm rounded-field bg-surface-muted p-md">
            <label htmlFor={studentId} className="text-body font-medium">{t('students.addLabel')}</label>
            {candidates.students.status === 'unavailable' ? <p className="text-body text-text-muted">{t('students.noPermission')}</p> : candidates.students.status === 'loading' ? <p role="status">{t('loading')}</p> : candidates.students.status === 'failed' ? <p role="alert" className="text-danger">{t('errors.candidates')}</p> : (
              <div className="flex flex-wrap gap-sm">
                <select id={studentId} className="min-h-tap-target min-w-0 flex-1 rounded-field border border-border bg-surface px-sm text-body text-text" value={selectedStudent} onChange={(event) => { setSelectedStudent(event.target.value) }}>
                  <option value="">{t('students.choose')}</option>
                  {candidates.students.items.filter(item => !activeStudents.some(active => active.studentId === item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <Button type="button" disabled={candidateStudent === undefined || actions.pending} onClick={() => { if (candidateStudent !== undefined) setConfirmation({ kind: 'enroll', studentId: candidateStudent.id, name: candidateStudent.name }) }}><UserRoundPlus aria-hidden="true" className="size-4" />{t('students.enroll')}</Button>
              </div>
            )}
            <p className="text-caption text-text-muted">{t('students.transferHint')}</p>
          </div>
        )}
        {pastStudents.length > 0 && <details className="rounded-field border border-hairline p-md"><summary className="cursor-pointer text-body font-medium">{t('students.history', { count: pastStudents.length })}</summary><ul className="mt-sm flex flex-col gap-sm">{pastStudents.map((item, index) => <li key={`${item.studentId}:${item.enrolledAt}:${String(index)}`} className="text-body text-text-muted">{t('students.pastItem', { name: item.name, start: formatDate(item.enrolledAt), end: formatDate(item.leftAt ?? item.enrolledAt) })}</li>)}</ul></details>}
      </Section>

      <Section title={t('staff.title')} description={t('staff.description')}>
        {activeStaff.length === 0 ? <p className="text-body text-text-muted">{t('staff.empty')}</p> : (
          <ul className="flex flex-col gap-sm">
            {activeStaff.map(item => (
              <li key={item.membershipId} className="flex flex-wrap items-center justify-between gap-sm border-b border-hairline pb-sm">
                <div className="min-w-0">
                  <p className="text-body font-medium">{item.name}</p>
                  <p className="text-caption text-text-muted">{t('staff.linkedMeta', { environment: t(`staff.environments.${item.environment}`), date: formatDate(item.linkedAt) })}</p>
                </div>
                {capabilities.canManage && !isArchived && <Button type="button" variant="outline" size="sm" disabled={actions.pending} onClick={() => { setConfirmation({ kind: 'removeStaff', membershipId: item.membershipId, name: item.name }); setFailed(false) }}>{t('actions.remove')}</Button>}
              </li>
            ))}
          </ul>
        )}
        {capabilities.canManage && !isArchived && (
          <div className="flex flex-col gap-sm rounded-field bg-surface-muted p-md">
            <label htmlFor={staffId} className="text-body font-medium">{t('staff.addLabel')}</label>
            {candidates.staff.status === 'unavailable' ? <p className="text-body text-text-muted">{t('staff.noPermission')}</p> : candidates.staff.status === 'loading' ? <p role="status">{t('loading')}</p> : candidates.staff.status === 'failed' ? <p role="alert" className="text-danger">{t('errors.candidates')}</p> : (
              <div className="flex flex-wrap gap-sm">
                <select id={staffId} className="min-h-tap-target min-w-0 flex-1 rounded-field border border-border bg-surface px-sm text-body text-text" value={selectedStaff} onChange={(event) => { setSelectedStaff(event.target.value) }}>
                  <option value="">{t('staff.choose')}</option>
                  {candidates.staff.items.filter(item => !activeStaff.some(active => active.membershipId === item.id)).map(item => <option key={item.id} value={item.id}>{t('staff.option', { name: item.name, environment: t(`staff.environments.${item.environment}`) })}</option>)}
                </select>
                <Button type="button" disabled={candidateStaff === undefined || actions.pending} onClick={() => { if (candidateStaff !== undefined) void execute(() => actions.assignStaff(detail.id, candidateStaff.id), t('messages.staffLinked')) }}><UsersRound aria-hidden="true" className="size-4" />{t('staff.link')}</Button>
              </div>
            )}
          </div>
        )}
        {pastStaff.length > 0 && <details className="rounded-field border border-hairline p-md"><summary className="cursor-pointer text-body font-medium">{t('staff.history', { count: pastStaff.length })}</summary><ul className="mt-sm flex flex-col gap-sm">{pastStaff.map((item, index) => <li key={`${item.membershipId}:${item.linkedAt}:${String(index)}`} className="text-body text-text-muted">{t('staff.pastItem', { name: item.name, start: formatDate(item.linkedAt), end: formatDate(item.leftAt ?? item.linkedAt) })}</li>)}</ul></details>}
      </Section>
    </div>
  )
}
