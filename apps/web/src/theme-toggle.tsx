import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './components/ui/button.js'
import { useThemePreference } from './use-theme-preference.js'

/** Controle de tema claro/escuro das telas internas; não sabe qual tela o contém. */
export function ThemeToggle(): ReactElement {
  const { t } = useTranslation()
  const { theme, toggle } = useThemePreference()
  const isDark = theme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      // O botão troca o tema, então o rótulo anuncia o destino da ação, não o estado
      // atual — quem usa leitor de tela ouve o que vai acontecer ao acionar.
      aria-label={isDark ? t('theme.activateLight') : t('theme.activateDark')}
      onClick={toggle}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  )
}

function SunIcon(): ReactElement {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon(): ReactElement {
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
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79" />
    </svg>
  )
}
