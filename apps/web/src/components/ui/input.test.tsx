import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { expectNoSeriousA11yViolations } from '../../test/expect-no-a11y-violations.js'
import { Input } from './input.js'

// Textos fixos do teste: não passam por i18n de propósito — o que está sob teste é o
// campo, não o catálogo, e um rótulo estável deixa a asserção legível.
const LABEL = 'E-mail'
const FAILURE_TEXT = 'E-mail ou senha inválidos.'

function renderLabelledInput(input: ReactElement): HTMLElement {
  const { container } = render(
    <>
      <label htmlFor="email">{LABEL}</label>
      {input}
    </>,
  )

  return container
}

describe('text field of the web visual kit', () => {
  it('is reachable by its label', () => {
    renderLabelledInput(<Input id="email" type="email" />)

    expect(screen.getByLabelText(LABEL)).toBeInTheDocument()
  })

  it('announces an invalid field to assistive technology, not only by color', async () => {
    const container = renderLabelledInput(
      <>
        <Input id="email" type="email" aria-invalid aria-describedby="failure" />
        <p id="failure" role="alert">
          {FAILURE_TEXT}
        </p>
      </>,
    )
    const field = screen.getByLabelText(LABEL)

    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription(FAILURE_TEXT)
    await expectNoSeriousA11yViolations(container)
  })

  it('keeps the visible focus ring that the caller cannot forget to add', () => {
    renderLabelledInput(<Input id="email" type="email" />)

    expect(screen.getByLabelText(LABEL).className).toContain('focus-visible:outline-focus-ring')
  })

  it('keeps the minimum touch target when the caller adds its own classes', () => {
    renderLabelledInput(<Input id="email" type="email" className="w-full" />)

    expect(screen.getByLabelText(LABEL).className).toContain('min-h-tap-target')
  })
})
