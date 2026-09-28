import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { AppearanceGate } from './appearance-gate'

const APP_CONTENT = 'conteúdo do app'

const mockFontState: { loaded: boolean; error: Error | null } = { loaded: true, error: null }

jest.mock('expo-font', () => ({
  useFonts: () => [mockFontState.loaded, mockFontState.error],
}))

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => Promise.resolve(),
}))

beforeEach(() => {
  mockFontState.loaded = true
  mockFontState.error = null
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


  it('mounts nothing while the font has neither arrived nor failed', () => {
    mockFontState.loaded = false

    render(
      <AppearanceGate>
        <Text>{APP_CONTENT}</Text>
      </AppearanceGate>,
    )

    expect(screen.queryByText(APP_CONTENT)).toBeNull()
  })
})
