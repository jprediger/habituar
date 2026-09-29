import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * Preferência do sistema por movimento reduzido, acompanhada enquanto a tela vive. Toda
 * animação do app que não seja só troca de cor passa por aqui antes de se mover.
 */
export function useReduceMotion(): boolean {
  const [isEnabled, setIsEnabled] = useState(false)
  useEffect(() => {
    let isMounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (isMounted) setIsEnabled(value) })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsEnabled)
    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [])
  return isEnabled
}
