/**
 * Entrypoint do formulário de bloco da rotina: dono do rascunho semanal, da tradução dele
 * para a série de tarefa do contrato, da validação pelo schema do contrato e do desfecho do
 * envio. Não conhece navegação nem visual.
 */
import { addDays, type LocalDate, type Weekday, weekdayOfLocalDate } from '@habituar/core/calendar'
import { TASK_NOTES_MAX_LENGTH, TASK_TITLE_MAX_LENGTH, taskInputSchema } from '@habituar/core/tasks'
import type { TaskInput, TaskKind } from '@habituar/core/tasks'
import { useState } from 'react'
import type { RoutineBlock, RoutineWriteResult } from './routine-hooks.js'

/** Chave de i18n do nome de cada dia; o mapa fechado mantém a chave verificável no build. */
export const WEEKDAY_LABEL_KEYS = {
  1: 'routine.weekdays.1',
  2: 'routine.weekdays.2',
  3: 'routine.weekdays.3',
  4: 'routine.weekdays.4',
  5: 'routine.weekdays.5',
  6: 'routine.weekdays.6',
  7: 'routine.weekdays.7',
} as const satisfies Readonly<Record<Weekday, `routine.weekdays.${string}`>>

export type RoutineBlockField = 'weekday' | 'startsAt' | 'endsAt' | 'title' | 'kind' | 'notes'

export type RoutineBlockDraft = Readonly<{ weekday: Weekday; startsAt: string; endsAt: string; title: string; kind: TaskKind; notes: string }>

export type RoutineBlockForm = Readonly<{
  values: RoutineBlockDraft
  change: <Field extends RoutineBlockField>(field: Field, value: RoutineBlockDraft[Field]) => void
  invalidFields: ReadonlySet<RoutineBlockField>
  titleMaxLength: number
  notesMaxLength: number
  submit: () => Promise<RoutineWriteResult | 'invalid'>
  isSaving: boolean
}>

function toDraft(block: RoutineBlock | undefined, weekday: Weekday): RoutineBlockDraft {
  if (block === undefined) return { weekday, startsAt: '', endsAt: '', title: '', kind: 'class', notes: '' }
  return { weekday: block.weekday, startsAt: block.startsAt, endsAt: block.endsAt, title: block.title, kind: block.kind ?? 'other', notes: block.notes ?? '' }
}

// Trocar o dia de um bloco troca só aquele dia da série; os outros dias dela continuam.
function weekdaysFor(draft: RoutineBlockDraft, block: RoutineBlock | undefined): readonly Weekday[] {
  if (block === undefined) return [draft.weekday]
  const recurrence = block.task.schedule.recurrence
  const current = recurrence.kind === 'weekly' ? recurrence.weekdays : [block.weekday]
  return [...new Set(current.map(day => day === block.weekday ? draft.weekday : day))]
}

// A série semanal começa num dos dias dela: o primeiro a partir de hoje.
function toTaskInput(draft: RoutineBlockDraft, block: RoutineBlock | undefined, today: LocalDate): unknown {
  const weekdays = weekdaysFor(draft, block)
  const recurrence = block?.task.schedule.recurrence
  const startsOn = [0, 1, 2, 3, 4, 5, 6].map(offset => addDays(today, offset)).find(date => weekdays.includes(weekdayOfLocalDate(date))) ?? today
  return {
    title: draft.title,
    kind: draft.kind,
    notes: draft.notes.trim() === '' ? null : draft.notes,
    schedule: {
      startsOn,
      time: { kind: 'timed', startsAt: draft.startsAt, endsAt: draft.endsAt },
      recurrence: { kind: 'weekly', weekdays, until: recurrence?.kind === 'weekly' ? recurrence.until : null },
    },
  }
}

// O schema da série aponta caminhos dentro de `schedule`; a tela conhece os campos do rascunho.
function fieldOf(path: readonly PropertyKey[]): RoutineBlockField {
  const [first, second, third] = path
  if (first === 'title' || first === 'kind' || first === 'notes') return first
  if (first === 'schedule' && second === 'time' && (third === 'startsAt' || third === 'endsAt')) return third
  return 'weekday'
}

/**
 * Criação ou edição de um bloco semanal da equipe. Parte do bloco existente, quando há, ou do
 * dia escolhido; observação em branco vira "sem observação", e horário invertido aponta o
 * campo de fim. O que é salvo é uma série de tarefa semanal com horário.
 */
export function useRoutineBlockForm(
  options: Readonly<{ block?: RoutineBlock | undefined; weekday: Weekday; today: LocalDate; save: (input: TaskInput) => Promise<RoutineWriteResult> }>,
): RoutineBlockForm {
  const [values, setValues] = useState<RoutineBlockDraft>(() => toDraft(options.block, options.weekday))
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<RoutineBlockField>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  return {
    values,
    change: (field, value) => { setValues({ ...values, [field]: value }) },
    invalidFields,
    titleMaxLength: TASK_TITLE_MAX_LENGTH,
    notesMaxLength: TASK_NOTES_MAX_LENGTH,
    submit: async () => {
      const parsed = taskInputSchema.safeParse(toTaskInput(values, options.block, options.today))
      if (!parsed.success) {
        setInvalidFields(new Set(parsed.error.issues.map(issue => fieldOf(issue.path))))
        return 'invalid'
      }
      setInvalidFields(new Set())
      setIsSaving(true)
      try {
        return await options.save(parsed.data)
      } finally {
        setIsSaving(false)
      }
    },
    isSaving,
  }
}
