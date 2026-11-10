import { localDateSchema } from '@habituar/core/calendar'
import { appointmentIdSchema, studentIdSchema } from '@habituar/core/identity/ids'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { AppointmentDetailScreen } from '../../../../agenda/appointment-detail-screen'
import { InstitutionSessionScreen } from '../../../../session/session-screen'

/** Detalhe de uma ocorrência na agenda do profissional; os parâmetros passam por parse antes da tela. */
export default function ProfessionalAppointmentRoute() {
  const router = useRouter()
  const params = useLocalSearchParams<{ 'appointment-id': string; student: string; date: string }>()
  const appointmentId = appointmentIdSchema.safeParse(params['appointment-id'])
  const studentId = studentIdSchema.safeParse(params.student)
  const date = localDateSchema.safeParse(params.date)
  if (!appointmentId.success || !studentId.success || !date.success) return <Redirect href="/professional/agenda" />
  return (
    <InstitutionSessionScreen>
      {(session) => (
        <AppointmentDetailScreen
          session={session}
          studentId={studentId.data}
          appointmentId={appointmentId.data}
          date={date.data}
          onEdit={() => { router.push({ pathname: '/professional/agenda/appointment/[appointment-id]/edit', params: { 'appointment-id': appointmentId.data, student: studentId.data, date: date.data } }) }}
        />
      )}
    </InstitutionSessionScreen>
  )
}
