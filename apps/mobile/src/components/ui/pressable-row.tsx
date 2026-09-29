import { SPACING } from '@habituar/design-tokens/spacing'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { PressableProps } from 'react-native'
import { Animated, Pressable, StyleSheet } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'

// Acende rápido para responder ao dedo e apaga em seguida, para o olho acompanhar qual
// linha foi tocada mesmo quando a navegação acontece logo depois.
const PRESS_IN_MS = 80
const PRESS_OUT_MS = 200

type PressableRowProps = Omit<PressableProps, 'style' | 'children' | 'onPressIn' | 'onPressOut' | 'accessibilityRole'> &
  Readonly<{ accessibilityRole: 'button' | 'switch' | 'radio'; children: ReactNode; inset?: number }>

/**
 * Único retorno de toque das linhas do app (`ListRow`, `SwitchRow`, `ChoiceList`): o fundo
 * acende de borda a borda e apaga em transição. Assume o recuo lateral de `Page` e
 * `StackPage`; `inset` recua só o conteúdo, para linha aninhada sob outra.
 */
export function PressableRow({ accessibilityRole, children, inset = 0, disabled, ...props }: PressableRowProps) {
  const { colors, minimumTouchTarget } = useThemeTokens()
  const [highlight] = useState(() => new Animated.Value(0))
  const animateHighlight = (toValue: number, duration: number) => {
    // Cor não roda no driver nativo; a animação é curta e só de uma linha.
    Animated.timing(highlight, { toValue, duration, useNativeDriver: false }).start()
  }

  return (
    <Pressable
      {...props}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      onPressIn={() => { animateHighlight(1, PRESS_IN_MS) }}
      onPressOut={() => { animateHighlight(0, PRESS_OUT_MS) }}
    >
      <Animated.View
        style={[
          styles.row,
          {
            minHeight: minimumTouchTarget,
            paddingLeft: SPACING.xl + inset,
            opacity: disabled === true ? 0.5 : 1,
            backgroundColor: highlight.interpolate({ inputRange: [0, 1], outputRange: [colors.surface, colors.surfaceMuted] }),
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg, paddingVertical: SPACING.md, marginHorizontal: -SPACING.xl, paddingRight: SPACING.xl },
})
