import { fireEvent, render, screen } from '@testing-library/react-native'
import '../i18n/i18n'
import { InstitutionSwitcher } from './institution-switcher'

const mockOtherMemberships: { institution: { id: string; name: string } }[] = []
const mockSwitcher = {
  current: { institution: { id: 'first', name: 'Escola Aurora' } },
  others: mockOtherMemberships,
  switchTo: jest.fn(),
}

jest.mock('../client/habituar-client', () => ({
  habituar: { useInstitutionSwitcher: () => mockSwitcher },
}))

beforeEach(() => {
  mockSwitcher.others = []
  mockSwitcher.switchTo.mockClear()
})

describe('institution switcher', () => {
  it('stays hidden when the person has one membership', () => {
    const view = render(<InstitutionSwitcher />)
    expect(view.toJSON()).toBeNull()
  })

  it('announces the current institution and offers the other membership', () => {
    mockSwitcher.others = [{ institution: { id: 'second', name: 'Escola Boreal' } }]
    render(<InstitutionSwitcher />)

    expect(screen.getByText('Instituição atual: Escola Aurora')).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('button', { name: 'Trocar instituição' }))
    fireEvent.press(screen.getByRole('button', { name: 'Escola Boreal' }))
    expect(mockSwitcher.switchTo).toHaveBeenCalledWith('second')
  })
})
