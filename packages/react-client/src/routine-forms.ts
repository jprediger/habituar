/**
 * Entrypoint do formulário de bloco da rotina: dono do rascunho, da validação pelo schema
 * do contrato e do desfecho do envio. Não conhece navegação nem visual.
 */
import { ROUTINE_NOTES_MAX_LENGTH, ROUTINE_TITLE_MAX_LENGTH, routineBlockInputSchema } from '@habituar/core/routines'
import type { RoutineBlock, RoutineBlockInput, RoutineKind, Weekday } from '@habituar/core/routines'
import { useState } from 'react'
import type { RoutineWriteResult } from './routine-hooks.js'

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

export type RoutineBlockDraft = Readonly<{ weekday: Weekday; startsAt: string; endsAt: string; title: string; kind: RoutineKind; notes: string }>

export type RoutineBlockForm = Readonly<{
  values: RoutineBlockDraft
  change: <Field extends RoutineBlockField>(field: Field, value: RoutineBlockDraft[Field]) => void
  invalidFields: ReadonlySet<RoutineBlockField>
  titleMaxLength: number
  notesMaxLength: number
  submit: () => Promise<RoutineWriteResult | 'invalid'>
  isSaving: boolean
}>

const FIELDS: readonly RoutineBlockField[] = ['weekday', 'startsAt', 'endsAt', 'title', 'kind', 'notes']

function toDraft(block: RoutineBlock | undefined, weekday: Weekday): RoutineBlockDraft {
  if (block === undefined) return { weekday, startsAt: '', endsAt: '', title: '', kind: 'class', notes: '' }
  return { weekday: block.weekday, startsAt: block.startsAt, endsAt: block.endsAt, title: block.title, kind: block.kind, notes: block.notes ?? '' }
}

/**
 * Criação ou edição de um bloco. Parte do bloco existente, quando há, ou do dia escolhido;
 * observação em branco vira "sem observação", e horário invertido aponta o campo de fim.
 */
export function useRoutineBlockForm(
  options: Readonly<{ block?: RoutineBlock | undefined; weekday: Weekday; save: (input: RoutineBlockInput) => Promise<RoutineWriteResult> }>,
): RoutineBlockForm {
  const [values, setValues] = useState<RoutineBlockDraft>(() => toDraft(options.block, options.weekday))
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<RoutineBlockField>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  return {
    values,
    change: (field, value) => { setValues({ ...values, [field]: value }) },
    invalidFields,
    titleMaxLength: ROUTINE_TITLE_MAX_LENGTH,
    notesMaxLength: ROUTINE_NOTES_MAX_LENGTH,
    submit: async () => {
      const parsed = routineBlockInputSchema.safeParse({ ...values, notes: values.notes.trim() === '' ? null : values.notes })
      if (!parsed.success) {
        setInvalidFields(new Set(parsed.error.issues.flatMap((issue) => FIELDS.filter((field) => field === issue.path[0]))))
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
