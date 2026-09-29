import type { AuthenticationState } from '@habituar/react-client/react-client'
import { render, screen } from '@testing-library/react-native'
import { AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'
import type * as ReactNative from 'react-native'
import '../i18n/i18n'
import { AuthenticationRouter } from './authentication-router'

const ROUTE_CONTENT = 'conteúdo da rota'

const mockRoute: { pathname: string } = { pathname: '/login' }
const mockHideSplash = jest.fn()
const mockRevalidate = jest.fn(() => Promise.resolve())
const mockAuthentication: { state: AuthenticationState } = { state: { status: 'unauthenticated' } }

jest.mock('expo-router', () => {
  // `requireActual` dentro da fábrica: `jest.mock` é içado acima dos imports, e o módulo
  // real precisa ser resolvido na hora da substituição.
  const { Text: NativeText } = jest.requireActual<typeof ReactNative>('react-native')

  return {
    Slot: () => <NativeText>{'conteúdo da rota'}</NativeText>,
    Redirect: ({ href }: Readonly<{ href: string }>) => <NativeText>{`redirecionado para ${href}`}</NativeText>,
    usePathname: () => mockRoute.pathname,
  }
})

// Referência preguiçosa: a fábrica é içada acima do `const`, que ainda estaria na zona
// morta se fosse lido na criação do mock.
jest.mock('expo-splash-screen', () => ({
  hideAsync: () => {
    mockHideSplash()
  },
}))

jest.mock('../client/habituar-client', () => ({
  habituar: { useAuthentication: () => ({ ...mockAuthentication, actions: { revalidate: mockRevalidate } }) },
}))

beforeEach(() => {
  mockRoute.pathname = '/login'
  mockAuthentication.state = { status: 'unauthenticated' }
  jest.clearAllMocks()
})

describe('authentication router', () => {
  it('mounts the requested route when the guard admits it', () => {
    render(<AuthenticationRouter />)

    expect(screen.getByText(ROUTE_CONTENT)).toBeOnTheScreen()
  })

  it('never mounts a route the guard refuses, even for a deep link', () => {
    mockRoute.pathname = '/professional'

    render(<AuthenticationRouter />)

    expect(screen.queryByText(ROUTE_CONTENT)).toBeNull()
    expect(screen.getByText('redirecionado para /login')).toBeOnTheScreen()
  })

  it('waits instead of guessing while the session is still being restored', () => {
    mockAuthentication.state = { status: 'restoring' }
    mockRoute.pathname = '/professional'

    render(<AuthenticationRouter />)

    expect(screen.queryByText(ROUTE_CONTENT)).toBeNull()
    expect(mockHideSplash).not.toHaveBeenCalled()
  })

  it('lifts the splash once the session has been restored', () => {
    render(<AuthenticationRouter />)

    expect(mockHideSplash).toHaveBeenCalled()
  })

  it('re-reads access when the app comes back to the foreground, so a removed membership stops showing', () => {
    const listeners: ((state: AppStateStatus) => void)[] = []
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener)
      return { remove: jest.fn() }
    })

    render(<AuthenticationRouter />)
    for (const listener of listeners) listener('background')
    expect(mockRevalidate).not.toHaveBeenCalled()
    for (const listener of listeners) listener('active')

    expect(mockRevalidate).toHaveBeenCalledTimes(1)
  })
})
