import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import type { PropsWithChildren } from 'react'
import { useEffect } from 'react'
import { appThemePreference, useThemePreference } from './app-theme-preference'

// A splash cobre a tela até a fonte chegar. Sem isto o app aparece com a fonte do sistema
// e troca para a Outfit no meio do primeiro quadro, o que salta à vista.
void SplashScreen.preventAutoHideAsync()
// Mesma razão da fonte: o tema escolhido precisa estar aplicado antes do primeiro quadro,
// senão o app abre no esquema do sistema e troca em seguida. `load` nunca rejeita — falhar
// na leitura cai no esquema do sistema.
void appThemePreference.load()

/**
 * Dona da aparência inicial do app: segura a splash até a fonte e o tema escolhido se
 * resolverem, e recusa deixá-la de pé quando um dos dois falha. Carregar a fonte por tela
 * faria cada uma decidir o que só pode ser decidido uma vez. Não conhece navegação nem
 * sessão — só decide quando é honesto mostrar a primeira tela.
 */
export function AppearanceGate({ children }: PropsWithChildren) {
  const [areFontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  })

  // Fonte é aparência, e aparência não impede entrar na conta: se o arquivo não chega, o
  // app abre no corte do sistema. Ignorar este erro deixaria a splash de pé para sempre,
  // sem nada na tela explicando o quê.
  const hasFontSettled = areFontsLoaded || fontError !== null
  const hasThemeSettled = useThemePreference().state.status === 'ready'
  const hasAppearanceSettled = hasFontSettled && hasThemeSettled

  useEffect(() => {
    if (!hasAppearanceSettled) return
    if (fontError !== null) console.error('Failed to load the app font; falling back to the system face.', fontError)

    void SplashScreen.hideAsync()
  }, [hasAppearanceSettled, fontError])

  // Não é tela vazia: a splash ainda está por cima e sai assim que fonte e tema se
  // resolverem, tendo chegado ou falhado.
  if (!hasAppearanceSettled) return null

  return children
}
