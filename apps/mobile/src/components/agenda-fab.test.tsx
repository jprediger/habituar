import { fireEvent, render, screen } from '@testing-library/react-native'
import '../i18n/i18n'
import { AgendaFab } from './agenda-fab'

describe('agenda floating create button', () => {
  it('creates directly when there is a single type', () => {
    const onPress = jest.fn()
    render(<AgendaFab actions={[{ key: 'task', label: 'Nova tarefa', icon: 'list-checks', onPress }]} />)

    fireEvent.press(screen.getByRole('button', { name: 'Nova tarefa' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('opens the menu of types first when there is more than one', () => {
    const onTask = jest.fn()
    render(<AgendaFab actions={[{ key: 'task', label: 'Nova tarefa', icon: 'list-checks', onPress: onTask }, { key: 'consultation', label: 'Nova consulta', icon: 'clipboard-text', onPress: jest.fn() }]} />)

    expect(screen.queryByRole('button', { name: 'Nova tarefa' })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Criar' }))
    fireEvent.press(screen.getByRole('button', { name: 'Nova tarefa' }))

    expect(onTask).toHaveBeenCalledTimes(1)
  })

  it('does not appear for someone who can only read the agenda', () => {
    render(<AgendaFab actions={[]} />)

    expect(screen.queryByRole('button')).toBeNull()
  })
})
