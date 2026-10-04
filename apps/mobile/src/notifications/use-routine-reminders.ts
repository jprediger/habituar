import { useEffect, useState } from 'react'
import type { MembershipContext } from '@habituar/react-client/react-client'
import type { StudentId } from '@habituar/core/identity/ids'
import { habituar } from '../client/habituar-client'
import { ensureNotificationsConfigured, getNotificationPermissionStatus, requestNotificationPermission } from './notification-setup'
import type { NotificationPermissionStatus } from './notification-setup'
import { reminderPreferenceStorage, REMINDER_LEAD_OPTIONS } from './reminder-preference-storage'
import type { ReminderLeadMinutes } from './reminder-preference-storage'
import { syncRoutineReminders } from './routine-reminders'

export { REMINDER_LEAD_OPTIONS }
export type { ReminderLeadMinutes }

/**
 * Lê a própria rotina do aluno e mantém os lembretes locais sincronizados com ela..
 */
export function useRoutineReminders(membership: MembershipContext, studentId: StudentId) {
  const routine = habituar.useStudentRoutine(membership, studentId)
  const [leadMinutes, setLeadMinutesState] = useState<ReminderLeadMinutes>(30)
  const [permission, setPermission] = useState<NotificationPermissionStatus>('undetermined')

  useEffect(() => {
    void (async () => {
      await ensureNotificationsConfigured()
      setPermission(await getNotificationPermissionStatus())
      setLeadMinutesState(await reminderPreferenceStorage.read())
    })()
  }, [])

  useEffect(() => {
    if (routine.state.status !== 'ready' || permission !== 'granted') return
    void syncRoutineReminders(studentId, routine.state.isEmpty ? [] : routine.state.days.flatMap((day) => day.blocks), leadMinutes)
  }, [routine.state, leadMinutes, permission, studentId])

  async function setLeadMinutes(value: ReminderLeadMinutes): Promise<void> {
    setLeadMinutesState(value)
    await reminderPreferenceStorage.write(value)
  }

  async function requestPermission(): Promise<void> {
    setPermission(await requestNotificationPermission())
  }

  return { leadMinutes, setLeadMinutes, permission, requestPermission }
}