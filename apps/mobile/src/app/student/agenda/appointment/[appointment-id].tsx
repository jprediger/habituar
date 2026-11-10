import { localDateSchema } from '@habituar/core/calendar'
import { appointmentIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { AppointmentDetailScreen } from '../../../../agenda/appointment-detail-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

/** Atendimento visto da agenda do aluno, só para leitura; os parâmetros passam por parse antes da tela. */
export default function StudentAppointmentRoute() {
  const params = useLocalSearchParams<{ 'appointment-id': string; student: string; date: string }>()
  const appointmentId = appointmentIdSchema.safeParse(params['appointment-id'])
  const studentId = studentIdSchema.safeParse(params.student)
  const date = localDateSchema.safeParse(params.date)
  if (!appointmentId.success || !studentId.success || !date.success) return <Redirect href="/student/agenda" />
  return <InstitutionSessionScreen>{(session) => <AppointmentDetailScreen session={session} studentId={studentId.data} appointmentId={appointmentId.data} date={date.data} />}</InstitutionSessionScreen>
}
