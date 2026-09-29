import { fireEvent, render, screen } from '@testing-library/react-native'
import { SwitchRow } from './switch-row'

describe('switch row', () => {
  it('is announced as a switch by its label and reports the new value', () => {
    const onChange = jest.fn()
    const label = 'Consultar a equipe'
    render(<SwitchRow label={label} isOn={false} onChange={onChange} />)

    fireEvent.press(screen.getByRole('switch', { name: label, checked: false }))

    expect(onChange).toHaveBeenCalledWith(true)
  })
})
