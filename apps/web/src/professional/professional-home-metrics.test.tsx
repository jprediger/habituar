import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import { ProfessionalHomeMetrics } from './professional-home-metrics.js'

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useProfessionalHomeMetrics: () => ({ status: 'ready', metrics: { todayAppointments: 3, weekAppointments: 8, next: { date: '2026-11-12', startsAt: '09:00', studentName: 'Bruno Lima' } } }),
  },
}))

describe('professional home metrics', () => {
  it('shows the appointments of today, of the week and who comes next', () => {
    render(
      <I18nProvider>
        <InstitutionSessionProvider session={createInstitutionSession('professional')}>
          <ProfessionalHomeMetrics />
        </InstitutionSessionProvider>
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Resumo' })).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
    expect(screen.getByText(/às 09:00/)).toBeInTheDocument()
  })
})
