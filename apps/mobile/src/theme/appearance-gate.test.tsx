import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { AppearanceGate } from './appearance-gate'

const APP_CONTENT = 'conteúdo do app'

const mockFontState: { loaded: boolean; error: Error | null } = { loaded: true, error: null }
const mockHideSplash = jest.fn()

jest.mock('expo-font', () => ({
  useFonts: () => [mockFontState.loaded, mockFontState.error],
}))

// Referência preguiçosa: o `import` do portão sobe acima do `const` abaixo, então a
// fábrica roda com `mockHideSplash` ainda na zona morta se ela for lida agora.
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => Promise.resolve(),
  hideAsync: () => {
    mockHideSplash()
  },
}))

beforeEach(() => {
  mockFontState.loaded = true
  mockFontState.error = null
  jest.clearAllMocks()
})

describe('appearance gate', () => {
  it('shows the app once the font is ready', () => {
    render(
      <AppearanceGate>
        <Text>{APP_CONTENT}</Text>
      </AppearanceGate>,
    )

    expect(screen.getByText(APP_CONTENT)).toBeOnTheScreen()
  })

  it('still opens when the font fails to load, in whatever face the system has', () => {
    // Fonte é aparência. Deixar o app inutilizável porque um arquivo de fonte não chegou
    // troca um defeito cosmético por um que impede entrar na conta.
    mockFontState.loaded = false
    mockFontState.error = new Error('font asset unavailable')

    render(
      <AppearanceGate>
        <Text>{APP_CONTENT}</Text>
      </AppearanceGate>,
    )

    expect(screen.getByText(APP_CONTENT)).toBeOnTheScreen()
  })

  it('never leaves the splash up once it has decided either way', () => {
    mockFontState.loaded = false
    mockFontState.error = new Error('font asset unavailable')

    render(
      <AppearanceGate>
        <Text>{APP_CONTENT}</Text>
      </AppearanceGate>,
    )

    expect(mockHideSplash).toHaveBeenCalled()
  })

  it('holds the splash while the font has neither arrived nor failed', () => {
    mockFontState.loaded = false

    render(
      <AppearanceGate>
        <Text>{APP_CONTENT}</Text>
      </AppearanceGate>,
    )

    expect(screen.queryByText(APP_CONTENT)).toBeNull()
    expect(mockHideSplash).not.toHaveBeenCalled()
  })
})
