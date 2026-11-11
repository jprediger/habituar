import { createContext, useContext, useEffect, useState, memo, type ReactNode } from 'react'
import { habituar } from '../client/habituar-client'
import type { InstitutionSession } from '../session/session-screen'
import type { StudentId } from '@habituar/core/identity/ids'
import { useTaskReminders } from './use-task-reminders'

const RemindersContext = createContext<ReturnType<typeof useTaskReminders> | undefined>(undefined)

/** Mantém os lembretes na sessão sem remontar o navegador quando o cadastro carrega. */
export function StudentRemindersProvider({ session, children }: Readonly<{ session: InstitutionSession; children: ReactNode }>) {
  const { state } = habituar.useAccessibleStudents(session.membership)
  const [reminders, setReminders] = useState<ReturnType<typeof useTaskReminders> | undefined>(undefined)
  const student = state.status === 'ready' && state.students.length === 1 ? state.students[0] : undefined
  return <RemindersContext.Provider value={student === undefined ? undefined : reminders}>
    {student !== undefined && <ReminderCoordinator key={`${session.membership.institution.id}:${student.id}`} session={session} studentId={student.id} onChange={setReminders} />}
    {children}
  </RemindersContext.Provider>
}

const ReminderCoordinator = memo(function ReminderCoordinator({ session, studentId, onChange }: Readonly<{ session: InstitutionSession; studentId: StudentId; onChange: (value: ReturnType<typeof useTaskReminders>) => void }>) {
  const reminders = useTaskReminders(session.membership, studentId)
  useEffect(() => { onChange(reminders) }, [reminders, onChange])
  return null
})

/** Compartilha o estado de lembretes da sessão entre Perfil e suas preferências. */
export function useStudentReminders() { return useContext(RemindersContext) }
