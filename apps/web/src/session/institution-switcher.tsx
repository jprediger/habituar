import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { Button } from '../components/ui/button.js'

/** Expõe a troca explícita de instituição sem decidir destino ou persistência. */
export function InstitutionSwitcher() {
  const { t } = useTranslation()
  const { current, others, switchTo } = habituar.useInstitutionSwitcher()
  if (current === undefined || others.length === 0) return null
  return (
    <details className="relative">
      <summary className="cursor-pointer rounded-control p-md focus-visible:outline-2 focus-visible:outline-focus-ring" aria-label={t('institutionSwitcher.current', { institution: current.institution.name })}>
        {t('institutionSwitcher.change')}
      </summary>
      <div className="absolute right-0 z-40 flex min-w-64 flex-col gap-sm rounded-control border border-hairline bg-surface p-md">
        <p role="status">{t('institutionSwitcher.current', { institution: current.institution.name })}</p>
        {others.map((membership) => <Button key={membership.institution.id} variant="outline" onClick={() => { void switchTo(membership.institution.id) }}>{membership.institution.name}</Button>)}
      </div>
    </details>
  )
}
