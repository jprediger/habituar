import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import '../../i18n/i18n'
import { StackPage } from './stack-page'
import { Text } from './text'

const mockBack = jest.fn()

jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: Readonly<{ children: ReactNode }>) => children,
}))

describe('stack page', () => {
  it('names the screen in its bar and goes back to the previous screen', () => {
    const title = 'Equipe'
    const content = 'conteúdo'
    render(<StackPage title={title}><Text>{content}</Text></StackPage>)

    expect(screen.getByRole('header', { name: 'Equipe' })).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))

    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('offers its single action by the accessible name, since the bar shows only an icon', () => {
    const onPress = jest.fn()
    const label = 'Criar papel'
    render(<StackPage title={label} action={{ icon: 'plus', label, onPress }} />)

    fireEvent.press(screen.getByRole('button', { name: label }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
