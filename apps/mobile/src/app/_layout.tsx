import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit'
import { useFonts } from 'expo-font'
import { Redirect, Slot, usePathname } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { getMobileAuthenticationGuard } from '../authentication-guard'
import { habituar } from '../habituar-client'
import { SessionLoadingScreen } from '../session-loading-screen'
import '../i18n/i18n'

// A splash cobre a tela até a fonte chegar. Sem isto o app aparece com a fonte do sistema
// e troca para a Outfit no meio do primeiro quadro, o que salta à vista.
void SplashScreen.preventAutoHideAsync()

/**
 * Raiz do Expo Router: monta a SafeArea e o Provider da instância única do react-client
 * deste app. Também é dona da fonte do app — carregá-la por tela faria cada uma decidir
 * o que só pode ser decidido uma vez. TanStack Query não é configurado aqui — isso é
 * interno ao pacote, não decisão do app (`m0-clients.md`).
 */
export default function RootLayout() {
  const [areFontsLoaded] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold })

  useEffect(() => {
    if (areFontsLoaded) void SplashScreen.hideAsync()
  }, [areFontsLoaded])

  // Não é tela vazia: a splash ainda está por cima e só sai na linha acima.
  if (!areFontsLoaded) return null

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

  if (guard.action === 'block') return <SessionLoadingScreen />
  if (guard.action === 'redirect') return <Redirect href={guard.route} />

  // Falha não troca a tela: quem sabe explicá-la é a rota que iniciou a autenticação.
  return <Slot />
}
