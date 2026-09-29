import { fireEvent, render, screen } from '@testing-library/react-native'
import { ChoiceList } from './choice-list'

describe('choice list', () => {
  it('ignores a choice while disabled and says so to assistive technology', () => {
    const onChange = jest.fn()
    const label = 'Alcance'
    const choices = [{ value: 'own', label: 'Somente os próprios dados' }, { value: 'institution', label: 'Todos da instituição' }] as const
    render(<ChoiceList label={label} choices={choices} value="own" isDisabled onChange={onChange} />)

    const other = screen.getByRole('radio', { name: 'Todos da instituição', disabled: true })
    fireEvent.press(other)

    expect(onChange).not.toHaveBeenCalled()
  })
})
