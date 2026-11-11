import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { createHabituarReactClient } from '@habituar/react-client/react-client'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { ProfessionalAgendaScreen } from './professional-agenda-screen'

const mockPush = jest.fn()
let mockCanSchedule = false
const mockClient = createHabituarReactClient({ origin: 'http://habituar.test' })

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: jest.fn(),
}))
jest.mock('../client/habituar-client', () => ({ habituar: {
  useCalendarNavigation: (...args: Parameters<typeof mockClient.useCalendarNavigation>) => mockClient.useCalendarNavigation(...args),
  useCalendarFilter: () => mockClient.useCalendarFilter(),
  useProfessionalCalendar: () => ({ state: { status: 'ready', days: [] }, canSchedule: mockCanSchedule }),
} }))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-11-11T15:00:00.000Z'))
  mockCanSchedule = false
  mockPush.mockClear()
})
afterEach(() => { jest.useRealTimers() })

it('lets the professional switch from the month to the continuous schedule', async () => {
  render(<ProfessionalAgendaScreen session={createInstitutionSession('professional')} />)

  const menu = await screen.findByRole('button', { name: /visão Mês/ })
  fireEvent.press(menu)
  fireEvent.press(screen.getByRole('radio', { name: 'Programação' }))

  await waitFor(() => { expect(screen.getByRole('button', { name: /visão Programação/ })).toBeOnTheScreen() })
})


it('does not offer creation to a reader of the professional agenda', async () => {
  render(<ProfessionalAgendaScreen session={createInstitutionSession('professional')} />)
  await screen.findByRole('button', { name: /visão Mês/ })
  expect(screen.queryByRole('button', { name: 'Novo atendimento' })).toBeNull()
})

it('creates an appointment on the focused date through the floating button', async () => {
  mockCanSchedule = true
  render(<ProfessionalAgendaScreen session={createInstitutionSession('professional')} />)
  fireEvent.press(await screen.findByRole('button', { name: 'Novo atendimento' }))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/professional/agenda/new', params: { date: '2026-11-11' } })
})
