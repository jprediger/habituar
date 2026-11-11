import { assertNever } from '@habituar/core/assert-never'
import type { LocalDate } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import type { StudentHomeMetrics } from '@habituar/react-client/react-client'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { ListSectionSkeleton } from '../components/skeletons/list-section-skeleton'
import { Skeleton } from '../components/skeletons/skeleton'
import { ListRow } from '../components/ui/list-row'
import { ListSection } from '../components/ui/list-section'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'

/**
 * Resumo do aluno no topo do início: progresso de hoje, sequência e constância da semana.
 * Só desenha o que o hook calculou; não decide o que é dia cumprido.
 */
export function StudentHomeMetricsSection({ session, studentId, today }: Readonly<{ session: InstitutionSession; studentId: StudentId; today: LocalDate }>) {
  const { t } = useTranslation()
  const state = habituar.useStudentHomeMetrics(session.membership, studentId, today)

  switch (state.status) {
    case 'loading':
      return <Skeleton><ListSectionSkeleton hasTitle rows={3} /></Skeleton>
    case 'failed':
      return <Text accessibilityRole="alert" tone="danger">{t('home.metrics.failed')}</Text>
    case 'ready':
      return <StudentMetricRows metrics={state.metrics} />
    default:
      return assertNever(state)
  }
}

function StudentMetricRows({ metrics }: Readonly<{ metrics: StudentHomeMetrics }>) {
  const { t } = useTranslation()
  const todayValue = metrics.today.total === 0 ? t('home.metrics.todayNone') : t('home.metrics.todayValue', { done: metrics.today.done, total: metrics.today.total })
  const weekDescription = metrics.weekRate === null
    ? t('home.metrics.weekDescriptionNone')
    : metrics.weekMissing === 0 ? t('home.metrics.weekAllDone') : t('home.metrics.weekMissing', { count: metrics.weekMissing })

  return (
    <ListSection title={t('home.metrics.title')}>
      <ListRow icon="list-checks" title={t('home.metrics.today')} value={todayValue} />
      <ListRow icon="check" title={t('home.metrics.streak')} description={t('home.metrics.streakDescription')} value={t('home.metrics.streakValue', { count: metrics.streakDays })} />
      <ListRow icon="calendar-blank" title={t('home.metrics.week')} description={weekDescription} {...(metrics.weekRate === null ? {} : { value: t('home.metrics.weekValue', { rate: metrics.weekRate }) })} />
    </ListSection>
  )
}
