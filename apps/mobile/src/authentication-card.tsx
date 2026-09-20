import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren, ReactNode } from 'react'
import type { ImageSourcePropType } from 'react-native'
import { Image, StyleSheet, View } from 'react-native'
import { Screen } from './components/ui/screen'
import { Text } from './components/ui/text'
import { useThemeTokens } from './theme/tokens'

/**
 * Moldura comum das telas de autenticação; dona do enquadramento, da marca e do título
 * da rota — não conhece formulário, estado de sessão nem qual tela está dentro dela.
 */
export function AuthenticationCard({
  heading,
  description,
  hero,
  footer,
  children,
}: PropsWithChildren<
  Readonly<{ heading: string; description: string; hero?: ImageSourcePropType; footer?: ReactNode }>
>) {
  const { radius } = useThemeTokens()

  return (
    <Screen>
      {hero !== undefined && (
        <Image
          source={hero}
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="cover"
          style={[styles.hero, { borderRadius: radius.surface }]}
        />
      )}

      <View style={[styles.intro, hero === undefined ? undefined : styles.heroIntro]}>
        <Text accessibilityRole="header" size="display" weight="bold" isCentered={hero === undefined}>
          {heading}
        </Text>
        <Text tone="muted" isCentered={hero === undefined}>
          {description}
        </Text>
      </View>

      <View style={styles.content}>{children}</View>
      {footer}
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 200 },
  intro: { gap: SPACING.xs },
  heroIntro: { marginTop: SPACING.md },
  content: { gap: SPACING.md },
})
