import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { Card } from './components/ui/card'
import { Text } from './components/ui/text'
import { Screen } from './components/ui/screen'

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

  return (
    <Screen>
      <Card>
        <View style={styles.header}>
          <Text size="caption" weight="bold" tone="muted">
            {t('authentication.brandName')}
          </Text>
          <Text accessibilityRole="header" size="title" weight="bold">
            {title}
          </Text>
          <Text size="caption" tone="muted">
            {description}
          </Text>
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
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.label}>
          <Text size="caption" tone="muted">
            {item.label}
          </Text>
          <Text>{item.value}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { gap: SPACING.xs },
  list: { gap: SPACING.sm },
})
