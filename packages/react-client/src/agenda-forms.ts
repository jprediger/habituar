/**
 * Entrypoint dos formulários da agenda: atendimento da equipe, observação do aluno sobre
 * a ocorrência da tarefa e avaliação da equipe. Dono do rascunho, da validação pelo schema do contrato e do desfecho do
 * envio. Não conhece navegação nem visual.
 */
import { APPOINTMENT_NOTES_MAX_LENGTH, appointmentInputSchema } from '@habituar/core/appointments'
import type { Appointment, AppointmentInput } from '@habituar/core/appointments'
import type { LocalDate } from '@habituar/core/calendar'
import { studentIdSchema } from '@habituar/core/identity/ids'
import type { StudentId } from '@habituar/core/identity/ids'
import { TASK_EVALUATION_COMMENT_MAX_LENGTH, TASK_OCCURRENCE_NOTES_MAX_LENGTH, taskEvaluationInputSchema, taskOccurrenceNoteInputSchema } from '@habituar/core/tasks'
import type { TaskEvaluationInput, TaskEvaluationOutcome, TaskOccurrence } from '@habituar/core/tasks'
import { useState } from 'react'
import type { AgendaWriteResult } from './agenda-hooks.js'
import type { RoutineEntryWriteResult } from './offline-sync.js'

/** Durações oferecidas na escolha rápida; o atendimento escolar raramente foge delas. */
export const APPOINTMENT_DURATION_OPTIONS = [30, 45, 50, 60, 90] as const

export type AppointmentField = 'studentId' | 'startsOn' | 'startsAt' | 'durationMinutes' | 'notes' | 'until'

export type AppointmentDraft = Readonly<{
  studentId: StudentId | undefined
  startsOn: string
  startsAt: string
  durationMinutes: number
  notes: string
  isWeekly: boolean
  /** Vazio é "sem data de término". */
  until: string
}>

export type AppointmentForm = Readonly<{
  values: AppointmentDraft
  change: <Field extends keyof AppointmentDraft>(field: Field, value: AppointmentDraft[Field]) => void
  invalidFields: ReadonlySet<AppointmentField>
  notesMaxLength: number
  /** O aluno de um atendimento existente não muda: trocar de aluno é outro atendimento. */
  isStudentLocked: boolean
  submit: () => Promise<AgendaWriteResult | 'invalid'>
  isSaving: boolean
}>

function toDraft(appointment: Appointment | undefined, date: LocalDate, time: string, studentId: StudentId | undefined): AppointmentDraft {
  if (appointment === undefined) return { studentId, startsOn: date, startsAt: time, durationMinutes: 50, notes: '', isWeekly: false, until: '' }
  return {
    studentId: appointment.studentId,
    startsOn: appointment.startsOn,
    startsAt: appointment.startsAt,
    durationMinutes: appointment.durationMinutes,
    notes: appointment.notes ?? '',
    isWeekly: appointment.recurrence.kind === 'weekly',
    until: appointment.recurrence.kind === 'weekly' ? appointment.recurrence.until ?? '' : '',
  }
}

// O schema aponta `recurrence` quando o término vem antes do início; na tela o campo é "Até".
function toField(path: PropertyKey | undefined): AppointmentField | undefined {
  if (path === 'recurrence') return 'until'
  if (path === 'startsOn' || path === 'startsAt' || path === 'durationMinutes' || path === 'notes') return path
  return undefined
}

/**
 * Criação ou edição de um atendimento. Parte do existente, quando há, ou do dia, do horário
 * e do aluno escolhidos; observação em branco vira "sem observação" e término vazio, série sem fim.
 */
export function useAppointmentForm(
  options: Readonly<{
    appointment?: Appointment | undefined
    date: LocalDate
    /** Horário clicado na grade; vazio quando a pessoa ainda vai escolher. */
    time?: string | undefined
    studentId?: StudentId | undefined
    save: (studentId: StudentId, input: AppointmentInput) => Promise<AgendaWriteResult>
  }>,
): AppointmentForm {
  const [values, setValues] = useState<AppointmentDraft>(() => toDraft(options.appointment, options.date, options.time ?? '', options.studentId))
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<AppointmentField>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  return {
    values,
    change: (field, value) => { setValues({ ...values, [field]: value }) },
    invalidFields,
    notesMaxLength: APPOINTMENT_NOTES_MAX_LENGTH,
    isStudentLocked: options.appointment !== undefined,
    submit: async () => {
      const student = studentIdSchema.safeParse(values.studentId)
      const parsed = appointmentInputSchema.safeParse({
        startsOn: values.startsOn,
        startsAt: values.startsAt,
        durationMinutes: values.durationMinutes,
        notes: values.notes.trim() === '' ? null : values.notes,
        recurrence: values.isWeekly ? { kind: 'weekly', until: values.until === '' ? null : values.until } : { kind: 'none' },
      })
      if (!student.success || !parsed.success) {
        const fields = new Set<AppointmentField>(parsed.success ? [] : parsed.error.issues.flatMap(issue => toField(issue.path[0]) ?? []))
        if (!student.success) fields.add('studentId')
        setInvalidFields(fields)
        return 'invalid'
      }
      setInvalidFields(new Set())
      setIsSaving(true)
      try {
        return await options.save(student.data, parsed.data)
      } finally {
        setIsSaving(false)
      }
    },
    isSaving,
  }
}

export type TaskNoteForm = Readonly<{
  notes: string
  change: (notes: string) => void
  isInvalid: boolean
  maxLength: number
  submit: () => Promise<RoutineEntryWriteResult | 'invalid'>
  isSaving: boolean
}>

/** Observação do aluno sobre a ocorrência da tarefa; texto em branco apaga a que existia. */
export function useTaskNoteForm(
  options: Readonly<{ occurrence: TaskOccurrence | undefined; save: (notes: string | null) => Promise<RoutineEntryWriteResult> }>,
): TaskNoteForm {
  const [notes, setNotes] = useState(options.occurrence?.notes ?? '')
  const [isInvalid, setIsInvalid] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  return {
    notes,
    change: setNotes,
    isInvalid,
    maxLength: TASK_OCCURRENCE_NOTES_MAX_LENGTH,
    submit: async () => {
      const parsed = taskOccurrenceNoteInputSchema.safeParse({ notes: notes.trim() === '' ? null : notes })
      if (!parsed.success) {
        setIsInvalid(true)
        return 'invalid'
      }
      setIsInvalid(false)
      setIsSaving(true)
      try {
        return await options.save(parsed.data.notes)
      } finally {
        setIsSaving(false)
      }
    },
    isSaving,
  }
}

export type TaskEvaluationForm = Readonly<{
  outcome: TaskEvaluationOutcome | undefined
  changeOutcome: (outcome: TaskEvaluationOutcome) => void
  comment: string
  changeComment: (comment: string) => void
  invalidField: 'outcome' | 'comment' | undefined
  maxLength: number
  submit: () => Promise<AgendaWriteResult | 'invalid'>
  isSaving: boolean
}>

/** Retorno da equipe sobre a ocorrência concluída: o conceito é obrigatório, o comentário não. */
export function useTaskEvaluationForm(
  options: Readonly<{ occurrence: TaskOccurrence | undefined; save: (input: TaskEvaluationInput) => Promise<AgendaWriteResult> }>,
): TaskEvaluationForm {
  const [outcome, setOutcome] = useState<TaskEvaluationOutcome | undefined>(options.occurrence?.evaluation?.outcome)
  const [comment, setComment] = useState(options.occurrence?.evaluation?.comment ?? '')
  const [invalidField, setInvalidField] = useState<'outcome' | 'comment' | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)

  return {
    outcome,
    changeOutcome: setOutcome,
    comment,
    changeComment: setComment,
    invalidField,
    maxLength: TASK_EVALUATION_COMMENT_MAX_LENGTH,
    submit: async () => {
      const parsed = taskEvaluationInputSchema.safeParse({ outcome, comment: comment.trim() === '' ? null : comment })
      if (!parsed.success) {
        setInvalidField(parsed.error.issues.some(issue => issue.path[0] === 'outcome') ? 'outcome' : 'comment')
        return 'invalid'
      }
      setInvalidField(undefined)
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
