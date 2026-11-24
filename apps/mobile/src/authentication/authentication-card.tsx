import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren, ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Screen } from '../components/ui/screen'
import { Text } from '../components/ui/text'
import { BrandMark } from '../shell/brand-mark'

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
  return (
    <Screen>
      <View style={styles.intro}>
        <View style={styles.brand}>
          <BrandMark />
        </View>
        <View style={styles.headingGroup}>
          <Text accessibilityRole="header" size="display" weight="bold" isCentered>
            {heading}
          </Text>
          <Text tone="muted" isCentered>
            {description}
          </Text>
        </View>
      </View>

      <View style={styles.content}>{children}</View>
      {footer}
    </Screen>
  )
}

const styles = StyleSheet.create({
  // A marca abre a tela e o título pertence à rota: o espaço maior entre os dois evita que
  // o logo pareça parte do título, e o respiro abaixo separa a apresentação do formulário.
  intro: { gap: SPACING.xxl, paddingTop: SPACING.xxl, marginBottom: SPACING.lg },
  brand: { alignItems: 'center' },
  headingGroup: { gap: SPACING.xs },
  content: { gap: SPACING.md },
})
