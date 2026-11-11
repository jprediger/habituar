import { addDays, readLocalDateTime } from '@habituar/core/calendar'
import type { StudentId } from '@habituar/core/identity/ids'
import type { MembershipContext } from '@habituar/react-client/react-client'
import type { TFunction } from 'i18next'
import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
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
  const stopped = useRef(false)
  const [revision, setRevision] = useState(0)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    stopped.current = false
    let active = true
    async function refresh() {
      try {
        await ensureNotificationsConfigured()
        const leads = await reminderPreferenceStorage.read(studentId)
        const status = await getNotificationPermissionStatus()
        if (active) { setLeadMinutesList(leads); setPermission(status); setHasLoaded(true) }
      } catch { if (active) setError(true) }
    }
    void refresh()
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh() })
    return () => { active = false; subscription.remove() }
  }, [studentId])

  useEffect(() => {
    if (stopped.current || !hasLoaded || calendar.state.status !== 'ready') return
    const current = readLocalDateTime(readCurrentTime())
    const plan = permission !== 'granted' ? [] : planTaskReminders(studentId, calendar.state.days.flatMap(day => day.entries), leadMinutesList, current)
    void syncTaskReminders(studentId, plan, leadMinutes => t('notifications.startsIn', { lead: describeLead(leadMinutes, t) })).catch(() => { setError(true) })
  }, [revision, calendar.state, hasLoaded, leadMinutesList, permission, studentId, t])

  /** Pedido explícito após a explicação na tela de notificações. */
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

  async function selectLeadMinutes(value: number | undefined): Promise<void> {
    if (value !== undefined && !isValidLeadMinutes(value)) return
    const next = value === undefined ? [] : [value]
    try {
      await reminderPreferenceStorage.write(next, studentId)
      setLeadMinutesList(next)
      setError(false)
    } catch { setError(true) }
  }

  async function requestPermission(): Promise<void> {
    try {
      if (await getNotificationPermissionStatus() === 'granted') await openAppNotificationSettings()
      else await ensurePermissionBeforeChange()
    } catch { setError(true) }
  }

  function resume(): void {
    stopped.current = false
    setRevision(value => value + 1)
  }

  async function stop(): Promise<void> {
    stopped.current = true
    await syncTaskReminders(studentId, [], () => '')
  }

  useEffect(() => () => {
    stopped.current = true
    void syncTaskReminders(studentId, [], () => '').catch(() => undefined)
  }, [studentId])

  return { leadMinutesList, selectLeadMinutes, permission, requestPermission, hasLoaded, error, stop, resume }
}

function describeLead(leadMinutes: number, t: TFunction): string {
  if (leadMinutes >= 1440 && leadMinutes % 1440 === 0) return t('notifications.leadDays', { count: leadMinutes / 1440 })
  if (leadMinutes >= 60 && leadMinutes % 60 === 0) return t('notifications.leadHours', { count: leadMinutes / 60 })
  return t('notifications.leadMinutes', { count: leadMinutes })
}
