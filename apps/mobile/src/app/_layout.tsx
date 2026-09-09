import { Redirect, Slot, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { habituar } from '../habituar-client'
import { AuthenticationFixture } from './authentication-fixture'
import { getMobileAuthenticationGuard } from './authentication-guard'
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
        <AuthenticationRouter />
      </habituar.Provider>
    </SafeAreaProvider>
  )
}

/** Aplica o guard antes do Slot para que deep links não montem conteúdo de outro ambiente. */
function AuthenticationRouter() {
  const pathname = usePathname()
  const { state } = habituar.useAuthentication()
  const guard = getMobileAuthenticationGuard(state, pathname)

  if (guard.action === 'block') return null
  if (guard.action === 'redirect') return <Redirect href={guard.route} />

  return state.status === 'failed' ? <AuthenticationFixture /> : <Slot />
}
