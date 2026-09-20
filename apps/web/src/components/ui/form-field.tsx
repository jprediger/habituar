import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../lib/utils.js'

export type FormFieldControl = Readonly<{
  id: string
  required: boolean
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}>

export type FormFieldProps = Readonly<{
  id: string
  label: string
  isRequired: boolean
  requiredMarkLabel: string
  hint?: string | undefined
  error?: string | undefined
  action?: ReactNode | undefined
  className?: string | undefined
  children: (control: FormFieldControl) => ReactNode
}>

/**
 * Enquadramento de um campo de formulário: título, marca de obrigatório, ação da linha
 * do título, dica e mensagem de erro. Dona da amarração acessível entre esses textos e
 * o controle — que recebe pronta e nunca monta por conta própria.
 */
export function FormField({
  id,
  label,
  isRequired,
  requiredMarkLabel,
  hint,
  error,
  action,
  className,
  children,
}: FormFieldProps): ReactElement {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint === undefined ? undefined : hintId, error === undefined ? undefined : errorId]
    .filter((value) => value !== undefined)
    .join(' ')

  return (
    <div className={cn('flex flex-col gap-xs', className)}>
      <div className="flex min-h-compact-tap-target items-center justify-between gap-sm">
        <label htmlFor={id} className="text-body font-medium">
          {label}
          {isRequired && (
            // O asterisco é redundante para leitor de tela — o `required` do controle já
            // anuncia a obrigatoriedade —, então ele existe só para quem enxerga, e o
            // texto equivalente acompanha o rótulo sem ser lido duas vezes.
            <span className="text-danger" title={requiredMarkLabel} aria-hidden="true">
              {' *'}
            </span>
          )}
        </label>
        {action}
      </div>

      {children({
        id,
        required: isRequired,
        'aria-invalid': error !== undefined,
        'aria-describedby': describedBy === '' ? undefined : describedBy,
      })}

      {hint !== undefined && (
        <p id={hintId} className="text-caption text-text-muted">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
