import { SPACING } from '@habituar/design-tokens/spacing'
import type { PropsWithChildren } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from './text'

/**
 * Bloco nomeado de uma página. O título é cabeçalho para o leitor de tela: é por ele que
 * quem navega por cabeçalhos pula de um assunto ao próximo.
 */
export function Section({ title, children }: PropsWithChildren<Readonly<{ title: string }>>) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" size="caption" weight="medium" tone="muted" isEyebrow>
        {title}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: SPACING.md },
})
