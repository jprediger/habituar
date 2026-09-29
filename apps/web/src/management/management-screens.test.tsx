import { institutionIdSchema } from '@habituar/core/identity/ids'
import type { StaffManagementContext } from '@habituar/react-client/staff-management'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { habituar } from '../client/habituar-client.js'
import { I18nProvider } from '../i18n/i18n-provider.js'
import { expectNoSeriousA11yViolations } from '../test/expect-no-a11y-violations.js'
import { CUSTOM_ROLE_ID, FULL_MANAGER, INSTITUTION_ID, MEMBER_ID, MONITORING_ROLE_ID } from '../test/fake-staff-api.js'
import { InvitationsPanel } from './invitations-panel.js'
import { RolesPanel } from './roles-panel.js'
import { TeamPanel } from './team-panel.js'

// Tela e hook compartilhado juntos: só o transporte é falso, então o que passa aqui é o
// mesmo caminho que o mobile usa até a rede.
const fake = await vi.hoisted(async () => {
  const module = await import('../test/fake-staff-api.js')
  return module.createFakeStaffApi('institution')
})

vi.mock('../client/habituar-client.js', async () => {
  const { createHabituarReactClient } = await import('@habituar/react-client/react-client')
  return { habituar: createHabituarReactClient({ origin: 'http://api.habituar.test', fetch: fake.fetch }) }
})

const CONTEXT: StaffManagementContext = { kind: 'institution', institutionId: institutionIdSchema.parse(INSTITUTION_ID), permissions: FULL_MANAGER }

function renderPanel(panel: ReactElement) {
  return render(
    <I18nProvider>
      <habituar.Provider>{panel}</habituar.Provider>
    </I18nProvider>,
  )
}

describe('team section', () => {
  it('removes a member only after a confirmation that names the person and the institution', async () => {
    const user = userEvent.setup()
    renderPanel(<TeamPanel context={CONTEXT} institutionName="Escola Aurora" />)

    await user.click(await screen.findByRole('button', { name: 'Papéis de João Lima' }))
    const dialog = await screen.findByRole('dialog', { name: 'João Lima' })
    await user.click(await within(dialog).findByRole('button', { name: 'Remover da instituição' }))

    expect(within(dialog).getByText(/Remover João Lima de Escola Aurora\?/)).toBeInTheDocument()
    expect(fake.writes.some((write) => write.method === 'DELETE')).toBe(false)
    expect(within(dialog).getByRole('button', { name: 'Sim, remover' })).toHaveFocus()

    await user.click(within(dialog).getByRole('button', { name: 'Sim, remover' }))

    expect(await within(dialog).findByRole('status')).toHaveTextContent('Vínculo removido. A pessoa não faz mais parte de Escola Aurora.')
    expect(fake.writes).toContainEqual({ method: 'DELETE', path: `${fake.prefix}/members/${MEMBER_ID}`, body: { expectedVersion: 4 } })
  })

  it('returns focus to the member button when the dialog closes', async () => {
    const user = userEvent.setup()
    renderPanel(<TeamPanel context={CONTEXT} institutionName="Escola Aurora" />)
    const opener = await screen.findByRole('button', { name: 'Papéis de João Lima' })

    await user.click(opener)
    await screen.findByRole('dialog', { name: 'João Lima' })
    await user.keyboard('{Escape}')

    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    await waitFor(() => { expect(opener).toHaveFocus() })
  })

  it('keeps the team list free of serious accessibility violations', async () => {
    const { container } = renderPanel(<TeamPanel context={CONTEXT} institutionName="Escola Aurora" />)
    await screen.findByRole('button', { name: 'Papéis de João Lima' })

    await expectNoSeriousA11yViolations(container)
  })
})

describe('invitations section', () => {
  it('ties each error to its field and shows the one-time link only after the server created it', async () => {
    const user = userEvent.setup()
    const { container } = renderPanel(<InvitationsPanel context={CONTEXT} />)

    await screen.findByText('nova@example.com')
    await user.click(screen.getByRole('button', { name: 'Criar convite' }))

    const email = screen.getByRole('textbox', { name: /E-mail da pessoa/ })
    expect(email).toHaveAccessibleDescription('Informe um e-mail válido.')
    expect(screen.getByRole('group', { name: /Papéis/ })).toHaveAccessibleDescription(/Escolha ao menos um papel para continuar\./)
    expect(screen.queryByText('https://habituar.test/invite/once')).not.toBeInTheDocument()

    await user.type(email, 'nova@example.com')
    await user.selectOptions(screen.getByRole('combobox', { name: /Tipo de vínculo/ }), 'monitor')
    await user.click(await screen.findByRole('checkbox', { name: /Monitoria/ }))
    await user.click(screen.getByRole('button', { name: 'Criar convite' }))

    expect(await screen.findByRole('link', { name: 'https://habituar.test/invite/once' })).toBeInTheDocument()
    expect(fake.writes).toContainEqual({ method: 'POST', path: `${fake.prefix}/invitations`, body: { email: 'nova@example.com', environment: 'monitor', roleIds: [MONITORING_ROLE_ID] } })
    await expectNoSeriousA11yViolations(container)
  })

  it('revokes an invitation only after an explicit confirmation, and lets the person keep it', async () => {
    const user = userEvent.setup()
    renderPanel(<InvitationsPanel context={CONTEXT} />)

    await user.click(await screen.findByRole('button', { name: 'Revogar convite de nova@example.com' }))
    await user.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(fake.writes.some((write) => write.path.endsWith('/revoke'))).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Revogar convite de nova@example.com' }))
    await user.click(screen.getByRole('button', { name: 'Sim, revogar' }))

    expect(await screen.findByText('Convite de nova@example.com revogado.')).toBeInTheDocument()
  })
})

describe('roles section', () => {
  it('shows the impact on every holder before saving a changed role', async () => {
    const user = userEvent.setup()
    renderPanel(<RolesPanel context={CONTEXT} />)

    await user.click(await screen.findByRole('button', { name: 'Abrir papel Leitura ampla' }))
    const dialog = await screen.findByRole('dialog', { name: 'Papel Leitura ampla' })
    await user.click(await within(dialog).findByRole('radio', { name: 'Todos da instituição' }))
    await user.click(within(dialog).getByRole('button', { name: 'Salvar papel' }))

    const impact = within(dialog).getByRole('group', { name: 'Confirme a mudança' })
    expect(impact).toHaveTextContent('Esta mudança vale para 2 pessoas ativas com este papel.')
    expect(impact).toHaveTextContent('1 convites pendentes com este papel serão revogados.')
    expect(fake.writes.some((write) => write.method === 'PATCH')).toBe(false)

    await user.click(within(impact).getByRole('button', { name: 'Confirmar mudança' }))

    expect(await within(dialog).findByRole('status')).toHaveTextContent('1 convites pendentes foram revogados')
    expect(fake.writes).toContainEqual({ method: 'PATCH', path: `${fake.prefix}/roles/${CUSTOM_ROLE_ID}`, body: { name: 'Leitura ampla', bundles: [{ bundle: 'student-read', scope: 'institution' }], expectedVersion: 3 } })
  })

  it('offers templates as read-only starting points', async () => {
    const user = userEvent.setup()
    renderPanel(<RolesPanel context={CONTEXT} />)

    await user.click(await screen.findByRole('button', { name: 'Abrir papel Gestão da equipe' }))
    const dialog = await screen.findByRole('dialog')

    expect(await within(dialog).findByText(/Modelos do sistema não podem ser alterados/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Salvar papel' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Excluir papel' })).not.toBeInTheDocument()
  })
})
