import type { Appointment, AppointmentOccurrence } from '@habituar/core/appointments'
import { assertNever } from '@habituar/core/assert-never'
import { type LocalDate, minutesOfDay, readLocalDateTime } from '@habituar/core/calendar'
import { APPOINTMENT_DURATION_OPTIONS, useAppointmentForm } from '@habituar/react-client/agenda-forms'
import type { AppointmentField } from '@habituar/react-client/agenda-forms'
import type { AgendaItem, AgendaWriteResult, ProfessionalAgenda } from '@habituar/react-client/react-client'
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { AgendaBoard } from '../components/agenda-board.js'
import { useAgendaLabels } from '../components/agenda-labels.js'
import { Button } from '../components/ui/button.js'
import { Dialog } from '../components/ui/dialog.js'
import { FormField } from '../components/ui/form-field.js'
import { Input } from '../components/ui/input.js'
import { PageHeader } from '../components/ui/page-header.js'
import { Textarea } from '../components/ui/textarea.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { readCurrentTime } from '../time/current-time.js'

// O que está aberto sobre a agenda: nada, a criação a partir de um horário, o detalhe de
// uma ocorrência ou a edição da série. Só uma coisa por vez, para a pessoa não perder o fio.
type Target =
  | Readonly<{ mode: 'idle' }>
  | Readonly<{ mode: 'create'; date: LocalDate; time: string }>
  | Readonly<{ mode: 'detail'; occurrence: AppointmentOccurrence }>
  | Readonly<{ mode: 'edit'; appointment: Appointment }>

type Feedback = Readonly<{ result: AgendaWriteResult; kind: 'saved' | 'removed' | 'cancelled' }> | undefined

/**
 * Agenda de atendimentos do profissional, no estilo do Google Agenda: semana com horários,
 * dia ou mês. Quem tem `appointment.write` cria clicando num horário vazio e edita ou
 * cancela pelo detalhe; os demais só leem.
 */
export function ProfessionalAgendaScreen(): ReactElement {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const session = useInstitutionSession()
  const now = readLocalDateTime(readCurrentTime())
  const cursor = habituar.useAgendaCursor(now.date, 'week')
  const agenda = habituar.useProfessionalAgenda(session.membership, cursor.range)
  const [target, setTarget] = useState<Target>({ mode: 'idle' })
  const [feedback, setFeedback] = useState<Feedback>(undefined)

  function open(next: Target): void {
    setFeedback(undefined)
    setTarget(next)
  }

  function finish(result: AgendaWriteResult, kind: NonNullable<Feedback>['kind']): void {
    setFeedback({ result, kind })
    if (result !== 'not-saved') setTarget({ mode: 'idle' })
  }

  function selectItem(item: AgendaItem): void {
    if (item.kind === 'appointment') open({ mode: 'detail', occurrence: item.occurrence })
  }

  return (
    <div className="flex flex-col gap-xl">
      <div className="flex flex-wrap items-end justify-between gap-md">
        <PageHeader eyebrow={tc('navigation.agenda')} title={t('title')} description={t('professionalDescription')} />
        {agenda.canSchedule && <Button type="button" onClick={() => { open({ mode: 'create', date: cursor.date, time: '' }) }}><Plus aria-hidden className="size-4" />{t('new')}</Button>}
      </div>
      {feedback !== undefined && <FeedbackMessage feedback={feedback} />}
      {(() => {
        switch (agenda.state.status) {
          case 'loading':
            return <p role="status" className="text-body text-text-muted">{t('loading')}</p>
          case 'failed':
            return <p role="alert" className="text-body text-danger">{t(agenda.state.failure === 'forbidden' ? 'forbidden' : 'failed')}</p>
          case 'ready':
            return (
              <AgendaBoard
                cursor={cursor}
                days={agenda.state.days}
                today={now.date}
                nowMinute={minutesOfDay(now.time)}
                describeItem={item => item.kind === 'appointment'
                  ? { title: item.occurrence.appointment.studentName, detail: t('appointment') }
                  : { title: item.block.title, detail: tc(`routine.kinds.${item.block.kind}`) }}
                onItemSelect={selectItem}
                onSlotSelect={agenda.canSchedule ? (date, time) => { open({ mode: 'create', date, time }) } : undefined}
              />
            )
          default:
            return assertNever(agenda.state)
        }
      })()}
      {target.mode === 'create' && (
        <AppointmentEditor key={`create-${target.date}-${target.time}`} date={target.date} time={target.time} agenda={agenda} onDone={(result) => { finish(result, 'saved') }} onCancel={() => { setTarget({ mode: 'idle' }) }} />
      )}
      {target.mode === 'edit' && (
        <AppointmentEditor key={`edit-${target.appointment.id}`} appointment={target.appointment} date={target.appointment.startsOn} time={target.appointment.startsAt} agenda={agenda} onDone={(result) => { finish(result, 'saved') }} onCancel={() => { setTarget({ mode: 'idle' }) }} />
      )}
      {target.mode === 'detail' && (
        <AppointmentDetail
          occurrence={target.occurrence}
          agenda={agenda}
          onEdit={() => { setTarget({ mode: 'edit', appointment: target.occurrence.appointment }) }}
          onDone={finish}
          onClose={() => { setTarget({ mode: 'idle' }) }}
        />
      )}
    </div>
  )
}

function FeedbackMessage({ feedback }: Readonly<{ feedback: NonNullable<Feedback> }>): ReactElement {
  const { t } = useTranslation('agenda')
  switch (feedback.result) {
    case 'saved': {
      const key = feedback.kind === 'saved' ? 'saved' : feedback.kind === 'removed' ? 'removed' : 'occurrenceCancelled'
      return <p role="status" className="text-body text-text">{t(key)}</p>
    }
    case 'conflict':
      return <p role="alert" className="text-body text-danger">{t('conflict')}</p>
    case 'not-saved':
      return <p role="alert" className="text-body text-danger">{t('writeFailed')}</p>
    default:
      return assertNever(feedback.result)
  }
}

type Confirmation = 'none' | 'occurrence' | 'series'

function AppointmentDetail({
  occurrence,
  agenda,
  onEdit,
  onDone,
  onClose,
}: Readonly<{
  occurrence: AppointmentOccurrence
  agenda: ProfessionalAgenda
  onEdit: () => void
  onDone: (result: AgendaWriteResult, kind: 'removed' | 'cancelled') => void
  onClose: () => void
}>): ReactElement {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()
  const [confirmation, setConfirmation] = useState<Confirmation>('none')
  const [isWriting, setIsWriting] = useState(false)
  const { appointment } = occurrence
  const recurrence = labels.formatRecurrence(appointment)

  function run(send: () => Promise<AgendaWriteResult>, kind: 'removed' | 'cancelled'): void {
    setIsWriting(true)
    void send().then((result) => {
      setIsWriting(false)
      onDone(result, kind)
    })
  }

  return (
    <Dialog isOpen onClose={onClose} title={t('appointmentWithStudent', { name: appointment.studentName })} description={t('detailDescription')}>
      <dl className="grid gap-sm text-body sm:grid-cols-[auto_1fr]">
        <dt className="text-text-muted">{t('fields.startsOn')}</dt>
        <dd className="text-text">{labels.formatLongDate(occurrence.date)}</dd>
        <dt className="text-text-muted">{t('fields.startsAt')}</dt>
        <dd className="text-text">{t('time', { start: occurrence.startsAt, end: occurrence.endsAt })}</dd>
        {recurrence !== undefined && (
          <>
            <dt className="text-text-muted">{t('sections.recurrence')}</dt>
            <dd className="text-text">{recurrence}</dd>
          </>
        )}
        {appointment.notes !== null && (
          <>
            <dt className="text-text-muted">{t('fields.notes')}</dt>
            <dd className="whitespace-pre-line break-words text-text">{appointment.notes}</dd>
          </>
        )}
      </dl>
      {confirmation !== 'none' && (
        <div role="group" aria-label={t('remove')} className="flex flex-col gap-sm rounded-field border border-danger px-lg py-md">
          <p className="text-body text-text">
            {confirmation === 'occurrence'
              ? t('cancelOccurrenceQuestion', { date: labels.formatShortDate(occurrence.date) })
              : appointment.recurrence.kind === 'weekly' ? t('removeSeriesQuestion') : t('removeSingleQuestion', { date: labels.formatShortDate(occurrence.date) })}
          </p>
          <div className="flex flex-wrap gap-sm">
            <Button
              type="button"
              variant="destructive"
              disabled={isWriting}
              onClick={() => {
                if (confirmation === 'occurrence') run(() => agenda.cancelOccurrence(appointment, occurrence.date), 'cancelled')
                else run(() => agenda.remove(appointment), 'removed')
              }}
            >
              {t(confirmation === 'occurrence' ? 'confirmCancelOccurrence' : 'confirmRemove')}
            </Button>
            <Button type="button" variant="outline" disabled={isWriting} onClick={() => { setConfirmation('none') }}>{t('cancel')}</Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-sm">
        {agenda.canSchedule && confirmation === 'none' && (
          <>
            <Button type="button" onClick={onEdit}>{t('edit')}</Button>
            {appointment.recurrence.kind === 'weekly' && <Button type="button" variant="outline" onClick={() => { setConfirmation('occurrence') }}>{t('cancelOccurrence')}</Button>}
            <Button type="button" variant="outline" onClick={() => { setConfirmation('series') }}>{t('remove')}</Button>
          </>
        )}
        <Button type="button" variant="ghost" onClick={onClose}>{t('close')}</Button>
      </div>
    </Dialog>
  )
}

function AppointmentEditor({
  appointment,
  date,
  time,
  agenda,
  onDone,
  onCancel,
}: Readonly<{
  appointment?: Appointment
  date: LocalDate
  time: string
  agenda: ProfessionalAgenda
  onDone: (result: AgendaWriteResult) => void
  onCancel: () => void
}>): ReactElement {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const session = useInstitutionSession()
  const students = habituar.useAccessibleStudents(session.membership)
  const form = useAppointmentForm({
    appointment,
    date,
    time,
    save: (studentId, input) => appointment === undefined ? agenda.create(studentId, input) : agenda.update(appointment, input),
  })
  const id = useId()
  const errorFor = (field: AppointmentField) => form.invalidFields.has(field) ? t(`invalid.${field}`, { maximum: form.notesMaxLength }) : undefined

  return (
    <Dialog isOpen onClose={onCancel} title={appointment === undefined ? t('new') : t('edit')} description={t('formDescription')}>
      <form
        className="flex flex-col gap-md"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void form.submit().then((result) => { if (result !== 'invalid') onDone(result) })
        }}
      >
        <FormField id={`${id}-student`} label={t('fields.student')} isRequired requiredMarkLabel={tc('form.requiredMark')} error={errorFor('studentId')}>
          {(control) => (
            <select
              {...control}
              disabled={form.isStudentLocked}
              className="min-h-tap-target rounded-field border border-border bg-surface px-sm text-body text-text"
              value={form.values.studentId ?? ''}
              onChange={(event) => {
                const student = students.state.status === 'ready' ? students.state.students.find(candidate => candidate.id === event.target.value) : undefined
                form.change('studentId', student?.id)
              }}
            >
              {form.isStudentLocked && appointment !== undefined
                ? <option value={appointment.studentId}>{appointment.studentName}</option>
                : (
                    <>
                      <option value="">{students.state.status === 'ready' && students.state.students.length === 0 ? t('noStudentsToSchedule') : ''}</option>
                      {students.state.status === 'ready' && students.state.students.map(student => <option key={student.id} value={student.id}>{student.socialName ?? student.fullName}</option>)}
                    </>
                  )}
            </select>
          )}
        </FormField>
        <div className="grid gap-md sm:grid-cols-3">
          <FormField id={`${id}-startsOn`} label={t('fields.startsOn')} isRequired requiredMarkLabel={tc('form.requiredMark')} error={errorFor('startsOn')}>
            {(control) => <Input {...control} type="date" value={form.values.startsOn} onChange={(event) => { form.change('startsOn', event.target.value) }} />}
          </FormField>
          <FormField id={`${id}-startsAt`} label={t('fields.startsAt')} isRequired requiredMarkLabel={tc('form.requiredMark')} error={errorFor('startsAt')}>
            {(control) => <Input {...control} type="time" value={form.values.startsAt} onChange={(event) => { form.change('startsAt', event.target.value) }} />}
          </FormField>
          <FormField id={`${id}-duration`} label={t('fields.duration')} isRequired requiredMarkLabel={tc('form.requiredMark')} error={errorFor('durationMinutes')}>
            {(control) => (
              <select {...control} className="min-h-tap-target rounded-field border border-border bg-surface px-sm text-body text-text" value={form.values.durationMinutes} onChange={(event) => { form.change('durationMinutes', Number(event.target.value)) }}>
                {APPOINTMENT_DURATION_OPTIONS.map(minutes => <option key={minutes} value={minutes}>{t('durationOption', { minutes })}</option>)}
              </select>
            )}
          </FormField>
        </div>
        <label className="flex min-h-tap-target items-center gap-sm text-body text-text">
          <input type="checkbox" className="size-4" checked={form.values.isWeekly} onChange={(event) => { form.change('isWeekly', event.target.checked) }} />
          {t('fields.weekly')}
        </label>
        {form.values.isWeekly && (
          <FormField id={`${id}-until`} label={t('fields.until')} isRequired={false} requiredMarkLabel={tc('form.requiredMark')} hint={t('untilHint')} error={errorFor('until')} className="pl-lg">
            {(control) => <Input {...control} type="date" value={form.values.until} onChange={(event) => { form.change('until', event.target.value) }} />}
          </FormField>
        )}
        <FormField id={`${id}-notes`} label={t('fields.notes')} isRequired={false} requiredMarkLabel={tc('form.requiredMark')} error={errorFor('notes')}>
          {(control) => <Textarea {...control} maxLength={form.notesMaxLength} value={form.values.notes} onChange={(event) => { form.change('notes', event.target.value) }} />}
        </FormField>
        <div className="flex flex-wrap gap-sm">
          <Button type="submit" disabled={form.isSaving}>{form.isSaving ? t('saving') : t('save')}</Button>
          <Button type="button" variant="outline" disabled={form.isSaving} onClick={onCancel}>{t('cancel')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
