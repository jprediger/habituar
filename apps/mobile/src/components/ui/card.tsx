import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'

/**
 * Superfície de agrupamento visual do kit nativo; não decide o conteúdo. Preenchida e sem
 * borda: o cartão não é controle, e a borda de campo (3:1) o fazia parecer um.
 */
export function Card({ children }: PropsWithChildren) {
  const { colors, radius } = useThemeTokens()

  return (
    <View
      style={{
        gap: SPACING.md,
        borderRadius: radius.surface,
        // Separa pelo tom, como o cartão preenchido do Material 3 e o fundo agrupado do iOS.
        // Sombra ficaria de fora: some no tema escuro e é o que distingue o toast.
        backgroundColor: colors.surfaceMuted,
        padding: SPACING.lg,
      }}
    >
      {children}
    </View>
  )
}
