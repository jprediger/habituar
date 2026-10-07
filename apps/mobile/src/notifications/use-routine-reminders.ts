import { useEffect, useRef, useState } from 'react'
import type { MembershipContext } from '@habituar/react-client/react-client'
import type { StudentId } from '@habituar/core/identity/ids'
import { habituar } from '../client/habituar-client'
import {
  ensureNotificationsConfigured,
  getNotificationPermissionStatus,
  openAppNotificationSettings,
  requestNotificationPermission,
} from './notification-setup'
import type { NotificationPermissionStatus } from './notification-setup'
import { permissionRequestFlag } from './notification-permission-flag-storage'
import { PRESET_LEAD_MINUTES, isValidLeadMinutes, reminderPreferenceStorage } from './reminder-preference-storage'
import { syncRoutineReminders } from './routine-reminders'

export { PRESET_LEAD_MINUTES, isValidLeadMinutes }

export function useRoutineReminders(membership: MembershipContext, studentId: StudentId) {
  const routine = habituar.useStudentRoutine(membership, studentId)
  const [leadMinutesList, setLeadMinutesList] = useState<readonly number[]>([])
  const [permission, setPermission] = useState<NotificationPermissionStatus>('undetermined')
  const hasInitialized = useRef(false)

  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    void (async () => {
      await ensureNotificationsConfigured()
      setLeadMinutesList(await reminderPreferenceStorage.read())

      const currentStatus = await getNotificationPermissionStatus()
      const alreadyAskedOnce = await permissionRequestFlag.wasRequested()

      // Pedido automático só na primeira vez que o app roda
      if (currentStatus === 'undetermined' && !alreadyAskedOnce) {
        const result = await requestNotificationPermission()
        await permissionRequestFlag.markRequested()
        setPermission(result)
        return
      }

      setPermission(currentStatus)
    })()
  }, [])

  useEffect(() => {
    if (routine.state.status !== 'ready' || permission !== 'granted') return
    const blocks = routine.state.isEmpty ? [] : routine.state.days.flatMap((day) => day.blocks)
    void syncRoutineReminders(studentId, blocks, leadMinutesList)
  }, [routine.state, leadMinutesList, permission, studentId])

  /** Pedido reaberto sempre que a pessoa tenta mudar algo sem permissão */
  async function ensurePermissionBeforeChange(): Promise<boolean> {
    const currentStatus = await getNotificationPermissionStatus()
    if (currentStatus === 'granted') {
      setPermission('granted')
      return true
    }

    // Negativa persistente: o SO não reexibe o próprio diálogo depois da primeira recusa.
    if (currentStatus === 'denied') {
      await openAppNotificationSettings()
      return false
    }

    const result = await requestNotificationPermission()
    setPermission(result)
    return result === 'granted'
  }

  async function addLeadMinutes(value: number): Promise<void> {
    if (!(await ensurePermissionBeforeChange())) return
    if (!isValidLeadMinutes(value) || leadMinutesList.includes(value)) return
    const next = [...leadMinutesList, value]
    setLeadMinutesList(next)
    await reminderPreferenceStorage.write(next)
  }

  async function removeLeadMinutes(value: number): Promise<void> {
    const next = leadMinutesList.filter((entry) => entry !== value)
    setLeadMinutesList(next)
    await reminderPreferenceStorage.write(next)
  }

  async function requestPermission(): Promise<void> {
    await ensurePermissionBeforeChange()
  }

  return { leadMinutesList, addLeadMinutes, removeLeadMinutes, permission, requestPermission }
}