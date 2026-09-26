import { SPACING } from '@habituar/design-tokens/spacing'
import { StyleSheet, View } from 'react-native'
import { useThemeTokens } from '../../theme/tokens'
import { Text } from './text'

/**
 * Lugar reservado para conteúdo que ainda não existe. Diz o que aparecerá ali e por que
 * ainda não aparece; recusa número, gráfico ou item de exemplo — dado inventado em tela
 * de acompanhamento é pior do que tela vazia.
 */
export function EmptyState({ title, description }: Readonly<{ title: string; description: string }>) {
  const { colors, radius } = useThemeTokens()

  return (
    <View style={[styles.container, { borderColor: colors.border, borderRadius: radius.surface }]}>
      <Text weight="medium">{title}</Text>
      <Text tone="muted">{description}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Tracejado distingue o espaço reservado de uma superfície com conteúdo, sem precisar
  // de ícone ou cor para dizê-lo.
  container: { borderWidth: 1, borderStyle: 'dashed', padding: SPACING.xl, gap: SPACING.xs },
})
