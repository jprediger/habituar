import { Stack } from 'expo-router'

export const unstable_settings = { initialRouteName: 'index' }

/** Mantém o perfil como destino de volta das preferências do profissional e monitor. */
export default function ProfessionalProfileLayout() {
  return <Stack screenOptions={{ headerShown: false }} initialRouteName="index" />
}
