import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'

/** Superfície de agrupamento visual do kit nativo; não decide o conteúdo. */
export function Card({ children }: PropsWithChildren) {
  const { colors } = useThemeTokens()

  return (
    <View
      style={{
        gap: SPACING.md,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: SPACING.md,
        backgroundColor: colors.surface,
        padding: SPACING.lg,
      }}
    >
      {children}
    </View>
  )
}
