import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import '../i18n/i18n'
import { createInstitutionSession } from '../session/institution-session-fixture'
import { AppointmentNotificationSettings } from './appointment-notification-settings'
import { ProfessionalRemindersProvider } from './professional-reminders-provider'

const mockCancel = jest.fn<Promise<void>, [string]>(() => Promise.resolve())
const mockReload = jest.fn(() => Promise.reject(new Error('offline')))
jest.mock('../client/habituar-client', () => ({ habituar: { useProfessionalAgenda: () => ({ state: { status: 'failed', failure: 'failed' }, reload: mockReload }) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('./notification-setup', () => ({ ensureNotificationsConfigured: () => Promise.resolve(), getNotificationPermissionStatus: () => Promise.resolve('granted') }))
jest.mock('./appointment-reminder-preference-storage', () => ({ appointmentReminderPreferenceStorage: { read: () => Promise.resolve([30]), write: () => Promise.resolve() } }))
jest.mock('expo-notifications', () => ({
  addNotificationResponseReceivedListener: () => ({ remove: jest.fn() }), getLastNotificationResponse: () => null,
  getAllScheduledNotificationsAsync: () => Promise.resolve([{ identifier: 'appointment-reminder:00000000-0000-4000-8000-000000000001:20000000-0000-4000-8000-000000000001:existing' }]),
  cancelScheduledNotificationAsync: (id: string) => mockCancel(id),
}))

describe('consultation preferences while offline', () => {
  it('loads local preferences and cancels scheduled reminders when disabled even if the agenda fails', async () => {
    const session = createInstitutionSession('professional')
    render(<ProfessionalRemindersProvider session={{ ...session, membership: { ...session.membership, permissions: [{ key: 'appointment.read', scope: 'institution' }] } }}><AppointmentNotificationSettings /></ProfessionalRemindersProvider>)
    await waitFor(() => { expect(screen.getByRole('switch', { name: 'Lembretes de consultas', checked: true })).toBeEnabled() })
    fireEvent.press(screen.getByRole('switch', { name: 'Lembretes de consultas' }))
    await waitFor(() => { expect(mockCancel).toHaveBeenCalledWith('appointment-reminder:00000000-0000-4000-8000-000000000001:20000000-0000-4000-8000-000000000001:existing') })
  })
})
