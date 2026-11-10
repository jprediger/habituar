import { localDateSchema } from '@habituar/core/calendar'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { NewAppointmentScreen } from '../../../agenda/appointment-form-screen'
import { InstitutionSessionScreen } from '../../../session/session-screen'

/** Novo atendimento no dia vindo da agenda; o parâmetro passa por parse antes da tela. */
export default function NewAppointmentRoute() {
  const params = useLocalSearchParams<{ date: string }>()
  const date = localDateSchema.safeParse(params.date)
  if (!date.success) return <Redirect href="/professional/agenda" />
  return <InstitutionSessionScreen>{(session) => <NewAppointmentScreen session={session} date={date.data} />}</InstitutionSessionScreen>
}
