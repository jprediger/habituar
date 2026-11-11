import { addDays, readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import type { MembershipContext } from '@habituar/react-client/react-client'
import type { TFunction } from 'i18next'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { habituar } from '../client/habituar-client'
import { readCurrentTime } from '../time/current-time'
import {
  ensureNotificationsConfigured,
  getNotificationPermissionStatus,
  openAppNotificationSettings,
  requestNotificationPermission,
} from './notification-setup'
import type { NotificationPermissionStatus } from './notification-setup'
import { permissionRequestFlag } from './notification-permission-flag-storage'
import { isValidLeadMinutes, reminderPreferenceStorage } from './reminder-preference-storage'
import { planTaskReminders, REMINDER_WINDOW_DAYS, syncTaskReminders } from './task-reminders'

// Consultas ficam fora: os lembretes desta preferência são das tarefas, das duas origens.
const TASKS_ONLY = { 'student-task': true, 'staff-task': true, consultation: false } as const

/**
 * Lembretes locais das tarefas do aluno com a preferência global de antecedência: lê as
 * ocorrências das próximas semanas na agenda e mantém agendadas as mais próximas.
 */
export function useTaskReminders(membership: MembershipContext, studentId: StudentId) {
  const { t } = useTranslation()
  const now = readLocalDateTime(readCurrentTime())
  const calendar = habituar.useStudentCalendar(membership, studentId, { from: now.date, to: addDays(now.date, REMINDER_WINDOW_DAYS - 1) }, TASKS_ONLY, now.date)
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

      // Pedido automático só na primeira vez que o app roda.
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
    if (calendar.state.status !== 'ready' || permission !== 'granted') return
    const current = readLocalDateTime(readCurrentTime())
    const plan = planTaskReminders(studentId, calendar.state.days.flatMap(day => day.entries), leadMinutesList, current)
    void syncTaskReminders(studentId, plan, leadMinutes => t('notifications.startsIn', { lead: describeLead(leadMinutes, t) }))
  }, [calendar.state, leadMinutesList, permission, studentId, t])

  /** Pedido reaberto sempre que a pessoa tenta mudar algo sem permissão. */
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

function describeLead(leadMinutes: number, t: TFunction): string {
  if (leadMinutes >= 1440 && leadMinutes % 1440 === 0) return t('notifications.leadDays', { count: leadMinutes / 1440 })
  if (leadMinutes >= 60 && leadMinutes % 60 === 0) return t('notifications.leadHours', { count: leadMinutes / 60 })
  return t('notifications.leadMinutes', { count: leadMinutes })
}
