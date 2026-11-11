import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { appointmentIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { localDateSchema } from '@habituar/core/calendar'
import type { InstitutionSession } from '../session/session-screen'

/** Abre somente notificações da conta e instituição ativas; o detalhe revalida o acesso na API. */
export function useAppointmentNotificationNavigation(session: InstitutionSession) {
  const router = useRouter()
  useEffect(() => {
    let active = true
    let handled: string | undefined
    function open(response: Notifications.NotificationResponse | null) {
      if (!active || response === null || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return
      const request = response.notification.request
      if (handled === request.identifier) return
      const data = request.content.data
      if (data === undefined || data.kind !== 'appointment-reminder' || data.userId !== session.user.id || data.institutionId !== session.membership.institution.id) return
      const appointment = appointmentIdSchema.safeParse(data.appointmentId)
      const student = studentIdSchema.safeParse(data.studentId)
      const date = localDateSchema.safeParse(data.date)
      if (!appointment.success || !student.success || !date.success) return
      handled = request.identifier
      Notifications.clearLastNotificationResponse()
      router.push({ pathname: '/professional/agenda/appointment/[appointment-id]', params: { 'appointment-id': appointment.data, student: student.data, date: date.data } })
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(open)
    open(Notifications.getLastNotificationResponse())
    return () => { active = false; subscription.remove() }
  }, [session.user.id, session.membership.institution.id, router])
}
