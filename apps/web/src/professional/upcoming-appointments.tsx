import { assertNever } from '@habituar/core/assert-never'
import { addDays, readLocalDateTime } from '@habituar/core/calendar'
import { Link } from '@tanstack/react-router'
import { CalendarDays } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client.js'
import { useAgendaLabels } from '../components/agenda-labels.js'
import { Button } from '../components/ui/button.js'
import { EmptyState } from '../components/ui/empty-state.js'
import { useInstitutionSession } from '../session/institution-session.js'
import { readCurrentTime } from '../time/current-time.js'

// Uma semana adiante basta para "próximos": o resto da agenda mora na tela da agenda.
const UPCOMING_DAYS = 7
const UPCOMING_LIMIT = 5

/**
 * Próximos atendimentos no início do profissional, em ordem de horário, com atalho para a
 * agenda inteira. O que já terminou hoje não aparece: "próximo" é o que ainda vai acontecer.
 */
export function UpcomingAppointments(): ReactElement {
  const { t } = useTranslation('agenda')
  const { t: tc } = useTranslation()
  const session = useInstitutionSession()
  const labels = useAgendaLabels()
  const now = readLocalDateTime(readCurrentTime())
  const agenda = habituar.useProfessionalAgenda(session.membership, { from: now.date, to: addDays(now.date, UPCOMING_DAYS - 1) })

  switch (agenda.state.status) {
    case 'loading':
      return <p role="status" className="text-body text-text-muted">{t('loading')}</p>
    case 'failed':
      return <p role="alert" className="text-body text-danger">{t(agenda.state.failure === 'forbidden' ? 'forbidden' : 'failed')}</p>
    case 'ready': {
      const upcoming = agenda.state.days
        .flatMap(day => day.items)
        .filter(item => item.kind === 'appointment' && (item.date > now.date || item.endsAt > now.time))
        .slice(0, UPCOMING_LIMIT)
      return (
        <div className="flex flex-col gap-md">
          {upcoming.length === 0
            ? <EmptyState icon={CalendarDays} title={tc('professional.home.appointmentsEmptyTitle')} description={tc('professional.home.appointmentsEmptyDescription')} />
            : (
                <ul className="flex flex-col divide-y divide-hairline rounded-field border border-hairline bg-surface">
                  {upcoming.map(item => (
                    <li key={item.key} className="flex flex-wrap items-baseline justify-between gap-sm px-lg py-md">
                      <span className="text-body font-medium text-text">{item.kind === 'appointment' ? item.occurrence.appointment.studentName : ''}</span>
                      <span className="text-caption text-text-muted">{`${labels.formatShortDate(item.date)} · ${t('time', { start: item.startsAt, end: item.endsAt })}`}</span>
                    </li>
                  ))}
                </ul>
              )}
          <div>
            <Button asChild variant="outline"><Link to="/professional/agenda">{t('openAgenda')}</Link></Button>
          </div>
        </div>
      )
    }
    default:
      return assertNever(agenda.state)
  }
}
