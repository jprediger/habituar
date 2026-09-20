import type { InputHTMLAttributes, ReactElement } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils.js'
import { Input } from './input.js'

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Campo de senha com alternância de visibilidade. Dono apenas de mostrar ou esconder o
 * que foi digitado — nunca guarda, transforma ou valida a senha.
 */
export function PasswordInput({ className, ...props }: PasswordInputProps): ReactElement {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative flex items-center">
      <Input
        {...props}
        type={isVisible ? 'text' : 'password'}
        // Espaço reservado para o botão: o texto digitado nunca corre por baixo dele.
        className={cn('pr-[var(--interaction-minimum-touch-target)]', className)}
      />
      <button
        type="button"
        onClick={() => {
          setIsVisible(!isVisible)
        }}
        aria-pressed={isVisible}
        aria-label={isVisible ? t('form.password.hide') : t('form.password.show')}
        className={
          'absolute right-0 flex min-h-tap-target min-w-tap-target cursor-pointer items-center ' +
          'justify-center rounded-md text-text-muted transition-colors hover:text-text outline-none ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring'
        }
      >
        <VisibilityIcon isVisible={isVisible} />
      </button>
    </div>
  )
}

function VisibilityIcon({ isVisible }: Readonly<{ isVisible: boolean }>): ReactElement {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {isVisible && <path d="m3 3 18 18" />}
    </svg>
  )
}
