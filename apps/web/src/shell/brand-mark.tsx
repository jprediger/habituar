import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Logotipo provisório: marca geométrica e wordmark enquanto a identidade visual não
 * existe. A marca é um laço aberto que fecha num ponto — o hábito que se repete.
 */
export function BrandMark(): ReactElement {
  const { t } = useTranslation()

  return (
    <span className="inline-flex items-center gap-sm text-text">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        focusable="false"
        className="shrink-0 text-primary"
      >
        <path
          d="M19.5 12a7.5 7.5 0 1 1-4.1-6.69"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        <circle cx="18.6" cy="6.9" r="2.1" fill="currentColor" />
      </svg>
      <span className="text-title font-bold lowercase tracking-tight">{t('authentication.brandName')}</span>
    </span>
  )
}
