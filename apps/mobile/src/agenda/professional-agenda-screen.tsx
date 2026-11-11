import { assertNever } from '@habituar/core/assert-never'
import { readLocalDateTime } from '@habituar/core/calendar'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { AgendaDayList } from '../components/agenda-day-list'
import { AgendaWeekStrip } from '../components/agenda-week-strip'
import { ListSectionSkeleton } from '../components/skeletons/list-section-skeleton'
import { Skeleton } from '../components/skeletons/skeleton'
import { SkeletonBlock } from '../components/skeletons/skeleton-block'
import { ListRow } from '../components/ui/list-row'
import { Page } from '../components/ui/page'
import { PageHeader } from '../components/ui/page-header'
import { Text } from '../components/ui/text'
import type { InstitutionSession } from '../session/session-screen'
import { readCurrentTime } from '../time/current-time'
import { useAgendaLabels } from './agenda-labels'

/**
 * Aba Agenda do profissional, na visão "Programação" do Google Agenda: a semana no topo e
 * os atendimentos do dia escolhido em lista. Tocar abre o detalhe; quem tem
 * `appointment.write` agenda a partir do próprio dia.
 */
export function ProfessionalAgendaScreen({ session }: Readonly<{ session: InstitutionSession }>) {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const router = useRouter()
  const labels = useAgendaLabels()
  const now = readLocalDateTime(readCurrentTime())
  const cursor = habituar.useAgendaCursor(now.date, 'week')
  const agenda = habituar.useProfessionalAgenda(session.membership, cursor.range)

  return (
    <Page>
      <PageHeader eyebrow={tc('navigation.agenda')} title={t('title')} />
      {(() => {
        switch (agenda.state.status) {
          case 'loading':
            return <Skeleton><SkeletonBlock height={64} /><ListSectionSkeleton rows={3} hasTitle /></Skeleton>
          case 'failed':
            return <Text accessibilityRole="alert" tone="danger">{t(agenda.state.failure === 'forbidden' ? 'forbidden' : 'failed')}</Text>
          case 'ready': {
            const busyDates = new Set(agenda.state.days.filter(day => day.items.length > 0).map(day => day.date))
            const day = agenda.state.days.find(candidate => candidate.date === cursor.date) ?? { date: cursor.date, items: [] }
            return (
              <>
                <AgendaWeekStrip cursor={cursor} today={now.date} busyDates={busyDates} />
                <AgendaDayList
                  day={day}
                  describeItem={item => item.kind === 'appointment'
                    ? { title: item.occurrence.appointment.studentName, description: labels.formatRecurrence(item.occurrence.appointment) ?? t('appointment') }
                    : { title: item.task.title, description: item.task.kind === null ? tc('routine.noKind') : tc(`routine.kinds.${item.task.kind}`) }}
                  onItemPress={(item) => {
                    if (item.kind !== 'appointment') return
                    router.push({ pathname: '/professional/agenda/appointment/[appointment-id]', params: { 'appointment-id': item.occurrence.appointment.id, student: item.occurrence.appointment.studentId, date: item.date } })
                  }}
                  footer={agenda.canSchedule
                    ? <ListRow icon="plus" title={t('newOn', { date: labels.formatShortDate(cursor.date) })} onPress={() => { router.push({ pathname: '/professional/agenda/new', params: { date: cursor.date } }) }} />
                    : undefined}
                />
              </>
            )
          }
          default:
            return assertNever(agenda.state)
        }
      })()}
    </Page>
  )
}
