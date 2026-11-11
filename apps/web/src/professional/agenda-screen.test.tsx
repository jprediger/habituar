import { appointmentSchema, expandAppointmentOccurrences } from '@habituar/core/appointments'
import { localDateSchema } from '@habituar/core/calendar'
import { studentIdSchema } from '@habituar/core/identity/ids'
import type { AccessibleStudents, AgendaCursor, ProfessionalAgenda } from '@habituar/react-client/react-client'
import { groupAgendaByDay, rangeOfAgendaView } from '@habituar/react-client/react-client'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { ProfessionalAgendaScreen } from './agenda-screen.js'

const MONDAY = localDateSchema.parse('2026-11-09')
const range = rangeOfAgendaView('week', MONDAY)
const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const appointment = appointmentSchema.parse({
  id: 'e3000000-0000-4000-8000-000000000001', studentId, studentName: 'Bruno Lima', professionalUserId: '20000000-0000-4000-8000-000000000001', professionalName: 'Alex',
  startsOn: '2026-11-09', startsAt: '09:00', durationMinutes: 50, notes: null, recurrence: { kind: 'weekly', until: null }, cancelledOccurrences: [], version: 1, updatedAt: '2026-11-01T12:00:00.000Z',
})
const items = expandAppointmentOccurrences(appointment, range).map(occurrence => ({ kind: 'appointment' as const, key: `appointment:${occurrence.date}`, date: occurrence.date, startsAt: occurrence.startsAt, endsAt: occurrence.endsAt, occurrence }))

const cancelOccurrence = vi.fn(() => Promise.resolve('saved' as const))
let canSchedule = true
const agenda = (): ProfessionalAgenda => ({
  state: { status: 'ready', days: groupAgendaByDay(items, range) },
  canSchedule,
  reload: vi.fn(() => Promise.resolve()),
  create: vi.fn(), update: vi.fn(), remove: vi.fn(), cancelOccurrence,
})
const cursor: AgendaCursor = { date: MONDAY, view: 'week', range, select: vi.fn(), changeView: vi.fn(), goToday: vi.fn(), goPrevious: vi.fn(), goNext: vi.fn() }
const students: AccessibleStudents = {
  state: { status: 'ready', students: [{ id: studentId, fullName: 'Bruno Lima', socialName: null, birthDate: '2014-03-09', ageRange: '11-14', archivedAt: null }], total: 1, page: 1, pageCount: 1 },
  searchDraft: '', setSearchDraft: vi.fn(), applySearch: vi.fn(), clearSearch: vi.fn(), activeSearch: '',
  pagination: { hasPreviousPage: false, hasNextPage: false, goToPreviousPage: vi.fn(), goToNextPage: vi.fn() },
  canOpenRecord: false,
}

vi.mock('../client/habituar-client.js', () => ({ habituar: { useAgendaCursor: () => cursor, useProfessionalAgenda: () => agenda(), useAccessibleStudents: () => students } }))
vi.mock('../time/current-time.js', () => ({ readCurrentTime: () => new Date(2026, 10, 9, 8, 0) }))

function renderScreen() {
  return render(
    <I18nProvider>
      <InstitutionSessionProvider session={createInstitutionSession('professional')}>
        <ProfessionalAgendaScreen />
      </InstitutionSessionProvider>
    </I18nProvider>,
  )
}

describe('agenda do profissional', () => {
  it('mostra a semana com o atendimento no dia e no horário dele', () => {
    renderScreen()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Agenda')
    const monday = screen.getByRole('group', { name: /segunda-feira, 9 de novembro/i })
    expect(within(monday).getByRole('button', { name: /Bruno Lima/ })).toBeInTheDocument()
  })

  it('cancela só o dia escolhido de um atendimento semanal, depois de confirmar', async () => {
    renderScreen()
    const monday = screen.getByRole('group', { name: /segunda-feira, 9 de novembro/i })
    await userEvent.click(within(monday).getByRole('button', { name: /Bruno Lima/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar só este dia' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sim, cancelar este dia' }))
    expect(cancelOccurrence).toHaveBeenCalledWith(appointment, '2026-11-09')
    expect(await screen.findByText('O atendimento deste dia foi cancelado.')).toBeInTheDocument()
  })

  it('não oferece criar nem editar a quem só lê a agenda', async () => {
    canSchedule = false
    renderScreen()
    expect(screen.queryByRole('button', { name: 'Novo atendimento' })).not.toBeInTheDocument()
    const monday = screen.getByRole('group', { name: /segunda-feira, 9 de novembro/i })
    await userEvent.click(within(monday).getByRole('button', { name: /Bruno Lima/ }))
    expect(screen.queryByRole('button', { name: 'Editar atendimento' })).not.toBeInTheDocument()
    canSchedule = true
  })
})
