/**
 * Entrypoint dos formulários da ficha do estudante: dono do rascunho, do envio e de qual
 * falha mostrar ao editar a ficha e ao registrar observação ou consulta. Não conhece navegação nem
 * visual; cada plataforma recebe estado e ações prontos.
 */
import type { StudentProfileRevisionId } from '@habituar/core/identity/ids'
import {
  CONSULTATION_MAX_DURATION_MINUTES,
  consultationInputSchema,
  observationInputSchema,
  STUDENT_RECORD_TEXT_MAX_LENGTH,
  studentProfileFieldSchema,
  studentProfileInputSchema,
} from '@habituar/core/student-records'
import type {
  ConsultationInput,
  ObservationInput,
  StudentCondition,
  StudentProfile,
  StudentProfileField,
  StudentProfileInput,
  StudentProfileState,
} from '@habituar/core/student-records'
import { useState } from 'react'
import { readFailureCode } from './request-failure.js'

export type StudentProfileTextField = Exclude<StudentProfileField, 'conditions'>

/**
 * Desfecho de um envio, para a tela avisar o sucesso pelo que a ação devolveu — nunca
 * observando o estado do formulário, que também muda por cancelamento.
 */
export type FormSubmission = 'saved' | 'not-saved'

type StudentProfileDraft = Readonly<Record<StudentProfileTextField, string> & { conditions: readonly StudentCondition[] }>

const EMPTY_DRAFT: StudentProfileDraft = {
  schoolGrade: '',
  conditions: [],
  supportNeeds: '',
}

function toDraft(profile: StudentProfile): StudentProfileDraft {
  return {
    schoolGrade: profile.schoolGrade ?? '',
    conditions: profile.conditions,
    supportNeeds: profile.supportNeeds ?? '',
  }
}

// Campo em branco no formulário é "não informado" na ficha: o schema só aceita `null`.
function blankToNull(value: string): string | null {
  return value.trim() === '' ? null : value
}

function currentRevisionId(profile: StudentProfileState): StudentProfileRevisionId | null {
  return profile.status === 'filled' ? profile.revision.id : null
}

/**
 * `conflict`: outra pessoa gravou a ficha depois que a edição começou. O rascunho é
 * mantido — apagar o que a pessoa digitou seria a ação destrutiva sem desfazer que as
 * regras cognitivas proíbem —, e salvar de novo passa a substituir a versão atual.
 */
export type StudentProfileFormFailure = 'invalid' | 'conflict' | 'server'

export type StudentProfileForm = Readonly<{
  isEditing: boolean
  startEditing: () => void
  cancel: () => void
  values: StudentProfileDraft
  change: (field: StudentProfileTextField, value: string) => void
  setCondition: (condition: StudentCondition, isSelected: boolean) => void
  invalidFields: ReadonlySet<StudentProfileField>
  submit: () => Promise<FormSubmission>
  isSaving: boolean
  failure: StudentProfileFormFailure | undefined
}>

/**
 * Edição da ficha validada pelo schema do contrato antes do envio. Guarda a revisão que a
 * pessoa estava vendo ao começar, para a API recusar a gravação se ela já mudou.
 */
export function useStudentProfileForm(
  options: Readonly<{ profile: StudentProfileState; save: (input: StudentProfileInput) => Promise<void> }>,
): StudentProfileForm {
  const [draft, setDraft] = useState<StudentProfileDraft | undefined>(undefined)
  const [basedOnRevisionId, setBasedOnRevisionId] = useState<StudentProfileRevisionId | null>(null)
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<StudentProfileField>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [failure, setFailure] = useState<StudentProfileFormFailure | undefined>(undefined)
  const values = draft ?? (options.profile.status === 'filled' ? toDraft(options.profile.revision) : EMPTY_DRAFT)

  function stopEditing(): void {
    setDraft(undefined)
    setInvalidFields(new Set())
    setFailure(undefined)
  }

  return {
    isEditing: draft !== undefined,
    startEditing: () => {
      setDraft(values)
      setBasedOnRevisionId(currentRevisionId(options.profile))
      setFailure(undefined)
    },
    cancel: stopEditing,
    values,
    change: (field, value) => { setDraft({ ...values, [field]: value }) },
    setCondition: (condition, isSelected) => {
      const others = values.conditions.filter((entry) => entry !== condition)
      setDraft({ ...values, conditions: isSelected ? [...others, condition] : others })
    },
    invalidFields,
    submit: async () => {
      const parsed = studentProfileInputSchema.safeParse({
        schoolGrade: blankToNull(values.schoolGrade),
        conditions: values.conditions,
        supportNeeds: blankToNull(values.supportNeeds),
        // Depois de um conflito avisado, salvar de novo é a decisão de substituir a atual.
        basedOnRevisionId: failure === 'conflict' ? currentRevisionId(options.profile) : basedOnRevisionId,
      })
      if (!parsed.success) {
        setInvalidFields(new Set(parsed.error.issues.flatMap((issue) => {
          const field = studentProfileFieldSchema.safeParse(issue.path[0])
          return field.success ? [field.data] : []
        })))
        setFailure('invalid')
        return 'not-saved'
      }
      setInvalidFields(new Set())
      setIsSaving(true)
      setFailure(undefined)
      try {
        await options.save(parsed.data)
        stopEditing()
        return 'saved'
      } catch (error) {
        setFailure(readFailureCode(error) === 'conflict' ? 'conflict' : 'server')
        return 'not-saved'
      } finally {
        setIsSaving(false)
      }
    },
    isSaving,
    failure,
  }
}

export type ObservationFormFailure = 'invalid' | 'server'

export type ObservationForm = Readonly<{
  body: string
  setBody: (value: string) => void
  maxLength: number
  isConfirming: boolean
  request: () => void
  cancel: () => void
  confirm: () => Promise<FormSubmission>
  isSaving: boolean
  failure: ObservationFormFailure | undefined
}>

/**
 * Registro de observação em dois passos: depois de registrada, ela não é editada nem
 * apagada, então a confirmação é explícita e diz isso antes de gravar.
 */
export function useObservationForm(options: Readonly<{ add: (input: ObservationInput) => Promise<void> }>): ObservationForm {
  const [body, setBody] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [failure, setFailure] = useState<ObservationFormFailure | undefined>(undefined)

  return {
    body,
    setBody: (value) => {
      setBody(value)
      if (failure === 'invalid') setFailure(undefined)
    },
    maxLength: STUDENT_RECORD_TEXT_MAX_LENGTH,
    isConfirming,
    request: () => {
      if (!observationInputSchema.safeParse({ body }).success) { setFailure('invalid'); return }
      setFailure(undefined)
      setIsConfirming(true)
    },
    cancel: () => { setIsConfirming(false) },
    confirm: async () => {
      const parsed = observationInputSchema.safeParse({ body })
      if (!parsed.success) { setFailure('invalid'); setIsConfirming(false); return 'not-saved' }
      setIsSaving(true)
      try {
        await options.add(parsed.data)
        setBody('')
        setIsConfirming(false)
        setFailure(undefined)
        return 'saved'
      } catch {
        setFailure('server')
        return 'not-saved'
      } finally {
        setIsSaving(false)
      }
    },
    isSaving,
    failure,
  }
}

export type ConsultationField = 'occurredAt' | 'durationMinutes' | 'notes'

/** `future`: a API recusou a data porque o registro é do que já aconteceu, não agenda. */
export type ConsultationFormFailure = 'invalid' | 'future' | 'server'

export type ConsultationForm = Readonly<{
  values: Readonly<Record<ConsultationField, string>>
  change: (field: ConsultationField, value: string) => void
  notesMaxLength: number
  maxDurationMinutes: number
  invalidFields: ReadonlySet<ConsultationField>
  isConfirming: boolean
  request: () => void
  cancel: () => void
  confirm: () => Promise<FormSubmission>
  isSaving: boolean
  failure: ConsultationFormFailure | undefined
}>

const EMPTY_CONSULTATION: Readonly<Record<ConsultationField, string>> = { occurredAt: '', durationMinutes: '', notes: '' }

// O campo de data e hora do formulário não carrega fuso (`2026-09-28T14:30`): lido como
// hora local de quem digitou, vira instante absoluto antes de sair para a API.
function toInstant(localDateTime: string): string | undefined {
  if (localDateTime.trim() === '') return undefined
  const instant = new Date(localDateTime)
  return Number.isNaN(instant.getTime()) ? undefined : instant.toISOString()
}

function parseConsultation(values: Readonly<Record<ConsultationField, string>>) {
  return consultationInputSchema.safeParse({
    occurredAt: toInstant(values.occurredAt),
    durationMinutes: values.durationMinutes.trim() === '' ? undefined : Number(values.durationMinutes),
    notes: values.notes,
  })
}

/**
 * Registro de consulta realizada em dois passos: depois de gravada ela não muda, então a
 * confirmação é explícita. Falha de envio mantém tudo o que foi digitado.
 */
export function useConsultationForm(options: Readonly<{ record: (input: ConsultationInput) => Promise<void> }>): ConsultationForm {
  const [values, setValues] = useState(EMPTY_CONSULTATION)
  const [invalidFields, setInvalidFields] = useState<ReadonlySet<ConsultationField>>(new Set())
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [failure, setFailure] = useState<ConsultationFormFailure | undefined>(undefined)

  return {
    values,
    change: (field, value) => {
      setValues({ ...values, [field]: value })
      if (failure === 'future' && field === 'occurredAt') setFailure(undefined)
    },
    notesMaxLength: STUDENT_RECORD_TEXT_MAX_LENGTH,
    maxDurationMinutes: CONSULTATION_MAX_DURATION_MINUTES,
    invalidFields,
    isConfirming,
    request: () => {
      const parsed = parseConsultation(values)
      if (!parsed.success) {
        setInvalidFields(new Set(parsed.error.issues.flatMap((issue) => {
          const field = issue.path[0]
          return field === 'occurredAt' || field === 'durationMinutes' || field === 'notes' ? [field] : []
        })))
        setFailure('invalid')
        return
      }
      setInvalidFields(new Set())
      setFailure(undefined)
      setIsConfirming(true)
    },
    cancel: () => { setIsConfirming(false) },
    confirm: async () => {
      const parsed = parseConsultation(values)
      if (!parsed.success) { setIsConfirming(false); setFailure('invalid'); return 'not-saved' }
      setIsSaving(true)
      try {
        await options.record(parsed.data)
        setValues(EMPTY_CONSULTATION)
        setIsConfirming(false)
        setFailure(undefined)
        return 'saved'
      } catch (error) {
        setIsConfirming(false)
        setFailure(readFailureCode(error) === 'consultation-in-future' ? 'future' : 'server')
        return 'not-saved'
      } finally {
        setIsSaving(false)
      }
    },
    isSaving,
    failure,
  }
}
