import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemeTokens } from '../../theme/tokens'
import { Text } from './text'

// Tempo de leitura, não de enfeite: abaixo disso uma frase curta some antes de ser lida.
const MINIMUM_VISIBLE_MS = 4000
// Frase longa ganha tempo proporcional, na média de leitura de ~15 caracteres por segundo.
const MS_PER_CHARACTER = 65
const ENTER_MS = 180
const EXIT_MS = 220
const ENTER_OFFSET = 24

type ToastContextValue = Readonly<{
  show: (message: string) => void
  setBottomOffset: (offset: number) => void
}>

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

/**
 * Dono do aviso passageiro do app: um por vez, na base da tela, acima da barra de
 * navegação, sobrevivendo à troca de tela. Só confirma o que deu certo; recusa erro e
 * informação que precisa ficar na tela — esses moram junto do que os causou.
 */
export function ToastProvider({ children }: PropsWithChildren) {
  const { colors, radius } = useThemeTokens()
  const insets = useSafeAreaInsets()
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [bottomOffset, setBottomOffset] = useState(0)
  const [progress] = useState(() => new Animated.Value(0))

  const show = (next: string) => {
    progress.stopAnimation()
    progress.setValue(0)
    setMessage(next)
    // Aviso só visual não chega a quem usa leitor de tela.
    AccessibilityInfo.announceForAccessibility(next)
    Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: ENTER_MS, useNativeDriver: true }),
      Animated.delay(Math.max(MINIMUM_VISIBLE_MS, next.length * MS_PER_CHARACTER)),
      Animated.timing(progress, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) setMessage(undefined) })
  }

  return (
    <ToastContext.Provider value={{ show, setBottomOffset }}>
      {children}
      {message !== undefined && (
        <View pointerEvents="none" style={[styles.host, { bottom: Math.max(bottomOffset, insets.bottom) + SPACING.md }]}>
          <Animated.View
            // O anúncio já foi feito pelo `AccessibilityInfo`; ler de novo ao focar repetiria.
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              styles.toast,
              {
                borderRadius: radius.field,
                backgroundColor: colors.toast,
                borderColor: colors.divider,
                opacity: progress,
                transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_OFFSET, 0] }) }],
              },
            ]}
          >
            <Text weight="medium" tone="onToast">{message}</Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  )
}

/** Mostra um aviso passageiro de sucesso. Exige estar sob `ToastProvider`. */
export function useToast(): ToastContextValue['show'] {
  const context = useContext(ToastContext)
  if (context === undefined) throw new Error('useToast must be used inside ToastProvider')
  return context.show
}

/**
 * Registra a altura da barra de navegação enquanto ela existe, para o aviso subir acima
 * dela; ao sair, o aviso volta a respeitar só a área segura. Sem `ToastProvider` não faz
 * nada: é ajuste de posição, não comportamento, e a barra não depende dele para existir.
 */
export function useToastBottomOffset(): (offset: number) => void {
  const setBottomOffset = useContext(ToastContext)?.setBottomOffset ?? ignoreOffset
  useEffect(() => () => { setBottomOffset(0) }, [setBottomOffset])
  return setBottomOffset
}

function ignoreOffset(): void {
  // Sem provedor não há aviso para posicionar.
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: SPACING.lg, right: SPACING.lg },
  // Borda fina em vez de sombra: a faixa é só um tom acima do fundo, e o traço a separa do
  // conteúdo com o mesmo peso nos dois temas.
  toast: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
})
