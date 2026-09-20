import { useState } from 'react'
import type { ZodType } from 'zod'
import type { FieldError } from './form-validation.js'
import { getFieldErrors } from './form-validation.js'

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
