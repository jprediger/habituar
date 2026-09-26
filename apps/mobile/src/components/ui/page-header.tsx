import { SPACING } from '@habituar/design-tokens/spacing'
import { StyleSheet, View } from 'react-native'
import { Text } from './text'

/**
 * Abertura de uma página: rótulo de contexto acima e título grande, o único cabeçalho de
 * primeiro nível da tela. Recusa ação — botão no cabeçalho disputaria a decisão principal
 * que a página existe para oferecer.
 */
export function PageHeader({ eyebrow, title }: Readonly<{ eyebrow: string; title: string }>) {
  return (
    <View style={styles.container}>
      <Text size="caption" weight="medium" tone="primary" isEyebrow>
        {eyebrow}
      </Text>
      <Text accessibilityRole="header" size="display" weight="bold">
        {title}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm },
})
