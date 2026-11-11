import { Stack } from 'expo-router'

export const unstable_settings = { initialRouteName: 'index' }

/** Pilha do perfil mantém a raiz disponível ao abrir notificações por link direto. */
export default function StudentProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} initialRouteName="index" />
}
