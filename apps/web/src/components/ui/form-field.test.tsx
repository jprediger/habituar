import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { expectNoSeriousA11yViolations } from '../../test/expect-no-a11y-violations.js'
import { Button } from './button.js'
import { FormField } from './form-field.js'
import { Input } from './input.js'
import { PasswordInput } from './password-input.js'

// Textos fixos: o que está sob teste é o campo, não o catálogo de i18n.
const LABEL = 'E-mail'
const PASSWORD_LABEL = 'Senha'
const REQUIRED_MARK = 'Campo obrigatório'
const ERROR_TEXT = 'Informe um e-mail válido.'
const HINT_TEXT = 'Mínimo de 8 caracteres.'
const ACTION_TEXT = 'Esqueci minha senha'

describe('form field', () => {
  it('announces a required field without reading the asterisk twice', () => {
    render(
      <FormField id="email" label={LABEL} isRequired requiredMarkLabel={REQUIRED_MARK}>
        {(control) => <Input {...control} type="email" />}
      </FormField>,
    )

    // O nome acessível é só "E-mail": o asterisco é `aria-hidden` e o `required` do
    // controle é o que anuncia a obrigatoriedade.
    expect(screen.getByRole('textbox', { name: LABEL })).toBeRequired()
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true')
  })

  it('links the error message to the field it belongs to', async () => {
    const { container } = render(
      <FormField id="email" label={LABEL} isRequired requiredMarkLabel={REQUIRED_MARK} error={ERROR_TEXT}>
        {(control) => <Input {...control} type="email" />}
      </FormField>,
    )
    const field = screen.getByRole('textbox', { name: LABEL })

    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(ERROR_TEXT)
    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_TEXT)
    await expectNoSeriousA11yViolations(container)
  })

  it('keeps both the hint and the error reachable from the field', () => {
    render(
      <FormField
        id="email"
        label={LABEL}
        isRequired
        requiredMarkLabel={REQUIRED_MARK}
        hint={HINT_TEXT}
        error={ERROR_TEXT}
      >
        {(control) => <Input {...control} type="email" />}
      </FormField>,
    )

    expect(screen.getByRole('textbox', { name: LABEL })).toHaveAccessibleDescription(`${HINT_TEXT} ${ERROR_TEXT}`)
  })

  it('keeps the title the same distance from its control whether or not the row has an action', () => {
    // O alvo de toque padrão de 44px numa ação da linha do rótulo esticava só esse
    // campo, afastando o título do controle dele.
    const { container: withoutAction } = render(
      <FormField id="email" label={LABEL} isRequired requiredMarkLabel={REQUIRED_MARK}>
        {(control) => <Input {...control} type="email" />}
      </FormField>,
    )
    const { container: withAction } = render(
      <FormField
        id="password"
        label={PASSWORD_LABEL}
        isRequired
        requiredMarkLabel={REQUIRED_MARK}
        action={
          <Button variant="link" size="inline">
            {ACTION_TEXT}
          </Button>
        }
      >
        {(control) => <Input {...control} type="password" />}
      </FormField>,
    )

    const rowOf = (root: Element): string => root.querySelector('label')?.parentElement?.className ?? ''

    expect(rowOf(withAction)).toBe(rowOf(withoutAction))
    expect(screen.getByRole('button', { name: ACTION_TEXT }).className).not.toContain('min-h-tap-target')
  })

  it('leaves a valid field without an invalid state', () => {
    render(
      <FormField id="email" label={LABEL} isRequired requiredMarkLabel={REQUIRED_MARK}>
        {(control) => <Input {...control} type="email" />}
      </FormField>,
    )

    expect(screen.getByRole('textbox', { name: LABEL })).toHaveAttribute('aria-invalid', 'false')
  })
})

describe('password field', () => {
  it('hides what was typed until the person asks to see it', async () => {
    const user = userEvent.setup()

    render(
      <FormField id="password" label={PASSWORD_LABEL} isRequired requiredMarkLabel={REQUIRED_MARK}>
        {(control) => <PasswordInput {...control} defaultValue="secret" />}
      </FormField>,
    )

    const field = screen.getByLabelText(PASSWORD_LABEL, { exact: false })
    const toggle = screen.getByRole('button')

    expect(field).toHaveAttribute('type', 'password')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await user.click(toggle)

    expect(field).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await user.click(toggle)

    expect(field).toHaveAttribute('type', 'password')
  })

  it('keeps the toggle out of form submission', () => {
    render(
      <FormField id="password" label={PASSWORD_LABEL} isRequired requiredMarkLabel={REQUIRED_MARK}>
        {(control) => <PasswordInput {...control} />}
      </FormField>,
    )

    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})
