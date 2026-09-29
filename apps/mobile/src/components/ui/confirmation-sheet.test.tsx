import { fireEvent, render, screen } from '@testing-library/react-native'
import '../../i18n/i18n'
import { ConfirmationSheet } from './confirmation-sheet'

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }))

const TITLE = 'Excluir papel'
const MESSAGE = 'Excluir o papel TS? Esta ação não pode ser desfeita.'
const CONFIRM_LABEL = 'Sim, excluir'
const CANCEL_LABEL = 'Voltar'

function renderSheet({ isBusy, onConfirm = jest.fn(), onCancel = jest.fn() }: Readonly<{ isBusy: boolean; onConfirm?: () => void; onCancel?: () => void }>) {
  render(
    <ConfirmationSheet
      title={TITLE}
      message={MESSAGE}
      confirmLabel={CONFIRM_LABEL}
      cancelLabel={CANCEL_LABEL}
      confirmVariant="danger"
      isBusy={isBusy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
}

// O véu fica fora da árvore acessível de propósito (`accessibilityViewIsModal` na folha):
// para o leitor de tela, sair é o botão de cancelar ou o gesto de voltar do sistema.
describe('confirmation sheet', () => {
  it('names the action and runs it only from the confirm button', () => {
    const onConfirm = jest.fn()
    renderSheet({ isBusy: false, onConfirm })

    expect(screen.getByRole('header', { name: 'Excluir papel' })).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Sim, excluir' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancels when the backdrop is tapped', () => {
    const onCancel = jest.fn()
    renderSheet({ isBusy: false, onCancel })

    fireEvent.press(screen.getByLabelText('Fechar confirmação', { includeHiddenElements: true }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cannot be dismissed while the action is running', () => {
    const onCancel = jest.fn()
    renderSheet({ isBusy: true, onCancel })

    fireEvent.press(screen.getByLabelText('Fechar confirmação', { includeHiddenElements: true }))

    expect(onCancel).not.toHaveBeenCalled()
  })
})
