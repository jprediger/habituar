import type { AuthenticationState } from '@habituar/react-client/react-client'
import { render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { ProfessionalHomeScreen } from './professional-home-screen'

const mockAuthentication: { state: AuthenticationState; actions: Record<string, jest.Mock> } = {
  state: { status: 'unauthenticated' },
  actions: { logout: jest.fn() },
}

jest.mock('../client/habituar-client', () => ({
  habituar: {
    useAuthentication: () => mockAuthentication,
    useInstitutionSwitcher: () => ({ current: undefined, others: [], switchTo: jest.fn() }),
    useAccessibleStudents: () => ({
      state: { status: 'ready', students: [], total: 0, page: 1, pageCount: 1 }, searchDraft: '', setSearchDraft: jest.fn(), applySearch: jest.fn(), clearSearch: jest.fn(),
      activeSearch: '', pagination: { hasPreviousPage: false, hasNextPage: false, goToPreviousPage: jest.fn(), goToNextPage: jest.fn() }, canOpenRecord: true,
    }),
  },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('professional home', () => {
  it('greets the professional by name as the heading of the screen', () => {
    render(<ProfessionalHomeScreen session={createInstitutionSession('professional')} />)

    expect(screen.getByRole('header', { name: 'Olá, Alex' })).toBeOnTheScreen()
  })

  it('shows the institution and role the session is acting under', () => {
    render(<ProfessionalHomeScreen session={createInstitutionSession('professional')} />)

    expect(screen.getByRole('header', { name: 'Vínculo ativo' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
    expect(screen.getByText('Fonoaudióloga')).toBeOnTheScreen()
  })

  it('lists the students the person follows, explaining when there are none yet', () => {
    render(<ProfessionalHomeScreen session={createInstitutionSession('professional')} />)

    expect(screen.getByText('Nenhum estudante para mostrar')).toBeOnTheScreen()
    expect(screen.getByLabelText(/Buscar estudante pelo nome/)).toBeOnTheScreen()
  })

  it('leaves signing out to the profile', () => {
    render(<ProfessionalHomeScreen session={createInstitutionSession('professional')} />)

    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
  })
})
