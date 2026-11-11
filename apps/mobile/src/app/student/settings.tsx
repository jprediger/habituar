import { Redirect } from 'expo-router'

/** Preserva o destino antigo, mantendo notificações dentro da pilha de Perfil. */
export default function StudentSettingsRoute() {
  return <Redirect href="/student/profile/notifications" />
}
