import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from './text'

/**
 * Grupo de linhas de lista com título discreto. A separação entre grupos vem do espaço
 * da página ou de `ListDivider`, não de superfície: é o que mantém a tela sem cartões.
 * O rodapé explica o grupo inteiro, não uma linha.
 */
export function ListSection({ title, footer, children }: PropsWithChildren<Readonly<{ title?: string | undefined; footer?: string | undefined }>>) {
  return (
    <View style={styles.container}>
      {title !== undefined && <Text accessibilityRole="header" size="caption" weight="medium" tone="muted">{title}</Text>}
      <View>{children}</View>
      {footer !== undefined && <Text size="caption" tone="muted">{footer}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: SPACING.xs },
})
