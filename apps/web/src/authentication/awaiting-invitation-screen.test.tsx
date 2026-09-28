import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { AwaitingInvitationScreen } from './awaiting-invitation-screen.js'

const actions = vi.hoisted(() => ({ retry: vi.fn(), logout: vi.fn() }))

vi.mock('../client/habituar-client.js', () => ({
  habituar: { useAuthentication: () => ({ state: { status: 'awaiting-invitation' }, actions }) },
}))

describe('awaiting invitation', () => {
  it('keeps a signed-in person informed and able to refresh or leave', async () => {
    const { container } = render(<I18nProvider><AwaitingInvitationScreen /></I18nProvider>)

    expect(screen.getByRole('status')).toHaveTextContent('Peça um convite')
    fireEvent.click(screen.getByRole('button', { name: 'Verificar meu acesso' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(actions.retry).toHaveBeenCalledTimes(1)
    expect(actions.logout).toHaveBeenCalledTimes(1)
    await expectNoSeriousA11yViolations(container)
  })
})
