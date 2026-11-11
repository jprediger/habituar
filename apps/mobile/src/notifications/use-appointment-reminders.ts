import { addDays, readLocalDateTime } from '@habituar/core/calendar'
import type { UserId } from '@habituar/core/identity/ids'
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
import { isValidLeadMinutes } from './reminder-preference-storage'
import { appointmentReminderPreferenceStorage } from './appointment-reminder-preference-storage'
import { REMINDER_WINDOW_DAYS } from './task-reminders'
import { planAppointmentReminders, syncAppointmentReminders } from './appointment-reminders'

/** Lembretes próprios do profissional: preferência por conta e instituição, fora dos filtros da agenda. */
export function useAppointmentReminders(membership: MembershipContext, userId: UserId) {
  const { t } = useTranslation()
  const now = readLocalDateTime(readCurrentTime())
  const calendar = habituar.useProfessionalAgenda(membership, { from: now.date, to: addDays(now.date, REMINDER_WINDOW_DAYS - 1) })
  const { reload } = calendar
  const scope = `appointments:${membership.institution.id}:${userId}`
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
        const leads = await appointmentReminderPreferenceStorage.read(scope)
        const status = await getNotificationPermissionStatus()
        if (active) { setLeadMinutesList(leads); setPermission(status); setHasLoaded(true) }
      } catch { if (active) setError(true) }
    }
    void refresh()
    void reload().catch(() => { if (active) setError(true) })
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') {
      void refresh()
      void reload().catch(() => { if (active) setError(true) })
    } })
    return () => { active = false; subscription.remove() }
  }, [scope, reload])

  useEffect(() => {
    if (stopped.current || !hasLoaded) return
    const isDisabled = permission !== 'granted' || leadMinutesList.length === 0
    if (!isDisabled && calendar.state.status !== 'ready') return
    const current = readLocalDateTime(readCurrentTime())
    const plan = isDisabled || calendar.state.status !== 'ready' ? [] : planAppointmentReminders(membership.institution.id, userId, calendar.state.days.flatMap(day => day.items), leadMinutesList[0], current)
    void syncAppointmentReminders(membership.institution.id, userId, plan, t('appointmentNotifications.title'), leadMinutes => t('appointmentNotifications.startsIn', { lead: describeLead(leadMinutes, t) })).catch(() => { setError(true) })
  }, [revision, calendar.state, hasLoaded, leadMinutesList, permission, membership.institution.id, userId, t])

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
      await appointmentReminderPreferenceStorage.write(next, scope)
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
    await syncAppointmentReminders(membership.institution.id, userId, [], '', () => '')
  }

  useEffect(() => () => {
    stopped.current = true
    void syncAppointmentReminders(membership.institution.id, userId, [], '', () => '').catch(() => undefined)
  }, [membership.institution.id, userId])

  return { leadMinutesList, selectLeadMinutes, permission, requestPermission, hasLoaded, error, stop, resume, updatePermission: setPermission }
}

function describeLead(leadMinutes: number, t: TFunction): string {
  if (leadMinutes >= 1440 && leadMinutes % 1440 === 0) return t('notifications.leadDays', { count: leadMinutes / 1440 })
  if (leadMinutes >= 60 && leadMinutes % 60 === 0) return t('notifications.leadHours', { count: leadMinutes / 60 })
  return t('notifications.leadMinutes', { count: leadMinutes })
}
