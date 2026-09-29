import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemeTokens } from '../../theme/tokens'
import { Text } from './text'
import { Icon } from './icon'

export type ToastType = 'success' | 'warning' | 'info' | 'error'
export type ToastMessage = Readonly<{ type: ToastType; title: string; subtitle: string }>

// Tempo de leitura, não de enfeite: abaixo disso uma frase curta some antes de ser lida.
const MINIMUM_VISIBLE_MS = 4000
// Frase longa ganha tempo proporcional, na média de leitura de ~15 caracteres por segundo.
const MS_PER_CHARACTER = 65
const ENTER_MS = 180
const EXIT_MS = 220
const ENTER_OFFSET = 24

type ToastContextValue = Readonly<{
  show: (message: ToastMessage) => void
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
  const [message, setMessage] = useState<ToastMessage | undefined>(undefined)
  const [bottomOffset, setBottomOffset] = useState(0)
  const [progress] = useState(() => new Animated.Value(0))

  const show = (next: ToastMessage) => {
    progress.stopAnimation()
    progress.setValue(0)
    setMessage(next)
    // Aviso só visual não chega a quem usa leitor de tela.
    AccessibilityInfo.announceForAccessibility(`${next.title}. ${next.subtitle}`)
    Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: ENTER_MS, useNativeDriver: true }),
      Animated.delay(Math.max(MINIMUM_VISIBLE_MS, (next.title.length + next.subtitle.length) * MS_PER_CHARACTER)),
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
                backgroundColor: colors.surface,
                borderColor: colors.divider,
                opacity: progress,
                transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_OFFSET, 0] }) }],
              },
            ]}
          >
            <View style={styles.content}>
              <View style={[styles.icon, { backgroundColor: getToastColor(message.type, colors) }]}>
                <Icon name={getToastIcon(message.type)} size={20} color={colors.surface} />
              </View>
              <View style={styles.copy}>
                <Text weight="medium">{message.title}</Text>
                <Text size="caption" tone="muted">{message.subtitle}</Text>
              </View>
            </View>
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
  toast: { borderWidth: StyleSheet.hairlineWidth, padding: SPACING.md, shadowColor: '#000000', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  content: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: SPACING.xs },
})

function getToastIcon(type: ToastType): 'shield-check' | 'warning' | 'info' | 'warning-circle' {
  switch (type) {
    case 'success': return 'shield-check'
    case 'warning': return 'warning'
    case 'info': return 'info'
    case 'error': return 'warning-circle'
  }
}

function getToastColor(type: ToastType, colors: ReturnType<typeof useThemeTokens>['colors']): string {
  switch (type) {
    case 'success': return colors.primary
    case 'warning': return colors.warning
    case 'info': return colors.info
    case 'error': return colors.danger
  }
}
