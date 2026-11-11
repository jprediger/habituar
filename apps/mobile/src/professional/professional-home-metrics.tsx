import { assertNever } from '@habituar/core/assert-never'
import { readLocalDateTime } from '@habituar/core/calendar'
import { useTranslation } from 'react-i18next'
import { useAgendaLabels } from '../agenda/agenda-labels'
import { habituar } from '../client/habituar-client'
import { ListSectionSkeleton } from '../components/skeletons/list-section-skeleton'
import { Skeleton } from '../components/skeletons/skeleton'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'

/**
 * Resumo da agenda do profissional no início: o dia, a semana e quem vem a seguir.
 * Só aparece para quem lê atendimentos; a decisão de mostrar é de quem chama.
 */
export function ProfessionalHomeMetricsSection({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation()
  const labels = useAgendaLabels()
  const now = readLocalDateTime(readCurrentTime())
  const state = habituar.useProfessionalHomeMetrics(session.membership, now.date, now.time)

  switch (state.status) {
    case 'loading':
      return <Skeleton><ListSectionSkeleton hasTitle rows={3} /></Skeleton>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t('home.metrics.failed')}</Text>
    case 'ready': {
      const { next } = state.metrics
      return (
        <ListSection title={t('home.metrics.title')}>
          <ListRow icon="calendar-blank" title={t('home.metrics.appointmentsToday')} value={String(state.metrics.todayAppointments)} />
          <ListRow icon="clipboard-text" title={t('home.metrics.appointmentsWeek')} value={String(state.metrics.weekAppointments)} />
          <ListRow
            icon="user"
            title={t('home.metrics.next')}
            description={next === undefined ? t('home.metrics.nextNone') : `${next.studentName} · ${t('home.metrics.nextValue', { date: labels.formatShortDate(next.date), time: next.startsAt })}`}
          />
        </ListSection>
      )
    }
    default:
      return assertNever(state)
  }
}
