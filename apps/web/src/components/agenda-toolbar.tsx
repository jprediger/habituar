import type { AgendaCursor, AgendaView } from '@habituar/react-client/react-client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button.js'
import { useAgendaLabels } from './agenda-labels.js'

const VIEWS: readonly AgendaView[] = ['day', 'week', 'month']

/**
 * Barra da agenda no estilo do Google Agenda: hoje, anterior e próximo, o período em foco
 * e a troca de visão. Dono só do visual; o cursor vem do hook compartilhado.
 */
export function AgendaToolbar({ cursor }: Readonly<{ cursor: AgendaCursor }>): ReactElement {
  const { t } = useTranslation('agenda')
  const labels = useAgendaLabels()

  return (
    <div className="flex flex-wrap items-center justify-between gap-sm">
      <div className="flex flex-wrap items-center gap-sm">
        <Button type="button" variant="outline" onClick={cursor.goToday}>{t('today')}</Button>
        <div className="flex items-center">
          <Button type="button" variant="ghost" size="icon" aria-label={t(`previous.${cursor.view}`)} onClick={cursor.goPrevious}>
            <ChevronLeft aria-hidden className="size-5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label={t(`next.${cursor.view}`)} onClick={cursor.goNext}>
            <ChevronRight aria-hidden className="size-5" />
          </Button>
        </div>
        <h2 aria-live="polite" className="text-title font-medium text-text">{labels.formatPeriod(cursor.view, cursor.date, cursor.range)}</h2>
      </div>
      <div role="group" aria-label={t('viewLabel')} className="flex rounded-button border border-border">
        {VIEWS.map(view => (
          <Button key={view} type="button" variant={cursor.view === view ? 'secondary' : 'ghost'} aria-pressed={cursor.view === view} onClick={() => { cursor.changeView(view) }}>
            {t(`views.${view}`)}
          </Button>
        ))}
      </div>
    </div>
  )
}
