import { consentIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import type { AccessibleStudents, GuardianConsents } from '@habituar/react-client/react-client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { InstitutionSessionProvider } from '../session/institution-session.js'
import { createInstitutionSession } from '../session/institution-session-fixture.js'
import type { InstitutionSession } from '../session/session-route.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { StudentHomeScreen } from './student-home-screen.js'

const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const consentId = consentIdSchema.parse('40000000-0000-4000-8000-000000000001')
const bruno = { id: studentId, fullName: 'Bruno Lima', socialName: null, birthDate: '2014-03-09', ageRange: '11-14', archivedAt: null } as const
const confirmation = { id: consentId, kind: 'guardian-confirmation', termVersion: '2026-01', guardianId: null, signedOn: null, recordedAt: '2026-09-30T12:00:00.000Z', revokedAt: null } as const

const client = vi.hoisted((): { students: AccessibleStudents | undefined; consents: GuardianConsents | undefined } => ({ students: undefined, consents: undefined }))

vi.mock('../client/habituar-client.js', () => ({
  habituar: {
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: { logout: vi.fn() } }),
    useInstitutionSwitcher: () => ({ current: undefined, others: [], switchTo: vi.fn() }),
    useAccessibleStudents: () => client.students,
    useGuardianConsents: () => client.consents,
  },
}))

function sessionWithRole(templateKey: 'student' | 'guardian'): InstitutionSession {
  const session = createInstitutionSession('student')
  const [role] = session.membership.roles
  if (role === undefined) throw new Error('Session fixture has no role')
  return { ...session, membership: { ...session.membership, roles: [{ ...role, name: templateKey, templateKey }] } }
}

function createStudents(): AccessibleStudents {
  return {
    state: { status: 'ready', students: [bruno], total: 1, page: 1, pageCount: 1 },
    searchDraft: '', setSearchDraft: vi.fn(), applySearch: vi.fn(), clearSearch: vi.fn(), activeSearch: '',
    pagination: { hasPreviousPage: false, hasNextPage: false, goToPreviousPage: vi.fn(), goToNextPage: vi.fn() },
    canOpenRecord: false,
  }
}

function createConsents(overrides: Partial<GuardianConsents> = {}): GuardianConsents {
  return {
    pending: { status: 'ready', consents: [{ student: bruno, termVersion: '2026-01' }] },
    confirmed: { status: 'ready', consents: [] },
    confirm: vi.fn(() => Promise.resolve('saved' as const)),
    revoke: vi.fn(() => Promise.resolve('saved' as const)),
    ...overrides,
  }
}

function renderScreen(session: InstitutionSession) {
  return render(
    <I18nProvider>
      <InstitutionSessionProvider session={session}>
        <StudentHomeScreen />
      </InstitutionSessionProvider>
    </I18nProvider>,
  )
}

beforeEach(() => {
  client.students = createStudents()
  client.consents = createConsents()
})

describe('student home', () => {
  it('shows the student their institution and their own registration', () => {
    renderScreen(sessionWithRole('student'))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seu ambiente de aluno')
    expect(screen.getByText('Escola Aurora')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Seu cadastro' })).toBeInTheDocument()
    expect(screen.getByText('Bruno Lima')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Consentimentos para confirmar' })).not.toBeInTheDocument()
  })

  it('confirms a guardian consent only after an explicit confirmation that names the student', async () => {
    const consents = createConsents()
    client.consents = consents
    const { container } = renderScreen(sessionWithRole('guardian'))

    expect(screen.queryByRole('heading', { name: 'Seu cadastro' })).not.toBeInTheDocument()
    expect(screen.getByText('Resumo provisório do termo, pendente de revisão jurídica.', { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar consentimento' }))
    expect(consents.confirm).not.toHaveBeenCalled()
    expect(screen.getByText('Confirmar o consentimento para Bruno Lima?')).toBeInTheDocument()
    await expectNoSeriousA11yViolations(container)

    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }))
    await waitFor(() => { expect(consents.confirm).toHaveBeenCalledWith(studentId) })
    expect(await screen.findByRole('status')).toHaveTextContent('Consentimento confirmado para Bruno Lima.')
  })

  it('revokes a confirmed consent by its id after saying what revoking means', async () => {
    const consents = createConsents({ pending: { status: 'ready', consents: [] }, confirmed: { status: 'ready', consents: [{ student: bruno, consent: confirmation }] } })
    client.consents = consents
    renderScreen(sessionWithRole('guardian'))

    fireEvent.click(screen.getByRole('button', { name: 'Revogar consentimento' }))
    expect(screen.getByText(/Revogar o consentimento para Bruno Lima\? A instituição passa a ver/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sim, revogar' }))

    await waitFor(() => { expect(consents.revoke).toHaveBeenCalledWith(studentId, consentId) })
  })

  it('keeps the failure beside the consents instead of claiming success', async () => {
    client.consents = createConsents({ confirm: vi.fn(() => Promise.resolve('not-saved' as const)) })
    renderScreen(sessionWithRole('guardian'))

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar consentimento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível enviar.')
    expect(screen.queryByText('Consentimento confirmado para Bruno Lima.')).not.toBeInTheDocument()
  })
})
