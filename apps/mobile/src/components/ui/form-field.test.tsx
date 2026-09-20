import { render, screen } from '@testing-library/react-native'
import { TextInput } from 'react-native'
import '../../i18n/i18n'
import { FormField } from './form-field'

const FIELD_LABEL = 'E-mail'

function renderEmailField(options: Readonly<{ hint?: string; error?: string }> = {}) {
  return render(
    <FormField id="login-email" label={FIELD_LABEL} isRequired hint={options.hint} error={options.error}>
      {(control) => <TextInput {...control} />}
    </FormField>,
  )
}

describe('form field', () => {
  it('announces the requirement once, in the label the control carries', () => {
    renderEmailField()

    expect(screen.getByLabelText('E-mail, campo obrigatório')).toBeTruthy()
  })

  it('keeps the required mark out of what is read aloud', () => {
    renderEmailField()

    // O `*` é reforço para quem enxerga; anunciá-lo seria a segunda vez que a mesma
    // obrigatoriedade chega a quem usa leitor de tela.
    expect(screen.queryByLabelText(/\*/)).toBeNull()
    expect(screen.getByText(/E-mail \*/)).toBeTruthy()
  })

  it('shows the visible label next to the control', () => {
    renderEmailField()

    expect(screen.getByText(/E-mail/)).toBeTruthy()
  })

  it('hands the hint to the control so it is heard at the field', () => {
    renderEmailField({ hint: 'Mínimo de 8 caracteres.' })

    expect(screen.getByHintText('Mínimo de 8 caracteres.')).toBeTruthy()
  })

  it('raises the error as an alert and lets the control repeat it', () => {
    renderEmailField({ error: 'Informe um e-mail válido.' })

    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.')
    expect(screen.getByHintText('Informe um e-mail válido.')).toBeTruthy()
  })

  it('prefers the error over the hint, so the field never reads stale guidance', () => {
    renderEmailField({ hint: 'Mínimo de 8 caracteres.', error: 'Informe um e-mail válido.' })

    expect(screen.getByHintText('Informe um e-mail válido.')).toBeTruthy()
  })
})
