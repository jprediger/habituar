import { assertNever } from '@habituar/core/assert-never'
import { readLocalDateTime } from '@habituar/core/calendar'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { useAgendaLabels } from '../components/agenda-labels.js'
import { MetricTiles } from '../components/ui/metric-tiles.js'
import { Section } from '../components/ui/section.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { readCurrentTime } from '../time/current-time.js'

/**
 * Resumo da agenda do profissional no início: o dia, a semana e quem vem a seguir.
 * A decisão de mostrar, pela permissão de ler atendimentos, é de quem chama.
 */
export function ProfessionalHomeMetrics(): ReactElement {
  const { t } = useTranslation()
  const session = useInstitutionSession()
  const labels = useAgendaLabels()
  const now = readLocalDateTime(readCurrentTime())
  const state = habituar.useProfessionalHomeMetrics(session.membership, now.date, now.time)

  return (
    <Section title={t('home.metrics.title')}>
      {(() => {
        switch (state.status) {
          case 'loading':
            return <p role="status" className="text-body text-text-muted">{t('home.metrics.loading')}</p>
          case 'failed':
            return <p role="alert" className="text-body text-danger">{t('home.metrics.failed')}</p>
          case 'ready': {
            const { next } = state.metrics
            return (
              <MetricTiles
                items={[
                  { label: t('home.metrics.appointmentsToday'), value: String(state.metrics.todayAppointments) },
                  { label: t('home.metrics.appointmentsWeek'), value: String(state.metrics.weekAppointments) },
                  next === undefined
                    ? { label: t('home.metrics.next'), value: t('home.metrics.nextNone') }
                    : { label: t('home.metrics.next'), value: next.studentName, hint: t('home.metrics.nextValue', { date: labels.formatShortDate(next.date), time: next.startsAt }) },
                ]}
              />
            )
          }
          default:
            return assertNever(state)
        }
      })()}
    </Section>
  )
}
