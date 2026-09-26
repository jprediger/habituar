import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * Preferência de "reduzir movimento" do sistema, acompanhada enquanto a tela vive. É a
 * única fonte dessa decisão no app: animação que não passa por aqui ignora quem pediu
 * para não ver movimento.
 */
export function useIsReduceMotionEnabled(): boolean {
  // Começa reduzido: a consulta é assíncrona, e o erro seguro no primeiro quadro é deixar
  // de animar para quem queria animação — não animar para quem pediu que não.
  const [isEnabled, setIsEnabled] = useState(true)

  useEffect(() => {
    let isMounted = true

    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (isMounted) setIsEnabled(value)
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsEnabled)

    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [])

  return isEnabled
}
