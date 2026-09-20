import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren, ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Screen } from './components/ui/screen'
import { Text } from './components/ui/text'

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
        <Text accessibilityRole="header" size="display" weight="bold" isCentered>
          {heading}
        </Text>
        <Text tone="muted" isCentered>
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
