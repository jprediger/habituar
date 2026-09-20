import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren, ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { BrandMark } from './brand-mark'
import { Screen } from './components/ui/screen'
import { useThemeTokens } from './theme/tokens'

/**
 * Moldura comum das telas de autenticação; dona do enquadramento, da marca e do título
 * da rota — não conhece formulário, estado de sessão nem qual tela está dentro dela.
 */
export function AuthenticationCard({
  heading,
  description,
  footer,
  children,
}: PropsWithChildren<Readonly<{ heading: string; description: string; footer?: ReactNode }>>) {
  const { colors, fontSize, fontWeight, lineHeight } = useThemeTokens()

  return (
    <Screen>
      <BrandMark />

      <View style={styles.intro}>
        <Text
          accessibilityRole="header"
          style={{
            color: colors.text,
            fontSize: fontSize.display,
            fontWeight: fontWeight.bold,
            lineHeight: lineHeight.display.tight,
            textAlign: 'center',
          }}
        >
          {heading}
        </Text>
        <Text
          style={{
            color: colors.textMuted,
            fontSize: fontSize.body,
            lineHeight: lineHeight.body.normal,
            textAlign: 'center',
          }}
        >
          {description}
        </Text>
      </View>

      <View style={styles.content}>{children}</View>
      {footer}
    </Screen>
  )
}

const styles = StyleSheet.create({
  intro: { gap: SPACING.xs },
  content: { gap: SPACING.md },
})
