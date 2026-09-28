import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { InstitutionSwitcher } from './institution-switcher.js'

const switcher = vi.hoisted(() => {
  const others: { institution: { id: string; name: string } }[] = []
  return { current: { institution: { id: 'first', name: 'Escola Aurora' } }, others, switchTo: vi.fn() }
})

vi.mock('../client/habituar-client.js', () => ({
  habituar: { useInstitutionSwitcher: () => switcher },
}))

beforeEach(() => {
  switcher.others = []
  switcher.switchTo.mockClear()
})

describe('institution switcher', () => {
  it('stays out of the way when there is only one membership', () => {
    const { container } = render(<I18nProvider><InstitutionSwitcher /></I18nProvider>)
    expect(container).toBeEmptyDOMElement()
  })

  it('announces the active institution and offers the other one', async () => {
    switcher.others = [{ institution: { id: 'second', name: 'Escola Boreal' } }]
    const { container } = render(<I18nProvider><InstitutionSwitcher /></I18nProvider>)
    const summary = screen.getByText('Trocar instituição')
    expect(summary).toHaveAccessibleName('Instituição atual: Escola Aurora')
    fireEvent.click(summary)
    fireEvent.click(screen.getByRole('button', { name: 'Escola Boreal' }))
    expect(switcher.switchTo).toHaveBeenCalledWith('second')
    await expectNoSeriousA11yViolations(container)
  })
})
