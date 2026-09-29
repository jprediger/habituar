import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, Easing, StyleSheet } from 'react-native'
import { useReduceMotion } from '../ui/use-reduce-motion'

// Resposta rápida não pisca esqueleto: abaixo disso, a troca de tela já parece imediata e
// o esqueleto que some logo depois é só ruído visual.
export const SKELETON_DELAY_MS = 50
const PULSE_DURATION_MS = 900
const PULSE_MIN_OPACITY = 0.45

/**
 * Raiz de todo esqueleto de carregamento: dona do atraso antes de aparecer, do pulso único
 * que anima todos os blocos em sincronia e do anúncio acessível. Os blocos dentro dela são
 * só forma e se agrupam num único elemento acessível; quem ouve a tela recebe "Carregando"
 * uma vez, não uma lista de retângulos.
 */
export function Skeleton({ children }: PropsWithChildren) {
  const { t } = useTranslation()
  const isVisible = useDelayedVisibility()
  const opacity = usePulse(isVisible)

  if (!isVisible) return null
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('skeleton.loading')}
      accessibilityLiveRegion="polite"
      style={[styles.container, { opacity }]}
    >
      {children}
    </Animated.View>
  )
}

function useDelayedVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => { setIsVisible(true) }, SKELETON_DELAY_MS)
    return () => { clearTimeout(timer) }
  }, [])
  return isVisible
}

function usePulse(isActive: boolean): Animated.Value {
  const [opacity] = useState(() => new Animated.Value(1))
  const isReduceMotionEnabled = useReduceMotion()

  useEffect(() => {
    // Com movimento reduzido o esqueleto fica parado: a forma já comunica carregamento.
    if (!isActive || isReduceMotionEnabled) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: PULSE_MIN_OPACITY, duration: PULSE_DURATION_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: PULSE_DURATION_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => {
      loop.stop()
      opacity.setValue(1)
    }
  }, [isActive, isReduceMotionEnabled, opacity])

  return opacity
}

const styles = StyleSheet.create({
  container: { gap: SPACING.xl },
})
