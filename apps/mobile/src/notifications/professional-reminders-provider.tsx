import { createContext, useContext, useEffect, useState, memo, type ReactNode } from 'react'
import type { InstitutionSession } from '../session/session-screen'
import { useAppointmentNotificationNavigation } from './use-appointment-notification-navigation'
import { useAppointmentReminders } from './use-appointment-reminders'

const Context = createContext<ReturnType<typeof useAppointmentReminders> | undefined>(undefined)

/** Mantém os lembretes na sessão profissional sem depender de abrir a tela de preferências. */
export function ProfessionalRemindersProvider({ session, children }: Readonly<{ session: InstitutionSession; children: ReactNode }>) {
  useAppointmentNotificationNavigation(session)
  const [reminders, setReminders] = useState<ReturnType<typeof useAppointmentReminders> | undefined>(undefined)
  const canRead = session.membership.permissions.some(grant => grant.key === 'appointment.read')
  return <Context.Provider value={canRead ? reminders : undefined}>
    {canRead && <Coordinator key={`${session.membership.institution.id}:${session.user.id}`} session={session} onChange={setReminders} />}
    {children}
  </Context.Provider>
}

const Coordinator = memo(function Coordinator({ session, onChange }: Readonly<{ session: InstitutionSession; onChange: (value: ReturnType<typeof useAppointmentReminders>) => void }>) {
  const reminders = useAppointmentReminders(session.membership, session.user.id)
  useEffect(() => { onChange(reminders) }, [reminders, onChange])
  return null
})

/** Compartilha a preferência e o controle de saída da sessão entre Perfil e Notificações. */
export function useProfessionalReminders() { return useContext(Context) }
