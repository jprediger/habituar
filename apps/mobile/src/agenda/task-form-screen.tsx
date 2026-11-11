import { assertNever } from '@habituar/core/assert-never'
import { type LocalDate, localDateSchema, readLocalDateParts, readLocalDateTime, WEEKDAYS } from '@habituar/core/calendar'
import type { StudentId, TaskId } from '@habituar/core/identity/ids'
import { TASK_KINDS } from '@habituar/core/tasks'
import type { TaskChangeScope, TaskOrigin } from '@habituar/core/tasks'
import { SPACING } from '@habituar/design-tokens/spacing'
import { WEEKDAY_LABEL_KEYS } from '@habituar/react-client/routine-forms'
import type { TaskSeriesWriteResult } from '@habituar/react-client/react-client'
import { TASK_REPEATS, useTaskForm } from '@habituar/react-client/task-forms'
import type { TaskField, TaskFormOccurrence, TaskSubmission } from '@habituar/react-client/task-forms'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { habituar } from '../client/habituar-client'
import { Button } from '../components/ui/button'
import { ChoiceList } from '../components/ui/choice-list'
import { DateTimeField } from '../components/ui/date-time-field'
import { FormField } from '../components/ui/form-field'
import { Input } from '../components/ui/input'
import { ListDivider } from '../components/ui/list-divider'
import { ListSection } from '../components/ui/list-section'
import { StackPage } from '../components/ui/stack-page'
import { SwitchRow } from '../components/ui/switch-row'
import { Text } from '../components/ui/text'
import { Textarea } from '../components/ui/textarea'
import { useToast } from '../components/ui/toast'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'
import type { AgendaPlace } from './agenda-routes'
import { useAgendaRoutes } from './agenda-routes'
import { ScopeSheet } from './scope-sheet'

type FormFailure = Exclude<TaskSeriesWriteResult, 'saved'> | 'no-scope'

/** Nova tarefa a partir do botão flutuante; a origem é a de quem cria, decidida pela pilha. */
export function NewTaskScreen({ session, studentId, date, place }: Readonly<{ session: InstitutionSession; studentId: StudentId; date: LocalDate; place: AgendaPlace }>) {
  const { t } = useTranslation('agenda')
  const series = habituar.useTaskSeries(session.membership, studentId)
  const origin: TaskOrigin = place === 'student' ? 'student' : 'staff'

  return (
    <StackPage title={t('calendar.newTask')}>
      <TaskForm
        studentId={studentId}
        date={date}
        place={place}
        save={(submission) => submission.kind === 'create' ? series.create(origin, submission.input) : series.change(submission.task, submission.change)}
      />
    </StackPage>
  )
}

/** Edição da série a partir de uma ocorrência; carrega a ocorrência pelo endereço antes do rascunho. */
export function EditTaskScreen({ session, studentId, taskId, originalDate, place }: Readonly<{ session: InstitutionSession; studentId: StudentId; taskId: TaskId; originalDate: LocalDate; place: AgendaPlace }>) {
  const { t } = useTranslation('agenda')
  const access = habituar.useTaskOccurrence(session.membership, studentId, taskId, originalDate)
  const series = habituar.useTaskSeries(session.membership, studentId)

  return (
    <StackPage title={t('calendar.editTask')}>
      {(() => {
        switch (access.state.status) {
          case 'loading':
            return <Text tone="muted" accessibilityLiveRegion="polite">{t('loading')}</Text>
          case 'failed':
            return <Text accessibilityRole="alert" tone="danger">{t('failed')}</Text>
          case 'ready':
            return (
              <TaskForm
                studentId={studentId}
                date={access.state.date}
                place={place}
                occurrence={{ task: access.state.task, originalDate, date: access.state.date, time: access.state.time }}
                save={(submission) => submission.kind === 'change' ? series.change(submission.task, submission.change) : series.create(access.state.status === 'ready' ? access.state.task.origin : 'student', submission.input)}
              />
            )
          default:
            return assertNever(access.state)
        }
      })()}
    </StackPage>
  )
}

function toPickerDate(value: string, fallback: LocalDate): Date {
  const parsed = localDateSchema.safeParse(value)
  const parts = readLocalDateParts(parsed.success ? parsed.data : fallback)
  return new Date(parts.year, parts.month - 1, parts.day)
}

function TaskForm({ studentId, date, place, occurrence, save }: Readonly<{
  studentId: StudentId
  date: LocalDate
  place: AgendaPlace
  occurrence?: TaskFormOccurrence | undefined
  save: (submission: TaskSubmission) => Promise<TaskSeriesWriteResult>
}>) {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const router = useRouter()
  const routes = useAgendaRoutes(place)
  const toast = useToast()
  const form = useTaskForm({ occurrence, date, today: readLocalDateTime(readCurrentTime()).date, save })
  const [failure, setFailure] = useState<FormFailure | undefined>(undefined)
  const [isAskingScope, setIsAskingScope] = useState(false)
  const errorFor = (field: TaskField) => form.invalidFields.has(field) ? t(`calendar.invalid.${field}`, { maximum: field === 'title' ? form.titleMaxLength : form.notesMaxLength }) : undefined
  const pickerDate = toPickerDate(form.values.date, date)

  function submit(scope?: TaskChangeScope): void {
    setFailure(undefined)
    void form.submit(scope).then((result) => {
      switch (result) {
        case 'invalid':
          return
        case 'needs-scope':
          setIsAskingScope(true)
          return
        case 'saved':
          setIsAskingScope(false)
          toast({ type: 'success', title: t('toast.taskSaved.title'), subtitle: t('toast.taskSaved.description') })
          // Remarcar mantém a ocorrência no mesmo endereço; dividir a série pode não manter.
          if (occurrence !== undefined && scope !== 'this-occurrence') routes.backToAgenda(studentId)
          else router.back()
          return
        case 'conflict':
        case 'in-past':
        case 'has-record':
        case 'not-saved':
        case 'no-scope':
          setIsAskingScope(false)
          setFailure(result)
          return
        default:
          assertNever(result)
      }
    })
  }

  return (
    <View style={styles.stack}>
      <ListSection title={t('calendar.sections.what')}>
        <View style={styles.fields}>
          <FormField id="task-title" label={t('calendar.fields.title')} isRequired error={errorFor('title')}>
            {(control) => <Input maxLength={form.titleMaxLength} value={form.values.title} onChangeText={(value) => { form.change('title', value) }} {...control} />}
          </FormField>
          <ChoiceList
            label={t('task.kind')}
            choices={[{ value: 'none' as const, label: tc('routine.noKind') }, ...TASK_KINDS.map(kind => ({ value: kind, label: tc(`routine.kinds.${kind}`) }))]}
            value={form.values.kind}
            onChange={(kind) => { form.change('kind', kind) }}
          />
          <FormField id="task-notes" label={t('calendar.fields.notes')} isRequired={false} error={errorFor('notes')}>
            {(control) => <Textarea maxLength={form.notesMaxLength} value={form.values.notes} onChangeText={(value) => { form.change('notes', value) }} {...control} />}
          </FormField>
        </View>
      </ListSection>
      <ListDivider />
      <ListSection title={t('calendar.sections.when')}>
        <SwitchRow label={t('task.allDay')} isOn={form.values.isAllDay} onChange={(isOn) => { form.change('isAllDay', isOn) }} />
        <View style={styles.fields}>
          <FormField id="task-date" label={t('fields.startsOn')} isRequired error={errorFor('date')}>
            {(control) => <DateTimeField mode="date" value={form.values.date} initialDate={pickerDate} onChange={(value) => { form.change('date', value) }} {...control} />}
          </FormField>
          {!form.values.isAllDay && (
            <>
              <FormField id="task-starts-at" label={t('calendar.fields.startsAt')} isRequired error={errorFor('startsAt')}>
                {(control) => <DateTimeField mode="time" value={form.values.startsAt} initialDate={pickerDate} onChange={(value) => { form.change('startsAt', value) }} {...control} />}
              </FormField>
              <FormField id="task-ends-at" label={t('calendar.fields.endsAt')} isRequired error={errorFor('endsAt')}>
                {(control) => <DateTimeField mode="time" value={form.values.endsAt} initialDate={pickerDate} onChange={(value) => { form.change('endsAt', value) }} {...control} />}
              </FormField>
            </>
          )}
        </View>
      </ListSection>
      <ListDivider />
      <ListSection title={t('calendar.sections.repeat')} footer={form.values.repeat === 'none' ? undefined : t('untilHint')}>
        <ChoiceList
          label={t('calendar.sections.repeat')}
          isLabelVisible={false}
          choices={TASK_REPEATS.map(repeat => ({ value: repeat, label: t(`calendar.repeat.${repeat}`) }))}
          value={form.values.repeat}
          onChange={(repeat) => { form.change('repeat', repeat) }}
        />
        {form.values.repeat === 'weekly' && (
          <View style={styles.indented}>
            {WEEKDAYS.map(weekday => (
              <SwitchRow
                key={weekday}
                label={tc(WEEKDAY_LABEL_KEYS[weekday])}
                isOn={form.values.weekdays.includes(weekday)}
                onChange={(isOn) => { form.change('weekdays', isOn ? [...form.values.weekdays, weekday] : form.values.weekdays.filter(day => day !== weekday)) }}
              />
            ))}
            {errorFor('weekdays') !== undefined && <Text accessibilityRole="alert" tone="danger">{errorFor('weekdays')}</Text>}
          </View>
        )}
        {form.values.repeat !== 'none' && (
          <View style={styles.indented}>
            <FormField id="task-until" label={t('fields.until')} isRequired={false} error={errorFor('until')}>
              {(control) => <DateTimeField mode="date" value={form.values.until} initialDate={pickerDate} onChange={(value) => { form.change('until', value) }} onClear={() => { form.change('until', '') }} {...control} />}
            </FormField>
          </View>
        )}
      </ListSection>
      {failure !== undefined && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" tone="danger">{t(`calendar.writeFailure.${failure}`)}</Text>}
      <Button label={form.isSaving ? t('saving') : t('calendar.saveTask')} isBusy={form.isSaving} onPress={() => { submit() }} />
      {isAskingScope && (
        <ScopeSheet
          title={t('calendar.changeRecurringQuestion')}
          scopes={form.scopes}
          isBusy={form.isSaving}
          isDanger={false}
          onChoose={(scope) => { submit(scope) }}
          onCancel={() => { setIsAskingScope(false) }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: SPACING.xl },
  fields: { gap: SPACING.md },
  indented: { paddingLeft: SPACING.lg },
})
