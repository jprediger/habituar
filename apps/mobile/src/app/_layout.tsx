import { NavigationBar } from 'expo-navigation-bar'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthenticationRouter } from '../session/authentication-router'
import { habituar } from '../client/habituar-client'
import { AppearanceGate } from '../theme/appearance-gate'
import '../i18n/i18n'

/**
 * Raiz do Expo Router: monta a SafeArea e o Provider da instância única do react-client
 * deste app. Só compõe — *quando* a primeira tela aparece é do `AppearanceGate`, e *qual*
 * rota monta é do `AuthenticationRouter`. TanStack Query não é configurado aqui: isso é
 * interno ao pacote, não decisão do app (`m0-clients.md`).
 */
export default function RootLayout() {
  return (
    <AppearanceGate>
      <SafeAreaProvider>
        <habituar.Provider>
          <StatusBar style="auto" />
          {/* O Android pinta a barra de navegação pelo tema do sistema, não pelo escolhido no
              Perfil; `auto` segue o `Appearance`, que é onde essa escolha vive. */}
          <NavigationBar style="auto" />
          <AuthenticationRouter />
        </habituar.Provider>
      </SafeAreaProvider>
    </AppearanceGate>
  )
}
