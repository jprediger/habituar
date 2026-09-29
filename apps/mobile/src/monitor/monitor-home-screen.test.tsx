import { render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { MonitorHomeScreen } from './monitor-home-screen'

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

describe('monitor home', () => {
  it('shows the monitor their institution', () => {
    render(<MonitorHomeScreen session={createInstitutionSession('monitor')} />)

    expect(screen.getByRole('header', { name: 'Seu ambiente de monitor' })).toBeOnTheScreen()
    expect(screen.getByText('Escola Aurora')).toBeOnTheScreen()
  })

  it('leaves signing out to the profile tab the monitor now shares with professionals', () => {
    render(<MonitorHomeScreen session={createInstitutionSession('monitor')} />)

    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull()
  })
})
