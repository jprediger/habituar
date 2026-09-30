import { assertNever } from '@habituar/core/assert-never'
import type { StudentId } from '@habituar/core/identity/ids'
import { ROUTINE_KINDS, WEEKDAYS, weekdayOf } from '@habituar/core/routines'
import type { RoutineBlock, Weekday } from '@habituar/core/routines'
import type { RoutineWriteResult, StudentRoutine } from '@habituar/react-client/react-client'
import { WEEKDAY_LABEL_KEYS, useRoutineBlockForm } from '@habituar/react-client/routine-forms'
import type { RoutineBlockField } from '@habituar/react-client/routine-forms'
import { useId, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'
import { FormField } from '../components/ui/form-field.js'
import { Input } from '../components/ui/input.js'
import { Textarea } from '../components/ui/textarea.js'
import { RoutineWeek } from '../components/routine-week.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { readCurrentTime } from '../time/current-time.js'

// O que está aberto na grade: nada, o formulário de um bloco novo ou de um existente, ou
// a confirmação de remoção. Só uma coisa por vez, para a pessoa não perder o fio.
type EditorTarget =
  | Readonly<{ mode: 'idle' }>
  | Readonly<{ mode: 'create'; weekday: Weekday }>
  | Readonly<{ mode: 'edit'; block: RoutineBlock }>
  | Readonly<{ mode: 'remove'; block: RoutineBlock }>

type Feedback = Readonly<{ result: RoutineWriteResult; kind: 'saved' | 'removed' }> | undefined

/**
 * Grade semanal dentro da ficha, para quem acompanha o aluno. Com `routine.write`,
 * oferece adicionar, editar e remover blocos; sem, é a mesma grade só para leitura.
 */
export function StudentRoutineEditor({ studentId }: Readonly<{ studentId: StudentId }>): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const routine = habituar.useStudentRoutine(session.membership, studentId)
  const [target, setTarget] = useState<EditorTarget>({ mode: 'idle' })
  const [feedback, setFeedback] = useState<Feedback>(undefined)

  function finish(result: RoutineWriteResult, kind: 'saved' | 'removed'): void {
    setFeedback({ result, kind })
    if (result !== 'not-saved') setTarget({ mode: 'idle' })
  }

  switch (routine.state.status) {
    case 'loading':
      return <p role="status" className="text-body text-text-muted">{t('routine.loading')}</p>
    case 'failed':
      return <p role="alert" className="text-body text-danger">{t(routine.state.failure === 'forbidden' ? 'routine.forbidden' : 'routine.failed')}</p>
    case 'ready':
      return (
        <div className="flex flex-col gap-md">
          <RoutineWeek
            days={routine.state.days}
            today={weekdayOf(readCurrentTime())}
            renderDayAction={routine.canEdit && target.mode === 'idle'
              ? (day) => (
                  <Button type="button" variant="outline" size="sm" onClick={() => { setFeedback(undefined); setTarget({ mode: 'create', weekday: day.weekday }) }}>
                    {t('routine.addTo', { day: t(WEEKDAY_LABEL_KEYS[day.weekday]) })}
                  </Button>
                )
              : undefined}
            renderBlockActions={routine.canEdit && target.mode === 'idle'
              ? (block) => (
                  <div className="flex gap-xs">
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setFeedback(undefined); setTarget({ mode: 'edit', block }) }}>{t('routine.editBlock', { title: block.title })}</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setFeedback(undefined); setTarget({ mode: 'remove', block }) }}>{t('routine.removeBlock', { title: block.title })}</Button>
                  </div>
                )
              : undefined}
          />
          {target.mode === 'create' && <RoutineBlockEditor key={`create-${String(target.weekday)}`} weekday={target.weekday} save={routine.add} onDone={(result) => { finish(result, 'saved') }} onCancel={() => { setTarget({ mode: 'idle' }) }} />}
          {target.mode === 'edit' && <RoutineBlockEditor key={`edit-${target.block.id}`} block={target.block} weekday={target.block.weekday} save={(input) => routine.update(target.block, input)} onDone={(result) => { finish(result, 'saved') }} onCancel={() => { setTarget({ mode: 'idle' }) }} />}
          {target.mode === 'remove' && <RemoveConfirmation block={target.block} routine={routine} onDone={(result) => { finish(result, 'removed') }} onCancel={() => { setTarget({ mode: 'idle' }) }} />}
          {feedback !== undefined && <FeedbackMessage feedback={feedback} />}
        </div>
      )
    default:
      return assertNever(routine.state)
  }
}

function FeedbackMessage({ feedback }: Readonly<{ feedback: NonNullable<Feedback> }>): ReactElement {
  const { t } = useTranslation()
  switch (feedback.result) {
    case 'saved':
      return <p role="status" className="text-body text-text">{t(feedback.kind === 'saved' ? 'routine.saved' : 'routine.removed')}</p>
    case 'conflict':
      return <p role="alert" className="text-body text-danger">{t('routine.conflict')}</p>
    case 'not-saved':
      return <p role="alert" className="text-body text-danger">{t('routine.writeFailed')}</p>
    default:
      return assertNever(feedback.result)
  }
}

function RemoveConfirmation({ block, routine, onDone, onCancel }: Readonly<{ block: RoutineBlock; routine: StudentRoutine; onDone: (result: RoutineWriteResult) => void; onCancel: () => void }>): ReactElement {
  const { t } = useTranslation()
  const [isRemoving, setIsRemoving] = useState(false)

  return (
    <div role="group" aria-label={t('routine.removeTitle')} className="flex flex-col gap-sm rounded-field border border-danger px-lg py-md">
      <p className="text-body text-text">{t('routine.removeQuestion', { title: block.title, day: t(WEEKDAY_LABEL_KEYS[block.weekday]) })}</p>
      <div className="flex flex-wrap gap-sm">
        <Button type="button" variant="destructive" disabled={isRemoving} onClick={() => { setIsRemoving(true); void routine.remove(block).then(onDone) }}>{t('routine.removeYes')}</Button>
        <Button type="button" variant="outline" disabled={isRemoving} onClick={onCancel}>{t('routine.cancel')}</Button>
      </div>
    </div>
  )
}

function RoutineBlockEditor({
  block,
  weekday,
  save,
  onDone,
  onCancel,
}: Readonly<{ block?: RoutineBlock; weekday: Weekday; save: StudentRoutine['add']; onDone: (result: RoutineWriteResult) => void; onCancel: () => void }>): ReactElement {
  const { t } = useTranslation()
  const form = useRoutineBlockForm({ block, weekday, save })
  const id = useId()
  const errorFor = (field: RoutineBlockField) => form.invalidFields.has(field)
    ? t(`routine.invalid.${field}`, { maximum: field === 'notes' ? form.notesMaxLength : form.titleMaxLength })
    : undefined

  return (
    <form
      aria-label={block === undefined ? t('routine.newBlock') : t('routine.editBlock', { title: block.title })}
      className="flex flex-col gap-md rounded-field border border-hairline bg-surface px-lg py-md"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.submit().then((result) => { if (result !== 'invalid') onDone(result) })
      }}
    >
      <div className="grid gap-md sm:grid-cols-2">
        <FormField id={`${id}-weekday`} label={t('routine.fields.weekday')} isRequired requiredMarkLabel={t('form.requiredMark')} error={errorFor('weekday')}>
          {(control) => (
            <select {...control} className="min-h-tap-target rounded-field border border-border bg-surface px-sm text-body text-text" value={form.values.weekday} onChange={(event) => { form.change('weekday', WEEKDAYS.find((day) => String(day) === event.target.value) ?? form.values.weekday) }}>
              {WEEKDAYS.map((day) => <option key={day} value={day}>{t(WEEKDAY_LABEL_KEYS[day])}</option>)}
            </select>
          )}
        </FormField>
        <FormField id={`${id}-kind`} label={t('routine.fields.kind')} isRequired requiredMarkLabel={t('form.requiredMark')} error={errorFor('kind')}>
          {(control) => (
            <select {...control} className="min-h-tap-target rounded-field border border-border bg-surface px-sm text-body text-text" value={form.values.kind} onChange={(event) => { form.change('kind', ROUTINE_KINDS.find((kind) => kind === event.target.value) ?? form.values.kind) }}>
              {ROUTINE_KINDS.map((kind) => <option key={kind} value={kind}>{t(`routine.kinds.${kind}`)}</option>)}
            </select>
          )}
        </FormField>
        <FormField id={`${id}-startsAt`} label={t('routine.fields.startsAt')} isRequired requiredMarkLabel={t('form.requiredMark')} error={errorFor('startsAt')}>
          {(control) => <Input {...control} type="time" value={form.values.startsAt} onChange={(event) => { form.change('startsAt', event.target.value) }} />}
        </FormField>
        <FormField id={`${id}-endsAt`} label={t('routine.fields.endsAt')} isRequired requiredMarkLabel={t('form.requiredMark')} error={errorFor('endsAt')}>
          {(control) => <Input {...control} type="time" value={form.values.endsAt} onChange={(event) => { form.change('endsAt', event.target.value) }} />}
        </FormField>
      </div>
      <FormField id={`${id}-title`} label={t('routine.fields.title')} isRequired requiredMarkLabel={t('form.requiredMark')} error={errorFor('title')}>
        {(control) => <Input {...control} maxLength={form.titleMaxLength} value={form.values.title} onChange={(event) => { form.change('title', event.target.value) }} />}
      </FormField>
      <FormField id={`${id}-notes`} label={t('routine.fields.notes')} isRequired={false} requiredMarkLabel={t('form.requiredMark')} error={errorFor('notes')}>
        {(control) => <Textarea {...control} maxLength={form.notesMaxLength} value={form.values.notes} onChange={(event) => { form.change('notes', event.target.value) }} />}
      </FormField>
      <div className="flex flex-wrap gap-sm">
        <Button type="submit" disabled={form.isSaving}>{form.isSaving ? t('routine.saving') : t('routine.save')}</Button>
        <Button type="button" variant="outline" disabled={form.isSaving} onClick={onCancel}>{t('routine.cancel')}</Button>
      </div>
    </form>
  )
}
