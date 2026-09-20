/**
 * Entrypoint de validação de formulário do pacote (D4): a regra de validade vem do schema
 * zod que a API já publica, e o estado de preenchimento que decide *quando* a falha
 * aparece. Não é dono do texto — cada app traduz `FieldError` no próprio catálogo.
 */
import { useState } from 'react'
import type { ZodType } from 'zod'

/**
 * Falhas de preenchimento que a interface sabe explicar ao usuário. União fechada de
 * propósito: issue do zod que não caia aqui vira erro de build, não mensagem em inglês
 * vazando do validador para a tela.
 */
export type FieldError =
  | Readonly<{ code: 'required' }>
  | Readonly<{ code: 'invalid-email' }>
  | Readonly<{ code: 'too-short'; minimum: number }>

export type FieldErrors = Readonly<Record<string, FieldError | undefined>>

function toFieldError(issue: Readonly<{ code: string; minimum?: unknown; format?: unknown }>): FieldError {
  if (issue.code === 'invalid_format' && issue.format === 'email') return { code: 'invalid-email' }

  if (issue.code === 'too_small' && typeof issue.minimum === 'number') {
    // `min(1)` é "não pode ficar em branco"; qualquer piso maior é "curto demais". A
    // distinção pertence ao texto, não ao schema — por isso mora aqui.
    return issue.minimum <= 1 ? { code: 'required' } : { code: 'too-short', minimum: issue.minimum }
  }

  return { code: 'required' }
}

/**
 * Único ponto que traduz o resultado de um schema zod em falha por campo; o schema
 * continua sendo a fonte da verdade e nenhuma tela reimplementa a regra de validade.
 */
export function getFieldErrors(schema: ZodType, values: Readonly<Record<string, string>>): FieldErrors {
  const result = schema.safeParse(values)

  if (result.success) return {}

  const errors: Record<string, FieldError> = {}

  for (const issue of result.error.issues) {
    const [field] = issue.path

    // Issue sem caminho pertence ao objeto inteiro, não a um campo: não há onde ancorar
    // a mensagem, e o envio já está bloqueado de qualquer forma.
    if (typeof field !== 'string') continue
    if (errors[field] !== undefined) continue

    errors[field] = toFieldError(issue)
  }

  return errors
}

export type ValidatedField = Readonly<{
  value: string
  error: FieldError | undefined
  setValue: (value: string) => void
  markVisited: () => void
}>

export type ValidatedForm<TField extends string> = Readonly<{
  getField: (name: TField) => ValidatedField
  isValid: boolean
  handleSubmit: (onValid: () => void) => (event: Readonly<{ preventDefault: () => void }>) => void
}>

/**
 * Estado de preenchimento de um formulário validado por schema zod. Dona de quando a
 * falha *aparece* — nunca enquanto o campo é digitado pela primeira vez, sempre depois
 * de sair dele ou de tentar enviar. Não conhece transporte nem tela.
 */
export function useValidatedForm<TField extends string>(
  schema: ZodType,
  initialValues: Readonly<Record<TField, string>>,
): ValidatedForm<TField> {
  const [values, setValues] = useState<Readonly<Record<TField, string>>>(initialValues)
  const [visitedFields, setVisitedFields] = useState<ReadonlySet<string>>(new Set())
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false)

  const errors = getFieldErrors(schema, values)

  function getField(name: TField): ValidatedField {
    // Erro só depois que a pessoa saiu do campo ou tentou enviar: acusar "e-mail
    // inválido" na primeira letra digitada é ruído, não ajuda (WCAG 3.3.1).
    const isRevealed = visitedFields.has(name) || hasAttemptedSubmit

    return {
      value: values[name],
      error: isRevealed ? errors[name] : undefined,
      setValue: (value: string) => {
        setValues((current) => ({ ...current, [name]: value }))
      },
      markVisited: () => {
        setVisitedFields((current) => new Set(current).add(name))
      },
    }
  }

  function handleSubmit(onValid: () => void) {
    return (event: Readonly<{ preventDefault: () => void }>): void => {
      event.preventDefault()
      setHasAttemptedSubmit(true)

      if (Object.keys(getFieldErrors(schema, values)).length > 0) return

      onValid()
    }
  }

  return { getField, isValid: Object.keys(errors).length === 0, handleSubmit }
}
