import { consentIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import type { AccessibleStudents, AuthenticationState, GuardianConsents } from '@habituar/react-client/react-client'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { AccessibilityInfo } from 'react-native'
import { ToastProvider } from '../components/ui/toast'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import type { InstitutionSession } from '../session/session-screen'
import { StudentHomeScreen } from './student-home-screen'

const studentId = studentIdSchema.parse('30000000-0000-4000-8000-000000000001')
const consentId = consentIdSchema.parse('40000000-0000-4000-8000-000000000001')
const bruno = { id: studentId, fullName: 'Bruno Lima', socialName: null, birthDate: '2014-03-09', ageRange: '11-14', archivedAt: null } as const
const confirmation = { id: consentId, kind: 'guardian-confirmation', termVersion: '2026-01', guardianId: null, signedOn: null, recordedAt: '2026-09-30T12:00:00.000Z', revokedAt: null } as const

const mockClient: {
  authentication: { state: AuthenticationState; actions: Record<string, jest.Mock> }
  students: AccessibleStudents | undefined
  consents: GuardianConsents | undefined
} = {
  authentication: { state: { status: 'unauthenticated' }, actions: { logout: jest.fn() } },
  students: undefined,
  consents: undefined,
}

jest.mock('../client/habituar-client', () => ({
  habituar: {
    useAuthentication: () => mockClient.authentication,
    useInstitutionSwitcher: () => ({ current: undefined, others: [], switchTo: jest.fn() }),
    useAccessibleStudents: () => mockClient.students,
    useGuardianConsents: () => mockClient.consents,
  },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

function sessionWithRole(templateKey: 'student' | 'guardian'): InstitutionSession {
  const session = createInstitutionSession('student')
  const [role] = session.membership.roles
  if (role === undefined) throw new Error('Session fixture has no role')
  return { ...session, membership: { ...session.membership, roles: [{ ...role, name: templateKey, templateKey }] } }
}

function createConsents(overrides: Partial<GuardianConsents> = {}): GuardianConsents {
  return {
    pending: { status: 'ready', consents: [{ student: bruno, termVersion: '2026-01' }] },
    confirmed: { status: 'ready', consents: [] },
    confirm: jest.fn(() => Promise.resolve('saved' as const)),
    revoke: jest.fn(() => Promise.resolve('saved' as const)),
    ...overrides,
  }
}

function renderScreen(session: InstitutionSession) {
  return render(<ToastProvider><StudentHomeScreen session={session} /></ToastProvider>)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockClient.students = {
    state: { status: 'ready', students: [bruno], total: 1, page: 1, pageCount: 1 },
    searchDraft: '', setSearchDraft: jest.fn(), applySearch: jest.fn(), clearSearch: jest.fn(), activeSearch: '',
    pagination: { hasPreviousPage: false, hasNextPage: false, goToPreviousPage: jest.fn(), goToNextPage: jest.fn() },
    canOpenRecord: false,
  }
  mockClient.consents = createConsents()
})

describe('student home', () => {
  it('shows the student their institution and their own registration', () => {
    renderScreen(sessionWithRole('student'))

    expect(screen.getByRole('header', { name: 'Seu ambiente de aluno' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
    expect(screen.getByText('Seu cadastro')).toBeOnTheScreen()
    expect(screen.getByText('Bruno Lima')).toBeOnTheScreen()
    expect(screen.queryByText('Consentimentos para confirmar')).toBeNull()
  })

  it('keeps a way out of the session', () => {
    renderScreen(sessionWithRole('student'))

    fireEvent.press(screen.getByRole('button', { name: 'Sair' }))

    expect(mockClient.authentication.actions.logout).toHaveBeenCalledTimes(1)
  })

  it('confirms a guardian consent only after the confirmation sheet, then confirms it in passing', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    const consents = createConsents()
    mockClient.consents = consents
    renderScreen(sessionWithRole('guardian'))

    expect(screen.queryByText('Seu cadastro')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Confirmar consentimento' }))
    expect(consents.confirm).not.toHaveBeenCalled()
    expect(screen.getByText('Confirmar o consentimento para Bruno Lima?')).toBeOnTheScreen()

    fireEvent.press(screen.getByRole('button', { name: 'Sim, confirmar' }))
    await waitFor(() => { expect(consents.confirm).toHaveBeenCalledWith(studentId) })
    await waitFor(() => { expect(announce).toHaveBeenCalledWith('Consentimento confirmado. A instituição já vê a sua confirmação.') })
  })

  it('revokes a confirmed consent by its id', async () => {
    const consents = createConsents({ pending: { status: 'ready', consents: [] }, confirmed: { status: 'ready', consents: [{ student: bruno, consent: confirmation }] } })
    mockClient.consents = consents
    renderScreen(sessionWithRole('guardian'))

    fireEvent.press(screen.getByRole('button', { name: 'Revogar consentimento' }))
    fireEvent.press(screen.getByRole('button', { name: 'Sim, revogar' }))

    await waitFor(() => { expect(consents.revoke).toHaveBeenCalledWith(studentId, consentId) })
  })

  it('keeps the failure beside the consents instead of a success message', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    mockClient.consents = createConsents({ confirm: jest.fn(() => Promise.resolve('not-saved' as const)) })
    renderScreen(sessionWithRole('guardian'))

    fireEvent.press(screen.getByRole('button', { name: 'Confirmar consentimento' }))
    fireEvent.press(screen.getByRole('button', { name: 'Sim, confirmar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível enviar/)
    expect(announce).not.toHaveBeenCalledWith(expect.stringContaining('Consentimento confirmado'))
  })
})
