import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { Card } from './components/ui/card'
import { Screen } from './components/ui/screen'
import { useThemeTokens } from './theme/tokens'

/**
 * Moldura comum das telas de ambiente: marca, título da rota, descrição e rodapé. Não
 * conhece sessão, papel nem qual ambiente está dentro dela. Sem seletor de tema — o app
 * segue `useColorScheme()`, decisão registrada em `theme/tokens.ts`.
 */
export function HomeCard({
  title,
  description,
  footer,
  children,
}: PropsWithChildren<Readonly<{ title: string; description: string; footer?: ReactNode }>>) {
  const { t } = useTranslation()
  const { colors, fontSize, fontWeight, lineHeight } = useThemeTokens()

  return (
    <Screen>
      <Card>
        <View style={styles.header}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.caption, fontWeight: fontWeight.bold }}>
            {t('authentication.brandName')}
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              color: colors.text,
              fontSize: fontSize.title,
              fontWeight: fontWeight.bold,
              lineHeight: lineHeight.title.tight,
            }}
          >
            {title}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{description}</Text>
        </View>

        {children}
        {footer}
      </Card>
    </Screen>
  )
}

export type HomeDetail = Readonly<{ label: string; value: string }>

/** Lista de pares rótulo/valor que identificam o contexto da sessão na tela. */
export function HomeDetailList({ items }: Readonly<{ items: readonly HomeDetail[] }>) {
  const { colors, fontSize } = useThemeTokens()

  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.label}>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.caption }}>{item.label}</Text>
          <Text style={{ color: colors.text, fontSize: fontSize.body }}>{item.value}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { gap: SPACING.xs },
  list: { gap: SPACING.sm },
})
