import { INTERACTION } from '@habituar/design-tokens/interaction'
import { fireEvent, render, screen } from '@testing-library/react-native'
import '../../i18n/i18n'
import { PasswordInput } from './password-input'

// Constantes, não literais no JSX: a regra de i18n do lint vale igual em teste, e o texto
// aqui é fixture, não catálogo.
const FIELD_LABEL = 'Senha'
const SHOW = 'Mostrar senha'
const HIDE = 'Ocultar senha'

function renderPasswordField() {
  return render(
    <PasswordInput accessibilityLabel={FIELD_LABEL} value="secret" onChangeText={jest.fn()} />,
  )
}

describe('password field', () => {
  it('hides what is typed until someone asks to see it', () => {
    renderPasswordField()

    expect(screen.getByLabelText(FIELD_LABEL)).toHaveProp('secureTextEntry', true)
  })

  it('reveals the password when the toggle is pressed', () => {
    renderPasswordField()

    fireEvent.press(screen.getByLabelText(SHOW))

    expect(screen.getByLabelText(FIELD_LABEL)).toHaveProp('secureTextEntry', false)
    expect(screen.getByLabelText(HIDE)).toBeOnTheScreen()
  })

  it('keeps what was typed while the visibility changes', () => {
    renderPasswordField()

    fireEvent.press(screen.getByLabelText(SHOW))

    // Remontar o `TextInput` apaga o conteúdo em parte dos Androids; o mesmo campo precisa
    // sobreviver à alternância.
    expect(screen.getByLabelText(FIELD_LABEL)).toHaveDisplayValue('secret')
  })

  it('tells assistive technology whether the password is currently showing', () => {
    renderPasswordField()

    expect(screen.getByRole('button', { name: SHOW, selected: false })).toBeOnTheScreen()

    fireEvent.press(screen.getByLabelText(SHOW))

    expect(screen.getByRole('button', { name: HIDE, selected: true })).toBeOnTheScreen()
  })

  it('gives the toggle a target big enough to hit', () => {
    renderPasswordField()

    expect(screen.getByRole('button', { name: SHOW })).toHaveStyle({
      minHeight: INTERACTION.minimumTouchTarget,
      minWidth: INTERACTION.minimumTouchTarget,
    })
  })
})
