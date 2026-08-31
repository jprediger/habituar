import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { habituar } from '../habituar-client'
import '../i18n/i18n'

/**
 * Raiz do Expo Router: monta a SafeArea e o Provider da instância única do react-client
 * deste app. TanStack Query não é configurado aqui — isso é interno ao pacote, não decisão
 * do app (`m0-clients.md`).
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <habituar.Provider>
        <StatusBar style="auto" />
        <Slot />
      </habituar.Provider>
    </SafeAreaProvider>
  )
}
