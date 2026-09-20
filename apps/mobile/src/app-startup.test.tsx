import { render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import type * as ReactNative from 'react-native'
import './i18n/i18n'

const APP_CONTENT = 'conteúdo do app'

const mockFontState: { loaded: boolean; error: Error | null } = { loaded: true, error: null }
const mockHideSplash = jest.fn()

jest.mock('expo-font', () => ({
  useFonts: () => [mockFontState.loaded, mockFontState.error],
}))

// Referência preguiçosa: o `import` de `_layout` sobe acima do `const` abaixo, então a
// fábrica roda com `mockHideSplash` ainda na zona morta se ela for lida agora.
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => Promise.resolve(),
  hideAsync: () => {
    mockHideSplash()
  },
}))

jest.mock('expo-router', () => {
  const { Text: NativeText } = jest.requireActual<typeof ReactNative>('react-native')

  return {
    Slot: () => <NativeText>{'conteúdo do app'}</NativeText>,
    Redirect: () => null,
    usePathname: () => '/login',
  }
})

jest.mock('expo-status-bar', () => ({ StatusBar: () => null }))

// O `SafeAreaProvider` real não renderiza filho nenhum até medir as bordas da tela, o que
// não acontece fora de um aparelho.
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: Readonly<{ children: ReactNode }>) => children,
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

jest.mock('./habituar-client', () => ({
  habituar: {
    Provider: ({ children }: Readonly<{ children: ReactNode }>) => children,
    useAuthentication: () => ({ state: { status: 'unauthenticated' }, actions: {} }),
  },
}))

import RootLayout from './app/_layout'

beforeEach(() => {
  mockFontState.loaded = true
  mockFontState.error = null
  jest.clearAllMocks()
})

describe('app startup', () => {
  it('shows the app once the font is ready', () => {
    render(<RootLayout />)

    expect(screen.getByText(APP_CONTENT)).toBeOnTheScreen()
  })

  it('still opens when the font fails to load, in whatever face the system has', () => {
    // Fonte é aparência. Deixar o app inutilizável porque um arquivo de fonte não chegou
    // troca um defeito cosmético por um que impede entrar na conta.
    mockFontState.loaded = false
    mockFontState.error = new Error('font asset unavailable')

    render(<RootLayout />)

    expect(screen.getByText(APP_CONTENT)).toBeOnTheScreen()
  })

  it('never leaves the splash up once it has decided either way', () => {
    mockFontState.loaded = false
    mockFontState.error = new Error('font asset unavailable')

    render(<RootLayout />)

    expect(mockHideSplash).toHaveBeenCalled()
  })
})
