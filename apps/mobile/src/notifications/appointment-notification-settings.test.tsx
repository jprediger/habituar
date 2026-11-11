import { fireEvent, render, screen } from '@testing-library/react-native'
import '../i18n/i18n'
import { AppointmentNotificationSettings } from './appointment-notification-settings'

const mockSelect = jest.fn()
const mockReminders = { leadMinutesList: [30], selectLeadMinutes: mockSelect, hasLoaded: true, error: false }
jest.mock('./professional-reminders-provider', () => ({ useProfessionalReminders: () => mockReminders }))

beforeEach(() => { jest.clearAllMocks(); mockReminders.leadMinutesList = [30]; mockReminders.error = false })

describe('consultation notification preferences', () => {
  it('shows the default lead and lets the professional change it', () => {
    render(<AppointmentNotificationSettings />)
    expect(screen.getByRole('radio', { name: '30 minutos', checked: true })).toBeOnTheScreen()
    fireEvent.press(screen.getByRole('radio', { name: '15 minutos' }))
    expect(mockSelect).toHaveBeenCalledWith(15)
  })
  it('lets the professional disable reminders without changing the device permission', () => {
    render(<AppointmentNotificationSettings />)
    fireEvent.press(screen.getByRole('switch', { name: 'Lembretes de consultas', checked: true }))
    expect(mockSelect).toHaveBeenCalledWith(undefined)
  })
  it('hides lead choices while reminders are disabled', () => {
    mockReminders.leadMinutesList = []
    render(<AppointmentNotificationSettings />)
    expect(screen.queryByRole('radio', { name: '30 minutos' })).toBeNull()
    fireEvent.press(screen.getByRole('switch', { name: 'Lembretes de consultas', checked: false }))
    expect(mockSelect).toHaveBeenCalledWith(30)
  })
})
