import { localDateSchema } from '@habituar/core/calendar'
import { appointmentIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { EditAppointmentScreen } from '../../../../../agenda/appointment-form-screen'
import { InstitutionSessionScreen } from '../../../../../session/session-screen'

/** Edição da série de um atendimento; os parâmetros passam por parse antes da tela. */
export default function EditAppointmentRoute() {
  const params = useLocalSearchParams<{ 'appointment-id': string; student: string; date: string }>()
  const appointmentId = appointmentIdSchema.safeParse(params['appointment-id'])
  const studentId = studentIdSchema.safeParse(params.student)
  const date = localDateSchema.safeParse(params.date)
  if (!appointmentId.success || !studentId.success || !date.success) return <Redirect href="/professional/agenda" />
  return <InstitutionSessionScreen>{(session) => <EditAppointmentScreen session={session} studentId={studentId.data} appointmentId={appointmentId.data} date={date.data} />}</InstitutionSessionScreen>
}
