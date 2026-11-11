/**
 * Entrypoint do formulário de tarefa da agenda: dono do rascunho (o quê, quando, repetição),
 * da tradução dele para a série do contrato, da validação pelo schema do contrato e de qual
 * alcance ("só esta" / "desta em diante") cada edição ou exclusão admite. Não conhece
 * navegação nem visual.
 */
import { addDays, type LocalDate, localDateSchema, type Weekday, weekdayOfLocalDate } from '@habituar/core/calendar'
import type { ScheduleTime } from '@habituar/core/schedule'
import { TASK_NOTES_MAX_LENGTH, TASK_TITLE_MAX_LENGTH, taskInputSchema } from '@habituar/core/tasks'
import type { Task, TaskChange, TaskChangeScope, TaskInput, TaskKind } from '@habituar/core/tasks'
import { useState } from 'react'
import type { TaskSeriesWriteResult } from './calendar-hooks.js'

export const TASK_REPEATS = ['none', 'daily', 'weekly'] as const
export type TaskRepeat = (typeof TASK_REPEATS)[number]

export type TaskDraft = Readonly<{
  title: string
  /** `none` é "sem tipo": o tipo é opcional na tarefa. */
  kind: TaskKind | 'none'
  notes: string
  date: string
  isAllDay: boolean
  startsAt: string
  endsAt: string
  repeat: TaskRepeat
  weekdays: readonly Weekday[]
  /** Vazio é "sem data de término". */
  until: string
}>

export type TaskField = 'title' | 'kind' | 'notes' | 'date' | 'startsAt' | 'endsAt' | 'weekdays' | 'until'

/** Ocorrência que a edição parte: a série, a data original que a identifica e onde caiu de fato. */
export type TaskFormOccurrence = Readonly<{ task: Task; originalDate: LocalDate; date: LocalDate; time: ScheduleTime }>

/** O que o formulário entrega para gravar: série nova ou edição a partir de uma ocorrência. */
export type TaskSubmission =
  | Readonly<{ kind: 'create'; input: TaskInput }>
  | Readonly<{ kind: 'change'; task: Task; change: TaskChange }>

/**
 * `needs-scope` pede que a tela pergunte o alcance entre `scopes`; `no-scope` é edição que
 * nenhum alcance admite (mudar o conteúdo de uma ocorrência que já passou).
 */
export type TaskFormResult = TaskSeriesWriteResult | 'invalid' | 'needs-scope' | 'no-scope'

export type TaskForm = Readonly<{
  values: TaskDraft
  change: <Field extends keyof TaskDraft>(field: Field, value: TaskDraft[Field]) => void
  invalidFields: ReadonlySet<TaskField>
  titleMaxLength: number
  notesMaxLength: number
  /** Alcances que a edição atual admite; vazio na criação. */
  scopes: readonly TaskChangeScope[]
  submit: (scope?: TaskChangeScope) => Promise<TaskFormResult>
  isSaving: boolean
}>

function emptyDraft(date: LocalDate): TaskDraft {
  return { title: '', kind: 'none', notes: '', date, isAllDay: false, startsAt: '', endsAt: '', repeat: 'none', weekdays: [weekdayOfLocalDate(date)], until: '' }
}

function toDraft(occurrence: TaskFormOccurrence): TaskDraft {
  const { task, date, time } = occurrence
  const recurrence = task.schedule.recurrence
  return {
    title: task.title,
    kind: task.kind ?? 'none',
    notes: task.notes ?? '',
    date,
    isAllDay: time.kind === 'all-day',
    startsAt: time.kind === 'timed' ? time.startsAt : '',
    endsAt: time.kind === 'timed' ? time.endsAt : '',
    repeat: recurrence.kind,
    weekdays: recurrence.kind === 'weekly' ? recurrence.weekdays : [weekdayOfLocalDate(date)],
    until: recurrence.kind === 'none' ? '' : recurrence.until ?? '',
  }
}

// A série semanal começa num dos dias dela: o primeiro a partir da data escolhida.
function startsOnFor(draft: TaskDraft): string {
  const date = localDateSchema.safeParse(draft.date)
  if (draft.repeat !== 'weekly' || !date.success) return draft.date
  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = addDays(date.data, offset)
    if (draft.weekdays.includes(weekdayOfLocalDate(candidate))) return candidate
  }
  return draft.date
}

function toRecurrence(draft: TaskDraft): unknown {
  const until = draft.until === '' ? null : draft.until
  switch (draft.repeat) {
    case 'none': return { kind: 'none' }
    case 'daily': return { kind: 'daily', until }
    case 'weekly': return { kind: 'weekly', weekdays: [...draft.weekdays].sort(), until }
  }
}

function toTime(draft: TaskDraft): unknown {
  return draft.isAllDay ? { kind: 'all-day' } : { kind: 'timed', startsAt: draft.startsAt, endsAt: draft.endsAt }
}

function toInput(draft: TaskDraft): unknown {
  return {
    title: draft.title,
    kind: draft.kind === 'none' ? null : draft.kind,
    notes: draft.notes.trim() === '' ? null : draft.notes,
    schedule: { startsOn: startsOnFor(draft), time: toTime(draft), recurrence: toRecurrence(draft) },
  }
}

// O schema aponta caminhos dentro de `schedule`; a tela conhece os campos do rascunho.
function fieldOf(path: readonly PropertyKey[]): TaskField {
  const [first, second, third] = path
  if (first === 'title' || first === 'kind' || first === 'notes') return first
  if (second === 'time') return third === 'endsAt' ? 'endsAt' : 'startsAt'
  if (second === 'recurrence') return third === 'weekdays' ? 'weekdays' : 'until'
  return 'date'
}

// Só data e horário mudaram: é o que "só esta" sabe gravar.
function changesOnlyWhen(draft: TaskDraft, task: Task, input: TaskInput): boolean {
  return input.title === task.title && input.kind === task.kind && input.notes === task.notes
    && JSON.stringify(toRecurrence(draft)) === JSON.stringify(normalizeRecurrence(task))
}

function normalizeRecurrence(task: Task): unknown {
  const recurrence = task.schedule.recurrence
  return recurrence.kind === 'weekly' ? { ...recurrence, weekdays: [...recurrence.weekdays].sort() } : recurrence
}

/**
 * Alcances que uma edição admite. "Só esta" remarca, então só vale quando apenas data e
 * horário mudaram; "desta em diante" nunca começa antes de hoje.
 */
export function listTaskChangeScopes(occurrence: TaskFormOccurrence, isMoveOnly: boolean, today: LocalDate): readonly TaskChangeScope[] {
  return [...(isMoveOnly ? ['this-occurrence' as const] : []), ...(occurrence.originalDate >= today ? ['from-this-occurrence' as const] : [])]
}

/**
 * Alcances de exclusão a partir de uma ocorrência. Tarefa avulsa não pergunta: hoje ou
 * depois ela sai inteira, no passado só aquele dia é cancelado.
 */
export function listTaskRemovalScopes(task: Task, originalDate: LocalDate, today: LocalDate): readonly TaskChangeScope[] {
  if (task.schedule.recurrence.kind === 'none') return [originalDate >= today ? 'from-this-occurrence' : 'this-occurrence']
  return originalDate >= today ? ['this-occurrence', 'from-this-occurrence'] : ['this-occurrence']
}

/**
 * Criação ou edição de uma tarefa. Parte da ocorrência aberta, quando há, ou do dia
 * escolhido; observação em branco vira "sem observação" e término vazio, série sem fim.
 * Em série recorrente devolve `needs-scope` até a tela informar o alcance.
 */
export function useTaskForm(
  options: Readonly<{ occurrence?: TaskFormOccurrence | undefined; date: LocalDate; today: LocalDate; save: (submission: TaskSubmission) => Promise<TaskSeriesWriteResult> }>,
): TaskForm {
  const [values, setValues] = useState<TaskDraft>(() => options.occurrence === undefined ? emptyDraft(options.date) : toDraft(options.occurrence))
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<TaskField>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const parsed = taskInputSchema.safeParse(toInput(values))
  const occurrence = options.occurrence
  const scopes = occurrence === undefined || !parsed.success ? [] : listTaskChangeScopes(occurrence, changesOnlyWhen(values, occurrence.task, parsed.data), options.today)

  async function send(submission: TaskSubmission): Promise<TaskSeriesWriteResult> {
    setIsSaving(true)
    try {
      return await options.save(submission)
    } finally {
      setIsSaving(false)
    }
  }

  return {
    values,
    change: (field, value) => { setValues({ ...values, [field]: value }) },
    invalidFields,
    titleMaxLength: TASK_TITLE_MAX_LENGTH,
    notesMaxLength: TASK_NOTES_MAX_LENGTH,
    scopes,
    submit: async (scope) => {
      if (!parsed.success) {
        setInvalidFields(new Set(parsed.error.issues.map(issue => fieldOf(issue.path))))
        return 'invalid'
      }
      setInvalidFields(new Set())
      if (occurrence === undefined) return send({ kind: 'create', input: parsed.data })
      const isRecurring = occurrence.task.schedule.recurrence.kind !== 'none'
      // Avulsa não pergunta: edição inteira quando cabe, senão só remarca.
      const chosen = isRecurring ? scope : scopes.includes('from-this-occurrence') ? 'from-this-occurrence' : scopes[0]
      if (scopes.length === 0) return 'no-scope'
      if (chosen === undefined || !scopes.includes(chosen)) return 'needs-scope'
      // Remarcar leva o dia escolhido como está: o ajuste ao dia da semana é só da série.
      const movedTo = localDateSchema.safeParse(values.date)
      const change: TaskChange = chosen === 'this-occurrence'
        ? { scope: chosen, occurrenceDate: occurrence.originalDate, date: movedTo.success ? movedTo.data : parsed.data.schedule.startsOn, time: parsed.data.schedule.time }
        : { scope: chosen, occurrenceDate: occurrence.originalDate, task: parsed.data }
      return send({ kind: 'change', task: occurrence.task, change })
    },
    isSaving,
  }
}
