import { assertNever } from '@habituar/core/assert-never'
import type { StudentId } from '@habituar/core/identity/ids'
import { STUDENT_CONDITIONS } from '@habituar/core/student-records'
import type { StudentHistoryEntry, StudentProfileRevision, StudentProfileState, StudentRecord } from '@habituar/core/student-records'
import type { StudentDetail } from '@habituar/core/students'
import type { StudentConsultationsState, StudentHistoryState, StudentRecordAccess } from '@habituar/react-client/react-client'
import { useConsultationForm, useObservationForm, useStudentProfileForm } from '@habituar/react-client/student-record-forms'
import type { ConsultationField, StudentProfileForm, StudentProfileTextField } from '@habituar/react-client/student-record-forms'
import { Link } from '@tanstack/react-router'
import { Archive, FileText, History, LockKeyhole, Stethoscope } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { FormField } from '../components/ui/form-field.js'
import { Input } from '../components/ui/input.js'
import { PageHeader } from '../components/ui/page-header.js'
import { Section } from '../components/ui/section.js'
import { Textarea } from '../components/ui/textarea.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { StudentRoutineEditor } from './student-routine-editor.js'

/**
 * Ficha do estudante no ambiente profissional: cadastro para consulta, dados de apoio,
 * edição, consultas realizadas, observações e a linha do tempo. Não decide acesso — mostra o que a API devolveu e oferece edição só
 * como dica de interface, porque a API confere a permissão de novo em cada envio.
 */
export function StudentRecordScreen({ studentId }: Readonly<{ studentId: StudentId }>): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const access = habituar.useStudentRecord(session.membership, studentId)
  const back = <Link to="/professional" className="self-start text-body text-primary underline">{t('students.record.back')}</Link>

  switch (access.record.status) {
    case 'loading':
      return <div className="flex flex-col gap-xl">{back}<p role="status" className="text-body text-text-muted">{t('students.record.loading')}</p></div>
    case 'failed':
      return (
        <div className="flex flex-col gap-xl">
          {back}
          {access.record.failure === 'failed'
            ? <p role="alert" className="text-body text-danger">{t('students.record.failed')}</p>
            : <EmptyState icon={LockKeyhole} title={t(`students.record.${access.record.failure}.title`)} description={t(`students.record.${access.record.failure}.description`)} />}
        </div>
      )
    case 'ready':
      return <StudentRecordView student={access.record.student} record={access.record.record} access={access} back={back} />
    default:
      return assertNever(access.record)
  }
}

function StudentRecordView({ student, record, access, back }: Readonly<{ student: StudentDetail; record: StudentRecord; access: StudentRecordAccess; back: ReactElement }>): ReactElement {
  const { t } = useTranslation()
  const form = useStudentProfileForm({ profile: record.profile, save: access.recordProfile })

  return (
    <div className="flex flex-col gap-xxl">
      {back}
      <PageHeader eyebrow={t('students.record.eyebrow')} title={student.socialName ?? student.fullName} description={t('students.record.description')} />
      {student.archivedAt !== null && <EmptyState icon={Archive} title={t('students.record.archived')} description={t('students.record.registration.description')} />}

      <Section title={t('students.record.registration.title')} description={t('students.record.registration.description')}>
        <StudentRegistration student={student} />
      </Section>

      <Section title={t('students.profile.title')}>
        {form.isEditing
          ? <StudentProfileEditor form={form} />
          : <StudentProfileSummary profile={record.profile} canWrite={access.canWrite} onEdit={form.startEditing} />}
      </Section>

      <Section title={t('routine.title')} description={t('routine.description')}>
        <StudentRoutineEditor studentId={student.id} />
      </Section>

      <Section title={t('students.consultations.title')} description={t('students.consultations.description')}>
        {access.canWrite && <ConsultationComposer record={access.recordConsultation} />}
        <ConsultationList consultations={access.consultations} />
      </Section>

      <Section title={t('students.history.title')} description={t('students.history.description')}>
        {access.canWrite && <ObservationComposer add={access.addObservation} />}
        <StudentHistory history={access.history} />
      </Section>
    </div>
  )
}

// Cadastro é da instituição: aqui só se lê. Contato de responsável só chega a quem pode
// vinculá-lo, então lista vazia também cobre quem não tem esse acesso.
function StudentRegistration({ student }: Readonly<{ student: StudentDetail }>): ReactElement {
  const { t } = useTranslation()
  const item = 'flex flex-col gap-xs rounded-field border border-hairline bg-surface px-lg py-md'

  return (
    <dl className="grid gap-sm sm:grid-cols-2">
      <div className={item}>
        <dt className="text-caption font-medium uppercase tracking-widest text-text-muted">{t('students.record.registration.birthDate')}</dt>
        <dd className="text-body text-text">{formatCalendarDate(student.birthDate)}</dd>
      </div>
      {student.socialName !== null && (
        <div className={item}>
          <dt className="text-caption font-medium uppercase tracking-widest text-text-muted">{t('students.record.registration.socialName')}</dt>
          <dd className="text-body text-text">{student.socialName}</dd>
        </div>
      )}
      <div className={`${item} sm:col-span-2`}>
        <dt className="text-caption font-medium uppercase tracking-widest text-text-muted">{t('students.record.registration.guardians')}</dt>
        {student.guardians.length === 0
          ? <dd className="text-body text-text-muted">{t('students.record.registration.noGuardians')}</dd>
          : student.guardians.map((guardian) => (
              <dd key={guardian.id} className="text-body text-text">
                <span className="font-medium">{guardian.fullName}</span>
                {' — '}
                {t('students.record.registration.guardianContact', {
                  relationship: t(`students.recordRelationship.${guardian.relationship}`),
                  contact: [guardian.phone, guardian.email].filter((value) => value !== null).join(' · '),
                })}
              </dd>
            ))}
      </div>
    </dl>
  )
}

function StudentProfileSummary({ profile, canWrite, onEdit }: Readonly<{ profile: StudentProfileState; canWrite: boolean; onEdit: () => void }>): ReactElement {
  const { t } = useTranslation()

  if (profile.status === 'empty') {
    return (
      <div className="flex flex-col gap-md">
        <EmptyState icon={FileText} title={t('students.profile.emptyTitle')} description={t(canWrite ? 'students.profile.emptyDescription' : 'students.profile.emptyReadOnly')} />
        {canWrite && <div><Button onClick={onEdit}>{t('students.profile.fill')}</Button></div>}
      </div>
    )
  }

  const revision = profile.revision
  return (
    <div className="flex flex-col gap-md">
      <dl className="grid gap-sm sm:grid-cols-2">
        {listProfileItems(revision, t).map((item) => (
          <div key={item.label} className={item.isWide ? 'flex flex-col gap-xs rounded-field border border-hairline bg-surface px-lg py-md sm:col-span-2' : 'flex flex-col gap-xs rounded-field border border-hairline bg-surface px-lg py-md'}>
            <dt className="text-caption font-medium uppercase tracking-widest text-text-muted">{item.label}</dt>
            <dd className={item.value === undefined ? 'text-body text-text-muted' : 'whitespace-pre-line break-words text-body text-text'}>{item.value ?? t('students.profile.notInformed')}</dd>
          </div>
        ))}
      </dl>
      <p className="text-caption text-text-muted">{t('students.profile.lastUpdate', { name: revision.recordedBy.name, date: formatDateTime(revision.recordedAt) })}</p>
      {canWrite && <div><Button variant="outline" onClick={onEdit}>{t('students.profile.edit')}</Button></div>}
    </div>
  )
}

function StudentProfileEditor({ form }: Readonly<{ form: StudentProfileForm }>): ReactElement {
  const { t } = useTranslation()
  const id = useId()
  const failureId = `${id}-failure`
  const errorFor = (field: StudentProfileTextField) => form.invalidFields.has(field) ? t(`students.profile.invalid.${field}`) : undefined

  return (
    <form
      className="flex flex-col gap-lg"
      noValidate
      aria-describedby={form.failure === undefined ? undefined : failureId}
      onSubmit={(event) => { event.preventDefault(); void form.submit() }}
    >
      <p className="text-body text-text-muted">{t('students.profile.editorHint')}</p>
      <div className="grid gap-lg sm:grid-cols-2">
        <FormField id={`${id}-schoolGrade`} label={t('students.profile.fields.schoolGrade')} isRequired={false} requiredMarkLabel={t('form.requiredMark')} error={errorFor('schoolGrade')}>
          {(control) => <Input {...control} type="text" autoComplete="off" value={form.values.schoolGrade} onChange={(event) => { form.change('schoolGrade', event.target.value) }} />}
        </FormField>
      </div>

      <fieldset className="flex flex-col gap-sm">
        <legend className="text-body font-medium">{t('students.profile.fields.conditions')}</legend>
        <p className="text-caption text-text-muted">{t('students.profile.conditionsHint')}</p>
        <div className="grid gap-xs sm:grid-cols-2">
          {STUDENT_CONDITIONS.map((condition) => (
            <label key={condition} className="flex min-h-tap-target items-center gap-sm text-body">
              <input type="checkbox" className="size-5" checked={form.values.conditions.includes(condition)} onChange={(event) => { form.setCondition(condition, event.target.checked) }} />
              <span>{t(`students.conditions.${condition}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormField id={`${id}-supportNeeds`} label={t('students.profile.fields.supportNeeds')} isRequired={false} requiredMarkLabel={t('form.requiredMark')} hint={t('students.profile.supportNeedsHint')} error={errorFor('supportNeeds')}>
        {(control) => <Textarea {...control} value={form.values.supportNeeds} onChange={(event) => { form.change('supportNeeds', event.target.value) }} />}
      </FormField>

      {form.failure !== undefined && <p id={failureId} role="alert" className="text-body text-danger">{t(`students.profile.failure.${form.failure}`)}</p>}
      <div className="flex flex-wrap gap-sm">
        <Button type="submit" disabled={form.isSaving}>{form.isSaving ? t('students.profile.saving') : t(form.failure === 'conflict' ? 'students.profile.saveReplacing' : 'students.profile.save')}</Button>
        <Button type="button" variant="outline" onClick={form.cancel} disabled={form.isSaving}>{t('students.profile.cancel')}</Button>
      </div>
    </form>
  )
}

function ObservationComposer({ add }: Readonly<{ add: StudentRecordAccess['addObservation'] }>): ReactElement {
  const { t } = useTranslation()
  const form = useObservationForm({ add })
  const id = useId()

  return (
    <form className="flex flex-col gap-sm" noValidate onSubmit={(event) => { event.preventDefault(); form.request() }}>
      <FormField
        id={`${id}-observation`}
        label={t('students.observation.label')}
        isRequired
        requiredMarkLabel={t('form.requiredMark')}
        hint={t('students.observation.hint', { maximum: form.maxLength })}
        error={form.failure === 'invalid' ? t('students.observation.invalid', { maximum: form.maxLength }) : undefined}
      >
        {(control) => <Textarea {...control} maxLength={form.maxLength} readOnly={form.isConfirming} value={form.body} onChange={(event) => { form.setBody(event.target.value) }} />}
      </FormField>
      {form.isConfirming
        ? (
            <div role="group" aria-label={t('students.observation.confirmTitle')} className="flex flex-col gap-sm rounded-field border border-border bg-surface px-lg py-md">
              <p className="text-body text-text">{t('students.observation.confirmDescription')}</p>
              <div className="flex flex-wrap gap-sm">
                <Button type="button" disabled={form.isSaving} onClick={() => { void form.confirm() }}>{form.isSaving ? t('students.observation.saving') : t('students.observation.confirm')}</Button>
                <Button type="button" variant="outline" disabled={form.isSaving} onClick={form.cancel}>{t('students.observation.keepEditing')}</Button>
              </div>
            </div>
          )
        : <div><Button type="submit" variant="outline">{t('students.observation.submit')}</Button></div>}
      {form.failure === 'server' && <p role="alert" className="text-body text-danger">{t('students.observation.failed')}</p>}
    </form>
  )
}

function ConsultationComposer({ record }: Readonly<{ record: StudentRecordAccess['recordConsultation'] }>): ReactElement {
  const { t } = useTranslation()
  const form = useConsultationForm({ record })
  // Aberto/fechado é estado de tela, não de dado: o formulário fica recolhido para a ficha
  // não abrir com três campos vazios na frente do que já foi registrado.
  const [isOpen, setIsOpen] = useState(false)
  const id = useId()
  const errorFor = (field: ConsultationField) => form.invalidFields.has(field)
    ? t(`students.consultations.invalid.${field}`, { maximum: field === 'notes' ? form.notesMaxLength : form.maxDurationMinutes })
    : undefined

  if (!isOpen) return <div><Button variant="outline" onClick={() => { setIsOpen(true) }}>{t('students.consultations.open')}</Button></div>

  return (
    <form className="flex flex-col gap-md rounded-field border border-hairline bg-surface px-lg py-md" noValidate onSubmit={(event) => { event.preventDefault(); form.request() }}>
      <div className="grid gap-md sm:grid-cols-2">
        <FormField id={`${id}-occurredAt`} label={t('students.consultations.fields.occurredAt')} isRequired requiredMarkLabel={t('form.requiredMark')} error={errorFor('occurredAt')}>
          {(control) => <Input {...control} type="datetime-local" readOnly={form.isConfirming} value={form.values.occurredAt} onChange={(event) => { form.change('occurredAt', event.target.value) }} />}
        </FormField>
        <FormField id={`${id}-durationMinutes`} label={t('students.consultations.fields.durationMinutes')} isRequired requiredMarkLabel={t('form.requiredMark')} error={errorFor('durationMinutes')}>
          {(control) => <Input {...control} type="number" inputMode="numeric" min={1} max={form.maxDurationMinutes} step={1} readOnly={form.isConfirming} value={form.values.durationMinutes} onChange={(event) => { form.change('durationMinutes', event.target.value) }} />}
        </FormField>
      </div>
      <FormField id={`${id}-notes`} label={t('students.consultations.fields.notes')} isRequired requiredMarkLabel={t('form.requiredMark')} hint={t('students.consultations.notesHint')} error={errorFor('notes')}>
        {(control) => <Textarea {...control} maxLength={form.notesMaxLength} readOnly={form.isConfirming} value={form.values.notes} onChange={(event) => { form.change('notes', event.target.value) }} />}
      </FormField>
      {form.isConfirming
        ? (
            <div role="group" aria-label={t('students.consultations.confirmTitle')} className="flex flex-col gap-sm">
              <p className="text-body text-text">{t('students.consultations.confirmDescription')}</p>
              <div className="flex flex-wrap gap-sm">
                <Button type="button" disabled={form.isSaving} onClick={() => { void form.confirm() }}>{form.isSaving ? t('students.consultations.saving') : t('students.consultations.confirm')}</Button>
                <Button type="button" variant="outline" disabled={form.isSaving} onClick={form.cancel}>{t('students.consultations.keepEditing')}</Button>
              </div>
            </div>
          )
        : (
            <div className="flex flex-wrap gap-sm">
              <Button type="submit">{t('students.consultations.submit')}</Button>
              <Button type="button" variant="outline" onClick={() => { setIsOpen(false) }}>{t('students.consultations.close')}</Button>
            </div>
          )}
      {form.failure !== undefined && form.failure !== 'invalid' && <p role="alert" className="text-body text-danger">{t(`students.consultations.failure.${form.failure}`)}</p>}
    </form>
  )
}

function ConsultationList({ consultations }: Readonly<{ consultations: StudentConsultationsState }>): ReactElement {
  const { t } = useTranslation()

  switch (consultations.status) {
    case 'loading':
      return <p role="status" className="text-body text-text-muted">{t('students.consultations.loading')}</p>
    case 'failed':
      return <p role="alert" className="text-body text-danger">{t('students.consultations.failed')}</p>
    case 'ready':
      if (consultations.consultations.length === 0) {
        return <EmptyState icon={Stethoscope} title={t('students.consultations.emptyTitle')} description={t('students.consultations.emptyDescription')} />
      }
      return (
        <ol className="flex flex-col gap-sm">
          {consultations.consultations.map((consultation) => (
            <li key={consultation.id} className="flex flex-col gap-xs rounded-field border border-hairline bg-surface px-lg py-md">
              <p className="text-body font-medium text-text">
                {t('students.consultations.summary', { date: formatDateTime(consultation.occurredAt), minutes: consultation.durationMinutes })}
              </p>
              <p className="whitespace-pre-line break-words text-body text-text">{consultation.notes}</p>
              <p className="text-caption text-text-muted">{t('students.consultations.recordedBy', { name: consultation.recordedBy.name })}</p>
            </li>
          ))}
        </ol>
      )
    default:
      return assertNever(consultations)
  }
}

function StudentHistory({ history }: Readonly<{ history: StudentHistoryState }>): ReactElement {
  const { t } = useTranslation()

  switch (history.status) {
    case 'loading':
      return <p role="status" className="text-body text-text-muted">{t('students.history.loading')}</p>
    case 'failed':
      return <p role="alert" className="text-body text-danger">{t('students.history.failed')}</p>
    case 'ready':
      if (history.entries.length === 0) return <EmptyState icon={History} title={t('students.history.emptyTitle')} description={t('students.history.emptyDescription')} />
      return (
        <ol className="flex flex-col gap-sm">
          {history.entries.map((entry) => <HistoryItem key={`${entry.kind}-${entry.id}`} entry={entry} />)}
        </ol>
      )
    default:
      return assertNever(history)
  }
}

function HistoryItem({ entry }: Readonly<{ entry: StudentHistoryEntry }>): ReactElement {
  const { t } = useTranslation()
  const meta = t('students.history.meta', { name: entry.recordedBy.name, date: formatDateTime(entry.recordedAt) })

  return (
    <li className="flex flex-col gap-xs rounded-field border border-hairline bg-surface px-lg py-md">
      <p className="text-caption font-medium uppercase tracking-widest text-text-muted">{t(`students.history.kind.${entry.kind}`)}</p>
      <p className="whitespace-pre-line break-words text-body text-text">
        {entry.kind === 'observation'
          ? entry.body
          : t('students.history.changedFields', { fields: entry.changedFields.map((field) => t(`students.profile.fields.${field}`)).join(', ') })}
      </p>
      <p className="text-caption text-text-muted">{meta}</p>
    </li>
  )
}

type ProfileItem = Readonly<{ label: string; value: string | undefined; isWide: boolean }>

function listProfileItems(revision: StudentProfileRevision, t: TFunction): readonly ProfileItem[] {
  return [
    { label: t('students.profile.fields.schoolGrade'), value: revision.schoolGrade ?? undefined, isWide: false },
    {
      label: t('students.profile.fields.conditions'),
      value: revision.conditions.length === 0 ? undefined : revision.conditions.map((condition) => t(`students.conditions.${condition}`)).join(', '),
      isWide: true,
    },
    { label: t('students.profile.fields.supportNeeds'), value: revision.supportNeeds ?? undefined, isWide: true },
  ]
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Instante gravado pela API (UTC), mostrado no fuso de quem lê.
function formatDateTime(iso: string): string {
  return DATE_TIME_FORMAT.format(new Date(iso))
}

// Data de calendário sem fuso: passar por `Date` a deslocaria um dia a oeste de UTC.
function formatCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`
}
